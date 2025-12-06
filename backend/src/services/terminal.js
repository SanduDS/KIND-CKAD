import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const execAsync = promisify(exec);

/**
 * Terminal container management service
 */
export const TerminalService = {
  /**
   * Create a terminal container for a session
   */
  async createContainer(clusterName, kubeconfigPath) {
    const containerName = `term-${clusterName}`;

    try {
      logger.info('Creating terminal container...', { containerName });

      // Build docker run command
      const dockerCmd = [
        'docker', 'run', '-d',
        '--name', containerName,
        '--network', 'kind',
        `--memory=${config.terminal.memoryLimit}`,
        `--cpus=${config.terminal.cpuLimit}`,
        '--pids-limit=100',
        // Mount kubeconfig
        '-v', `${kubeconfigPath}:/root/.kube/config:ro`,
        '-e', 'KUBECONFIG=/root/.kube/config',
        // Terminal settings
        '-e', 'TERM=xterm-256color',
        '-e', 'PS1=\\u@ckad:\\w\\$ ',
        // Image
        config.terminal.image,
        // Keep container running
        'sleep', 'infinity',
      ];

      const { stdout, stderr } = await execAsync(dockerCmd.join(' '), {
        timeout: 30000,
      });

      const containerId = stdout.trim();
      logger.info('Terminal container created', { containerName, containerId });

      // Wait for container to be ready
      await this.waitForContainerReady(containerName);

      return {
        success: true,
        containerName,
        containerId,
      };
    } catch (error) {
      logger.error('Failed to create terminal container', {
        containerName,
        error: error.message,
      });

      // Cleanup on failure
      await this.removeContainer(containerName).catch(() => {});

      throw new Error(`Failed to create terminal container: ${error.message}`);
    }
  },

  /**
   * Wait for container to be ready
   */
  async waitForContainerReady(containerName, maxAttempts = 10) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const { stdout } = await execAsync(
          `docker inspect -f '{{.State.Running}}' ${containerName}`,
          { timeout: 5000 }
        );

        if (stdout.trim() === 'true') {
          logger.debug('Terminal container is ready', { containerName });
          return true;
        }
      } catch (error) {
        logger.debug('Container not ready yet', { containerName, attempt });
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error('Container did not become ready in time');
  },

  /**
   * Stop and remove a terminal container
   */
  async removeContainer(containerName) {
    try {
      // Stop container (with 10 second grace period)
      try {
        await execAsync(`docker stop -t 10 ${containerName}`, { timeout: 20000 });
        logger.debug('Container stopped', { containerName });
      } catch (error) {
        // Container might already be stopped
      }

      // Remove container
      await execAsync(`docker rm -f ${containerName}`, { timeout: 10000 });
      logger.info('Terminal container removed', { containerName });

      return { success: true };
    } catch (error) {
      logger.error('Failed to remove terminal container', {
        containerName,
        error: error.message,
      });
      throw error;
    }
  },

  /**
   * Check if container exists
   */
  async containerExists(containerName) {
    try {
      await execAsync(`docker inspect ${containerName}`, { timeout: 5000 });
      return true;
    } catch (error) {
      return false;
    }
  },

  /**
   * Get container status
   */
  async getContainerStatus(containerName) {
    try {
      const { stdout } = await execAsync(
        `docker inspect -f '{{.State.Status}}' ${containerName}`,
        { timeout: 5000 }
      );
      return stdout.trim();
    } catch (error) {
      return null;
    }
  },

  /**
   * Spawn a PTY process attached to container
   * Returns the spawn process for WebSocket handling
   */
  spawnTerminal(containerName) {
    const ptyProcess = spawn('docker', ['exec', '-it', containerName, '/bin/bash'], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: process.env.HOME,
      env: process.env,
    });

    return ptyProcess;
  },

  /**
   * List all terminal containers
   */
  async listContainers() {
    try {
      const { stdout } = await execAsync(
        'docker ps --filter "name=term-" --format "{{.Names}}"',
        { timeout: 10000 }
      );
      return stdout.trim().split('\n').filter(Boolean);
    } catch (error) {
      logger.error('Failed to list terminal containers', { error: error.message });
      return [];
    }
  },

  /**
   * Execute command in terminal container
   */
  async execCommand(containerName, command, timeout = 30000) {
    try {
      const { stdout, stderr } = await execAsync(
        `docker exec ${containerName} /bin/bash -c "${command.replace(/"/g, '\\"')}"`,
        { timeout }
      );
      return { success: true, stdout, stderr };
    } catch (error) {
      logger.error('Failed to execute command in container', {
        containerName,
        command,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  },

  /**
   * Clean terminal and prepare for next question
   * Creates new namespace, makes it default, deletes previous namespace
   */
  async cleanTerminalForNextQuestion(containerName, currentQuestionNumber) {
    try {
      const newNamespace = `q${currentQuestionNumber}`;
      const previousNamespace = currentQuestionNumber > 1 ? `q${currentQuestionNumber - 1}` : null;

      logger.info('Cleaning terminal for next question', { 
        containerName, 
        currentQuestionNumber,
        newNamespace,
        previousNamespace
      });

      // Clear terminal screen
      await this.execCommand(containerName, 'clear', 5000);

      // Create new namespace
      await this.execCommand(
        containerName,
        `kubectl create namespace ${newNamespace} 2>/dev/null || true`,
        10000
      );

      // Set new namespace as default
      await this.execCommand(
        containerName,
        `kubectl config set-context --current --namespace=${newNamespace}`,
        10000
      );

      // Delete previous namespace (if exists and not default)
      if (previousNamespace && previousNamespace !== 'default') {
        await this.execCommand(
          containerName,
          `kubectl delete namespace ${previousNamespace} --ignore-not-found=true --timeout=30s`,
          35000
        );
      }

      logger.info('Terminal cleaned successfully', { 
        containerName,
        newNamespace,
        deletedNamespace: previousNamespace
      });

      return {
        success: true,
        newNamespace,
        deletedNamespace: previousNamespace,
      };
    } catch (error) {
      logger.error('Failed to clean terminal', {
        containerName,
        currentQuestionNumber,
        error: error.message,
      });
      return {
        success: false,
        error: error.message,
      };
    }
  },

  /**
   * Cleanup orphaned terminal containers
   */
  async cleanupOrphanedContainers(validContainerNames) {
    try {
      const containers = await this.listContainers();
      const orphans = containers.filter(name => !validContainerNames.includes(name));

      for (const containerName of orphans) {
        logger.info('Removing orphaned container', { containerName });
        await this.removeContainer(containerName).catch(() => {});
      }

      return orphans.length;
    } catch (error) {
      logger.error('Failed to cleanup orphaned containers', { error: error.message });
      return 0;
    }
  },
};

export default TerminalService;




import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const execAsync = promisify(exec);

/**
 * KIND cluster management service
 */
export const KindService = {
  /**
   * Generate KIND cluster config
   */
  generateConfig(clusterName, ports) {
    const { apiPort, ingressPort, ingressHttpsPort } = ports;

    return `
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: ${clusterName}
nodes:
  - role: control-plane
    extraPortMappings:
      - containerPort: 6443
        hostPort: ${apiPort}
        protocol: TCP
      - containerPort: 80
        hostPort: ${ingressPort}
        protocol: TCP
      - containerPort: 443
        hostPort: ${ingressHttpsPort}
        protocol: TCP
    kubeadmConfigPatches:
      - |
        kind: InitConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            system-reserved: memory=256Mi
            eviction-hard: memory.available<100Mi
`;
  },

  /**
   * Create a KIND cluster
   */
  async createCluster(clusterName, ports) {
    const configPath = `/tmp/kind-config-${clusterName}.yaml`;
    const kubeconfigPath = `/tmp/kubeconfig-${clusterName}`;

    try {
      // Generate and write config file
      const configContent = this.generateConfig(clusterName, ports);
      await writeFile(configPath, configContent);
      logger.info('Created KIND config file', { clusterName, configPath });

      // Create KIND cluster
      logger.info('Creating KIND cluster...', { clusterName });
      const startTime = Date.now();

      const { stdout, stderr } = await execAsync(
        `kind create cluster --name ${clusterName} --config ${configPath}`,
        { timeout: 120000 } // 2 minute timeout
      );

      const duration = Date.now() - startTime;
      logger.info('KIND cluster created', { clusterName, durationMs: duration });

      // Generate kubeconfig
      await execAsync(`kind get kubeconfig --name ${clusterName} > ${kubeconfigPath}`);
      await execAsync(`chmod 600 ${kubeconfigPath}`);
      logger.info('Generated kubeconfig', { clusterName, kubeconfigPath });

      // Validate cluster is ready
      await this.waitForClusterReady(clusterName, kubeconfigPath);

      return {
        success: true,
        clusterName,
        configPath,
        kubeconfigPath,
        duration,
      };
    } catch (error) {
      logger.error('Failed to create KIND cluster', { 
        clusterName, 
        error: error.message 
      });

      // Cleanup on failure
      await this.cleanupCluster(clusterName).catch(() => {});
      
      throw new Error(`Failed to create cluster: ${error.message}`);
    }
  },

  /**
   * Wait for cluster to be ready
   */
  async waitForClusterReady(clusterName, kubeconfigPath, maxAttempts = 30) {
    logger.info('Waiting for cluster to be ready...', { clusterName });

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const { stdout } = await execAsync(
          `KUBECONFIG=${kubeconfigPath} kubectl get nodes --request-timeout=10s`,
          { timeout: 15000 }
        );

        if (stdout.includes('Ready')) {
          logger.info('Cluster is ready', { clusterName, attempt });
          return true;
        }
      } catch (error) {
        logger.debug('Cluster not ready yet', { 
          clusterName, 
          attempt, 
          error: error.message 
        });
      }

      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error('Cluster did not become ready in time');
  },

  /**
   * Delete a KIND cluster
   */
  async deleteCluster(clusterName) {
    try {
      logger.info('Deleting KIND cluster...', { clusterName });
      
      await execAsync(`kind delete cluster --name ${clusterName}`, {
        timeout: 60000,
      });

      logger.info('KIND cluster deleted', { clusterName });
      return { success: true };
    } catch (error) {
      logger.error('Failed to delete KIND cluster', { 
        clusterName, 
        error: error.message 
      });
      throw error;
    }
  },

  /**
   * Cleanup cluster resources (config files, etc.)
   */
  async cleanupCluster(clusterName) {
    const configPath = `/tmp/kind-config-${clusterName}.yaml`;
    const kubeconfigPath = `/tmp/kubeconfig-${clusterName}`;

    try {
      // Delete KIND cluster if exists
      const clusters = await this.listClusters();
      if (clusters.includes(clusterName)) {
        await this.deleteCluster(clusterName);
      }

      // Remove config files
      if (existsSync(configPath)) {
        await unlink(configPath);
        logger.debug('Removed config file', { configPath });
      }

      if (existsSync(kubeconfigPath)) {
        await unlink(kubeconfigPath);
        logger.debug('Removed kubeconfig file', { kubeconfigPath });
      }

      return { success: true };
    } catch (error) {
      logger.error('Failed to cleanup cluster', { 
        clusterName, 
        error: error.message 
      });
      throw error;
    }
  },

  /**
   * List all KIND clusters
   */
  async listClusters() {
    try {
      const { stdout } = await execAsync('kind get clusters', { timeout: 10000 });
      return stdout.trim().split('\n').filter(name => name.length > 0);
    } catch (error) {
      // If no clusters, kind returns error
      if (error.message.includes('No kind clusters found')) {
        return [];
      }
      logger.error('Failed to list KIND clusters', { error: error.message });
      return [];
    }
  },

  /**
   * Check if a cluster exists
   */
  async clusterExists(clusterName) {
    const clusters = await this.listClusters();
    return clusters.includes(clusterName);
  },

  /**
   * Get cluster info
   */
  async getClusterInfo(clusterName, kubeconfigPath) {
    try {
      const { stdout } = await execAsync(
        `KUBECONFIG=${kubeconfigPath} kubectl cluster-info`,
        { timeout: 10000 }
      );
      return stdout;
    } catch (error) {
      logger.error('Failed to get cluster info', { 
        clusterName, 
        error: error.message 
      });
      throw error;
    }
  },
};

export default KindService;


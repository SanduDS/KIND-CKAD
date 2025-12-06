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
        { timeout: 180000 } // 3 minute timeout (increased from 2 minutes)
      );

      const duration = Date.now() - startTime;
      logger.info('KIND cluster created', { clusterName, durationMs: duration });

      // Generate kubeconfig
      await execAsync(`kind get kubeconfig --name ${clusterName} > ${kubeconfigPath}`);
      await execAsync(`chmod 600 ${kubeconfigPath}`);
      
      // Fix kubeconfig server address: replace 0.0.0.0 with 127.0.0.1
      // This is needed because the certificate is valid for 127.0.0.1, not 0.0.0.0
      const kubeconfigContent = await readFile(kubeconfigPath, 'utf8');
      const fixedKubeconfig = kubeconfigContent.replace(/https:\/\/0\.0\.0\.0:/g, 'https://127.0.0.1:');
      await writeFile(kubeconfigPath, fixedKubeconfig);
      
      logger.info('Generated and fixed kubeconfig', { clusterName, kubeconfigPath });

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
  async waitForClusterReady(clusterName, kubeconfigPath, maxAttempts = 60) {
    logger.info('Waiting for cluster to be ready...', { clusterName });

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // First check if the cluster exists
        const { stdout: clusterList } = await execAsync(
          `kind get clusters`,
          { timeout: 10000 }
        );

        if (!clusterList.includes(clusterName)) {
          logger.error('Cluster not found in kind cluster list', { clusterName });
          throw new Error('Cluster not found');
        }

        // Check node status
        const { stdout } = await execAsync(
          `KUBECONFIG=${kubeconfigPath} kubectl get nodes -o wide --request-timeout=10s`,
          { timeout: 15000 }
        );

        if (attempt <= 3 || attempt % 5 === 0) {
          logger.info('Node status check', { clusterName, attempt, stdout: stdout.substring(0, 200) });
        }

        // Check if node is Ready and not in NotReady state
        const lines = stdout.split('\n');
        const nodeLines = lines.filter(line => line.includes('control-plane'));
        
        if (nodeLines.length > 0) {
          const nodeStatus = nodeLines[0];
          if (attempt <= 3 || attempt % 5 === 0) {
            logger.info('Node line found', { clusterName, attempt, nodeStatus: nodeStatus.trim() });
          }
          
          // Check for Ready status and ensure it's not NotReady
          if (nodeStatus.includes('Ready') && !nodeStatus.includes('NotReady')) {
            logger.info('Node is ready', { clusterName, attempt, nodeStatus: nodeStatus.trim() });
            
            // Additional validation: check if system pods are running
            try {
              const { stdout: podStatus } = await execAsync(
                `KUBECONFIG=${kubeconfigPath} kubectl get pods -n kube-system --request-timeout=10s`,
                { timeout: 15000 }
              );
              
              // Count running pods
              const runningPods = (podStatus.match(/Running/g) || []).length;
              const totalPods = podStatus.split('\n').filter(line => line.trim() && !line.startsWith('NAME')).length;
              
              logger.info('System pods status', { 
                clusterName, 
                attempt,
                runningPods, 
                totalPods,
                podStatusPreview: podStatus.substring(0, 300)
              });
              
              // If we have at least a few critical pods running, consider it ready
              if (runningPods >= 3) {
                logger.info('Cluster fully ready with system pods', { clusterName, runningPods });
                return true;
              } else {
                if (attempt % 5 === 0) {
                  logger.info('Not enough pods running yet', { clusterName, attempt, runningPods, required: 3 });
                }
              }
            } catch (podError) {
              // Pods not ready yet, but node is ready - continue waiting
              if (attempt <= 3 || attempt % 5 === 0) {
                logger.info('System pods check failed', { 
                  clusterName, 
                  attempt, 
                  error: podError.message 
                });
              }
            }
          } else {
            if (attempt <= 3 || attempt % 5 === 0) {
              logger.info('Node not in Ready state', { 
                clusterName, 
                attempt, 
                nodeStatus: nodeStatus.trim() 
              });
            }
          }
        } else {
          if (attempt <= 3 || attempt % 5 === 0) {
            logger.info('No control-plane node found', { clusterName, attempt, allLines: lines.length });
          }
        }
      } catch (error) {
        if (attempt <= 3 || attempt % 10 === 0) {
          logger.info('Cluster readiness check exception', {
            clusterName, 
            attempt, 
            maxAttempts,
            error: error.message,
            errorType: error.constructor.name
          });
        }
      }

      // Log progress every 10 attempts
      if (attempt % 10 === 0) {
        logger.info('Still waiting for cluster', { 
          clusterName, 
          attempt, 
          maxAttempts, 
          timeElapsed: `${attempt * 2}s`,
          maxTime: `${maxAttempts * 2}s`
        });
      }

      // Wait before next attempt (2 seconds)
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    logger.error('Cluster readiness timeout', { 
      clusterName, 
      totalAttempts: maxAttempts, 
      totalTime: `${maxAttempts * 2}s` 
    });
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




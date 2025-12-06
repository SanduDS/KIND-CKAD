import db from './index.js';
import logger from '../utils/logger.js';

const seedTasks = () => {
  logger.info('Seeding CKAD practice tasks...');

  const tasks = [
    {
      title: 'Create a Pod',
      body: `## Task: Create a Pod

Create a pod named \`nginx-pod\` in the \`default\` namespace with the following specifications:

- Image: \`nginx:1.21\`
- Container name: \`nginx-container\`
- Labels: \`app=nginx\`, \`tier=frontend\`

### Verification

\`\`\`bash
kubectl get pod nginx-pod -o yaml
\`\`\`

The pod should be running and have the correct labels.`,
      difficulty: 'easy',
      category: 'Pods',
      verificationConfig: {
        checks: [
          {
            name: 'Pod exists',
            command: 'kubectl get pod nginx-pod -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'nginx-pod',
            points: 2,
          },
          {
            name: 'Pod is running',
            command: 'kubectl get pod nginx-pod -o jsonpath=\'{.status.phase}\'',
            type: 'contains',
            expected: 'Running',
            points: 2,
          },
          {
            name: 'Correct image',
            command: 'kubectl get pod nginx-pod -o jsonpath=\'{.spec.containers[0].image}\'',
            type: 'contains',
            expected: 'nginx:1.21',
            points: 2,
          },
          {
            name: 'Container name correct',
            command: 'kubectl get pod nginx-pod -o jsonpath=\'{.spec.containers[0].name}\'',
            type: 'contains',
            expected: 'nginx-container',
            points: 2,
          },
          {
            name: 'Labels present',
            command: 'kubectl get pod nginx-pod -o jsonpath=\'{.metadata.labels.app},{.metadata.labels.tier}\'',
            type: 'contains',
            expected: 'nginx,frontend',
            points: 2,
          },
        ],
      },
      maxScore: 10,
    },
    {
      title: 'Create a Deployment with Replicas',
      body: `## Task: Create a Deployment

Create a deployment named \`web-app\` with the following specifications:

- Namespace: \`default\`
- Image: \`httpd:2.4\`
- Replicas: 3
- Labels: \`app=web-app\`
- Container port: 80

### Verification

\`\`\`bash
kubectl get deployment web-app
kubectl get pods -l app=web-app
\`\`\`

All 3 replicas should be running.`,
      difficulty: 'easy',
      category: 'Deployments',
      verificationConfig: {
        checks: [
          {
            name: 'Deployment exists',
            command: 'kubectl get deployment web-app -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'web-app',
            points: 2,
          },
          {
            name: 'Correct replicas',
            command: 'kubectl get deployment web-app -o jsonpath=\'{.spec.replicas}\'',
            type: 'contains',
            expected: '3',
            points: 2,
          },
          {
            name: 'Correct image',
            command: 'kubectl get deployment web-app -o jsonpath=\'{.spec.template.spec.containers[0].image}\'',
            type: 'contains',
            expected: 'httpd:2.4',
            points: 2,
          },
          {
            name: 'All replicas ready',
            command: 'kubectl get deployment web-app -o jsonpath=\'{.status.readyReplicas}\'',
            type: 'contains',
            expected: '3',
            points: 4,
          },
        ],
      },
      maxScore: 10,
    },
    {
      title: 'Create a ClusterIP Service',
      body: `## Task: Create a ClusterIP Service

Create a ClusterIP service named \`web-service\` that exposes the \`web-app\` deployment:

- Service port: 80
- Target port: 80
- Selector: \`app=web-app\`

### Verification

\`\`\`bash
kubectl get svc web-service
kubectl describe svc web-service
\`\`\`

The service should have endpoints pointing to the web-app pods.`,
      difficulty: 'easy',
      category: 'Services',
    },
    {
      title: 'Configure a ConfigMap',
      body: `## Task: Create and Use a ConfigMap

1. Create a ConfigMap named \`app-config\` with the following data:
   - \`DATABASE_HOST=mysql.default.svc\`
   - \`LOG_LEVEL=info\`

2. Create a pod named \`config-pod\` using image \`busybox:1.36\` that:
   - Uses the ConfigMap as environment variables
   - Runs command: \`sleep 3600\`

### Verification

\`\`\`bash
kubectl exec config-pod -- env | grep -E "DATABASE_HOST|LOG_LEVEL"
\`\`\``,
      difficulty: 'medium',
      category: 'Configuration',
    },
    {
      title: 'Create a Secret and Mount It',
      body: `## Task: Create and Mount a Secret

1. Create a Secret named \`db-credentials\` with:
   - \`username=admin\`
   - \`password=supersecret123\`

2. Create a pod named \`secret-pod\` using image \`nginx:1.21\` that mounts the secret at \`/etc/secrets\`

### Verification

\`\`\`bash
kubectl exec secret-pod -- cat /etc/secrets/username
kubectl exec secret-pod -- cat /etc/secrets/password
\`\`\``,
      difficulty: 'medium',
      category: 'Configuration',
    },
    {
      title: 'Resource Limits and Requests',
      body: `## Task: Configure Resource Limits

Create a pod named \`limited-pod\` with the following specifications:

- Image: \`nginx:1.21\`
- Memory request: 64Mi
- Memory limit: 128Mi
- CPU request: 100m
- CPU limit: 200m

### Verification

\`\`\`bash
kubectl get pod limited-pod -o jsonpath='{.spec.containers[0].resources}'
\`\`\``,
      difficulty: 'medium',
      category: 'Pods',
    },
    {
      title: 'Create a CronJob',
      body: `## Task: Create a CronJob

Create a CronJob named \`backup-job\` that:

- Runs every 5 minutes (\`*/5 * * * *\`)
- Uses image: \`busybox:1.36\`
- Command: \`echo "Backup completed at $(date)"\`
- Keep 3 successful job history
- Keep 1 failed job history

### Verification

\`\`\`bash
kubectl get cronjob backup-job
kubectl get jobs --selector=job-name=backup-job
\`\`\``,
      difficulty: 'medium',
      category: 'Jobs',
    },
    {
      title: 'Rolling Update Strategy',
      body: `## Task: Configure Rolling Update

1. Create a deployment named \`rolling-app\` with:
   - Image: \`nginx:1.20\`
   - Replicas: 4
   - maxSurge: 1
   - maxUnavailable: 1

2. Update the deployment to use \`nginx:1.21\` and observe the rolling update

### Verification

\`\`\`bash
kubectl rollout status deployment/rolling-app
kubectl rollout history deployment/rolling-app
\`\`\``,
      difficulty: 'medium',
      category: 'Deployments',
    },
    {
      title: 'Liveness and Readiness Probes',
      body: `## Task: Configure Health Probes

Create a pod named \`probed-app\` with:

- Image: \`nginx:1.21\`
- Liveness probe: HTTP GET on port 80, path /, every 10 seconds
- Readiness probe: HTTP GET on port 80, path /, every 5 seconds
- Initial delay: 5 seconds for both probes

### Verification

\`\`\`bash
kubectl describe pod probed-app | grep -A5 "Liveness"
kubectl describe pod probed-app | grep -A5 "Readiness"
\`\`\``,
      difficulty: 'medium',
      category: 'Pods',
    },
    {
      title: 'Network Policy',
      body: `## Task: Create a Network Policy

Create a NetworkPolicy named \`api-network-policy\` in the \`default\` namespace that:

1. Applies to pods with label \`app=api\`
2. Allows ingress traffic only from pods with label \`app=frontend\`
3. Allows ingress on port 8080

First, create a test pod:
\`\`\`bash
kubectl run api-pod --image=nginx --labels=app=api --port=8080
\`\`\`

### Verification

\`\`\`bash
kubectl get networkpolicy api-network-policy -o yaml
\`\`\``,
      difficulty: 'hard',
      category: 'Networking',
    },
    {
      title: 'PersistentVolumeClaim',
      body: `## Task: Create and Use a PVC

1. Create a PersistentVolumeClaim named \`data-pvc\`:
   - Storage: 1Gi
   - Access mode: ReadWriteOnce
   - StorageClass: standard (or default)

2. Create a pod named \`pvc-pod\` that:
   - Uses image \`nginx:1.21\`
   - Mounts the PVC at \`/data\`

### Verification

\`\`\`bash
kubectl get pvc data-pvc
kubectl exec pvc-pod -- df -h /data
\`\`\``,
      difficulty: 'medium',
      category: 'Storage',
    },
    {
      title: 'Multi-container Pod (Sidecar)',
      body: `## Task: Create a Multi-container Pod

Create a pod named \`sidecar-pod\` with two containers:

**Container 1 (main):**
- Name: \`app\`
- Image: \`nginx:1.21\`
- Mount a shared volume at \`/usr/share/nginx/html\`

**Container 2 (sidecar):**
- Name: \`content-generator\`
- Image: \`busybox:1.36\`
- Command: \`while true; do date >> /html/index.html; sleep 5; done\`
- Mount the same shared volume at \`/html\`

### Verification

\`\`\`bash
kubectl exec sidecar-pod -c app -- cat /usr/share/nginx/html/index.html
\`\`\``,
      difficulty: 'hard',
      category: 'Pods',
    },
    {
      title: 'Ingress Resource',
      body: `## Task: Create an Ingress

1. First, ensure you have a service:
\`\`\`bash
kubectl create deployment web --image=nginx
kubectl expose deployment web --port=80
\`\`\`

2. Create an Ingress named \`web-ingress\` that:
   - Routes traffic for host \`web.example.com\`
   - Path \`/\` routes to service \`web\` on port 80

### Verification

\`\`\`bash
kubectl get ingress web-ingress
kubectl describe ingress web-ingress
\`\`\``,
      difficulty: 'medium',
      category: 'Networking',
    },
    {
      title: 'ServiceAccount and RBAC',
      body: `## Task: Configure RBAC

1. Create a ServiceAccount named \`pod-reader-sa\`

2. Create a Role named \`pod-reader\` that allows:
   - get, list, watch on pods

3. Create a RoleBinding named \`pod-reader-binding\` that binds the role to the service account

4. Create a pod named \`sa-pod\` using the service account

### Verification

\`\`\`bash
kubectl auth can-i get pods --as=system:serviceaccount:default:pod-reader-sa
\`\`\``,
      difficulty: 'hard',
      category: 'Security',
    },
    {
      title: 'Horizontal Pod Autoscaler',
      body: `## Task: Create an HPA

1. Create a deployment named \`php-apache\`:
\`\`\`bash
kubectl create deployment php-apache --image=registry.k8s.io/hpa-example --requests=cpu=200m
kubectl expose deployment php-apache --port=80
\`\`\`

2. Create an HPA named \`php-apache-hpa\`:
   - Target CPU utilization: 50%
   - Min replicas: 1
   - Max replicas: 10

### Verification

\`\`\`bash
kubectl get hpa php-apache-hpa
kubectl describe hpa php-apache-hpa
\`\`\``,
      difficulty: 'hard',
      category: 'Scaling',
    },
    {
      title: 'Create a Job',
      body: `## Task: Create a Job

Create a Job named \`pi-calculator\` in the \`default\` namespace with the following specifications:

- Image: \`perl:5.34\`
- Command: \`["perl", "-Mbignum=bpi", "-wle", "print bpi(2000)"]\`
- Completions: 3
- Parallelism: 2
- Backoff limit: 4

### Verification

\`\`\`bash
kubectl get job pi-calculator
kubectl get pods -l job-name=pi-calculator
kubectl logs <pod-name>
\`\`\`

The job should complete successfully with 3 completions.`,
      difficulty: 'medium',
      category: 'Jobs',
    },
    {
      title: 'Update Deployment Image',
      body: `## Task: Update Deployment Image

A deployment named \`web-app\` exists in the \`default\` namespace running image \`nginx:1.20\`.

Update the deployment to use image \`nginx:1.21\` and record the change.

### Verification

\`\`\`bash
kubectl describe deployment web-app | grep Image
kubectl rollout history deployment web-app
\`\`\`

The deployment should be running nginx:1.21 and the rollout history should show the change.`,
      difficulty: 'easy',
      category: 'Deployments',
    },
    {
      title: 'Create NodePort Service',
      body: `## Task: Create NodePort Service

Create a NodePort service named \`web-nodeport\` in the \`default\` namespace with the following specifications:

- Selector: \`app=web\`
- Port: 80
- Target port: 8080
- NodePort: 30080
- Protocol: TCP

### Verification

\`\`\`bash
kubectl get svc web-nodeport
kubectl describe svc web-nodeport
\`\`\`

The service should expose port 30080 on all nodes.`,
      difficulty: 'medium',
      category: 'Services',
    },
    {
      title: 'Create DaemonSet',
      body: `## Task: Create DaemonSet

Create a DaemonSet named \`log-collector\` in the \`kube-system\` namespace with the following specifications:

- Image: \`fluentd:v1.14\`
- Container name: \`fluentd\`
- Mount host path \`/var/log\` to container path \`/var/log\`
- Labels: \`app=log-collector\`

### Verification

\`\`\`bash
kubectl get daemonset log-collector -n kube-system
kubectl get pods -n kube-system -l app=log-collector
\`\`\`

The DaemonSet should have one pod running on each node.`,
      difficulty: 'medium',
      category: 'DaemonSets',
    },
    {
      title: 'Troubleshoot Pod Failure',
      body: `## Task: Troubleshoot Pod Failure

A pod named \`broken-app\` in the \`default\` namespace is in CrashLoopBackOff state.

Investigate and fix the issue. The pod should:
- Use image: \`busybox:1.35\`
- Run command: \`["sh", "-c", "echo Hello from the broken app && sleep 3600"]\`

### Steps

1. Check pod status and logs
2. Identify the issue
3. Fix the pod configuration
4. Verify the pod is running

### Verification

\`\`\`bash
kubectl get pod broken-app
kubectl logs broken-app
\`\`\`

The pod should be in Running state and logs should show "Hello from the broken app".`,
      difficulty: 'hard',
      category: 'Troubleshooting',
    },
  ];

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO tasks (title, body, difficulty, category, verification_config, max_score)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((tasks) => {
    for (const task of tasks) {
      insertStmt.run(
        task.title, 
        task.body, 
        task.difficulty, 
        task.category,
        task.verificationConfig ? JSON.stringify(task.verificationConfig) : null,
        task.maxScore || 10
      );
    }
  });

  insertMany(tasks);
  logger.info(`Seeded ${tasks.length} CKAD practice tasks`);
};

// Run seed
seedTasks();

logger.info('Database seeding completed');
process.exit(0);




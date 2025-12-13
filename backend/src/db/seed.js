import db from './index.js';
import logger from '../utils/logger.js';

const seedTasks = () => {
  logger.info('Seeding CKAD practice tasks...');

  const tasks = [
    {
      title: 'Create a Pod',
      body: `## Task: Create a Pod

Create a pod named \`nginx-pod\` with the following specifications:

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
      verificationConfig: {
        checks: [
          {
            name: 'Service exists',
            command: 'kubectl get svc web-service -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'web-service',
            points: 2,
          },
          {
            name: 'Service type is ClusterIP',
            command: 'kubectl get svc web-service -o jsonpath=\'{.spec.type}\'',
            type: 'contains',
            expected: 'ClusterIP',
            points: 2,
          },
          {
            name: 'Service port is 80',
            command: 'kubectl get svc web-service -o jsonpath=\'{.spec.ports[0].port}\'',
            type: 'contains',
            expected: '80',
            points: 2,
          },
          {
            name: 'Selector matches web-app',
            command: 'kubectl get svc web-service -o jsonpath=\'{.spec.selector.app}\'',
            type: 'contains',
            expected: 'web-app',
            points: 2,
          },
          {
            name: 'Service has endpoints',
            command: 'kubectl get endpoints web-service -o jsonpath=\'{.subsets[0].addresses[0].ip}\'',
            type: 'regex',
            expected: '^\\s*\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\s*$',
            points: 2,
          },
        ],
      },
      maxScore: 10,
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
      verificationConfig: {
        checks: [
          {
            name: 'ConfigMap exists',
            command: 'kubectl get configmap app-config -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'app-config',
            points: 2,
          },
          {
            name: 'ConfigMap has DATABASE_HOST',
            command: 'kubectl get configmap app-config -o jsonpath=\'{.data.DATABASE_HOST}\'',
            type: 'contains',
            expected: 'mysql.default.svc',
            points: 2,
          },
          {
            name: 'ConfigMap has LOG_LEVEL',
            command: 'kubectl get configmap app-config -o jsonpath=\'{.data.LOG_LEVEL}\'',
            type: 'contains',
            expected: 'info',
            points: 2,
          },
          {
            name: 'Pod exists and running',
            command: 'kubectl get pod config-pod -o jsonpath=\'{.status.phase}\'',
            type: 'contains',
            expected: 'Running',
            points: 2,
          },
          {
            name: 'Pod has DATABASE_HOST env var',
            command: 'kubectl exec config-pod -- env | grep DATABASE_HOST',
            type: 'contains',
            expected: 'mysql.default.svc',
            points: 2,
          },
        ],
      },
      maxScore: 10,
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
      verificationConfig: {
        checks: [
          {
            name: 'Secret exists',
            command: 'kubectl get secret db-credentials -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'db-credentials',
            points: 2,
          },
          {
            name: 'Pod exists and running',
            command: 'kubectl get pod secret-pod -o jsonpath=\'{.status.phase}\'',
            type: 'contains',
            expected: 'Running',
            points: 2,
          },
          {
            name: 'Secret mounted - username',
            command: 'kubectl exec secret-pod -- cat /etc/secrets/username',
            type: 'contains',
            expected: 'admin',
            points: 3,
          },
          {
            name: 'Secret mounted - password',
            command: 'kubectl exec secret-pod -- cat /etc/secrets/password',
            type: 'contains',
            expected: 'supersecret123',
            points: 3,
          },
        ],
      },
      maxScore: 10,
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
      verificationConfig: {
        checks: [
          {
            name: 'Pod exists',
            command: 'kubectl get pod limited-pod -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'limited-pod',
            points: 2,
          },
          {
            name: 'Memory request set',
            command: 'kubectl get pod limited-pod -o jsonpath=\'{.spec.containers[0].resources.requests.memory}\'',
            type: 'contains',
            expected: '64Mi',
            points: 2,
          },
          {
            name: 'Memory limit set',
            command: 'kubectl get pod limited-pod -o jsonpath=\'{.spec.containers[0].resources.limits.memory}\'',
            type: 'contains',
            expected: '128Mi',
            points: 2,
          },
          {
            name: 'CPU request set',
            command: 'kubectl get pod limited-pod -o jsonpath=\'{.spec.containers[0].resources.requests.cpu}\'',
            type: 'contains',
            expected: '100m',
            points: 2,
          },
          {
            name: 'CPU limit set',
            command: 'kubectl get pod limited-pod -o jsonpath=\'{.spec.containers[0].resources.limits.cpu}\'',
            type: 'contains',
            expected: '200m',
            points: 2,
          },
        ],
      },
      maxScore: 10,
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
      verificationConfig: {
        checks: [
          {
            name: 'CronJob exists',
            command: 'kubectl get cronjob backup-job -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'backup-job',
            points: 2,
          },
          {
            name: 'Correct schedule',
            command: 'kubectl get cronjob backup-job -o jsonpath=\'{.spec.schedule}\'',
            type: 'contains',
            expected: '*/5 * * * *',
            points: 2,
          },
          {
            name: 'Successful history limit',
            command: 'kubectl get cronjob backup-job -o jsonpath=\'{.spec.successfulJobsHistoryLimit}\'',
            type: 'contains',
            expected: '3',
            points: 3,
          },
          {
            name: 'Failed history limit',
            command: 'kubectl get cronjob backup-job -o jsonpath=\'{.spec.failedJobsHistoryLimit}\'',
            type: 'contains',
            expected: '1',
            points: 3,
          },
        ],
      },
      maxScore: 10,
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
      verificationConfig: {
        checks: [
          {
            name: 'Deployment exists',
            command: 'kubectl get deployment rolling-app -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'rolling-app',
            points: 2,
          },
          {
            name: 'Image updated to nginx:1.21',
            command: 'kubectl get deployment rolling-app -o jsonpath=\'{.spec.template.spec.containers[0].image}\'',
            type: 'contains',
            expected: 'nginx:1.21',
            points: 2,
          },
          {
            name: 'MaxSurge is 1',
            command: 'kubectl get deployment rolling-app -o jsonpath=\'{.spec.strategy.rollingUpdate.maxSurge}\'',
            type: 'contains',
            expected: '1',
            points: 2,
          },
          {
            name: 'MaxUnavailable is 1',
            command: 'kubectl get deployment rolling-app -o jsonpath=\'{.spec.strategy.rollingUpdate.maxUnavailable}\'',
            type: 'contains',
            expected: '1',
            points: 2,
          },
          {
            name: 'Rollout recorded in history',
            command: 'kubectl rollout history deployment/rolling-app --revision=2 | grep -q "nginx:1.21" && echo "true" || echo "false"',
            type: 'contains',
            expected: 'true',
            points: 2,
          },
        ],
      },
      maxScore: 10,
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
      verificationConfig: {
        checks: [
          {
            name: 'Pod exists and running',
            command: 'kubectl get pod probed-app -o jsonpath=\'{.status.phase}\'',
            type: 'contains',
            expected: 'Running',
            points: 2,
          },
          {
            name: 'Liveness probe configured',
            command: 'kubectl get pod probed-app -o jsonpath=\'{.spec.containers[0].livenessProbe.httpGet.port}\'',
            type: 'contains',
            expected: '80',
            points: 2,
          },
          {
            name: 'Liveness probe period',
            command: 'kubectl get pod probed-app -o jsonpath=\'{.spec.containers[0].livenessProbe.periodSeconds}\'',
            type: 'contains',
            expected: '10',
            points: 2,
          },
          {
            name: 'Readiness probe configured',
            command: 'kubectl get pod probed-app -o jsonpath=\'{.spec.containers[0].readinessProbe.httpGet.port}\'',
            type: 'contains',
            expected: '80',
            points: 2,
          },
          {
            name: 'Readiness probe period',
            command: 'kubectl get pod probed-app -o jsonpath=\'{.spec.containers[0].readinessProbe.periodSeconds}\'',
            type: 'contains',
            expected: '5',
            points: 2,
          },
        ],
      },
      maxScore: 10,
    },
    {
      title: 'Network Policy',
      body: `## Task: Create a Network Policy

Create a NetworkPolicy named \`api-network-policy\` that:

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
      verificationConfig: {
        checks: [
          {
            name: 'NetworkPolicy exists',
            command: 'kubectl get networkpolicy api-network-policy -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'api-network-policy',
            points: 2,
          },
          {
            name: 'Pod selector correct',
            command: 'kubectl get networkpolicy api-network-policy -o jsonpath=\'{.spec.podSelector.matchLabels.app}\'',
            type: 'contains',
            expected: 'api',
            points: 3,
          },
          {
            name: 'Ingress from frontend',
            command: 'kubectl get networkpolicy api-network-policy -o jsonpath=\'{.spec.ingress[0].from[0].podSelector.matchLabels.app}\'',
            type: 'contains',
            expected: 'frontend',
            points: 3,
          },
          {
            name: 'Ingress port 8080',
            command: 'kubectl get networkpolicy api-network-policy -o jsonpath=\'{.spec.ingress[0].ports[0].port}\'',
            type: 'contains',
            expected: '8080',
            points: 2,
          },
        ],
      },
      maxScore: 10,
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
      verificationConfig: {
        checks: [
          {
            name: 'PVC exists',
            command: 'kubectl get pvc data-pvc -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'data-pvc',
            points: 2,
          },
          {
            name: 'PVC size is 1Gi',
            command: 'kubectl get pvc data-pvc -o jsonpath=\'{.spec.resources.requests.storage}\'',
            type: 'contains',
            expected: '1Gi',
            points: 2,
          },
          {
            name: 'Access mode ReadWriteOnce',
            command: 'kubectl get pvc data-pvc -o jsonpath=\'{.spec.accessModes[0]}\'',
            type: 'contains',
            expected: 'ReadWriteOnce',
            points: 2,
          },
          {
            name: 'Pod exists and running',
            command: 'kubectl get pod pvc-pod -o jsonpath=\'{.status.phase}\'',
            type: 'contains',
            expected: 'Running',
            points: 2,
          },
          {
            name: 'PVC mounted in pod',
            command: 'kubectl get pod pvc-pod -o jsonpath=\'{.spec.volumes[0].persistentVolumeClaim.claimName}\'',
            type: 'contains',
            expected: 'data-pvc',
            points: 2,
          },
        ],
      },
      maxScore: 10,
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
      verificationConfig: {
        checks: [
          {
            name: 'Pod exists',
            command: 'kubectl get pod sidecar-pod -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'sidecar-pod',
            points: 2,
          },
          {
            name: 'Two containers running',
            command: 'kubectl get pod sidecar-pod -o jsonpath=\'{.status.containerStatuses[*].name}\'',
            type: 'contains',
            expected: 'app',
            points: 2,
          },
          {
            name: 'Sidecar container exists',
            command: 'kubectl get pod sidecar-pod -o jsonpath=\'{.status.containerStatuses[*].name}\'',
            type: 'contains',
            expected: 'content-generator',
            points: 2,
          },
          {
            name: 'App container running',
            command: 'kubectl get pod sidecar-pod -o jsonpath=\'{.status.containerStatuses[?(@.name=="app")].ready}\'',
            type: 'contains',
            expected: 'true',
            points: 2,
          },
          {
            name: 'Sidecar container running',
            command: 'kubectl get pod sidecar-pod -o jsonpath=\'{.status.containerStatuses[?(@.name=="content-generator")].ready}\'',
            type: 'contains',
            expected: 'true',
            points: 2,
          },
        ],
      },
      maxScore: 10,
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
      verificationConfig: {
        checks: [
          {
            name: 'Ingress exists',
            command: 'kubectl get ingress web-ingress -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'web-ingress',
            points: 2,
          },
          {
            name: 'Host configured',
            command: 'kubectl get ingress web-ingress -o jsonpath=\'{.spec.rules[0].host}\'',
            type: 'contains',
            expected: 'web.example.com',
            points: 3,
          },
          {
            name: 'Backend service is web',
            command: 'kubectl get ingress web-ingress -o jsonpath=\'{.spec.rules[0].http.paths[0].backend.service.name}\'',
            type: 'contains',
            expected: 'web',
            points: 3,
          },
          {
            name: 'Service port is 80',
            command: 'kubectl get ingress web-ingress -o jsonpath=\'{.spec.rules[0].http.paths[0].backend.service.port.number}\'',
            type: 'contains',
            expected: '80',
            points: 2,
          },
        ],
      },
      maxScore: 10,
    },
    {
      title: 'ServiceAccount and RBAC',
      body: `## Task: Configure RBAC

1. Create a ServiceAccount named \`pod-reader-sa\`

2. Create a Role named \`pod-reader\` that allows:
   - get, list, watch on pods

3. Create a RoleBinding named \`pod-reader-binding\` that binds the role to the service account

4. Create a pod named \`sa-pod\` that uses the service account:
   - Image: \`nginx:1.21\`
   - ServiceAccount: \`pod-reader-sa\`

### Verification

\`\`\`bash
kubectl get sa pod-reader-sa
kubectl get role pod-reader
kubectl get rolebinding pod-reader-binding
kubectl get pod sa-pod
\`\`\``,
      difficulty: 'hard',
      category: 'Security',
      verificationConfig: {
        checks: [
          {
            name: 'ServiceAccount exists',
            command: 'kubectl get serviceaccount pod-reader-sa -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'pod-reader-sa',
            points: 2,
          },
          {
            name: 'Role exists',
            command: 'kubectl get role pod-reader -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'pod-reader',
            points: 1,
          },
          {
            name: 'RoleBinding exists',
            command: 'kubectl get rolebinding pod-reader-binding -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'pod-reader-binding',
            points: 2,
          },
          {
            name: 'RoleBinding references correct SA',
            command: 'kubectl get rolebinding pod-reader-binding -o jsonpath=\'{.subjects[0].name}\'',
            type: 'contains',
            expected: 'pod-reader-sa',
            points: 2,
          },
          {
            name: 'Pod uses correct ServiceAccount',
            command: 'kubectl get pod sa-pod -o jsonpath=\'{.spec.serviceAccountName}\'',
            type: 'contains',
            expected: 'pod-reader-sa',
            points: 2,
          },
          {
            name: 'Pod is running',
            command: 'kubectl get pod sa-pod -o jsonpath=\'{.status.phase}\'',
            type: 'contains',
            expected: 'Running',
            points: 1,
          },
        ],
      },
      maxScore: 10,
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
      verificationConfig: {
        checks: [
          {
            name: 'HPA exists',
            command: 'kubectl get hpa php-apache-hpa -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'php-apache-hpa',
            points: 2,
          },
          {
            name: 'Min replicas is 1',
            command: 'kubectl get hpa php-apache-hpa -o jsonpath=\'{.spec.minReplicas}\'',
            type: 'contains',
            expected: '1',
            points: 2,
          },
          {
            name: 'Max replicas is 10',
            command: 'kubectl get hpa php-apache-hpa -o jsonpath=\'{.spec.maxReplicas}\'',
            type: 'contains',
            expected: '10',
            points: 2,
          },
          {
            name: 'Target CPU is 50%',
            command: 'kubectl get hpa php-apache-hpa -o jsonpath=\'{.spec.metrics[0].resource.target.averageUtilization}\'',
            type: 'contains',
            expected: '50',
            points: 2,
          },
          {
            name: 'Targets deployment php-apache',
            command: 'kubectl get hpa php-apache-hpa -o jsonpath=\'{.spec.scaleTargetRef.name}\'',
            type: 'contains',
            expected: 'php-apache',
            points: 2,
          },
        ],
      },
      maxScore: 10,
    },
    {
      title: 'Create a Job',
      body: `## Task: Create a Job

Create a Job named \`pi-calculator\` with the following specifications:

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
      verificationConfig: {
        checks: [
          {
            name: 'Job exists',
            command: 'kubectl get job pi-calculator -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'pi-calculator',
            points: 2,
          },
          {
            name: 'Completions set to 3',
            command: 'kubectl get job pi-calculator -o jsonpath=\'{.spec.completions}\'',
            type: 'contains',
            expected: '3',
            points: 2,
          },
          {
            name: 'Parallelism set to 2',
            command: 'kubectl get job pi-calculator -o jsonpath=\'{.spec.parallelism}\'',
            type: 'contains',
            expected: '2',
            points: 2,
          },
          {
            name: 'Backoff limit set to 4',
            command: 'kubectl get job pi-calculator -o jsonpath=\'{.spec.backoffLimit}\'',
            type: 'contains',
            expected: '4',
            points: 2,
          },
          {
            name: 'Job completed successfully',
            command: 'kubectl get job pi-calculator -o jsonpath=\'{.status.succeeded}\'',
            type: 'contains',
            expected: '3',
            points: 2,
          },
        ],
      },
      maxScore: 10,
    },
    {
      title: 'Update Deployment Image',
      body: `## Task: Update Deployment Image

A deployment named \`web-app\` exists running image \`nginx:1.20\`.

Update the deployment to use image \`nginx:1.21\` and record the change.

### Verification

\`\`\`bash
kubectl describe deployment web-app | grep Image
kubectl rollout history deployment web-app
\`\`\`

The deployment should be running nginx:1.21 and the rollout history should show the change.`,
      difficulty: 'easy',
      category: 'Deployments',
      setupScript: 'kubectl create deployment web-app --image=nginx:1.20 --replicas=3',
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
            name: 'Image updated to nginx:1.21',
            command: 'kubectl get deployment web-app -o jsonpath=\'{.spec.template.spec.containers[0].image}\'',
            type: 'contains',
            expected: 'nginx:1.21',
            points: 4,
          },
          {
            name: 'Rollout history recorded',
            command: 'kubectl rollout history deployment web-app | wc -l',
            type: 'contains',
            expected: '2',
            points: 2,
          },
          {
            name: 'All replicas updated',
            command: 'kubectl get deployment web-app -o jsonpath=\'{.status.updatedReplicas}\'',
            type: 'regex',
            expected: '^\\s*[1-9][0-9]*\\s*$',
            points: 2,
          },
        ],
      },
      maxScore: 10,
    },
    {
      title: 'Create NodePort Service',
      body: `## Task: Create NodePort Service

Create a NodePort service named \`web-nodeport\` with the following specifications:

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
      verificationConfig: {
        checks: [
          {
            name: 'Service exists',
            command: 'kubectl get svc web-nodeport -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'web-nodeport',
            points: 2,
          },
          {
            name: 'Service type is NodePort',
            command: 'kubectl get svc web-nodeport -o jsonpath=\'{.spec.type}\'',
            type: 'contains',
            expected: 'NodePort',
            points: 2,
          },
          {
            name: 'NodePort is 30080',
            command: 'kubectl get svc web-nodeport -o jsonpath=\'{.spec.ports[0].nodePort}\'',
            type: 'contains',
            expected: '30080',
            points: 2,
          },
          {
            name: 'Port is 80',
            command: 'kubectl get svc web-nodeport -o jsonpath=\'{.spec.ports[0].port}\'',
            type: 'contains',
            expected: '80',
            points: 2,
          },
          {
            name: 'Selector matches app=web',
            command: 'kubectl get svc web-nodeport -o jsonpath=\'{.spec.selector.app}\'',
            type: 'contains',
            expected: 'web',
            points: 2,
          },
        ],
      },
      maxScore: 10,
    },
    {
      title: 'Create DaemonSet',
      body: `## Task: Create DaemonSet

Create a DaemonSet named \`log-collector\` in the \`kube-system\` namespace with the following specifications:

- Image: \`fluentd:v1.14-1\`
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
      verificationConfig: {
        checks: [
          {
            name: 'DaemonSet exists in kube-system',
            command: 'kubectl get daemonset log-collector -n kube-system -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'log-collector',
            points: 2,
          },
          {
            name: 'Correct image',
            command: 'kubectl get daemonset log-collector -n kube-system -o jsonpath=\'{.spec.template.spec.containers[0].image}\'',
            type: 'contains',
            expected: 'fluentd:v1.14-1',
            points: 2,
          },
          {
            name: 'Container name is fluentd',
            command: 'kubectl get daemonset log-collector -n kube-system -o jsonpath=\'{.spec.template.spec.containers[0].name}\'',
            type: 'contains',
            expected: 'fluentd',
            points: 2,
          },
          {
            name: 'Volume mount configured',
            command: 'kubectl get daemonset log-collector -n kube-system -o jsonpath=\'{.spec.template.spec.containers[0].volumeMounts[0].mountPath}\'',
            type: 'contains',
            expected: '/var/log',
            points: 2,
          },
          {
            name: 'Pods running',
            command: 'kubectl get pods -n kube-system -l app=log-collector -o jsonpath=\'{.items[0].status.phase}\'',
            type: 'contains',
            expected: 'Running',
            points: 2,
          },
        ],
      },
      maxScore: 10,
    },
    {
      title: 'Troubleshoot Pod Failure',
      body: `## Task: Troubleshoot Pod Failure

A pod named \`broken-app\` is in CrashLoopBackOff state.

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
      verificationConfig: {
        checks: [
          {
            name: 'Pod exists',
            command: 'kubectl get pod broken-app -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'broken-app',
            points: 2,
          },
          {
            name: 'Pod is running',
            command: 'kubectl get pod broken-app -o jsonpath=\'{.status.phase}\'',
            type: 'contains',
            expected: 'Running',
            points: 3,
          },
          {
            name: 'Correct image',
            command: 'kubectl get pod broken-app -o jsonpath=\'{.spec.containers[0].image}\'',
            type: 'contains',
            expected: 'busybox:1.35',
            points: 2,
          },
          {
            name: 'Correct command configured',
            command: 'kubectl get pod broken-app -o jsonpath=\'{.spec.containers[0].command[0]}\'',
            type: 'contains',
            expected: 'sh',
            points: 3,
          },
        ],
      },
      maxScore: 10,
    },
    {
      title: 'Create a Namespace',
      body: `## Task: Create a Namespace

Create a namespace named \`dev-team\` with the following labels:
- \`environment=development\`
- \`team=backend\`

### Verification

\`\`\`bash
kubectl get namespace dev-team
kubectl describe namespace dev-team
\`\`\``,
      difficulty: 'easy',
      category: 'Namespaces',
      verificationConfig: {
        checks: [
          {
            name: 'Namespace exists',
            command: 'kubectl get namespace dev-team -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'dev-team',
            points: 3,
          },
          {
            name: 'Environment label set',
            command: 'kubectl get namespace dev-team -o jsonpath=\'{.metadata.labels.environment}\'',
            type: 'contains',
            expected: 'development',
            points: 3,
          },
          {
            name: 'Team label set',
            command: 'kubectl get namespace dev-team -o jsonpath=\'{.metadata.labels.team}\'',
            type: 'contains',
            expected: 'backend',
            points: 4,
          },
        ],
      },
      maxScore: 10,
    },
    {
      title: 'EmptyDir Volume for Pod Communication',
      body: `## Task: Create Pod with EmptyDir Volume

Create a pod named \`shared-data-pod\` with two containers that share data via an emptyDir volume:

**Container 1:**
- Name: \`writer\`
- Image: \`busybox:1.36\`
- Command: \`sh -c "while true; do echo $(date) >> /data/log.txt; sleep 5; done"\`
- Mount volume at: \`/data\`

**Container 2:**
- Name: \`reader\`
- Image: \`busybox:1.36\`
- Command: \`sh -c "tail -f /data/log.txt"\`
- Mount volume at: \`/data\`

**Volume:**
- Name: \`shared-data\`
- Type: emptyDir

### Verification

\`\`\`bash
kubectl exec shared-data-pod -c reader -- cat /data/log.txt
\`\`\``,
      difficulty: 'medium',
      category: 'Pods',
      verificationConfig: {
        checks: [
          {
            name: 'Pod exists and running',
            command: 'kubectl get pod shared-data-pod -o jsonpath=\'{.status.phase}\'',
            type: 'contains',
            expected: 'Running',
            points: 2,
          },
          {
            name: 'Writer container running',
            command: 'kubectl get pod shared-data-pod -o jsonpath=\'{.status.containerStatuses[?(@.name=="writer")].ready}\'',
            type: 'contains',
            expected: 'true',
            points: 2,
          },
          {
            name: 'Reader container running',
            command: 'kubectl get pod shared-data-pod -o jsonpath=\'{.status.containerStatuses[?(@.name=="reader")].ready}\'',
            type: 'contains',
            expected: 'true',
            points: 2,
          },
          {
            name: 'EmptyDir volume configured',
            command: 'kubectl get pod shared-data-pod -o jsonpath=\'{.spec.volumes[?(@.name=="shared-data")].emptyDir}\'',
            type: 'regex',
            expected: '^\\s*\\{.*\\}\\s*$',
            points: 2,
          },
          {
            name: 'Data being written',
            command: 'kubectl exec shared-data-pod -c reader -- cat /data/log.txt 2>/dev/null | wc -l',
            type: 'regex',
            expected: '^\\s*[1-9][0-9]*\\s*$',
            points: 2,
          },
        ],
      },
      maxScore: 10,
    },
    {
      title: 'Init Container',
      body: `## Task: Create Pod with Init Container

Create a pod named \`init-demo\` with:

**Init Container:**
- Name: \`init-myservice\`
- Image: \`busybox:1.36\`
- Command: \`sh -c "echo 'Initialization complete' > /work-dir/ready.txt"\`
- Mount volume at: \`/work-dir\`

**Main Container:**
- Name: \`main-container\`
- Image: \`busybox:1.36\`
- Command: \`sh -c "cat /work-dir/ready.txt && sleep 3600"\`
- Mount volume at: \`/work-dir\`

**Volume:**
- Name: \`workdir\`
- Type: emptyDir

### Verification

\`\`\`bash
kubectl get pod init-demo
kubectl logs init-demo -c init-myservice
kubectl exec init-demo -- cat /work-dir/ready.txt
\`\`\``,
      difficulty: 'medium',
      category: 'Pods',
      verificationConfig: {
        checks: [
          {
            name: 'Pod running',
            command: 'kubectl get pod init-demo -o jsonpath=\'{.status.phase}\'',
            type: 'contains',
            expected: 'Running',
            points: 2,
          },
          {
            name: 'Init container completed',
            command: 'kubectl get pod init-demo -o jsonpath=\'{.status.initContainerStatuses[0].state.terminated.reason}\'',
            type: 'contains',
            expected: 'Completed',
            points: 3,
          },
          {
            name: 'Init container name correct',
            command: 'kubectl get pod init-demo -o jsonpath=\'{.spec.initContainers[0].name}\'',
            type: 'contains',
            expected: 'init-myservice',
            points: 2,
          },
          {
            name: 'Ready file created',
            command: 'kubectl exec init-demo -- cat /work-dir/ready.txt',
            type: 'contains',
            expected: 'Initialization complete',
            points: 3,
          },
        ],
      },
      maxScore: 10,
    },
    {
      title: 'Resource Quota',
      body: `## Task: Create Resource Quota

Create a ResourceQuota named \`compute-quota\` with:

- \`requests.cpu\`: 4
- \`requests.memory\`: 8Gi
- \`limits.cpu\`: 8
- \`limits.memory\`: 16Gi
- \`pods\`: 10

### Verification

\`\`\`bash
kubectl get resourcequota compute-quota
kubectl describe resourcequota compute-quota
\`\`\``,
      difficulty: 'medium',
      category: 'Resource Management',
      verificationConfig: {
        checks: [
          {
            name: 'ResourceQuota exists',
            command: 'kubectl get resourcequota compute-quota -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'compute-quota',
            points: 2,
          },
          {
            name: 'CPU request quota set',
            command: 'kubectl get resourcequota compute-quota -o jsonpath=\'{.spec.hard.requests\\.cpu}\'',
            type: 'contains',
            expected: '4',
            points: 2,
          },
          {
            name: 'Memory request quota set',
            command: 'kubectl get resourcequota compute-quota -o jsonpath=\'{.spec.hard.requests\\.memory}\'',
            type: 'contains',
            expected: '8Gi',
            points: 2,
          },
          {
            name: 'CPU limit quota set',
            command: 'kubectl get resourcequota compute-quota -o jsonpath=\'{.spec.hard.limits\\.cpu}\'',
            type: 'contains',
            expected: '8',
            points: 2,
          },
          {
            name: 'Pod quota set',
            command: 'kubectl get resourcequota compute-quota -o jsonpath=\'{.spec.hard.pods}\'',
            type: 'contains',
            expected: '10',
            points: 2,
          },
        ],
      },
      maxScore: 10,
    },
    {
      title: 'LimitRange Configuration',
      body: `## Task: Create LimitRange

Create a LimitRange named \`mem-limit-range\` that:

- Sets default memory request: 128Mi
- Sets default memory limit: 256Mi
- Sets default CPU request: 100m
- Sets default CPU limit: 200m
- Applies to containers

### Verification

\`\`\`bash
kubectl get limitrange mem-limit-range
kubectl describe limitrange mem-limit-range
\`\`\``,
      difficulty: 'medium',
      category: 'Resource Management',
      verificationConfig: {
        checks: [
          {
            name: 'LimitRange exists',
            command: 'kubectl get limitrange mem-limit-range -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'mem-limit-range',
            points: 2,
          },
          {
            name: 'Default memory request',
            command: 'kubectl get limitrange mem-limit-range -o jsonpath=\'{.spec.limits[0].defaultRequest.memory}\'',
            type: 'contains',
            expected: '128Mi',
            points: 2,
          },
          {
            name: 'Default memory limit',
            command: 'kubectl get limitrange mem-limit-range -o jsonpath=\'{.spec.limits[0].default.memory}\'',
            type: 'contains',
            expected: '256Mi',
            points: 2,
          },
          {
            name: 'Default CPU request',
            command: 'kubectl get limitrange mem-limit-range -o jsonpath=\'{.spec.limits[0].defaultRequest.cpu}\'',
            type: 'contains',
            expected: '100m',
            points: 2,
          },
          {
            name: 'Default CPU limit',
            command: 'kubectl get limitrange mem-limit-range -o jsonpath=\'{.spec.limits[0].default.cpu}\'',
            type: 'contains',
            expected: '200m',
            points: 2,
          },
        ],
      },
      maxScore: 10,
    },
    {
      title: 'Pod Security Context',
      body: `## Task: Configure Pod Security Context

Create a pod named \`security-context-demo\` with:

- Image: \`busybox:1.36\`
- Command: \`sh -c "sleep 3600"\`
- Run as user: 1000
- Run as group: 3000
- fsGroup: 2000
- ReadOnly root filesystem: true

### Verification

\`\`\`bash
kubectl get pod security-context-demo -o yaml
kubectl exec security-context-demo -- id
\`\`\``,
      difficulty: 'medium',
      category: 'Security',
      verificationConfig: {
        checks: [
          {
            name: 'Pod running',
            command: 'kubectl get pod security-context-demo -o jsonpath=\'{.status.phase}\'',
            type: 'contains',
            expected: 'Running',
            points: 2,
          },
          {
            name: 'RunAsUser set',
            command: 'kubectl get pod security-context-demo -o jsonpath=\'{.spec.securityContext.runAsUser}\'',
            type: 'contains',
            expected: '1000',
            points: 2,
          },
          {
            name: 'RunAsGroup set',
            command: 'kubectl get pod security-context-demo -o jsonpath=\'{.spec.securityContext.runAsGroup}\'',
            type: 'contains',
            expected: '3000',
            points: 2,
          },
          {
            name: 'fsGroup set',
            command: 'kubectl get pod security-context-demo -o jsonpath=\'{.spec.securityContext.fsGroup}\'',
            type: 'contains',
            expected: '2000',
            points: 2,
          },
          {
            name: 'ReadOnly root filesystem',
            command: 'kubectl get pod security-context-demo -o jsonpath=\'{.spec.containers[0].securityContext.readOnlyRootFilesystem}\'',
            type: 'contains',
            expected: 'true',
            points: 2,
          },
        ],
      },
      maxScore: 10,
    },
    {
      title: 'Taints and Tolerations',
      body: `## Task: Configure Taints and Tolerations

1. Add a taint to a node (use \`kubectl get nodes\` to find a node name):
\`\`\`bash
kubectl taint nodes <node-name> app=blue:NoSchedule
\`\`\`

2. Create a pod named \`toleration-pod\` with:
   - Image: \`nginx:1.21\`
   - Toleration for taint \`app=blue:NoSchedule\`

### Verification

\`\`\`bash
kubectl get pod toleration-pod
kubectl describe pod toleration-pod | grep -A5 Tolerations
\`\`\``,
      difficulty: 'hard',
      category: 'Scheduling',
      verificationConfig: {
        checks: [
          {
            name: 'Pod exists',
            command: 'kubectl get pod toleration-pod -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'toleration-pod',
            points: 2,
          },
          {
            name: 'Pod running or pending',
            command: 'kubectl get pod toleration-pod -o jsonpath=\'{.status.phase}\'',
            type: 'regex',
            expected: 'Running|Pending',
            points: 2,
          },
          {
            name: 'Toleration key configured',
            command: 'kubectl get pod toleration-pod -o jsonpath=\'{.spec.tolerations[?(@.key=="app")].key}\'',
            type: 'contains',
            expected: 'app',
            points: 2,
          },
          {
            name: 'Toleration value configured',
            command: 'kubectl get pod toleration-pod -o jsonpath=\'{.spec.tolerations[?(@.key=="app")].value}\'',
            type: 'contains',
            expected: 'blue',
            points: 2,
          },
          {
            name: 'Toleration effect configured',
            command: 'kubectl get pod toleration-pod -o jsonpath=\'{.spec.tolerations[?(@.key=="app")].effect}\'',
            type: 'contains',
            expected: 'NoSchedule',
            points: 2,
          },
        ],
      },
      maxScore: 10,
    },
    {
      title: 'Node Affinity',
      body: `## Task: Configure Node Affinity

A node has been labeled with \`disktype=ssd\`.

Create a pod named \`affinity-pod\` with:
- Image: \`nginx:1.21\`
- Required node affinity: \`disktype=ssd\`

### Verification

\`\`\`bash
kubectl get pod affinity-pod -o wide
kubectl describe pod affinity-pod | grep -A10 "Affinity"
\`\`\``,
      difficulty: 'hard',
      category: 'Scheduling',
      setupScript: 'kubectl label nodes $(kubectl get nodes -o jsonpath=\'{.items[0].metadata.name}\') disktype=ssd --overwrite',
      verificationConfig: {
        checks: [
          {
            name: 'Pod exists',
            command: 'kubectl get pod affinity-pod -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'affinity-pod',
            points: 2,
          },
          {
            name: 'Pod is running or pending',
            command: 'kubectl get pod affinity-pod -o jsonpath=\'{.status.phase}\'',
            type: 'regex',
            expected: 'Running|Pending',
            points: 1,
          },
          {
            name: 'Node affinity configured',
            command: 'kubectl get pod affinity-pod -o jsonpath=\'{.spec.affinity.nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution}\'',
            type: 'regex',
            expected: '^\\s*\\{.*\\}\\s*$',
            points: 2,
          },
          {
            name: 'Affinity key is disktype',
            command: 'kubectl get pod affinity-pod -o jsonpath=\'{.spec.affinity.nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution.nodeSelectorTerms[0].matchExpressions[0].key}\'',
            type: 'contains',
            expected: 'disktype',
            points: 3,
          },
          {
            name: 'Affinity value is ssd',
            command: 'kubectl get pod affinity-pod -o jsonpath=\'{.spec.affinity.nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution.nodeSelectorTerms[0].matchExpressions[0].values[0]}\'',
            type: 'contains',
            expected: 'ssd',
            points: 2,
          },
        ],
      },
      maxScore: 10,
    },
    {
      title: 'StatefulSet with Headless Service',
      body: `## Task: Create StatefulSet

Create a StatefulSet named \`web-stateful\` with:

**Headless Service:**
- Name: \`nginx-headless\`
- Selector: \`app=nginx-sts\`
- Port: 80
- clusterIP: None

**StatefulSet:**
- Replicas: 3
- Image: \`nginx:1.21\`
- Container port: 80
- serviceName: \`nginx-headless\`
- Labels: \`app=nginx-sts\`

### Verification

\`\`\`bash
kubectl get statefulset web-stateful
kubectl get pods -l app=nginx-sts
kubectl get svc nginx-headless
\`\`\``,
      difficulty: 'hard',
      category: 'StatefulSets',
      verificationConfig: {
        checks: [
          {
            name: 'Headless service exists',
            command: 'kubectl get svc nginx-headless -o jsonpath=\'{.spec.clusterIP}\'',
            type: 'contains',
            expected: 'None',
            points: 2,
          },
          {
            name: 'StatefulSet exists',
            command: 'kubectl get statefulset web-stateful -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'web-stateful',
            points: 2,
          },
          {
            name: 'StatefulSet replicas',
            command: 'kubectl get statefulset web-stateful -o jsonpath=\'{.spec.replicas}\'',
            type: 'contains',
            expected: '3',
            points: 2,
          },
          {
            name: 'ServiceName configured',
            command: 'kubectl get statefulset web-stateful -o jsonpath=\'{.spec.serviceName}\'',
            type: 'contains',
            expected: 'nginx-headless',
            points: 2,
          },
          {
            name: 'Pods created',
            command: 'kubectl get pods -l app=nginx-sts --field-selector=status.phase=Running -o jsonpath=\'{.items[*].metadata.name}\' | wc -w',
            type: 'contains',
            expected: '3',
            points: 2,
          },
        ],
      },
      maxScore: 10,
    },
    {
      title: 'Canary Deployment',
      body: `## Task: Implement Canary Deployment

Create a canary deployment strategy for an app:

**Stable Deployment:**
- Name: \`app-stable\`
- Replicas: 4
- Image: \`nginx:1.20\`
- Labels: \`app=myapp\`, \`version=stable\`

**Canary Deployment:**
- Name: \`app-canary\`
- Replicas: 1
- Image: \`nginx:1.21\`
- Labels: \`app=myapp\`, \`version=canary\`

**Service:**
- Name: \`myapp-service\`
- Selector: \`app=myapp\` (routes to both)
- Port: 80

### Verification

\`\`\`bash
kubectl get deployments -l app=myapp
kubectl get pods -l app=myapp
kubectl get svc myapp-service
\`\`\``,
      difficulty: 'hard',
      category: 'Deployments',
      verificationConfig: {
        checks: [
          {
            name: 'Stable deployment exists',
            command: 'kubectl get deployment app-stable -o jsonpath=\'{.spec.replicas}\'',
            type: 'contains',
            expected: '4',
            points: 2,
          },
          {
            name: 'Canary deployment exists',
            command: 'kubectl get deployment app-canary -o jsonpath=\'{.spec.replicas}\'',
            type: 'contains',
            expected: '1',
            points: 2,
          },
          {
            name: 'Service selector correct',
            command: 'kubectl get svc myapp-service -o jsonpath=\'{.spec.selector.app}\'',
            type: 'contains',
            expected: 'myapp',
            points: 2,
          },
          {
            name: 'Total pods running',
            command: 'kubectl get pods -l app=myapp --field-selector=status.phase=Running -o name | wc -l',
            type: 'contains',
            expected: '5',
            points: 2,
          },
          {
            name: 'Stable version label',
            command: 'kubectl get deployment app-stable -o jsonpath=\'{.spec.template.metadata.labels.version}\'',
            type: 'contains',
            expected: 'stable',
            points: 2,
          },
        ],
      },
      maxScore: 10,
    },
    {
      title: 'Network Policies',
      body: `## Task: Configure Network Policies

Create a NetworkPolicy named \`db-policy\` that:

- Applies to pods with label \`app=database\`
- Allows ingress from pods with label \`app=backend\` on port 3306
- Denies all other ingress traffic

### Verification

\`\`\`bash
kubectl get networkpolicy db-policy
kubectl describe networkpolicy db-policy
\`\`\``,
      difficulty: 'hard',
      category: 'Network',
      verificationConfig: {
        checks: [
          {
            name: 'NetworkPolicy exists',
            command: 'kubectl get networkpolicy db-policy -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'db-policy',
            points: 2,
          },
          {
            name: 'Pod selector correct',
            command: 'kubectl get networkpolicy db-policy -o jsonpath=\'{.spec.podSelector.matchLabels.app}\'',
            type: 'contains',
            expected: 'database',
            points: 2,
          },
          {
            name: 'Ingress from backend allowed',
            command: 'kubectl get networkpolicy db-policy -o jsonpath=\'{.spec.ingress[0].from[0].podSelector.matchLabels.app}\'',
            type: 'contains',
            expected: 'backend',
            points: 3,
          },
          {
            name: 'Port 3306 configured',
            command: 'kubectl get networkpolicy db-policy -o jsonpath=\'{.spec.ingress[0].ports[0].port}\'',
            type: 'contains',
            expected: '3306',
            points: 3,
          },
        ],
      },
      maxScore: 10,
    },
    {
      title: 'PodDisruptionBudget',
      body: `## Task: Create PodDisruptionBudget

Create a PodDisruptionBudget named \`web-pdb\` that:

- Targets pods with label \`app=web\`
- Ensures at least 2 pods are always available

### Verification

\`\`\`bash
kubectl get pdb web-pdb
kubectl describe pdb web-pdb
\`\`\``,
      difficulty: 'medium',
      category: 'Availability',
      verificationConfig: {
        checks: [
          {
            name: 'PodDisruptionBudget exists',
            command: 'kubectl get pdb web-pdb -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'web-pdb',
            points: 3,
          },
          {
            name: 'Min available is 2',
            command: 'kubectl get pdb web-pdb -o jsonpath=\'{.spec.minAvailable}\'',
            type: 'contains',
            expected: '2',
            points: 3,
          },
          {
            name: 'Selector matches web',
            command: 'kubectl get pdb web-pdb -o jsonpath=\'{.spec.selector.matchLabels.app}\'',
            type: 'contains',
            expected: 'web',
            points: 4,
          },
        ],
      },
      maxScore: 10,
    },
    {
      title: 'Horizontal Pod Autoscaler',
      body: `## Task: Configure HPA

Create a HorizontalPodAutoscaler named \`api-hpa\` that:

- Targets deployment \`api-server\`
- Min replicas: 2
- Max replicas: 10
- Target CPU utilization: 70%

### Verification

\`\`\`bash
kubectl get hpa api-hpa
kubectl describe hpa api-hpa
\`\`\``,
      difficulty: 'medium',
      category: 'Scaling',
      setupScript: 'kubectl create deployment api-server --image=nginx:1.21 --replicas=3 && kubectl set resources deployment api-server --requests=cpu=100m',
      verificationConfig: {
        checks: [
          {
            name: 'HPA exists',
            command: 'kubectl get hpa api-hpa -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'api-hpa',
            points: 2,
          },
          {
            name: 'Min replicas is 2',
            command: 'kubectl get hpa api-hpa -o jsonpath=\'{.spec.minReplicas}\'',
            type: 'contains',
            expected: '2',
            points: 2,
          },
          {
            name: 'Max replicas is 10',
            command: 'kubectl get hpa api-hpa -o jsonpath=\'{.spec.maxReplicas}\'',
            type: 'contains',
            expected: '10',
            points: 2,
          },
          {
            name: 'Target CPU utilization',
            command: 'kubectl get hpa api-hpa -o jsonpath=\'{.spec.targetCPUUtilizationPercentage}\'',
            type: 'contains',
            expected: '70',
            points: 2,
          },
          {
            name: 'Targets api-server deployment',
            command: 'kubectl get hpa api-hpa -o jsonpath=\'{.spec.scaleTargetRef.name}\'',
            type: 'contains',
            expected: 'api-server',
            points: 2,
          },
        ],
      },
      maxScore: 10,
    },
    {
      title: 'DaemonSet Creation',
      body: `## Task: Create a DaemonSet

Create a DaemonSet named \`log-collector\` that:

- Runs on all nodes
- Image: \`fluentd:v1.14-1\`
- Container name: \`fluentd\`
- Mounts host path \`/var/log\` to \`/var/log\` in the container

### Verification

\`\`\`bash
kubectl get daemonset log-collector
kubectl describe daemonset log-collector
\`\`\``,
      difficulty: 'medium',
      category: 'DaemonSets',
      verificationConfig: {
        checks: [
          {
            name: 'DaemonSet exists',
            command: 'kubectl get daemonset log-collector -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'log-collector',
            points: 2,
          },
          {
            name: 'Correct image',
            command: 'kubectl get daemonset log-collector -o jsonpath=\'{.spec.template.spec.containers[0].image}\'',
            type: 'contains',
            expected: 'fluentd:v1.14-1',
            points: 2,
          },
          {
            name: 'Container name correct',
            command: 'kubectl get daemonset log-collector -o jsonpath=\'{.spec.template.spec.containers[0].name}\'',
            type: 'contains',
            expected: 'fluentd',
            points: 2,
          },
          {
            name: 'Volume mount configured',
            command: 'kubectl get daemonset log-collector -o jsonpath=\'{.spec.template.spec.containers[0].volumeMounts[0].mountPath}\'',
            type: 'contains',
            expected: '/var/log',
            points: 2,
          },
          {
            name: 'Host path configured',
            command: 'kubectl get daemonset log-collector -o jsonpath=\'{.spec.template.spec.volumes[0].hostPath.path}\'',
            type: 'contains',
            expected: '/var/log',
            points: 2,
          },
        ],
      },
      maxScore: 10,
    },
    {
      title: 'Pod with Multiple Containers',
      body: `## Task: Create Multi-Container Pod

Create a pod named \`web-logger\` with two containers:

1. Main container:
   - Name: \`nginx\`
   - Image: \`nginx:1.21\`
   
2. Sidecar container:
   - Name: \`log-sidecar\`
   - Image: \`busybox:1.35\`
   - Command: \`sh -c "tail -f /var/log/nginx/access.log"\`

Share a volume named \`logs\` between them mounted at \`/var/log/nginx\`

### Verification

\`\`\`bash
kubectl get pod web-logger
kubectl describe pod web-logger
\`\`\``,
      difficulty: 'medium',
      category: 'Pods',
      verificationConfig: {
        checks: [
          {
            name: 'Pod exists',
            command: 'kubectl get pod web-logger -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'web-logger',
            points: 2,
          },
          {
            name: 'Two containers present',
            command: 'kubectl get pod web-logger -o jsonpath=\'{.spec.containers[*].name}\' | wc -w',
            type: 'contains',
            expected: '2',
            points: 2,
          },
          {
            name: 'Nginx container exists',
            command: 'kubectl get pod web-logger -o jsonpath=\'{.spec.containers[?(@.name=="nginx")].image}\'',
            type: 'contains',
            expected: 'nginx',
            points: 2,
          },
          {
            name: 'Sidecar container exists',
            command: 'kubectl get pod web-logger -o jsonpath=\'{.spec.containers[?(@.name=="log-sidecar")].image}\'',
            type: 'contains',
            expected: 'busybox',
            points: 2,
          },
          {
            name: 'Shared volume configured',
            command: 'kubectl get pod web-logger -o jsonpath=\'{.spec.volumes[0].name}\'',
            type: 'contains',
            expected: 'logs',
            points: 2,
          },
        ],
      },
      maxScore: 10,
    },
    {
      title: 'ConfigMap from File',
      body: `## Task: Create ConfigMap from Literal

Create a ConfigMap named \`app-properties\` with the following data:

- \`database.host\`: \`mysql.default.svc.cluster.local\`
- \`database.port\`: \`3306\`
- \`app.mode\`: \`production\`

Then create a pod named \`app-pod\` that uses this ConfigMap as environment variables.

### Verification

\`\`\`bash
kubectl get configmap app-properties
kubectl get pod app-pod
\`\`\``,
      difficulty: 'easy',
      category: 'Configuration',
      verificationConfig: {
        checks: [
          {
            name: 'ConfigMap exists',
            command: 'kubectl get configmap app-properties -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'app-properties',
            points: 2,
          },
          {
            name: 'Database host configured',
            command: 'kubectl get configmap app-properties -o jsonpath=\'{.data.database\\.host}\'',
            type: 'contains',
            expected: 'mysql',
            points: 2,
          },
          {
            name: 'Database port configured',
            command: 'kubectl get configmap app-properties -o jsonpath=\'{.data.database\\.port}\'',
            type: 'contains',
            expected: '3306',
            points: 2,
          },
          {
            name: 'Pod exists',
            command: 'kubectl get pod app-pod -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'app-pod',
            points: 2,
          },
          {
            name: 'Pod uses ConfigMap',
            command: 'kubectl get pod app-pod -o jsonpath=\'{.spec.containers[0].envFrom[0].configMapRef.name}\'',
            type: 'contains',
            expected: 'app-properties',
            points: 2,
          },
        ],
      },
      maxScore: 10,
    },
    {
      title: 'Pod Scheduling with Node Selector',
      body: `## Task: Schedule Pod on Specific Node

Label a node with \`disktype=ssd\`

Create a pod named \`fast-storage-pod\` that:

- Image: \`redis:6.2\`
- Must be scheduled only on nodes with label \`disktype=ssd\`

### Verification

\`\`\`bash
kubectl get pod fast-storage-pod -o wide
kubectl describe pod fast-storage-pod
\`\`\``,
      difficulty: 'medium',
      category: 'Scheduling',
      verificationConfig: {
        checks: [
          {
            name: 'Pod exists',
            command: 'kubectl get pod fast-storage-pod -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'fast-storage-pod',
            points: 2,
          },
          {
            name: 'Correct image',
            command: 'kubectl get pod fast-storage-pod -o jsonpath=\'{.spec.containers[0].image}\'',
            type: 'contains',
            expected: 'redis:6.2',
            points: 2,
          },
          {
            name: 'Node selector configured',
            command: 'kubectl get pod fast-storage-pod -o jsonpath=\'{.spec.nodeSelector.disktype}\'',
            type: 'contains',
            expected: 'ssd',
            points: 3,
          },
          {
            name: 'Pod is running',
            command: 'kubectl get pod fast-storage-pod -o jsonpath=\'{.status.phase}\'',
            type: 'contains',
            expected: 'Running',
            points: 3,
          },
        ],
      },
      maxScore: 10,
    },
    {
      title: 'Deployment Rollback',
      body: `## Task: Rollback a Deployment

A deployment named \`api-service\` exists but the latest version has issues.

1. Check the rollout history
2. Rollback to the previous revision
3. Verify the rollback was successful

### Verification

\`\`\`bash
kubectl rollout history deployment/api-service
kubectl rollout status deployment/api-service
\`\`\``,
      difficulty: 'easy',
      category: 'Deployments',
      setupScript: 'kubectl create deployment api-service --image=nginx:1.20 --replicas=3 && kubectl set image deployment/api-service nginx=nginx:1.21 --record',
      verificationConfig: {
        checks: [
          {
            name: 'Deployment exists',
            command: 'kubectl get deployment api-service -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'api-service',
            points: 2,
          },
          {
            name: 'Deployment has annotations',
            command: 'kubectl get deployment api-service -o jsonpath=\'{.metadata.annotations.deployment\\.kubernetes\\.io/revision}\'',
            type: 'contains',
            expected: '',
            points: 2,
          },
          {
            name: 'All replicas available',
            command: 'kubectl get deployment api-service -o jsonpath=\'{.status.availableReplicas}\'',
            type: 'contains',
            expected: '',
            points: 3,
          },
          {
            name: 'Rollout complete',
            command: 'kubectl rollout status deployment/api-service --timeout=10s 2>&1 | grep -c "successfully rolled out"',
            type: 'contains',
            expected: '1',
            points: 3,
          },
        ],
      },
      maxScore: 10,
    },
    {
      title: 'Job with Parallelism',
      body: `## Task: Create Parallel Job

Create a Job named \`batch-processor\` that:

- Image: \`perl:5.34\`
- Command: \`perl -Mbignum=bpi -wle "print bpi(2000)"\`
- Completions: 5
- Parallelism: 2
- Backoff limit: 4

### Verification

\`\`\`bash
kubectl get job batch-processor
kubectl describe job batch-processor
\`\`\``,
      difficulty: 'medium',
      category: 'Jobs',
      verificationConfig: {
        checks: [
          {
            name: 'Job exists',
            command: 'kubectl get job batch-processor -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'batch-processor',
            points: 2,
          },
          {
            name: 'Completions is 5',
            command: 'kubectl get job batch-processor -o jsonpath=\'{.spec.completions}\'',
            type: 'contains',
            expected: '5',
            points: 2,
          },
          {
            name: 'Parallelism is 2',
            command: 'kubectl get job batch-processor -o jsonpath=\'{.spec.parallelism}\'',
            type: 'contains',
            expected: '2',
            points: 2,
          },
          {
            name: 'Backoff limit is 4',
            command: 'kubectl get job batch-processor -o jsonpath=\'{.spec.backoffLimit}\'',
            type: 'contains',
            expected: '4',
            points: 2,
          },
          {
            name: 'Correct image',
            command: 'kubectl get job batch-processor -o jsonpath=\'{.spec.template.spec.containers[0].image}\'',
            type: 'contains',
            expected: 'perl',
            points: 2,
          },
        ],
      },
      maxScore: 10,
    },
    {
      title: 'Service with External Name',
      body: `## Task: Create ExternalName Service

Create a Service named \`external-db\` of type ExternalName that:

- Maps to external database: \`db.example.com\`
- Port: 5432

This allows pods to access the external database using the service name.

### Verification

\`\`\`bash
kubectl get service external-db
kubectl describe service external-db
\`\`\``,
      difficulty: 'easy',
      category: 'Services',
      verificationConfig: {
        checks: [
          {
            name: 'Service exists',
            command: 'kubectl get service external-db -o jsonpath=\'{.metadata.name}\'',
            type: 'contains',
            expected: 'external-db',
            points: 3,
          },
          {
            name: 'Service type is ExternalName',
            command: 'kubectl get service external-db -o jsonpath=\'{.spec.type}\'',
            type: 'contains',
            expected: 'ExternalName',
            points: 3,
          },
          {
            name: 'External name configured',
            command: 'kubectl get service external-db -o jsonpath=\'{.spec.externalName}\'',
            type: 'contains',
            expected: 'db.example.com',
            points: 4,
          },
        ],
      },
      maxScore: 10,
    },
  ];

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO tasks (title, body, difficulty, category, verification_config, setup_script, max_score)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((tasks) => {
    for (const task of tasks) {
      insertStmt.run(
        task.title, 
        task.body, 
        task.difficulty, 
        task.category,
        task.verificationConfig ? JSON.stringify(task.verificationConfig) : null,
        task.setupScript || null,
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




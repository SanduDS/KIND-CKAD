

# ✅ **ARCHITECTURE DOCUMENT (FOR LLM IMPLEMENTATION)**

**Project:** CKAD Hands-on Practice Platform (MVP)
**Budget:** ~$100/month or least cost possible to POC
**Infrastructure:** Single VM using Docker + KIND
**Goal:** Provide browser-based Kubernetes practice sessions with timed environments
**Last Updated:** December 2024 (with security & scalability fixes)

---

# 1. **High-Level Overview**

The platform will:

1. Provide a web UI where users log in (Google OAuth or email OTP).
2. Allow a user to start **one KIND cluster session** (Kubernetes cluster in Docker).
3. Provide a **browser-based terminal** connected to that cluster (`kubectl` access).
4. Provide **CKAD tasks** in a panel (Markdown).
5. Destroy the cluster when the session ends or times out.
6. Enforce resource/time limits to keep cost low.

This MVP runs on **one VPS** using:

* **Docker** (host)
* **KIND** clusters (per session)
* **Node.js / Go backend API**
* **SQLite or Postgres**
* **Nginx or Caddy** as reverse proxy
* **One domain** (HTTPS enabled via Let's Encrypt)

No Kubernetes-in-Kubernetes.
No vCluster.
No cloud APIs.

---

# 2. **System Components**

### 2.1. **Frontend Web Application**

* Framework: React, Next.js OR simple HTML+JS (LLM can choose)
* Features:

  * User login page
  * Dashboard: Start Session / End Session
  * CKAD Task viewer (Markdown)
  * Web terminal window (xterm.js)
  * Timer visible to user (with 5-min warning before timeout)
  * Session extension button (if under max limit)

---

### 2.2. **Backend API**

Language: **Node.js (Express)** or **Go Fiber/Gin**
The agent can pick.

API responsibilities:

1. **User Authentication**

   * Google OAuth or Email OTP (via SendGrid/Resend)
   * Maintain user session tokens (JWT with refresh tokens)
   * Rate limiting on auth endpoints

2. **Session Orchestration**

   * Create KIND cluster with isolated networking
   * Generate per-session kubeconfig
   * Connect terminal container to cluster
   * Track session TTL (60 mins default, extendable once)
   * Destroy KIND cluster with graceful warnings

3. **Task Management**

   * Serve CKAD tasks as Markdown
   * Return tasks list + task body

4. **Terminal Websocket**

   * Authenticate WebSocket connections with JWT
   * Verify session ownership (user can only access their own terminal)
   * Provide interactive terminal using:
     * A docker container (`kubectl` installed)
     * Connected via websocket to frontend
   * Backend relays keystrokes <-> bash process

---

### 2.3. **Database**

* Use **SQLite** for MVP (file-based).
* **Enable WAL mode** for better concurrency
* **Daily backup** to external storage (S3/B2)
* Tables required:

#### Table: `users`

| column     | type     | description |
| ---------- | -------- | ----------- |
| id         | string   | UUID        |
| email      | string   | login email |
| name       | string   | user name   |
| created_at | datetime |             |

#### Table: `sessions`

| column                | type                          | description               |
| --------------------- | ----------------------------- | ------------------------- |
| id                    | string                        | UUID                      |
| user_id               | string                        | FK                        |
| status                | enum(started, ended, timeout) |                           |
| start_time            | datetime                      |                           |
| end_time              | datetime                      |                           |
| cluster_name          | string                        | KIND cluster name         |
| kubeconfig_path       | string                        | Path to session kubeconfig|
| terminal_container_id | string                        | docker container id       |
| extended              | boolean                       | Whether TTL was extended  |
| notes                 | text                          | debug logs                |

#### Table: `allocated_ports`

| column       | type     | description                    |
| ------------ | -------- | ------------------------------ |
| port         | integer  | PRIMARY KEY, the allocated port|
| session_id   | string   | FK to sessions                 |
| port_type    | string   | 'api' or 'ingress'             |
| allocated_at | datetime |                                |

#### Table: `tasks`

| column     | type            |
| ---------- | --------------- |
| id         | int             |
| title      | string          |
| body       | text (Markdown) |
| difficulty | string          |

#### Table: `refresh_tokens`

| column     | type     | description           |
| ---------- | -------- | --------------------- |
| id         | string   | UUID                  |
| user_id    | string   | FK                    |
| token_hash | string   | Hashed refresh token  |
| expires_at | datetime |                       |
| created_at | datetime |                       |

---

# 3. **Infrastructure Architecture**

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Single VPS Host                               │
│                    (Hetzner CPX41 - 8vCPU/32GB)                      │
│                                                                      │
│  ┌───────────────┐    ┌─────────────────────────────────────────┐   │
│  │ Docker Engine │◀──▶│ KIND Clusters (isolated per session)    │   │
│  └───────────────┘    │ e.g., ckad-abc123 (single control-plane)│   │
│                       │ Network: kind-ckad-abc123               │   │
│                       └─────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Terminal Containers (per session)                            │    │
│  │ - Isolated network per cluster                               │    │
│  │ - Own kubeconfig mounted read-only                           │    │
│  │ - Resource limited (512MB RAM, 0.5 CPU)                      │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌──────────────────────────────┐                                   │
│  │ Backend API + WebSocket      │ (with rate limiting)              │
│  └──────────────────────────────┘                                   │
│                                                                      │
│  ┌──────────────────────────────┐                                   │
│  │ Frontend UI (Next.js)        │                                    │
│  └──────────────────────────────┘                                   │
│                                                                      │
│  ┌──────────────────────────────┐                                   │
│  │ Reverse Proxy (Nginx)        │ HTTPS + Routing + Rate Limit      │
│  └──────────────────────────────┘                                   │
│                                                                      │
│  ┌──────────────────────────────┐                                   │
│  │ Monitoring (optional)        │ Prometheus + simple dashboard     │
│  └──────────────────────────────┘                                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

# 4. **Resource Estimates**

### Per-Component Resource Usage

| Component | RAM | CPU |
|-----------|-----|-----|
| Host OS + Docker | 2GB | 0.5 |
| Backend + Frontend | 1GB | 0.5 |
| Per KIND cluster (single-node) | 2GB | 1.5 |
| Per terminal container | 512MB | 0.5 |

### Capacity Planning (32GB RAM / 8 vCPU)

| Scenario | Max Concurrent Sessions |
|----------|------------------------|
| Conservative (safe) | 6 sessions |
| Moderate | 8 sessions |
| Aggressive (not recommended) | 10 sessions |

**Recommendation:** Limit to **6-8 concurrent sessions** for stability.

---

# 5. **KIND Cluster Design**

Every user session = **one single-node KIND cluster** (control-plane only to save resources).

### KIND cluster config:

```yaml
# kind-config-template.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
    extraPortMappings:
      - containerPort: 6443
        hostPort: {{apiPort}}
        protocol: TCP
      - containerPort: 80
        hostPort: {{ingressPort}}
        protocol: TCP
      - containerPort: 443
        hostPort: {{ingressHttpsPort}}
        protocol: TCP
    kubeadmConfigPatches:
      - |
        kind: InitConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            system-reserved: memory=256Mi
            eviction-hard: memory.available<100Mi
```

Backend dynamically replaces:

* `{{apiPort}}` → allocated from port pool (30000–39999)
* `{{ingressPort}}` → allocated from port pool (40000–44999)
* `{{ingressHttpsPort}}` → allocated from port pool (45000–49999)

### Port Allocation Logic

```
1. Query allocated_ports table for free port in range
2. Use database transaction to prevent race conditions
3. Insert port record with session_id
4. On session destroy, DELETE port records
```

---

# 6. **Terminal Container Image**

### Dockerfile for Terminal Container

```dockerfile
# docker/terminal/Dockerfile
FROM alpine:3.19

# Install essential tools
RUN apk add --no-cache \
    bash \
    curl \
    wget \
    vim \
    nano \
    jq \
    git \
    openssl \
    ca-certificates

# Install kubectl
RUN curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" \
    && chmod +x kubectl \
    && mv kubectl /usr/local/bin/

# Install helm
RUN curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Install k9s (optional but great for CKAD practice)
RUN curl -sS https://webinstall.dev/k9s | bash || true

# Create non-root user (optional for extra security)
RUN adduser -D -s /bin/bash ckaduser
WORKDIR /home/ckaduser

# Set bash as default shell
ENV SHELL=/bin/bash
CMD ["/bin/bash"]
```

Build and tag:
```bash
docker build -t ckad-terminal:latest -f docker/terminal/Dockerfile .
```

---

# 7. **Session Lifecycle Logic (MUST implement exactly)**

### Step 1 — User clicks "Start Session"

**Pre-checks:**
```
1. Verify user is authenticated (valid JWT)
2. Check user doesn't have active session (enforce 1 session/user)
3. Check global session count < MAX_CONCURRENT_SESSIONS (6-8)
4. Rate limit: max 3 session starts per hour per user
```

**Backend executes:**

1. Generate cluster name:

   ```
   clusterName = "ckad-" + shortUUID()  // e.g., ckad-a1b2c3
   ```

2. Allocate free ports (with DB transaction):

   ```sql
   BEGIN TRANSACTION;
   SELECT port FROM port_pool WHERE port NOT IN (SELECT port FROM allocated_ports) LIMIT 3;
   INSERT INTO allocated_ports (port, session_id, port_type, allocated_at) VALUES (...);
   COMMIT;
   ```

3. Create temp config file:

   ```
   /tmp/kind-config-${clusterName}.yaml
   ```

4. Run KIND cluster creation:

   ```bash
   kind create cluster --name ${clusterName} --config /tmp/kind-config-${clusterName}.yaml
   ```

5. **Generate isolated kubeconfig:**

   ```bash
   kind get kubeconfig --name ${clusterName} > /tmp/kubeconfig-${clusterName}
   chmod 600 /tmp/kubeconfig-${clusterName}
   ```

6. Validate cluster:

   ```bash
   KUBECONFIG=/tmp/kubeconfig-${clusterName} kubectl get nodes --request-timeout=30s
   ```

7. Create a **secure terminal container:**

   ```bash
   docker run -itd \
     --name term-${clusterName} \
     --network kind \
     --memory=512m \
     --cpus=0.5 \
     --pids-limit=100 \
     --read-only \
     --tmpfs /tmp:rw,noexec,nosuid,size=100m \
     -v /tmp/kubeconfig-${clusterName}:/home/ckaduser/.kube/config:ro \
     -e KUBECONFIG=/home/ckaduser/.kube/config \
     --user ckaduser \
     ckad-terminal:latest
   ```

8. Save session record in DB.

9. Return to frontend:

   * websocket URL with session token
   * session timer info (start_time, TTL)
   * list of CKAD tasks

**Error Handling:**
```
If any step fails:
  - Rollback: delete partial cluster, release ports
  - Log error with context
  - Return user-friendly error message
  - Do NOT leave orphan resources
```

---

### Step 2 — Terminal Connectivity (WebSocket)

**Connection Flow:**

```
1. Frontend connects to: wss://domain/ws/terminal?token=<session_jwt>
2. Backend validates:
   a. JWT is valid and not expired
   b. User owns the session
   c. Session status is 'started'
3. Backend attaches to docker container:
   docker exec -it term-${clusterName} /bin/bash
4. Relay stdin/stdout between WebSocket and container
```

Backend MUST:

* Validate JWT on every WebSocket connection
* Keep STDIN/STDOUT stream open
* Relay characters between frontend and container
* Handle disconnection gracefully (don't kill container)
* Implement heartbeat/ping to detect stale connections

---

### Step 3 — Session Timer & Warnings

**Frontend Timer Logic:**

```
- Display countdown timer (60:00 default)
- At 10 minutes remaining: Show yellow warning
- At 5 minutes remaining: Show red warning + modal
- At 1 minute remaining: Show final warning
- Allow "Extend Session" button (adds 30 mins, once only)
```

**Backend TTL Extension:**

```
POST /session/extend
- Check session.extended == false
- Add 30 minutes to TTL
- Set session.extended = true
- Return new end_time
```

---

### Step 4 — Session Timeout (Background Job)

**Run every 30 seconds:**

```javascript
async function cleanupExpiredSessions() {
  const expiredSessions = await db.query(`
    SELECT * FROM sessions 
    WHERE status = 'started' 
    AND datetime(start_time, '+' || ttl_minutes || ' minutes') < datetime('now')
  `);
  
  for (const session of expiredSessions) {
    await destroySession(session.id, 'timeout');
  }
}
```

**Also cleanup orphans on startup:**

```javascript
async function cleanupOrphanResources() {
  // Find KIND clusters not in DB
  const kindClusters = exec('kind get clusters').split('\n');
  const dbClusters = await db.query('SELECT cluster_name FROM sessions WHERE status = "started"');
  
  for (const cluster of kindClusters) {
    if (!dbClusters.includes(cluster)) {
      exec(`kind delete cluster --name ${cluster}`);
    }
  }
  
  // Find terminal containers not in DB
  const containers = exec('docker ps --filter name=term- --format {{.Names}}').split('\n');
  // ... similar cleanup logic
}
```

---

### Step 5 — Destroy Session

**Triggered by:** User clicks "End Session" OR timeout OR admin action

Backend runs (in order):

```bash
# 1. Close WebSocket connections for this session
closeWebSocketsForSession(sessionId);

# 2. Stop and remove terminal container
docker stop term-${clusterName} --time 10
docker rm -f term-${clusterName}

# 3. Delete KIND cluster
kind delete cluster --name ${clusterName}

# 4. Cleanup kubeconfig
rm -f /tmp/kubeconfig-${clusterName}
rm -f /tmp/kind-config-${clusterName}.yaml

# 5. Release ports (DB)
DELETE FROM allocated_ports WHERE session_id = '${sessionId}';

# 6. Update session record
UPDATE sessions SET status = 'ended', end_time = NOW() WHERE id = '${sessionId}';
```

---

# 8. **Security Rules (LLM must implement all)**

### Authentication & Authorization

1. JWT tokens with 15-minute expiry + refresh tokens
2. Refresh tokens stored hashed in DB, 7-day expiry
3. WebSocket connections require valid JWT
4. Session ownership verified on all operations

### Session Isolation

5. Only **1 active session** per user simultaneously
6. Cluster TTL = **60 minutes** (extendable once to 90 mins)
7. Each terminal container:
   * Has its own isolated kubeconfig (read-only mount)
   * Connected to KIND network (not host network)
   * Cannot access other users' clusters
   * Resource limited (512MB RAM, 0.5 CPU, 100 PIDs)
   * Read-only filesystem (except /tmp)

### Network Security

8. KIND network ports are dynamically allocated and tracked
9. No user can access host Docker socket
10. Terminal containers cannot make outbound internet requests (optional: add `--network none` and only allow cluster access)

### API Security

11. Rate limiting on all endpoints:
    * Auth endpoints: 10 req/min
    * Session start: 3 req/hour
    * General API: 100 req/min
12. CORS configured for frontend domain only
13. Content Security Policy headers
14. HTTPS only (redirect HTTP)

### Input Validation

15. Validate all user inputs (session IDs, task IDs)
16. Sanitize any data before shell execution
17. Use parameterized queries for database

---

# 9. **Email OTP Configuration**

For email-based authentication, use one of these providers:

### Option A: SendGrid (Recommended for MVP)
```javascript
// config
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxx
EMAIL_FROM=noreply@yourdomain.com
```

### Option B: Resend (Simple, developer-friendly)
```javascript
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=noreply@yourdomain.com
```

### OTP Flow
```
1. User enters email
2. Backend generates 6-digit OTP, stores hash with 10-min expiry
3. Send email with OTP
4. User enters OTP
5. Backend verifies, issues JWT + refresh token
```

---

# 10. **Graceful Shutdown Handling**

### On Backend Process Shutdown (SIGTERM/SIGINT)

```javascript
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, graceful shutdown...');
  
  // 1. Stop accepting new connections
  server.close();
  
  // 2. Close all WebSocket connections with message
  wss.clients.forEach(client => {
    client.send(JSON.stringify({ type: 'server_shutdown', message: 'Server restarting...' }));
    client.close();
  });
  
  // 3. Wait for in-flight requests (max 30s)
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // 4. Note: Don't destroy sessions - they'll resume after restart
  
  process.exit(0);
});
```

### On VM Reboot (Systemd Service)

```ini
# /etc/systemd/system/ckad-platform.service
[Unit]
Description=CKAD Practice Platform
After=docker.service
Requires=docker.service

[Service]
Type=simple
Restart=always
RestartSec=10
ExecStartPre=/usr/local/bin/cleanup-orphans.sh
ExecStart=/usr/bin/docker-compose -f /opt/ckad-platform/docker-compose.yml up
ExecStop=/usr/bin/docker-compose -f /opt/ckad-platform/docker-compose.yml down

[Install]
WantedBy=multi-user.target
```

### Orphan Cleanup Script

```bash
#!/bin/bash
# /usr/local/bin/cleanup-orphans.sh

# Remove any orphaned KIND clusters
for cluster in $(kind get clusters 2>/dev/null); do
  echo "Cleaning up orphan cluster: $cluster"
  kind delete cluster --name "$cluster"
done

# Remove any orphaned terminal containers
for container in $(docker ps -a --filter "name=term-" --format "{{.Names}}" 2>/dev/null); do
  echo "Cleaning up orphan container: $container"
  docker rm -f "$container"
done

# Clean up old kubeconfig files
find /tmp -name "kubeconfig-ckad-*" -mmin +120 -delete
find /tmp -name "kind-config-ckad-*" -mmin +120 -delete
```

---

# 11. **Deployment Instructions for Production**

### Step 1 — Buy VM

Recommended:

* Hetzner CPX41 or CX41
  * 8 vCPU
  * 32 GB RAM
  * ~€25–30/month

SSH to VM.

---

### Step 2 — Install required software

```bash
# Update system
apt update && apt upgrade -y

# Install Docker
apt install -y docker.io docker-compose
systemctl enable docker
systemctl start docker

# Install KIND
curl -Lo ./kind https://kind.sigs.k8s.io/dl/latest/kind-linux-amd64
chmod +x kind
mv kind /usr/local/bin/

# Install kubectl (for debugging)
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
mv kubectl /usr/local/bin/

# Create app directory
mkdir -p /opt/ckad-platform
```

Install Node or Go environment (LLM decides).

---

### Step 3 — Clone the project

```bash
git clone <your-repo> /opt/ckad-platform
cd /opt/ckad-platform
```

---

### Step 4 — Configure environment

```bash
cp .env.example .env
# Edit .env with your values:
# - GOOGLE_CLIENT_ID
# - GOOGLE_CLIENT_SECRET
# - SENDGRID_API_KEY
# - JWT_SECRET
# - DATABASE_URL
# - DOMAIN
```

---

### Step 5 — Build and run

```bash
# Build terminal image
docker build -t ckad-terminal:latest -f docker/terminal/Dockerfile .

# Run platform
docker-compose up -d
```

---

### Step 6 — Configure domain & HTTPS

Use **Caddy** (auto-provision SSL):

```caddyfile
# Caddyfile
yourdomain.com {
    # API routes
    handle /api/* {
        reverse_proxy backend:3000
    }
    
    # WebSocket
    handle /ws/* {
        reverse_proxy backend:3000
    }
    
    # Frontend
    handle {
        reverse_proxy frontend:3000
    }
    
    # Security headers
    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy strict-origin-when-cross-origin
    }
}
```

---

### Step 7 — Setup systemd service

```bash
cp ckad-platform.service /etc/systemd/system/
cp cleanup-orphans.sh /usr/local/bin/
chmod +x /usr/local/bin/cleanup-orphans.sh
systemctl daemon-reload
systemctl enable ckad-platform
systemctl start ckad-platform
```

---

### Step 8 — Setup backup cron

```bash
# /etc/cron.d/ckad-backup
0 */6 * * * root /opt/ckad-platform/scripts/backup-db.sh
```

---

# 12. **Non-Functional Requirements**

### Performance

* Create cluster in < 60 seconds
* Max concurrent clusters: 6-8 (safe), 10 (max)
* WebSocket latency: < 50ms

### Reliability

* Auto-cleaner runs every 30 seconds
* No orphan docker containers allowed
* Graceful shutdown with session preservation
* Database backup every 6 hours

### Observability

* Log all backend events (structured JSON)
* Log session creations/deletions with timing
* Provide `/healthz` and `/readyz` endpoints
* (Optional) Prometheus metrics at `/metrics`

### Cost

* Must run under **$100/month**
* Target: $30-50/month with Hetzner

---

# 13. **Folder Structure (LLM must generate)**

```
project/
  backend/
    src/
      index.js (or main.go)
      config/
        index.js
      api/
        routes/
          auth.js
          session.js
          tasks.js
          health.js
        middleware/
          auth.js
          rateLimit.js
          errorHandler.js
    services/
        kind.js
        terminal.js
        port.js
        email.js
        cleanup.js
    db/
        index.js
        migrations/
    models/
        user.js
        session.js
        task.js
      websocket/
        terminal.js
    package.json
    Dockerfile
  frontend/
    src/
      pages/
        index.jsx
        login.jsx
        dashboard.jsx
    components/
        Terminal.jsx
        TaskPanel.jsx
        Timer.jsx
        SessionControls.jsx
      hooks/
        useAuth.js
        useSession.js
        useWebSocket.js
    styles/
    package.json
    Dockerfile
  docker/
    terminal/
      Dockerfile
  scripts/
    backup-db.sh
    cleanup-orphans.sh
  tasks/
    task-001-pods.md
    task-002-deployments.md
    task-003-services.md
    ...
  docker-compose.yml
  Caddyfile
  .env.example
  ckad-platform.service
  README.md
```

---

# 14. **Task List (LLM implementation checklist)**

### Backend

* [ ] Implement /api/auth/google (OAuth initiate)
* [ ] Implement /api/auth/google/callback
* [ ] Implement /api/auth/email/otp (send OTP)
* [ ] Implement /api/auth/email/verify
* [ ] Implement /api/auth/refresh (refresh token)
* [ ] Implement /api/auth/logout
* [ ] Implement /api/session/start
* [ ] Implement /api/session/status
* [ ] Implement /api/session/extend
* [ ] Implement /api/session/stop
* [ ] Implement /api/tasks/list
* [ ] Implement /api/tasks/:id
* [ ] Implement /ws/terminal (WebSocket with JWT auth)
* [ ] Implement /healthz and /readyz
* [ ] Implement KIND creation service
* [ ] Implement kubeconfig generation
* [ ] Implement port allocation service (with DB transactions)
* [ ] Implement terminal container service
* [ ] Implement TTL job scheduler (every 30s)
* [ ] Implement orphan cleanup on startup
* [ ] Implement DB models and migrations
* [ ] Implement logging middleware (structured JSON)
* [ ] Implement rate limiting middleware
* [ ] Implement error handling middleware
* [ ] Implement graceful shutdown handler

### Frontend

* [ ] Login page (Google + Email OTP)
* [ ] Dashboard with session status
* [ ] Session Start button (with loading state)
* [ ] Session Stop button (with confirmation)
* [ ] Session Extend button
* [ ] Timer component (with warnings at 10/5/1 min)
* [ ] Terminal using xterm.js + WebSocket
* [ ] Tasks list panel
* [ ] Task detail panel (Markdown rendered)
* [ ] Error handling and toast notifications
* [ ] Responsive design

### DevOps

* [ ] Dockerfile for backend
* [ ] Dockerfile for frontend
* [ ] Dockerfile for terminal container
* [ ] docker-compose.yml
* [ ] Caddyfile for reverse proxy + HTTPS
* [ ] Systemd service file
* [ ] Orphan cleanup script
* [ ] Database backup script
* [ ] .env.example with all required variables

### Content

* [ ] Create 10+ CKAD practice tasks (Markdown)

---

# 15. **Deliverables for the LLM Agent**

The agent can now generate:

* Backend codebase (with all security fixes)
* Frontend codebase (with timer warnings)
* Docker compose
* KIND orchestration with isolated networking
* Secure terminal container
* WebSocket executor with JWT auth
* Database schema with port allocation
* Sample CKAD tasks
* Deployment scripts
* Backup and cleanup scripts

Everything is explicitly specified — no ambiguity.

---

# 16. **API Reference Summary**

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| /api/auth/google | GET | No | Initiate Google OAuth |
| /api/auth/google/callback | GET | No | OAuth callback |
| /api/auth/email/otp | POST | No | Send OTP to email |
| /api/auth/email/verify | POST | No | Verify OTP |
| /api/auth/refresh | POST | Refresh Token | Get new access token |
| /api/auth/logout | POST | JWT | Invalidate refresh token |
| /api/session/start | POST | JWT | Create new session |
| /api/session/status | GET | JWT | Get current session status |
| /api/session/extend | POST | JWT | Extend session TTL |
| /api/session/stop | POST | JWT | End session |
| /api/tasks | GET | JWT | List all tasks |
| /api/tasks/:id | GET | JWT | Get task details |
| /ws/terminal | WS | JWT (query param) | Terminal WebSocket |
| /healthz | GET | No | Health check |
| /readyz | GET | No | Readiness check |

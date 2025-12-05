# CKAD Practice Platform - Backend

Backend API for the CKAD Hands-on Practice Platform.

## Features

- 🔐 **Authentication**: Google OAuth + Email OTP
- 🎯 **Session Management**: Create, extend, and destroy KIND clusters
- 🖥️ **Terminal WebSocket**: Real-time terminal access to Kubernetes clusters
- 📝 **Task Management**: CKAD practice tasks with difficulty levels
- 🔄 **Auto-cleanup**: Automatic session expiration and orphan cleanup

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Database**: SQLite (with WAL mode)
- **WebSocket**: ws
- **Authentication**: JWT + Refresh Tokens
- **Container Management**: Docker + KIND

## Prerequisites

- Node.js 20+
- Docker
- KIND (Kubernetes in Docker)
- kubectl

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

```bash
cp env.example .env
# Edit .env with your configuration
```

Required environment variables:
- `JWT_SECRET` - Secret for access tokens
- `JWT_REFRESH_SECRET` - Secret for refresh tokens
- `RESEND_API_KEY` - API key for email (optional in dev)

### 3. Initialize Database

```bash
npm run seed
```

### 4. Build Terminal Image

```bash
docker build -t ckad-terminal:latest -f ../docker/terminal/Dockerfile ../docker/terminal
```

### 5. Start Development Server

```bash
npm run dev
```

The API will be available at `http://localhost:3001`.

## API Endpoints

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/email/otp` | POST | Send OTP to email |
| `/api/auth/email/verify` | POST | Verify OTP and login |
| `/api/auth/google` | GET | Initiate Google OAuth |
| `/api/auth/google/callback` | GET | OAuth callback |
| `/api/auth/refresh` | POST | Refresh access token |
| `/api/auth/logout` | POST | Logout |
| `/api/auth/me` | GET | Get current user |

### Sessions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/session/start` | POST | Start new practice session |
| `/api/session/status` | GET | Get current session status |
| `/api/session/extend` | POST | Extend session TTL |
| `/api/session/stop` | POST | End current session |

### Tasks

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/tasks` | GET | List all tasks |
| `/api/tasks/categories` | GET | List task categories |
| `/api/tasks/:id` | GET | Get task details |

### Health

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/healthz` | GET | Health check |
| `/readyz` | GET | Readiness check |
| `/api/status` | GET | Platform status |

### WebSocket

| Endpoint | Description |
|----------|-------------|
| `/ws/terminal` | Terminal WebSocket connection |

**Query Parameters:**
- `token` - JWT access token
- `sessionId` - Active session ID

**Message Types (Client → Server):**
```json
{ "type": "input", "data": "ls -la\n" }
{ "type": "resize", "cols": 120, "rows": 40 }
{ "type": "ping" }
```

**Message Types (Server → Client):**
```json
{ "type": "connected", "sessionId": "...", "message": "..." }
{ "type": "output", "data": "..." }
{ "type": "exit", "code": 0 }
{ "type": "error", "message": "..." }
{ "type": "pong" }
```

## Project Structure

```
backend/
├── src/
│   ├── index.js              # Entry point
│   ├── config/
│   │   └── index.js          # Configuration
│   ├── api/
│   │   ├── routes/
│   │   │   ├── auth.js       # Auth endpoints
│   │   │   ├── session.js    # Session endpoints
│   │   │   ├── tasks.js      # Task endpoints
│   │   │   └── health.js     # Health endpoints
│   │   └── middleware/
│   │       ├── auth.js       # JWT authentication
│   │       ├── rateLimit.js  # Rate limiting
│   │       └── errorHandler.js
│   ├── services/
│   │   ├── kind.js           # KIND cluster management
│   │   ├── terminal.js       # Terminal container management
│   │   ├── email.js          # Email service
│   │   └── cleanup.js        # Cleanup scheduler
│   ├── websocket/
│   │   └── terminal.js       # WebSocket handler
│   ├── models/
│   │   ├── user.js
│   │   ├── session.js
│   │   ├── task.js
│   │   ├── port.js
│   │   └── auth.js
│   ├── db/
│   │   ├── index.js          # Database initialization
│   │   └── seed.js           # Seed CKAD tasks
│   └── utils/
│       └── logger.js         # Winston logger
├── Dockerfile
├── package.json
├── env.example
└── README.md
```

## Development

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

### Database Migrations

The database schema is auto-initialized on startup. For manual seeding:

```bash
npm run seed
```

## Production Deployment

### Using Docker

```bash
docker build -t ckad-backend:latest .
docker run -d \
  -p 3001:3001 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v $(pwd)/data:/app/data \
  --env-file .env \
  ckad-backend:latest
```

### Using Docker Compose

From the project root:

```bash
docker-compose up -d backend
```

## Security Considerations

1. **JWT Tokens**: 15-minute access tokens, 7-day refresh tokens
2. **Rate Limiting**: 
   - General API: 100 req/min
   - Auth: 10 req/min
   - Session start: 3 req/hour
3. **Session Isolation**: Each user gets isolated KIND cluster
4. **Terminal Security**: Containers are resource-limited and network-isolated

## Troubleshooting

### KIND cluster creation fails

1. Check Docker is running: `docker info`
2. Check KIND is installed: `kind --version`
3. Check available ports: `netstat -tlnp | grep 30000`

### WebSocket connection fails

1. Verify JWT token is valid
2. Check session status: `GET /api/session/status`
3. Check container is running: `docker ps | grep term-`

### Database locked

Enable WAL mode (already configured):
```sql
PRAGMA journal_mode = WAL;
```

## License

MIT




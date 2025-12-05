# CKAD Practice Platform - Frontend

Modern web interface for the CKAD hands-on practice platform.

## Features

- 🔐 **Authentication**: Email OTP + Google OAuth login
- 🖥️ **Terminal**: Full xterm.js terminal with WebSocket connection
- 📝 **Tasks**: Markdown-rendered CKAD practice tasks
- ⏱️ **Timer**: Session countdown with visual warnings
- 🎨 **Design**: Cyberpunk/terminal-inspired dark theme

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **State**: Zustand
- **Terminal**: xterm.js
- **Markdown**: react-markdown + remark-gfm

## Development

### Prerequisites

- Node.js 20+
- npm or yarn

### Setup

```bash
cd frontend
npm install
```

### Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx       # Root layout
│   │   ├── page.tsx         # Home (redirect)
│   │   ├── globals.css      # Global styles
│   │   ├── login/
│   │   │   └── page.tsx     # Login page
│   │   ├── auth/
│   │   │   └── callback/
│   │   │       └── page.tsx # OAuth callback
│   │   └── dashboard/
│   │       └── page.tsx     # Main dashboard
│   ├── components/
│   │   ├── Terminal.tsx     # xterm.js terminal
│   │   ├── TaskPanel.tsx    # Task list & details
│   │   └── Timer.tsx        # Session timer
│   └── lib/
│       ├── api.ts           # API client
│       └── store.ts         # Zustand stores
├── public/
├── Dockerfile
├── next.config.js
├── tailwind.config.js
└── package.json
```

## Components

### Terminal

Full-featured terminal using xterm.js:
- WebSocket connection to backend
- Auto-reconnect on disconnect
- Fullscreen mode
- Custom cyberpunk theme

### TaskPanel

Practice task management:
- Grouped by category
- Difficulty indicators
- Completion tracking
- Markdown rendering

### Timer

Session countdown:
- Visual warnings at 10/5/1 minutes
- Session extension button
- Animated alerts

## Build for Production

```bash
npm run build
```

## Docker

```bash
docker build -t ckad-frontend:latest .
docker run -p 3000:3000 ckad-frontend:latest
```

## Design System

### Colors

| Name | Hex | Usage |
|------|-----|-------|
| terminal-bg | #0a0a0f | Background |
| terminal-surface | #12121a | Cards, panels |
| terminal-border | #1e1e2e | Borders |
| terminal-accent | #00ff9d | Primary accent |
| terminal-text | #e4e4e7 | Text |
| terminal-muted | #71717a | Secondary text |

### Typography

- **Display**: Space Grotesk
- **Mono**: JetBrains Mono, Fira Code

## License

MIT




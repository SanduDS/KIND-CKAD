'use client';

import { useEffect, useRef, useState } from 'react';
import { Terminal as TerminalIcon, Maximize2, Minimize2, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';

interface TerminalProps {
  sessionId: string;
  wsUrl: string;
  accessToken: string;
}

export default function Terminal({ sessionId, wsUrl, accessToken }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<any>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let xterm: any;
    let fitAddon: any;
    let webLinksAddon: any;

    const initTerminal = async () => {
      // Dynamic imports for xterm (client-side only)
      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');
      const { WebLinksAddon } = await import('@xterm/addon-web-links');
      
      // Import xterm CSS
      await import('@xterm/xterm/css/xterm.css');

      if (!terminalRef.current) return;

      // Create terminal instance
      xterm = new Terminal({
        theme: {
          background: '#0a0a0f',
          foreground: '#e4e4e7',
          cursor: '#00ff9d',
          cursorAccent: '#0a0a0f',
          selectionBackground: '#00ff9d33',
          black: '#0a0a0f',
          red: '#ef4444',
          green: '#00ff9d',
          yellow: '#fbbf24',
          blue: '#3b82f6',
          magenta: '#a855f7',
          cyan: '#06b6d4',
          white: '#e4e4e7',
          brightBlack: '#71717a',
          brightRed: '#f87171',
          brightGreen: '#4ade80',
          brightYellow: '#fcd34d',
          brightBlue: '#60a5fa',
          brightMagenta: '#c084fc',
          brightCyan: '#22d3ee',
          brightWhite: '#ffffff',
        },
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontSize: 14,
        lineHeight: 1.2,
        cursorBlink: true,
        cursorStyle: 'block',
        scrollback: 5000,
        convertEol: true,
        windowOptions: {
          setWinLines: true,
        },
      });

      // Add addons
      fitAddon = new FitAddon();
      webLinksAddon = new WebLinksAddon();
      xterm.loadAddon(fitAddon);
      xterm.loadAddon(webLinksAddon);

      // Open terminal in DOM
      xterm.open(terminalRef.current);
      fitAddon.fit();

      xtermRef.current = xterm;
      fitAddonRef.current = fitAddon;

      // Connect WebSocket
      connectWebSocket(xterm);

      // Handle resize with debouncing
      let resizeTimeout: NodeJS.Timeout;
      const handleResize = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          if (fitAddon && xterm) {
            fitAddon.fit();
            // Send resize to server
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(
                JSON.stringify({
                  type: 'resize',
                  cols: xterm.cols,
                  rows: xterm.rows,
                })
              );
            }
          }
        }, 50);
      };

      window.addEventListener('resize', handleResize);
      
      // Initial fit after a short delay to ensure container is sized
      setTimeout(() => {
        if (fitAddon) {
          fitAddon.fit();
        }
      }, 100);

      // Handle terminal input
      xterm.onData((data: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'input', data }));
        }
      });

      return () => {
        window.removeEventListener('resize', handleResize);
      };
    };

      const connectWebSocket = (xterm: any) => {
        setIsConnecting(true);
        setError(null);

        // Use relative WebSocket URL (same domain)
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsFullUrl = `${wsProtocol}//${window.location.host}${wsUrl}&token=${accessToken}`;
        const ws = new WebSocket(wsFullUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        
        // Send initial terminal size immediately after connection
        setTimeout(() => {
          if (fitAddon) {
            fitAddon.fit();
            ws.send(
              JSON.stringify({
                type: 'resize',
                cols: xterm.cols,
                rows: xterm.rows,
              })
            );
          }
        }, 100);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          switch (message.type) {
            case 'output':
              xterm.write(message.data);
              break;
            case 'connected':
              // Ignore - bash will show prompt
              break;
            case 'exit':
              xterm.write('\r\n\x1b[33m● Session ended\x1b[0m\r\n');
              setIsConnected(false);
              break;
            case 'error':
              xterm.write(`\r\n\x1b[31m● Error: ${message.message}\x1b[0m\r\n`);
              break;
            case 'server_shutdown':
              xterm.write('\r\n\x1b[33m● Server is restarting...\x1b[0m\r\n');
              break;
          }
        } catch (e) {
          // Handle raw data
          xterm.write(event.data);
        }
      };

      ws.onerror = () => {
        setError('Connection error');
        setIsConnecting(false);
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        setIsConnecting(false);
        if (event.code !== 1000) {
          xterm.write('\r\n\x1b[31m● Disconnected\x1b[0m\r\n');
        }
      };
    };

    initTerminal();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (xtermRef.current) {
        xtermRef.current.dispose();
      }
    };
  }, [sessionId, wsUrl, accessToken]);

  const handleReconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (xtermRef.current) {
      xtermRef.current.clear();
      const wsProtocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = typeof window !== 'undefined' ? window.location.host : 'localhost:3001';
      const wsFullUrl = `${wsProtocol}//${wsHost}${wsUrl}&token=${accessToken}`;
      const ws = new WebSocket(wsFullUrl);
      wsRef.current = ws;
      setIsConnecting(true);

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        xtermRef.current.write('\r\n\x1b[32m● Reconnected\x1b[0m\r\n\r\n');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'output') {
            xtermRef.current.write(message.data);
          }
        } catch {
          xtermRef.current.write(event.data);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
      };
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    setTimeout(() => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    }, 100);
  };

  return (
    <div
      className={clsx(
        'flex flex-col bg-terminal-bg border border-terminal-border rounded-xl overflow-hidden transition-all',
        {
          'fixed inset-4 z-50': isFullscreen,
          'h-full': !isFullscreen,
        }
      )}
    >
      {/* Terminal header */}
      <div className="flex items-center justify-between px-4 py-2 bg-terminal-surface border-b border-terminal-border">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-terminal-accent" />
          <span className="text-sm font-medium">Terminal</span>
          <div
            className={clsx('w-2 h-2 rounded-full', {
              'bg-green-500': isConnected,
              'bg-yellow-500 animate-pulse': isConnecting,
              'bg-red-500': !isConnected && !isConnecting,
            })}
          />
          <span className="text-xs text-terminal-muted">
            {isConnecting ? 'Connecting...' : isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isConnected && !isConnecting && (
            <button
              onClick={handleReconnect}
              className="p-1.5 hover:bg-terminal-border rounded-lg transition-colors"
              title="Reconnect"
            >
              <RefreshCw className="w-4 h-4 text-terminal-muted hover:text-terminal-accent" />
            </button>
          )}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 hover:bg-terminal-border rounded-lg transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-terminal-muted hover:text-terminal-accent" />
            ) : (
              <Maximize2 className="w-4 h-4 text-terminal-muted hover:text-terminal-accent" />
            )}
          </button>
        </div>
      </div>

      {/* Terminal content */}
      <div ref={terminalRef} className="flex-1 p-2" />

      {/* Error message */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}


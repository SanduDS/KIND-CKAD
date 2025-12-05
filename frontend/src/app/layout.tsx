import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'CKAD Practice Platform',
  description: 'Hands-on Kubernetes practice for CKAD certification',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <Toaster 
          theme="dark" 
          position="top-right"
          toastOptions={{
            style: {
              background: '#12121a',
              border: '1px solid #1e1e2e',
              color: '#e4e4e7',
            },
          }}
        />
      </body>
    </html>
  );
}


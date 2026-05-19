import type { Metadata, Viewport } from 'next';
import './globals.css';
import { QueryProvider } from '@/components/shared/QueryProvider';

export const metadata: Metadata = {
  title: 'Apex Command Center OS',
  description: 'Master Federation Control Platform — Global Fleet Intelligence Dashboard',
  icons: { icon: '/favicon.ico' },
};

export const viewport: Viewport = {
  themeColor: '#050810',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-apex-bg text-apex-text antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}

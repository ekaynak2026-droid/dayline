import type { Metadata, Viewport } from 'next';
import './globals.css';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';
const TEST = process.env.NEXT_PUBLIC_DAYLINE_TEST === '1';

export const metadata: Metadata = {
  title: TEST ? 'Dayline (test)' : 'Dayline',
  description: "Today's tasks, a monthly calendar and notes.",
  manifest: `${BASE}/manifest.webmanifest`,
  icons: { icon: `${BASE}/icons/icon-192.png`, apple: `${BASE}/icons/apple-touch-icon.png` },
  appleWebApp: { capable: true, title: TEST ? 'Dayline test' : 'Dayline', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EDF0F3' },
    { media: '(prefers-color-scheme: dark)', color: '#0F151B' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'AAR · After Action Report',
  description: 'The AI companion that never forgets an adventure.',
  manifest: '/manifest.webmanifest',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

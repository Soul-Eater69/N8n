import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'StageRush - Live Event Tickets',
  description:
    'Book tickets for concerts, theater, sports, and live events. Real-time seat selection with interactive venue maps.',
  keywords: ['tickets', 'events', 'concerts', 'live', 'booking', 'seats'],
  openGraph: {
    title: 'StageRush - Live Event Tickets',
    description:
      'Book tickets for concerts, theater, sports, and live events.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen`}>{children}</body>
    </html>
  );
}

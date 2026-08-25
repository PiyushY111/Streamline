import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '../providers/providers';

export const metadata: Metadata = {
  title: {
    default: 'Streamline OS',
    template: '%s | Streamline OS',
  },
  description: 'Unified Inbox, Calendar, Agenda & Task Management Workspace',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      </head>
      <body className="antialiased min-h-screen bg-background text-foreground transition-colors duration-200">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '../providers/providers';

export const metadata: Metadata = {
  title: 'Streamline — Personal Productivity OS',
  description: 'Unified email, calendar, agenda, and task management across multiple accounts.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

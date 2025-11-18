import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import SessionProvider from '@/components/SessionProvider';
import BootstrapClient from '@/components/BootstrapClient';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'iSAR - Imam and Bilal Schedule System',
  description: 'Prayer schedule management system for mosques and surau',
};

// Force server rendering for the app to avoid static prerender errors
export const dynamic = 'force-dynamic';
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider>
          {children}
          <BootstrapClient />
        </SessionProvider>
      </body>
    </html>
  );
}

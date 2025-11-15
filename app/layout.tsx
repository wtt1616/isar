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

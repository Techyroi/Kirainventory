import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { CurrencyProvider } from '@/context/CurrencyContext';
import { AppLayout } from '@/components/layout/AppLayout';

export const metadata: Metadata = {
  title: 'Kiralyte POS system - Production-Ready Inventory Management System',
  description: 'Manage products, track stock, record purchases and sales, handle POS checkout, and analyze business performance.',
  icons: {
    icon: '/kiralyte-icon.png',
    shortcut: '/favicon.ico',
    apple: '/kiralyte-icon.png'
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans bg-slate-950 text-slate-100 antialiased">
        <AuthProvider>
          <CurrencyProvider>
            <AppLayout>
              {children}
            </AppLayout>
          </CurrencyProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

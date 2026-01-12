import './globals.css';
import { ReactNode } from 'react';
import TopNav from './components/TopNav';
import ThemeRegistry from './components/ThemeRegistry';
import ChatWidget from './components/ChatWidget';
import { SWRConfig } from 'swr';

export const metadata = {
  title: '',
  description: 'Track delivery requests and couriers',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeRegistry>
            <SWRConfig value={{ refreshInterval: 5000 }}>
              <TopNav />
              {children}
            <ChatWidget />
            </SWRConfig>
        </ThemeRegistry>
      </body>
    </html>
  );
}

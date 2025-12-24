import './globals.css';
import { ReactNode } from 'react';
import TopNav from './components/TopNav';
import ThemeRegistry from './components/ThemeRegistry';
import { SWRConfig } from 'swr';

export const metadata = {
  title: 'Brillar Delivery',
  description: 'Track delivery requests and couriers'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeRegistry>
          <SWRConfig value={{ refreshInterval: 5000 }}>
            <TopNav />
            {children}
          </SWRConfig>
        </ThemeRegistry>
      </body>
    </html>
  );
}

import './globals.css';
import { ReactNode } from 'react';
import TopNav from './components/TopNav';
import ThemeRegistry from './components/ThemeRegistry';
import { SWRConfig } from 'swr';

<<<<<<< HEAD
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#C9A227', contrastText: '#0F0F0F' },
    secondary: { main: '#B8B8B8', contrastText: '#0F0F0F' },
    background: {
      default: '#0F0F0F',
      paper: '#161616'
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#B8B8B8'
    }
  }
});

=======
>>>>>>> aaf4670 (fix)
export const metadata = {
  title: 'Office Delivery Tracking',
  description: 'Track office delivery requests and couriers'
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

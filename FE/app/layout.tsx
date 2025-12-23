import './globals.css';
import { ReactNode } from 'react';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import TopNav from './components/TopNav';
import { SWRConfig } from 'swr';

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

export const metadata = {
  title: 'Office Delivery Tracking',
  description: 'Track office delivery requests and couriers'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppRouterCacheProvider>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <SWRConfig value={{ refreshInterval: 5000 }}>
              <TopNav />
              {children}
            </SWRConfig>
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}

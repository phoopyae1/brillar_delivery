import './globals.css';
import { ReactNode } from 'react';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import TopNav from './components/TopNav';
import { SWRConfig } from 'swr';

const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },
    secondary: { main: '#9c27b0' }
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

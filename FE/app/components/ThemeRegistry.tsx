'use client';

import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { ReactNode } from 'react';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#C9A227', contrastText: '#0F0F0F' },
    secondary: { main: '#B8B8B8', contrastText: '#0F0F0F' },
    background: {
      default: '#0F0F0F',
      paper: '#1A1A1A'
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#B8B8B8'
    }
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#1F1F1F',
          '&:hover': {
            backgroundColor: '#242424'
          }
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#1A1A1A'
        }
      }
    }
  }
});

export default function ThemeRegistry({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}


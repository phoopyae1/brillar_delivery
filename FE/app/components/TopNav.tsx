'use client';
import Link from 'next/link';
import { AppBar, Toolbar, Typography, Stack, Button } from '@mui/material';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';

const links = [
  { href: '/', label: 'Home' },
  { href: '/track/quick', label: 'Track' },
  { href: '/dashboard/sender', label: 'Sender' },
  { href: '/dashboard/dispatcher', label: 'Dispatcher' },
  { href: '/dashboard/courier', label: 'Courier' },
  { href: '/admin', label: 'Admin' }
];

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <AppBar
      position="sticky"
      color="transparent"
      elevation={0}
      sx={{
        backdropFilter: 'blur(12px)',
        background: 'linear-gradient(120deg, rgba(15, 15, 15, 0.92), rgba(201, 162, 39, 0.18))',
        borderBottom: '1px solid rgba(184, 184, 184, 0.24)'
      }}
    >
      <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', py: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: -0.5 }}>
          Office Delivery Tracker
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          {links.map((link) => (
            <Button
              key={link.href}
              component={Link}
              href={link.href}
              variant={pathname?.startsWith(link.href) ? 'contained' : 'text'}
              color={pathname?.startsWith(link.href) ? 'primary' : 'inherit'}
              sx={{
                textTransform: 'none',
                borderRadius: '999px',
                px: 2,
                border: pathname?.startsWith(link.href)
                  ? '1px solid rgba(201, 162, 39, 0.24)'
                  : '1px solid rgba(184, 184, 184, 0.25)',
                bgcolor: pathname?.startsWith(link.href) ? 'primary.main' : 'transparent',
                color: pathname?.startsWith(link.href) ? 'primary.contrastText' : 'text.primary',
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: pathname?.startsWith(link.href)
                    ? 'primary.main'
                    : 'rgba(201, 162, 39, 0.14)',
                  color: pathname?.startsWith(link.href) ? 'primary.contrastText' : 'white'
                }
              }}
            >
              {link.label}
            </Button>
          ))}
          {user ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2">{user.name} ({user.role})</Typography>
              <Button variant="outlined" size="small" onClick={() => { logout(); router.push('/login'); }}>
                Logout
              </Button>
            </Stack>
          ) : (
            <Button variant="contained" component={Link} href="/login">
              Login
            </Button>
          )}
        </Stack>
      </Toolbar>
    </AppBar>
  );
}

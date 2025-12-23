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
    <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: '1px solid #eee' }}>
      <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="h6">Office Delivery Tracker</Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          {links.map((link) => (
            <Button key={link.href} component={Link} href={link.href} color={pathname?.startsWith(link.href) ? 'primary' : 'inherit'}>
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

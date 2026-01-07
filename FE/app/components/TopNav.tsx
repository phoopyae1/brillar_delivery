'use client';
import Link from 'next/link';
import { AppBar, Toolbar, Typography, Stack, Button } from '@mui/material';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';

// Helper functions to get dynamic links with IDs
const getSenderLink = (userId?: string) => {
  return userId ? `/sender/${userId}` : '/dashboard/sender';
};

const getDispatcherLink = (userId?: string) => {
  return userId ? `/dashboard/dispatcher/${userId}` : '/dashboard/dispatcher';
};

const getCourierLink = (userId?: string) => {
  return userId ? `/dashboard/courier/${userId}` : '/dashboard/courier';
};

const allLinks = [
  { href: '/', label: 'Home', roles: [] }, // Everyone can see Home
  { href: '/track/quick', label: 'Track', roles: [] }, // Everyone can see Track
  { href: '/dashboard/sender', label: 'My Deliveries', roles: ['SENDER', 'ADMIN'], dynamic: true, getLink: getSenderLink }, // ADMIN has access, will be replaced with /sender/{id}
  { href: '/dashboard/dispatcher', label: 'Dispatcher', roles: ['DISPATCHER', 'ADMIN'], dynamic: true, getLink: getDispatcherLink }, // ADMIN has access, will be replaced with /dashboard/dispatcher/{id}
  { href: '/dashboard/courier', label: 'Courier', roles: ['COURIER', 'DISPATCHER', 'ADMIN'], dynamic: true, getLink: getCourierLink }, // ADMIN has access, will be replaced with /dashboard/courier/{id}
  { href: '/admin', label: 'Admin', roles: ['ADMIN'] } // ADMIN only
];

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  // Filter links based on user role
  const getVisibleLinks = () => {
    if (!user) {
      // Not logged in - show only public links
      return allLinks.filter(link => link.roles.length === 0);
    }
    // Logged in - show public links + role-specific links
    // ADMIN role has access to all dashboards (sender, dispatcher, courier, admin)
    return allLinks.filter(link => 
      link.roles.length === 0 || link.roles.includes(user.role)
    );
  };

  const visibleLinks = getVisibleLinks();

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
          Brillar Delivery
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          {visibleLinks.map((link) => {
            // Use dynamic link with user ID if available
            let href = link.href;
            if ((link as any).dynamic && user?.id && (link as any).getLink) {
              href = (link as any).getLink(user.id);
            }
            const isActive = pathname?.startsWith(href) || 
              (href.includes('/sender/') && pathname?.startsWith('/sender/')) ||
              (href.includes('/dashboard/dispatcher/') && pathname?.startsWith('/dashboard/dispatcher/')) ||
              (href.includes('/dashboard/courier/') && pathname?.startsWith('/dashboard/courier/'));
            
            return (
              <Button
                key={link.href}
                component={Link}
                href={href}
                variant={isActive ? 'contained' : 'text'}
                color={isActive ? 'primary' : 'inherit'}
                sx={{
                  textTransform: 'none',
                  borderRadius: '999px',
                  px: 2,
                  border: isActive
                    ? '1px solid rgba(201, 162, 39, 0.24)'
                    : '1px solid rgba(184, 184, 184, 0.25)',
                  bgcolor: isActive ? 'primary.main' : 'transparent',
                  color: isActive ? 'primary.contrastText' : 'text.primary',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: isActive
                      ? 'primary.main'
                      : 'rgba(201, 162, 39, 0.14)',
                    color: isActive ? 'primary.contrastText' : 'white'
                  }
                }}
              >
                {link.label}
              </Button>
            );
          })}
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

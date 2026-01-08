'use client';
import { AppBar, Toolbar, Typography, Stack, Button } from '@mui/material';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';

// Helper function to get sender link with ID
const getSenderLink = (userId?: number) => {
  return userId ? `/sender/${userId}` : '/dashboard/sender';
};

const allLinks = [
  { href: '/', label: 'Home', roles: [], logoutOnClick: true }, // Everyone can see Home, logout on click
  { href: '/track/quick', label: 'Track', roles: [], showWhenLoggedIn: false }, // Only show when NOT logged in
  { href: '/dashboard/sender', label: 'My Deliveries', roles: ['SENDER', 'ADMIN'], dynamic: true }, // ADMIN has access, will be replaced with /sender/{id}
  { href: '/dashboard/dispatcher', label: 'Dispatcher', roles: ['DISPATCHER', 'ADMIN'] }, // ADMIN has access
  { href: '/dashboard/courier', label: 'Courier', roles: ['COURIER', 'ADMIN'] }, // ADMIN has access, removed DISPATCHER
  { href: '/admin', label: 'Admin', roles: ['ADMIN'] } // ADMIN only
];

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  // Filter links based on user role
  const getVisibleLinks = () => {
    if (!user) {
      // Not logged in - show public links including Track
      return allLinks.filter(link => {
        // Show links with no role requirement (public links)
        // Track link has showWhenLoggedIn: false, which means show when NOT logged in
        if (link.roles.length === 0) {
          // If showWhenLoggedIn is false, it means show when NOT logged in, so include it
          if (link.showWhenLoggedIn === false) {
            return true; // Show Track when not logged in
          }
          // Other public links (like Home) are always shown
          return true;
        }
        return false;
      });
    }
    // Logged in - show public links + role-specific links (but hide Track)
    // ADMIN role has access to all dashboards (sender, dispatcher, courier, admin)
    return allLinks.filter(link => {
      // Hide Track when logged in
      if (link.showWhenLoggedIn === false) {
        return false;
      }
      // Show if it's a public link or user has the required role
      return link.roles.length === 0 || link.roles.includes(user.role);
    });
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
            // Use dynamic sender link with user ID if available
            const href = (link as any).dynamic && user?.id ? getSenderLink(user.id) : link.href;
            const isActive = pathname?.startsWith(href) || (href.includes('/sender/') && pathname?.startsWith('/sender/'));
            
            // Handle navigation with full page refresh
            const handleClick = async (e: React.MouseEvent) => {
              e.preventDefault();
              
              // Handle logout on Home click
              if ((link as any).logoutOnClick && user) {
                await logout();
              }
              
              // Use window.location for full page refresh
              window.location.href = href;
            };
            
            return (
              <Button
                key={link.href}
                onClick={handleClick}
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
              <Button variant="outlined" size="small" onClick={async () => { 
                await logout(); 
                window.location.href = '/login'; 
              }}>
                Logout
              </Button>
            </Stack>
          ) : (
            <Button variant="contained" onClick={() => { window.location.href = '/login'; }}>
              Login
            </Button>
          )}
        </Stack>
      </Toolbar>
    </AppBar>
  );
}

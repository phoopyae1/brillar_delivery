'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  Stack,
  Typography
} from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import BoltIcon from '@mui/icons-material/Bolt';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useAuth } from './hooks/useAuth';

const features = [
  {
    icon: <LocalShippingIcon fontSize="large" color="primary" />,
    title: 'End-to-end visibility',
    description: 'Track packages from pickup to drop-off with live updates for every role.'
  },
  {
    icon: <QueryStatsIcon fontSize="large" color="primary" />,
    title: 'Smart insights',
    description: 'Monitor SLAs, bottlenecks, and courier performance at a glance.'
  },
  {
    icon: <AdminPanelSettingsIcon fontSize="large" color="primary" />,
    title: 'Secure roles',
    description: 'Role-aware dashboards for senders, dispatchers, couriers, and admins.'
  }
];

const quickActions = [
  { label: 'Track a package', href: '/track/quick', variant: 'contained' },
  { label: 'Log in', href: '/login', variant: 'outlined' },
  { label: 'Register', href: '/register', variant: 'text' }
];

export default function HomePage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  // Auto-logout when logged-in user visits home page
  useEffect(() => {
    const handleLogout = async () => {
      if (user) {
        await logout();
        // Force a refresh to ensure clean state
        router.refresh();
      }
    };
    handleLogout();
  }, [user, logout, router]);

  return (
    <Box sx={{ position: 'relative', overflow: 'hidden' }}>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 10% 20%, rgba(25, 118, 210, 0.12), transparent 25%), radial-gradient(circle at 90% 20%, rgba(156, 39, 176, 0.12), transparent 22%), radial-gradient(circle at 30% 80%, rgba(25, 118, 210, 0.1), transparent 30%)'
        }}
      />

      <Container sx={{ py: { xs: 6, md: 10 }, position: 'relative' }}>
        <Grid container spacing={4} alignItems="center">
          <Grid item xs={12} md={6}>
            <Chip
              icon={<BoltIcon />}
              label="Frictionless deliveries"
              color="primary"
              sx={{ mb: 2, fontWeight: 600, borderRadius: '999px', bgcolor: 'primary.light', color: 'primary.dark' }}
            />
            <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
              Keep every package on the fast lane
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 3, maxWidth: 520 }}>
              Unified dashboards for the whole courier chain—senders, dispatchers, couriers, and admins stay in sync with
              real-time tracking and accountability.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 4 }}>
              {quickActions.map((action) => (
                <Button
                  key={action.href}
                  variant={action.variant as 'text' | 'outlined' | 'contained'}
                  size="large"
                  onClick={() => { window.location.href = action.href; }}
                  sx={{
                    textTransform: 'none',
                    borderRadius: '12px',
                    px: 3,
                    boxShadow: action.variant === 'contained' ? '0 10px 30px rgba(25, 118, 210, 0.25)' : 'none'
                  }}
                >
                  {action.label}
                </Button>
              ))}
            </Stack>
            <Stack direction="row" spacing={4} alignItems="center">
              <Stack spacing={0.5}>
                <Typography variant="h4" sx={{ fontWeight: 800 }}>
                  2.5k+
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Shipments reconciled every week
                </Typography>
              </Stack>
              <Divider orientation="vertical" flexItem />
              <Stack spacing={0.5}>
                <Typography variant="h4" sx={{ fontWeight: 800 }}>
                  99.8%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  On-time delivery accuracy
                </Typography>
              </Stack>
            </Stack>
          </Grid>

          <Grid item xs={12} md={6}>
            <Box
              sx={{
                p: 4,
                borderRadius: 4,
                bgcolor: 'background.paper',
                border: '1px solid rgba(201, 162, 39, 0.2)',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}
            >
              <Stack spacing={4}>
                <Box>
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: '16px',
                        bgcolor: 'primary.main',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'primary.contrastText'
                      }}
                    >
                      <LocationOnIcon sx={{ fontSize: 28 }} />
                    </Box>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        Wide Coverage
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Serving Singapore, Thailand & Myanmar
                      </Typography>
                    </Box>
                  </Stack>
                </Box>

                <Box>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: '16px',
                        bgcolor: 'primary.main',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'primary.contrastText'
                      }}
                    >
                      <AccessTimeIcon sx={{ fontSize: 28 }} />
                    </Box>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        Express Options
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Standard & Express delivery available
                      </Typography>
                    </Box>
                  </Stack>
                </Box>

                {/* <Box
                  sx={{
                    mt: 2,
                    p: 3,
                    borderRadius: 2,
                    bgcolor: 'rgba(201, 162, 39, 0.1)',
                    border: '1px solid rgba(201, 162, 39, 0.2)'
                  }}
                >
                  <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
                    Ready to ship?
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Create your shipment in minutes and track it every step of the way.
                  </Typography>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={() => { window.location.href = '/create-shipment'; }}
                    sx={{
                      textTransform: 'none',
                      borderRadius: '8px',
                      fontWeight: 600
                    }}
                  >
                    Create Shipment
                  </Button>
                </Box> */}
              </Stack>
            </Box>
          </Grid>
        </Grid>

        <Box sx={{ mt: 10 }}>
          <Typography variant="overline" sx={{ letterSpacing: 1, color: 'text.secondary' }}>
            Why teams choose us
          </Typography>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {features.map((feature) => (
              <Grid item xs={12} md={4} key={feature.title}>
                <Card
                  variant="outlined"
                  sx={{
                    height: '100%',
                    borderRadius: 3,
                      borderColor: 'rgba(201, 162, 39, 0.15)',
                      bgcolor: '#1F1F1F',
                      boxShadow: '0 15px 45px rgba(0, 0, 0, 0.2)',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        bgcolor: '#242424',
                        borderColor: 'rgba(201, 162, 39, 0.3)',
                        transform: 'translateY(-2px)'
                      }
                  }}
                >
                  <CardContent>
                    <Box sx={{ mb: 2 }}>{feature.icon}</Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                      {feature.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {feature.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Container>
    </Box>
  );
}

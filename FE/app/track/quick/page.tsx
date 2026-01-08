'use client';
import { useState } from 'react';
import { 
  Button, 
  Container, 
  Stack, 
  TextField, 
  Typography,
  Box,
  InputAdornment,
  Grid,
  Paper
} from '@mui/material';
import {
  Search,
  LocalShipping,
  LocationOn,
  AccessTime,
  Verified,
  Security,
  Speed,
  NotificationsActive,
  CheckCircle,
  TrendingUp
} from '@mui/icons-material';

export default function QuickTrackPage() {
  const [code, setCode] = useState('');

  const handleTrack = () => {
    if (code.trim()) {
      window.location.href = `/track/${code.trim()}`;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && code.trim()) {
      handleTrack();
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Left Side - Visual Section */}
      <Box
        sx={{
          flex: { xs: 0, md: 1 },
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          bgcolor: '#0a0a0a',
          position: 'relative',
          p: 6,
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: '-50%',
            left: '-50%',
            width: '200%',
            height: '200%',
            background: 'radial-gradient(circle, rgba(201, 162, 39, 0.15) 0%, transparent 70%)',
            animation: 'rotate 20s linear infinite',
            '@keyframes rotate': {
              '0%': { transform: 'rotate(0deg)' },
              '100%': { transform: 'rotate(360deg)' }
            }
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(135deg, rgba(201, 162, 39, 0.1) 0%, transparent 100%)',
            opacity: 0.5
          }
        }}
      >
        <Box sx={{ position: 'relative', zIndex: 1, textAlign: 'center', width: '100%', maxWidth: 500 }}>
          {/* Main Icon */}
          <Box
            sx={{
              mb: 4,
              animation: 'float 3s ease-in-out infinite',
              '@keyframes float': {
                '0%, 100%': { transform: 'translateY(0px)' },
                '50%': { transform: 'translateY(-20px)' }
              }
            }}
          >
            <LocalShipping 
              sx={{ 
                fontSize: 120, 
                color: '#C9A227',
                filter: 'drop-shadow(0 0 20px rgba(201, 162, 39, 0.5))'
              }} 
            />
          </Box>

          {/* Branding */}
          <Typography 
            variant="h5" 
            sx={{ 
              fontWeight: 700,
              mb: 1,
              color: '#C9A227',
              letterSpacing: 1
            }}
          >
            Brillar Delivery
          </Typography>
          <Typography 
            variant="body1" 
            color="text.secondary"
            sx={{ 
              fontWeight: 300,
              mb: 5,
              maxWidth: 400,
              mx: 'auto',
              fontSize: '0.95rem'
            }}
          >
            Track your packages in real-time with our advanced delivery system
          </Typography>

          {/* Features List */}
          <Stack spacing={2} sx={{ textAlign: 'left', maxWidth: 400, mx: 'auto' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  bgcolor: 'rgba(201, 162, 39, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Verified sx={{ fontSize: 20, color: '#C9A227' }} />
              </Box>
              <Box>
                <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Verified Tracking
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Accurate location updates every step of the way
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  bgcolor: 'rgba(201, 162, 39, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <LocationOn sx={{ fontSize: 20, color: '#C9A227' }} />
              </Box>
              <Box>
                <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Live Location
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  See exactly where your package is right now
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  bgcolor: 'rgba(201, 162, 39, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <AccessTime sx={{ fontSize: 20, color: '#C9A227' }} />
              </Box>
              <Box>
                <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Delivery Timeline
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Complete history with timestamps and events
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  bgcolor: 'rgba(201, 162, 39, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <NotificationsActive sx={{ fontSize: 20, color: '#C9A227' }} />
              </Box>
              <Box>
                <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Instant Alerts
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Get notified when your package status changes
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  bgcolor: 'rgba(201, 162, 39, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Security sx={{ fontSize: 20, color: '#C9A227' }} />
              </Box>
              <Box>
                <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Data Protection
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Your information is encrypted and secure
                </Typography>
              </Box>
            </Box>
          </Stack>

          {/* Trust Badge */}
          <Box
            sx={{
              mt: 4,
              p: 2.5,
              bgcolor: 'rgba(201, 162, 39, 0.05)',
              border: '1px solid rgba(201, 162, 39, 0.15)',
              borderRadius: 2,
              textAlign: 'center'
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ mb: 1 }}>
              <CheckCircle sx={{ fontSize: 20, color: '#4caf50' }} />
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                Trusted by thousands of customers
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Secure • Fast • Reliable delivery tracking
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Right Side - Form Section */}
      <Box
        sx={{
          flex: { xs: 1, md: 1 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#1a1a1a',
          p: { xs: 3, sm: 6 },
          position: 'relative'
        }}
      >
        <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ mb: 4 }}>
            <Typography 
              variant="h4" 
              sx={{ 
                fontWeight: 700,
                mb: 1,
                color: 'text.primary'
              }}
            >
              Track Your Package
            </Typography>
            <Typography 
              variant="body1" 
              color="text.secondary"
            >
              Enter your tracking code to view delivery status and timeline
            </Typography>
          </Box>

          <Paper
            elevation={0}
            sx={{
              bgcolor: '#252525',
              border: '1px solid rgba(201, 162, 39, 0.2)',
              borderRadius: 3,
              p: 4,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
            }}
          >
            <Stack spacing={3}>
              <Box>
                <Typography 
                  variant="subtitle2" 
                  sx={{ 
                    mb: 1.5,
                    color: 'text.secondary',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    fontSize: '0.75rem'
                  }}
                >
                  Tracking Code
        </Typography>
                <TextField
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="OFF-2025-XXXXXX"
                  fullWidth
                  autoFocus
                  variant="outlined"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: '#1F1F1F',
                      borderRadius: 2,
                      '& fieldset': {
                        borderColor: 'rgba(201, 162, 39, 0.3)',
                        borderWidth: 2
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(201, 162, 39, 0.5)'
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#C9A227',
                        borderWidth: 2
                      }
                    },
                    '& .MuiInputBase-input': {
                      py: 2,
                      fontSize: '1.1rem',
                      fontWeight: 500,
                      color: 'text.primary'
                    }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search sx={{ color: 'rgba(201, 162, 39, 0.7)' }} />
                      </InputAdornment>
                    )
                  }}
                />
              </Box>

              <Button
                variant="contained"
                onClick={handleTrack}
                disabled={!code.trim()}
                fullWidth
                size="large"
                sx={{
                  py: 1.5,
                  fontSize: '1rem',
                  fontWeight: 600,
                  borderRadius: 2,
                  bgcolor: code.trim() ? '#C9A227' : 'rgba(201, 162, 39, 0.2)',
                  color: code.trim() ? '#000' : 'rgba(255, 255, 255, 0.3)',
                  textTransform: 'none',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: code.trim() ? '#FFD700' : 'rgba(201, 162, 39, 0.2)',
                    transform: code.trim() ? 'translateY(-2px)' : 'none',
                    boxShadow: code.trim() ? '0 6px 20px rgba(201, 162, 39, 0.4)' : 'none'
                  },
                  '&:disabled': {
                    bgcolor: 'rgba(201, 162, 39, 0.1)',
                    color: 'rgba(255, 255, 255, 0.2)'
                  }
                }}
              >
                Track Package
          </Button>
        </Stack>
      </Paper>

          {/* Features Grid */}
          <Grid container spacing={2} sx={{ mt: 4 }}>
            <Grid item xs={12} sm={4}>
              <Box
                sx={{
                  p: 2,
                  textAlign: 'center',
                  bgcolor: 'rgba(201, 162, 39, 0.05)',
                  borderRadius: 2,
                  border: '1px solid rgba(201, 162, 39, 0.1)',
                  height: '100%'
                }}
              >
                <LocationOn sx={{ fontSize: 32, color: '#C9A227', mb: 1 }} />
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Real-time Location
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Track package location
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Box
                sx={{
                  p: 2,
                  textAlign: 'center',
                  bgcolor: 'rgba(201, 162, 39, 0.05)',
                  borderRadius: 2,
                  border: '1px solid rgba(201, 162, 39, 0.1)',
                  height: '100%'
                }}
              >
                <AccessTime sx={{ fontSize: 32, color: '#C9A227', mb: 1 }} />
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Live Updates
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Instant status updates
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Box
                sx={{
                  p: 2,
                  textAlign: 'center',
                  bgcolor: 'rgba(201, 162, 39, 0.05)',
                  borderRadius: 2,
                  border: '1px solid rgba(201, 162, 39, 0.1)',
                  height: '100%'
                }}
              >
                <Verified sx={{ fontSize: 32, color: '#C9A227', mb: 1 }} />
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Secure Tracking
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Private & secure
                </Typography>
              </Box>
            </Grid>
          </Grid>
    </Container>
      </Box>
    </Box>
  );
}

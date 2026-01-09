'use client';
import { useState } from 'react';
import { authApi } from '../lib/api';
import { Button, Container, Paper, Stack, TextField, Typography, Alert } from '@mui/material';
import { useAuth } from '../hooks/useAuth';
import { loginAtenxionSender, fetchSenderIntegrationEmbed } from '../lib/atenxion';
import { integrationApi } from '../lib/api';

interface SenderSession {
  userId: number;
  token?: string;
  email?: string;
  [key: string]: any;
}

export default function LoginPage() {
  const { setAuth } = useAuth();
  const [email, setEmail] = useState('sender@example.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Load session from localStorage on mount
  const [session, setSession] = useState<SenderSession | null>(() => {
    try {
      const stored = localStorage.getItem("sender_session");
      if (stored) {
        return JSON.parse(stored) as SenderSession;
      }
    } catch {
      // Ignore errors
    }
    return null;
  });

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await authApi.login({ email, password });
      setAuth(data);
      
      // Store session in localStorage
      let newSession: SenderSession | null = null;
      if (data.user && data.user.id) {
        newSession = {
          userId: data.user.id,
          token: data.token,
          email: data.user.email,
        };
        localStorage.setItem("sender_session", JSON.stringify(newSession));
        setSession(newSession);
      }
      
      // Call Atenxion login - use userId from newly created session
      const userIdToUse = newSession?.userId || session?.userId || data.user?.id;
      
      if (userIdToUse) {
        try {
          // Fetch contextKey from MongoDB integration filtered by user role
          // let contextKey: string | null = null;
          // try {
          //   const role = data.user?.role;
          //   const embed = await fetchSenderIntegrationEmbed(role);
          //   contextKey = embed?.contextualKey || null;
          //   console.log('[Login] Fetched contextKey from MongoDB:', contextKey ? contextKey.substring(0, 50) + '...' : 'none');
          // } catch (integrationError) {
          //   console.warn('[Login] Error fetching integration for contextKey:', integrationError);
          // }

          await loginAtenxionSender(
            {
              userId: userIdToUse, // Use userId from session
            },
            // contextKey
          );
          console.log('Atenxion sender login completed');
        } catch (atenxionError) {
          // Log but don't block the login flow
          console.error('Atenxion login error (non-blocking):', atenxionError);
        }
      }
      
      // Route based on role if available, otherwise default to sender dashboard with ID
      const role = data.user?.role;
      let redirectUrl = '/dashboard/sender';
      
      if (role === 'DISPATCHER' && data.user?.id) {
        redirectUrl = `/dashboard/dispatcher/${data.user.id}`;
      } else if (role === 'COURIER' && data.user?.id) {
        redirectUrl = `/dashboard/courier/${data.user.id}`;
      } else if (role === 'ADMIN') {
        redirectUrl = '/admin';
      } else if (data.user?.id) {
        // Redirect to /sender/{senderid} with sender ID in URL
        redirectUrl = `/sender/${data.user.id}`;
      }
      
      // Force full page refresh for all roles
      window.location.href = redirectUrl;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container 
      maxWidth="sm" 
      sx={{ 
        py: 4,
        minHeight: 'calc(100vh - 64px)',
        display: 'flex',
        alignItems: 'center'
      }}
    >
      <Paper 
        sx={{ 
          p: 4,
          width: '100%',
          bgcolor: '#1F1F1F',
          border: '1px solid rgba(201, 162, 39, 0.2)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)'
        }}
      >
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
          Login
        </Typography>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        <Stack spacing={2} sx={{ mt: 2 }}>
          <TextField 
            label="Email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
          />
          <Button 
            variant="contained" 
            onClick={handleSubmit} 
            disabled={loading}
            fullWidth
            sx={{ mt: 2 }}
          >
            {loading ? 'Signing in...' : 'Login'}
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}

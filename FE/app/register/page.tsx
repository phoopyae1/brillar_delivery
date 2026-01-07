'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '../lib/api';
import { Button, Container, Paper, Stack, TextField, Typography, Alert, MenuItem } from '@mui/material';
import { useAuth } from '../hooks/useAuth';

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuth();
  const [form, setForm] = useState({
    name: 'New Sender',
    email: 'user@example.com',
    password: 'password123',
    role: 'SENDER'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await authApi.register({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role as any
      });
      setAuth(data);
      // Redirect to role-specific dashboard with ID in URL
      if (data.user?.id) {
        if (data.user.role === 'SENDER' || (data.user.role === 'ADMIN' && !data.user.role)) {
          router.push(`/sender/${data.user.id}`);
        } else if (data.user.role === 'DISPATCHER') {
          router.push(`/dashboard/dispatcher/${data.user.id}`);
        } else if (data.user.role === 'COURIER') {
          router.push(`/dashboard/courier/${data.user.id}`);
        } else if (data.user.role === 'ADMIN') {
          router.push('/admin');
        } else {
          router.push('/dashboard/sender');
        }
      } else {
      router.push('/dashboard/sender');
      }
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
          Register
        </Typography>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        <Stack spacing={2} sx={{ mt: 2 }}>
          <TextField 
            label="Name" 
            value={form.name} 
            onChange={(e) => setForm({ ...form, name: e.target.value })} 
            fullWidth
          />
          <TextField 
            label="Email" 
            value={form.email} 
            onChange={(e) => setForm({ ...form, email: e.target.value })} 
            fullWidth
          />
          <TextField
            label="Password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            fullWidth
          />
          <TextField 
            select 
            label="Role" 
            value={form.role} 
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            fullWidth
          >
            {['SENDER', 'DISPATCHER', 'COURIER', 'ADMIN'].map((role) => (
              <MenuItem key={role} value={role}>
                {role}
              </MenuItem>
            ))}
          </TextField>
          <Button 
            variant="contained" 
            onClick={handleSubmit} 
            disabled={loading}
            fullWidth
            sx={{ mt: 2 }}
          >
            {loading ? 'Creating...' : 'Register'}
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}

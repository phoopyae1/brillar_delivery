'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '../lib/api';
import { Button, Container, Paper, Stack, TextField, Typography, Alert } from '@mui/material';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuth();
  const [email, setEmail] = useState('sender@example.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await authApi.login({ email, password });
      setAuth(data);
      router.push('/dashboard/sender');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Login
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <Stack spacing={2} sx={{ mt: 2 }}>
          <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button variant="contained" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Signing in...' : 'Login'}
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}

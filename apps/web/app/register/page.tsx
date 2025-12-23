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
          Register
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <Stack spacing={2} sx={{ mt: 2 }}>
          <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <TextField
            label="Password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <TextField select label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {['SENDER', 'DISPATCHER', 'COURIER', 'ADMIN'].map((role) => (
              <MenuItem key={role} value={role}>
                {role}
              </MenuItem>
            ))}
          </TextField>
          <Button variant="contained" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating...' : 'Register'}
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}

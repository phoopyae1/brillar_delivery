'use client';
import { useState } from 'react';
import { Container, TextField, Button, Typography, Alert, Stack, Paper, MenuItem } from '@mui/material';
import { useRouter } from 'next/navigation';
import { register } from '../lib/api';

const roles = ['SENDER', 'DISPATCHER', 'COURIER', 'ADMIN'];

export default function RegisterPage() {
  const [name, setName] = useState('New User');
  const [email, setEmail] = useState('newuser@example.com');
  const [password, setPassword] = useState('password123');
  const [role, setRole] = useState('SENDER');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleRegister = async () => {
    setError('');
    try {
      const res = await register({ name, email, password, role });
      localStorage.setItem('token', res.token);
      localStorage.setItem('user', JSON.stringify(res.user));
      router.push('/dashboard');
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 6 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>
          Register
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <Stack spacing={2} sx={{ mt: 2 }}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
          <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
          <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} fullWidth />
          <TextField select label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
            {roles.map((r) => (
              <MenuItem key={r} value={r}>
                {r}
              </MenuItem>
            ))}
          </TextField>
          <Button variant="contained" onClick={handleRegister}>
            Register
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}

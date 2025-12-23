'use client';
import useSWR from 'swr';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { deliveryApi } from '../../lib/api';
import {
  Alert,
  Button,
  Container,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
  List,
  ListItem,
  ListItemText,
  Divider
} from '@mui/material';
import { priorityLabels, statusLabels } from '../../lib/status';

export default function SenderDashboard() {
  const { user, token, ready } = useAuth();
  const router = useRouter();
  const { data, error, mutate, isLoading } = useSWR(token ? '/sender/deliveries' : null, () => deliveryApi.mine(token!));
  const [form, setForm] = useState({
    title: 'Office Package',
    description: 'Documents',
    priority: 'MEDIUM',
    receiverName: 'Recipient',
    receiverPhone: '555-0100',
    pickupAddress: '500 Pickup Ave',
    deliveryAddress: '123 Office St',
    packageWeight: 1.5,
    packageDimensions: '10x8x4'
  });
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (ready && (!user || !token)) router.push('/login');
    if (ready && user && user.role !== 'SENDER' && user.role !== 'ADMIN') router.push('/');
  }, [ready, user, token, router]);

  const handleCreate = async () => {
    if (!token) return;
    setSubmitError('');
    try {
      await deliveryApi.create(token, form);
      await mutate();
    } catch (e: any) {
      setSubmitError(e.message);
    }
  };

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Sender Dashboard
      </Typography>
      {error && <Alert severity="error">{error.message}</Alert>}
      {submitError && <Alert severity="error">{submitError}</Alert>}
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">Create delivery</Typography>
            <Stack spacing={2} sx={{ mt: 2 }}>
              <TextField label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <TextField
                label="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              <TextField select label="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {['LOW', 'MEDIUM', 'HIGH'].map((p) => (
                  <MenuItem key={p} value={p}>
                    {p}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Receiver name"
                value={form.receiverName}
                onChange={(e) => setForm({ ...form, receiverName: e.target.value })}
              />
              <TextField
                label="Receiver phone"
                value={form.receiverPhone}
                onChange={(e) => setForm({ ...form, receiverPhone: e.target.value })}
              />
              <TextField
                label="Pickup address"
                value={form.pickupAddress}
                onChange={(e) => setForm({ ...form, pickupAddress: e.target.value })}
              />
              <TextField
                label="Delivery address"
                value={form.deliveryAddress}
                onChange={(e) => setForm({ ...form, deliveryAddress: e.target.value })}
              />
              <TextField
                label="Package weight (kg)"
                type="number"
                value={form.packageWeight}
                onChange={(e) => setForm({ ...form, packageWeight: Number(e.target.value) })}
              />
              <TextField
                label="Package dimensions"
                value={form.packageDimensions}
                onChange={(e) => setForm({ ...form, packageDimensions: e.target.value })}
              />
              <Button variant="contained" onClick={handleCreate}>
                Create
              </Button>
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">My deliveries</Typography>
            {isLoading && <Typography>Loading...</Typography>}
            {!isLoading && data?.length === 0 && <Typography>No deliveries yet.</Typography>}
            <List>
              {data?.map((d: any) => (
                <>
                  <ListItem key={d.id} alignItems="flex-start">
                    <ListItemText
                      primary={`${d.title} (${d.trackingCode})`}
                        secondary={`${statusLabels[d.status] || d.status} • Priority ${priorityLabels[d.priority] || d.priority} • Delivery ${d.deliveryAddress}`}
                    />
                  </ListItem>
                  <Divider />
                </>
              ))}
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}

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
  Paper,
  Stack,
  TextField,
  Typography,
  List,
  ListItem,
  ListItemText,
  Divider,
  MenuItem
} from '@mui/material';
import { statusLabels } from '../../lib/status';

const courierStatuses = ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED_DELIVERY', 'RETURNED'];

export default function CourierDashboard() {
  const { user, token, ready } = useAuth();
  const router = useRouter();
  const { data, error, mutate, isLoading } = useSWR(token ? '/courier/mine' : null, () => deliveryApi.mine(token!));
  const [updateForm, setUpdateForm] = useState({ id: '', status: courierStatuses[0], note: '', locationText: '' });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (ready && (!user || !token)) router.push('/login');
    if (ready && user && !['COURIER', 'ADMIN', 'DISPATCHER'].includes(user.role)) router.push('/');
  }, [ready, user, token, router]);

  const handleStatus = async () => {
    if (!token || !updateForm.id) return;
    setFormError('');
    try {
      await deliveryApi.updateStatus(token, Number(updateForm.id), {
        status: updateForm.status,
        note: updateForm.note,
        locationText: updateForm.locationText
      });
      await mutate();
    } catch (e: any) {
      setFormError(e.message);
    }
  };

  const handleEvent = async () => {
    if (!token || !updateForm.id) return;
    setFormError('');
    try {
      await deliveryApi.addEvent(token, Number(updateForm.id), {
        type: updateForm.status,
        note: updateForm.note,
        locationText: updateForm.locationText
      });
      await mutate();
    } catch (e: any) {
      setFormError(e.message);
    }
  };

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Courier Dashboard
      </Typography>
      {error && <Alert severity="error">{error.message}</Alert>}
      {formError && <Alert severity="error">{formError}</Alert>}
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">Update status</Typography>
            <Stack spacing={2} sx={{ mt: 2 }}>
              <TextField label="Delivery ID" value={updateForm.id} onChange={(e) => setUpdateForm({ ...updateForm, id: e.target.value })} />
              <TextField select label="Status" value={updateForm.status} onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}>
                {courierStatuses.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </TextField>
              <TextField label="Note" value={updateForm.note} onChange={(e) => setUpdateForm({ ...updateForm, note: e.target.value })} />
              <TextField
                label="Location"
                value={updateForm.locationText}
                onChange={(e) => setUpdateForm({ ...updateForm, locationText: e.target.value })}
              />
              <Stack direction="row" spacing={1}>
                <Button variant="contained" onClick={handleStatus} disabled={!updateForm.id}>
                  Update status
                </Button>
                <Button variant="outlined" onClick={handleEvent} disabled={!updateForm.id}>
                  Add checkpoint
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">My assignments</Typography>
            {isLoading && <Typography>Loading...</Typography>}
            {!isLoading && data?.length === 0 && <Typography>No assigned deliveries.</Typography>}
            <List>
              {data?.map((d: any) => (
                <>
                  <ListItem key={d.id} alignItems="flex-start">
                    <ListItemText
                      primary={`${d.title} (${d.trackingCode})`}
                      secondary={`${statusLabels[d.status] || d.status} • Destination ${d.destinationAddress}`}
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

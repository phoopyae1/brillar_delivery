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
  Divider
} from '@mui/material';
import { priorityLabels, statusLabels } from '../../lib/status';

export default function DispatcherDashboard() {
  const { user, token, ready } = useAuth();
  const router = useRouter();
  const { data, error, mutate, isLoading } = useSWR(token ? '/dispatcher/all' : null, () => deliveryApi.adminAll(token!));
  const [assignment, setAssignment] = useState({ id: '', courierId: '' });
  const [assignError, setAssignError] = useState('');

  useEffect(() => {
    if (ready && (!user || !token)) router.push('/login');
    if (ready && user && !['DISPATCHER', 'ADMIN'].includes(user.role)) router.push('/');
  }, [ready, user, token, router]);

  const handleAssign = async () => {
    if (!token) return;
    setAssignError('');
    try {
      await deliveryApi.assign(token, Number(assignment.id), Number(assignment.courierId));
      setAssignment({ id: '', courierId: '' });
      await mutate();
    } catch (e: any) {
      setAssignError(e.message);
    }
  };

  const unassigned = data?.filter((d: any) => d.status !== 'PICKED_UP' && d.status !== 'DELIVERED');

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Dispatcher Dashboard
      </Typography>
      {error && <Alert severity="error">{error.message}</Alert>}
      {assignError && <Alert severity="error">{assignError}</Alert>}
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">Assign courier</Typography>
            <Stack spacing={2} sx={{ mt: 2 }}>
              <TextField label="Delivery ID" value={assignment.id} onChange={(e) => setAssignment({ ...assignment, id: e.target.value })} />
              <TextField
                label="Courier ID"
                value={assignment.courierId}
                onChange={(e) => setAssignment({ ...assignment, courierId: e.target.value })}
              />
              <Button variant="contained" onClick={handleAssign} disabled={!assignment.id || !assignment.courierId}>
                Assign
              </Button>
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">Needs attention</Typography>
            {isLoading && <Typography>Loading...</Typography>}
            {!isLoading && unassigned?.length === 0 && <Typography>All deliveries are assigned.</Typography>}
            <List>
              {unassigned?.map((d: any) => (
                <>
                  <ListItem key={d.id} alignItems="flex-start">
                    <ListItemText
                      primary={`${d.title} (${d.trackingCode})`}
                      secondary={`${statusLabels[d.status] || d.status} • Priority ${priorityLabels[d.priority] || d.priority} • Destination ${d.destinationAddress}`}
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

'use client';
import { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  Paper,
  Stack,
  TextField,
  MenuItem,
  Button,
  Grid,
  List,
  ListItem,
  ListItemText,
  Divider,
  Alert
} from '@mui/material';
import { useRouter } from 'next/navigation';
import {
  createDelivery,
  getMyDeliveries,
  assignDelivery,
  updateStatus,
  addEvent,
  getAdminData
} from '../lib/api';

const statusOptions = [
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'FAILED_DELIVERY',
  'RETURNED'
];

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [adminData, setAdminData] = useState<any>(null);
  const [form, setForm] = useState({
    title: 'Office Package',
    description: 'Documents',
    priority: 'MEDIUM',
    receiverName: 'Receiver',
    receiverPhone: '555-0000',
    destinationAddress: '123 Main St'
  });
  const [assign, setAssign] = useState({ id: '', courierId: '' });
  const [statusForm, setStatusForm] = useState({ id: '', status: 'PICKED_UP', note: '', locationText: '' });
  const [poll, setPoll] = useState<NodeJS.Timeout | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (!storedToken || !storedUser) {
      router.push('/login');
      return;
    }
    setToken(storedToken);
    setUser(JSON.parse(storedUser));
  }, [router]);

  const loadData = async () => {
    if (!token || !user) return;
    setError('');
    try {
      const myDeliveries = await getMyDeliveries(token);
      setDeliveries(myDeliveries);
      if (user.role === 'ADMIN' || user.role === 'DISPATCHER') {
        setAdminData(await getAdminData(token));
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    loadData();
    if (poll) clearInterval(poll);
    const interval = setInterval(() => loadData(), 5000);
    setPoll(interval);
    return () => clearInterval(interval);
  }, [token, user]);

  const handleCreate = async () => {
    if (!token) return;
    try {
      await createDelivery(token, form);
      await loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleAssign = async () => {
    if (!token) return;
    try {
      await assignDelivery(token, Number(assign.id), Number(assign.courierId));
      await loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleStatus = async () => {
    if (!token) return;
    try {
      await updateStatus(token, Number(statusForm.id), statusForm.status, statusForm.note, statusForm.locationText);
      await loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleEvent = async () => {
    if (!token) return;
    try {
      await addEvent(token, Number(statusForm.id), {
        type: statusForm.status,
        note: statusForm.note,
        locationText: statusForm.locationText
      });
      await loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <Container sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      {user && (
        <Typography variant="subtitle1" gutterBottom>
          Signed in as {user.name} ({user.role})
        </Typography>
      )}
      {error && <Alert severity="error">{error}</Alert>}
      <Grid container spacing={3} sx={{ mt: 1 }}>
        {user?.role === 'SENDER' && (
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6">Create Delivery</Typography>
              <Stack spacing={1} sx={{ mt: 1 }}>
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
                  label="Receiver Name"
                  value={form.receiverName}
                  onChange={(e) => setForm({ ...form, receiverName: e.target.value })}
                />
                <TextField
                  label="Receiver Phone"
                  value={form.receiverPhone}
                  onChange={(e) => setForm({ ...form, receiverPhone: e.target.value })}
                />
                <TextField
                  label="Destination"
                  value={form.destinationAddress}
                  onChange={(e) => setForm({ ...form, destinationAddress: e.target.value })}
                />
                <Button variant="contained" onClick={handleCreate}>
                  Create
                </Button>
              </Stack>
            </Paper>
          </Grid>
        )}

        {(user?.role === 'DISPATCHER' || user?.role === 'ADMIN') && (
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6">Assign Courier</Typography>
              <Stack spacing={1} sx={{ mt: 1 }}>
                <TextField label="Delivery ID" value={assign.id} onChange={(e) => setAssign({ ...assign, id: e.target.value })} />
                <TextField
                  label="Courier ID"
                  value={assign.courierId}
                  onChange={(e) => setAssign({ ...assign, courierId: e.target.value })}
                />
                <Button variant="contained" onClick={handleAssign}>
                  Assign
                </Button>
              </Stack>
            </Paper>
          </Grid>
        )}

        {(user?.role === 'COURIER' || user?.role === 'DISPATCHER' || user?.role === 'ADMIN' || user?.role === 'SENDER') && (
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6">Update Status / Add Event</Typography>
              <Stack spacing={1} sx={{ mt: 1 }}>
                <TextField label="Delivery ID" value={statusForm.id} onChange={(e) => setStatusForm({ ...statusForm, id: e.target.value })} />
                <TextField select label="Status" value={statusForm.status} onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}>
                  {statusOptions.map((s) => (
                    <MenuItem key={s} value={s}>
                      {s}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField label="Note" value={statusForm.note} onChange={(e) => setStatusForm({ ...statusForm, note: e.target.value })} />
                <TextField
                  label="Location"
                  value={statusForm.locationText}
                  onChange={(e) => setStatusForm({ ...statusForm, locationText: e.target.value })}
                />
                <Stack direction="row" spacing={1}>
                  <Button variant="contained" onClick={handleStatus}>
                    Update Status
                  </Button>
                  <Button variant="outlined" onClick={handleEvent}>
                    Add Event
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          </Grid>
        )}

        {adminData && (
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6">Admin Overview</Typography>
              <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                <Paper sx={{ p: 2, minWidth: 120 }}>
                  <Typography variant="subtitle2">Users</Typography>
                  <Typography variant="h6">{adminData.stats.users}</Typography>
                </Paper>
                <Paper sx={{ p: 2, minWidth: 120 }}>
                  <Typography variant="subtitle2">Deliveries</Typography>
                  <Typography variant="h6">{adminData.stats.deliveries}</Typography>
                </Paper>
                <Paper sx={{ p: 2, minWidth: 120 }}>
                  <Typography variant="subtitle2">Delivered</Typography>
                  <Typography variant="h6">{adminData.stats.delivered}</Typography>
                </Paper>
                <Paper sx={{ p: 2, minWidth: 120 }}>
                  <Typography variant="subtitle2">In Transit</Typography>
                  <Typography variant="h6">{adminData.stats.inTransit}</Typography>
                </Paper>
              </Stack>
              <Typography variant="subtitle1" sx={{ mt: 2 }}>
                Recent Deliveries
              </Typography>
              <List>
                {adminData.deliveries.map((d: any) => (
                  <>
                    <ListItem key={d.id} alignItems="flex-start">
                      <ListItemText
                        primary={`${d.title} (${d.trackingCode}) - ${d.status}`}
                        secondary={`Sender: ${d.sender.name} | Destination: ${d.destinationAddress}`}
                      />
                    </ListItem>
                    <Divider />
                  </>
                ))}
              </List>
            </Paper>
          </Grid>
        )}

        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">My Deliveries</Typography>
            <List>
              {deliveries.map((d) => (
                <>
                  <ListItem key={d.id}>
                    <ListItemText
                      primary={`${d.title} (${d.trackingCode})`}
                      secondary={`Status: ${d.status} | Priority: ${d.priority} | Destination: ${d.destinationAddress}`}
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

'use client';
import useSWR from 'swr';
import { useAuth } from '../../../hooks/useAuth';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { deliveryApi } from '../../../lib/api';
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
  MenuItem,
  Pagination
} from '@mui/material';
import { priorityLabels, statusLabels } from '../../../lib/status';

export default function DispatcherDashboardById() {
  const params = useParams();
  const dispatcherIdFromUrl = params?.id as string;
  const { user, token, ready } = useAuth();
  const router = useRouter();
  const { data, error, mutate, isLoading } = useSWR(token ? '/dispatcher/all' : null, () => deliveryApi.adminAll(token!));
  const { data: couriers } = useSWR(token ? '/couriers' : null, () => deliveryApi.getCouriers(token!));
  const [assignment, setAssignment] = useState({ id: '', courierId: '' });
  const [assignError, setAssignError] = useState('');
  const [page, setPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    if (ready && (!user || !token)) router.push('/login');
    if (ready && user && !['DISPATCHER', 'ADMIN'].includes(user.role)) router.push('/');
  }, [ready, user, token, router]);

  const handleAssign = async () => {
    if (!token) return;
    setAssignError('');
    try {
      await deliveryApi.assign(token, assignment.id, assignment.courierId);
      setAssignment({ id: '', courierId: '' });
      await mutate();
    } catch (e: any) {
      setAssignError(e.message);
    }
  };

  const unassigned = data?.filter((d: any) => d.status !== 'PICKED_UP' && d.status !== 'DELIVERED') || [];
  
  // Pagination logic
  const totalPages = Math.ceil(unassigned.length / itemsPerPage);
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedUnassigned = unassigned.slice(startIndex, endIndex);

  // Reset to page 1 if current page is beyond available pages
  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(1);
    }
  }, [unassigned.length, page, totalPages]);

  return (
    <Container sx={{ py: 4, bgcolor: 'transparent' }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
        Dispatcher Dashboard {dispatcherIdFromUrl && `(ID: ${dispatcherIdFromUrl})`}
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error.message}</Alert>}
      {assignError && <Alert severity="error" sx={{ mb: 2 }}>{assignError}</Alert>}
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper 
            sx={{ 
              p: 3,
              bgcolor: '#1F1F1F',
              border: '1px solid rgba(201, 162, 39, 0.25)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)'
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Assign courier</Typography>
            <Stack spacing={2} sx={{ mt: 2 }}>
              <TextField 
                label="Delivery ID" 
                value={assignment.id} 
                onChange={(e) => setAssignment({ ...assignment, id: e.target.value })} 
                fullWidth
                helperText={data?.length ? `Available IDs: ${data.map((d: any) => d.id).join(', ')}` : 'Enter a delivery ID'}
              />
              <TextField
                select
                label="Courier"
                value={assignment.courierId}
                onChange={(e) => setAssignment({ ...assignment, courierId: e.target.value })}
                fullWidth
                helperText={couriers?.length ? `${couriers.length} courier(s) available` : 'Loading couriers...'}
              >
                {couriers?.map((courier: any) => (
                  <MenuItem key={courier.id} value={String(courier.id)}>
                    {courier.name} (ID: {courier.id}) - {courier.email}
                  </MenuItem>
                ))}
              </TextField>
              <Button variant="contained" onClick={handleAssign} disabled={!assignment.id || !assignment.courierId} fullWidth sx={{ mt: 2 }}>
                Assign
              </Button>
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} md={8}>
          <Paper 
            sx={{ 
              p: 3,
              bgcolor: '#252525',
              border: '1px solid rgba(201, 162, 39, 0.2)',
              boxShadow: '0 15px 45px rgba(0, 0, 0, 0.3)'
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Needs attention
              </Typography>
              {unassigned.length > 0 && (
                <Typography variant="body2" color="text.secondary">
                  Showing {startIndex + 1}-{Math.min(endIndex, unassigned.length)} of {unassigned.length}
                </Typography>
              )}
            </Stack>
            {isLoading && <Typography>Loading...</Typography>}
            {!isLoading && unassigned.length === 0 && <Typography>All deliveries are assigned.</Typography>}
            <List>
              {paginatedUnassigned.map((d: any, index: number) => (
                <>
                  <ListItem 
                    key={d.id} 
                    alignItems="flex-start"
                    onClick={() => setAssignment({ ...assignment, id: String(d.id) })}
                    sx={{
                      bgcolor: index % 2 === 0 ? 'transparent' : 'rgba(201, 162, 39, 0.05)',
                      borderRadius: 1,
                      mb: 0.5,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: 'rgba(201, 162, 39, 0.1)',
                        transform: 'translateX(4px)'
                      }
                    }}
                  >
                    <ListItemText
                      primary={`${d.title} (${d.trackingCode})`}
                      secondary={
                        <>
                          <Typography component="span" variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                            ID: {d.id}
                          </Typography>
                          {' • '}
                          {statusLabels[d.status] || d.status} • Priority {priorityLabels[d.priority] || d.priority} • Destination {d.destinationAddress}
                        </>
                      }
                    />
                  </ListItem>
                  <Divider sx={{ borderColor: 'rgba(201, 162, 39, 0.15)' }} />
                </>
              ))}
            </List>
            {totalPages > 1 && (
              <Stack alignItems="center" sx={{ mt: 3 }}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(_, value) => {
                    setPage(value);
                    setAssignment({ id: '', courierId: '' });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  color="primary"
                  sx={{
                    '& .MuiPaginationItem-root': {
                      color: 'text.primary',
                      '&.Mui-selected': {
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        '&:hover': {
                          bgcolor: 'primary.dark'
                        }
                      },
                      '&:hover': {
                        bgcolor: 'rgba(201, 162, 39, 0.1)'
                      }
                    }
                  }}
                />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Showing {startIndex + 1}-{Math.min(endIndex, unassigned.length)} of {unassigned.length}
                </Typography>
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}


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
  Pagination,
  Collapse,
  IconButton,
  Chip
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { Refresh } from '@mui/icons-material';
import { priorityLabels, statusLabels } from '../../../lib/status';
import { DeliveryEvent } from '../../../lib/api';

export default function DispatcherDashboardById() {
  const params = useParams();
  const dispatcherIdFromUrl = params?.id as string;
  const { user, token, ready } = useAuth();
  const router = useRouter();
  const { data, error, mutate, isLoading } = useSWR(
    token ? '/dispatcher/all' : null, 
    () => deliveryApi.adminAll(token!),
    {
      refreshInterval: 5000, // Auto-refresh every 5 seconds to show new deliveries
      revalidateOnFocus: true, // Refresh when window regains focus
    }
  );
  const { data: couriers } = useSWR(token ? '/couriers' : null, () => deliveryApi.getCouriers(token!));
  const [assignment, setAssignment] = useState({ id: '', courierId: '' });
  const [assignError, setAssignError] = useState('');
  const [expandedDelivery, setExpandedDelivery] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const itemsPerPage = 5;

  const toggleExpand = (deliveryId: number) => {
    setExpandedDelivery(expandedDelivery === deliveryId ? null : deliveryId);
  };

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

  // Debug logging
  useEffect(() => {
    if (data) {
      console.log('[Dispatcher] Total deliveries fetched:', data.length);
      console.log('[Dispatcher] Delivery statuses:', data.map((d: any) => ({ id: d.id, status: d.status, title: d.title })));
    }
    if (error) {
      console.error('[Dispatcher] Error fetching deliveries:', error);
    }
  }, [data, error]);

  const unassigned = data?.filter((d: any) => d.status !== 'PICKED_UP' && d.status !== 'DELIVERED') || [];
  
  // Debug logging for filtered data
  useEffect(() => {
    console.log('[Dispatcher] Unassigned deliveries (after filter):', unassigned.length);
    console.log('[Dispatcher] Unassigned delivery details:', unassigned.map((d: any) => ({ id: d.id, status: d.status, title: d.title })));
  }, [unassigned]);
  
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
                Needs attention {data && `(${data.length} total, ${unassigned.length} unassigned)`}
              </Typography>
              <Stack direction="row" spacing={2} alignItems="center">
                {unassigned.length > 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Showing {startIndex + 1}-{Math.min(endIndex, unassigned.length)} of {unassigned.length}
                  </Typography>
                )}
                <IconButton 
                  onClick={() => mutate()} 
                  disabled={isLoading}
                  sx={{ color: 'primary.main' }}
                  title="Refresh deliveries"
                >
                  <Refresh />
                </IconButton>
              </Stack>
            </Stack>
            {isLoading && <Typography>Loading deliveries...</Typography>}
            {!isLoading && !error && data && data.length === 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                No deliveries found in the system. Create a shipment to see it here.
              </Alert>
            )}
            {!isLoading && !error && data && data.length > 0 && unassigned.length === 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                All {data.length} delivery/deliveries are assigned or completed. No deliveries need attention.
              </Alert>
            )}
            {!isLoading && error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                Failed to load deliveries: {error.message || 'Unknown error'}
                {error.response && (
                  <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                    Status: {error.response.status}
                  </Typography>
                )}
              </Alert>
            )}
            <Stack spacing={2}>
              {paginatedUnassigned.map((d: any, index: number) => {
                const isExpanded = expandedDelivery === d.id;
                const events = d.events || [];
                
                return (
                  <Paper
                    key={d.id}
                    sx={{
                      bgcolor: index % 2 === 0 ? '#1F1F1F' : '#252525',
                      border: '1px solid rgba(201, 162, 39, 0.2)',
                      borderRadius: 2,
                      overflow: 'hidden'
                    }}
                  >
                    <ListItem 
                      onClick={() => {
                        toggleExpand(d.id);
                        setAssignment({ ...assignment, id: String(d.id) });
                      }}
                      sx={{
                        cursor: 'pointer',
                        '&:hover': {
                          bgcolor: 'rgba(201, 162, 39, 0.05)'
                        }
                      }}
                    >
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                              {d.title}
                            </Typography>
                            <Chip 
                              label={d.trackingCode} 
                              size="small" 
                              sx={{ 
                                bgcolor: 'rgba(201, 162, 39, 0.2)',
                                color: 'primary.main',
                                fontWeight: 600
                              }} 
                            />
                          </Stack>
                        }
                        secondary={
                          <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} flexWrap="wrap">
                            <Typography component="span" variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                              ID: {d.id}
                            </Typography>
                            <Typography variant="body2" component="span">•</Typography>
                            <Typography variant="body2" component="span">
                              {statusLabels[d.status] || d.status}
                            </Typography>
                            <Typography variant="body2" component="span">•</Typography>
                            <Typography variant="body2" component="span">
                              Priority {priorityLabels[d.priority] || d.priority}
                            </Typography>
                            <Typography variant="body2" component="span">•</Typography>
                            <Typography variant="body2" component="span">
                              {d.destinationAddress}
                            </Typography>
                          </Stack>
                        }
                      />
                      <IconButton size="small">
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </ListItem>
                    
                    <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                      <Divider sx={{ borderColor: 'rgba(201, 162, 39, 0.15)' }} />
                      <Stack spacing={1.5} sx={{ p: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                          Delivery Route
                        </Typography>
                        {events.length > 0 ? (
                          events.map((event: DeliveryEvent, eventIndex: number) => (
                            <Stack
                              key={event.id}
                              direction="row"
                              spacing={2}
                              sx={{
                                py: 1.5,
                                px: 2,
                                borderLeft: '2px solid',
                                borderColor: eventIndex === events.length - 1 ? 'primary.main' : 'rgba(201, 162, 39, 0.3)',
                                bgcolor: eventIndex % 2 === 0 ? 'transparent' : 'rgba(201, 162, 39, 0.03)',
                                borderRadius: 1
                              }}
                            >
                              <Stack spacing={0.5} sx={{ flex: 1 }}>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {statusLabels[event.type] || event.type}
                                  </Typography>
                                  {event.locationText && (
                                    <Typography variant="caption" color="text.secondary">
                                      • {event.locationText}
                                    </Typography>
                                  )}
                                </Stack>
                                {event.note && event.note !== '-' && (
                                  <Typography variant="body2" color="text.secondary">
                                    {event.note}
                                  </Typography>
                                )}
                                {event.proofImageUrl && event.type === 'DELIVERED' && (
                                  <Stack spacing={1} sx={{ mt: 1 }}>
                                    <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600 }}>
                                      Delivery Proof:
                                    </Typography>
                                    <img
                                      src={event.proofImageUrl}
                                      alt="Delivery proof"
                                      style={{
                                        maxWidth: '100%',
                                        maxHeight: '300px',
                                        objectFit: 'contain',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(201, 162, 39, 0.3)',
                                        cursor: 'pointer'
                                      }}
                                      onClick={() => window.open(event.proofImageUrl!, '_blank')}
                                    />
                                  </Stack>
                                )}
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Typography variant="caption" color="text.secondary">
                                    {new Date(event.createdAt).toLocaleString()}
                                  </Typography>
                                  {event.createdBy && (
                                    <>
                                      <Typography variant="caption" color="text.secondary">•</Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        {event.createdBy.name} ({event.createdBy.role}){event.createdBy.phone ? ` - ${event.createdBy.phone}` : ''}
                                      </Typography>
                                    </>
                                  )}
                                </Stack>
                              </Stack>
                            </Stack>
                          ))
                        ) : (
                          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                            No events yet
                          </Typography>
                        )}
                        {/* Delivery Details */}
                        <Divider sx={{ my: 2, borderColor: 'rgba(201, 162, 39, 0.15)' }} />
                        <Stack spacing={1.5}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                            Delivery Information
                          </Typography>
                          <Stack spacing={1}>
                            <Typography variant="body2">
                              <strong>Receiver:</strong> {d.receiverName}
                            </Typography>
                            <Typography variant="body2">
                              <strong>Receiver Phone:</strong> {d.receiverPhone}
                            </Typography>
                            <Typography variant="body2">
                              <strong>Destination:</strong> {d.destinationAddress}
                            </Typography>
                            {d.sender && (
                              <Typography variant="body2" sx={{ mt: 1 }}>
                                <strong>Sender:</strong> {d.sender.name} ({d.sender.role})
                              </Typography>
                            )}
                          </Stack>
                        </Stack>
                      </Stack>
                    </Collapse>
                  </Paper>
                );
              })}
            </Stack>
            {totalPages > 1 && (
              <Stack alignItems="center" sx={{ mt: 3 }}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(_, value) => {
                    setPage(value);
                    setAssignment({ id: '', courierId: '' });
                    setExpandedDelivery(null);
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


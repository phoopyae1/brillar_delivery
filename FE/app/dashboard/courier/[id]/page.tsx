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
  Chip,
  Collapse,
  IconButton
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { statusLabels } from '../../../lib/status';
import { DeliveryEvent } from '../../../lib/api';

const courierStatuses = ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED_DELIVERY', 'RETURNED'];

// Allowed transitions for courier role
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  ASSIGNED: ['PICKED_UP'],
  PICKED_UP: ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'FAILED_DELIVERY', 'RETURNED'],
  IN_TRANSIT: ['OUT_FOR_DELIVERY', 'FAILED_DELIVERY', 'RETURNED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED_DELIVERY', 'RETURNED'],
  FAILED_DELIVERY: ['RETURNED'],
  RETURNED: ['OUT_FOR_DELIVERY']
};

const getValidStatuses = (currentStatus: string): string[] => {
  return ALLOWED_TRANSITIONS[currentStatus] || [];
};

export default function CourierDashboardById() {
  const params = useParams();
  const courierIdFromUrl = params?.id as string;
  const { user, token, ready } = useAuth();
  const router = useRouter();
  const { data, error, mutate, isLoading } = useSWR(token ? '/courier/mine' : null, () => deliveryApi.mine(token!));
  const [updateForm, setUpdateForm] = useState({ id: '', status: courierStatuses[0], note: '', locationText: '' });
  const [formError, setFormError] = useState('');
  const [selectedDelivery, setSelectedDelivery] = useState<any>(null);
  const [expandedDelivery, setExpandedDelivery] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const itemsPerPage = 5;
  const [proofImage, setProofImage] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);

  const toggleExpand = (deliveryId: string) => {
    setExpandedDelivery(expandedDelivery === deliveryId ? null : deliveryId);
  };

  useEffect(() => {
    if (ready && (!user || !token)) router.push('/login');
    if (ready && user && !['COURIER', 'ADMIN', 'DISPATCHER'].includes(user.role)) router.push('/');
  }, [ready, user, token, router]);

  const convertImageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleStatus = async () => {
    if (!token || !updateForm.id) return;
    const id = updateForm.id;
    if (!id || typeof id !== 'string') {
      setFormError('Please enter a valid delivery ID');
      return;
    }
    
    // Check if delivery is in assigned list
    if (data && !data.find((d: any) => d.id === id)) {
      setFormError(`Delivery ID ${id} is not in your assigned deliveries. Please select from your assignments.`);
      return;
    }
    
    // Validate status transition
    if (selectedDelivery) {
      const validStatuses = getValidStatuses(selectedDelivery.status);
      if (!validStatuses.includes(updateForm.status)) {
        setFormError(`Cannot transition from ${statusLabels[selectedDelivery.status] || selectedDelivery.status} to ${statusLabels[updateForm.status] || updateForm.status}. Valid transitions: ${validStatuses.map(s => statusLabels[s] || s).join(', ')}`);
        return;
      }
    }
    
    // Validate proof image for DELIVERED status
    if (updateForm.status === 'DELIVERED' && !proofImage) {
      setFormError('Please attach a delivery proof image when marking as DELIVERED');
      return;
    }
    
    setFormError('');
    try {
      let proofImageUrl: string | undefined;
      if (updateForm.status === 'DELIVERED' && proofImage) {
        proofImageUrl = await convertImageToBase64(proofImage);
      }
      
      await deliveryApi.updateStatus(token, id, {
        status: updateForm.status,
        note: updateForm.note,
        locationText: updateForm.locationText,
        proofImageUrl
      });
      await mutate();
      setUpdateForm({ id: '', status: courierStatuses[0], note: '', locationText: '' });
      setSelectedDelivery(null);
      setProofImage(null);
      setProofPreview(null);
      setPage(1);
    } catch (e: any) {
      setFormError(e.message || 'Failed to update status. Make sure the delivery is assigned to you and the status transition is valid.');
    }
  };

  const handleEvent = async () => {
    if (!token || !updateForm.id) return;
    const id = updateForm.id;
    if (!id || typeof id !== 'string') {
      setFormError('Please enter a valid delivery ID');
      return;
    }
    
    // Check if delivery is in assigned list
    if (data && !data.find((d: any) => d.id === id)) {
      setFormError(`Delivery ID ${id} is not in your assigned deliveries. Please select from your assignments.`);
      return;
    }
    
    setFormError('');
    try {
      await deliveryApi.addEvent(token, id, {
        type: updateForm.status,
        note: updateForm.note,
        locationText: updateForm.locationText
      });
      await mutate();
      setUpdateForm({ id: '', status: courierStatuses[0], note: '', locationText: '' });
      setSelectedDelivery(null);
    } catch (e: any) {
      setFormError(e.message || 'Failed to add event. Make sure the delivery is assigned to you.');
    }
  };

  // Pagination logic
  const totalPages = data ? Math.ceil(data.length / itemsPerPage) : 0;
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = data ? data.slice(startIndex, endIndex) : [];

  // Reset to page 1 if current page is beyond available pages
  useEffect(() => {
    if (data && page > totalPages && totalPages > 0) {
      setPage(1);
    }
  }, [data, page, totalPages]);

  return (
    <Container sx={{ py: 4, bgcolor: 'transparent' }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
        Courier Dashboard {courierIdFromUrl && `(ID: ${courierIdFromUrl})`}
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error.message}</Alert>}
      {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
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
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Update status</Typography>
            <Stack spacing={2} sx={{ mt: 2 }}>
              <TextField 
                label="Delivery ID" 
                value={updateForm.id} 
                onChange={async (e) => {
                  const id = e.target.value;
                  setUpdateForm({ ...updateForm, id });
                  if (id && data) {
                    const delivery = data.find((d: any) => d.id === id);
                    if (delivery) {
                      setSelectedDelivery(delivery);
                      const validStatuses = getValidStatuses(delivery.status);
                      if (validStatuses.length > 0 && !validStatuses.includes(updateForm.status)) {
                        setUpdateForm({ ...updateForm, id, status: validStatuses[0] });
                      }
                    } else {
                      setSelectedDelivery(null);
                    }
                  } else {
                    setSelectedDelivery(null);
                  }
                }}
                fullWidth
                helperText={
                  selectedDelivery 
                    ? `Current: ${statusLabels[selectedDelivery.status] || selectedDelivery.status}. Valid next: ${getValidStatuses(selectedDelivery.status).map(s => statusLabels[s] || s).join(', ') || 'none'}`
                    : undefined
                }
              />
              <TextField 
                select 
                label="Status" 
                value={updateForm.status} 
                onChange={(e) => {
                  const newStatus = e.target.value;
                  setUpdateForm({ ...updateForm, status: newStatus });
                  // Clear proof image if status changes away from DELIVERED
                  if (newStatus !== 'DELIVERED') {
                    setProofImage(null);
                    setProofPreview(null);
                  }
                }} 
                fullWidth
                disabled={!selectedDelivery || getValidStatuses(selectedDelivery?.status || '').length === 0}
              >
                {(selectedDelivery ? getValidStatuses(selectedDelivery.status) : courierStatuses).map((s) => (
                  <MenuItem key={s} value={s}>
                    {statusLabels[s] || s}
                  </MenuItem>
                ))}
              </TextField>
              <TextField label="Note" value={updateForm.note} onChange={(e) => setUpdateForm({ ...updateForm, note: e.target.value })} fullWidth />
              <TextField
                label="Location"
                value={updateForm.locationText}
                onChange={(e) => setUpdateForm({ ...updateForm, locationText: e.target.value })}
                fullWidth
              />
              {updateForm.status === 'DELIVERED' && (
                <Stack spacing={1}>
                  <Button
                    variant="outlined"
                    component="label"
                    fullWidth
                    sx={{
                      borderColor: 'rgba(201, 162, 39, 0.5)',
                      color: 'text.primary',
                      '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: 'rgba(201, 162, 39, 0.1)'
                      }
                    }}
                  >
                    {proofImage ? 'Change Proof Image' : 'Attach Delivery Proof'}
                    <input
                      type="file"
                      hidden
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setProofImage(file);
                          const reader = new FileReader();
                          reader.onload = () => {
                            setProofPreview(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </Button>
                  {proofPreview && (
                    <Stack spacing={1}>
                      <Typography variant="caption" color="text.secondary">
                        Preview:
                      </Typography>
                      <img
                        src={proofPreview}
                        alt="Delivery proof preview"
                        style={{
                          width: '100%',
                          maxHeight: '200px',
                          objectFit: 'contain',
                          borderRadius: '8px',
                          border: '1px solid rgba(201, 162, 39, 0.3)'
                        }}
                      />
                      <Button
                        size="small"
                        variant="text"
                        color="error"
                        onClick={() => {
                          setProofImage(null);
                          setProofPreview(null);
                        }}
                      >
                        Remove
                      </Button>
                    </Stack>
                  )}
                </Stack>
              )}
              <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                <Button variant="contained" onClick={handleStatus} disabled={!updateForm.id} sx={{ flex: 1 }}>
                  Update status
                </Button>
                <Button variant="outlined" onClick={handleEvent} disabled={!updateForm.id} sx={{ flex: 1 }}>
                  Add checkpoint
                </Button>
              </Stack>
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
                My assignments
              </Typography>
              {data && data.length > 0 && (
                <Typography variant="body2" color="text.secondary">
                  Showing {startIndex + 1}-{Math.min(endIndex, data.length)} of {data.length}
                </Typography>
              )}
            </Stack>
            {isLoading && <Typography>Loading...</Typography>}
            {!isLoading && data?.length === 0 && <Typography>No assigned deliveries.</Typography>}
            <Stack spacing={2}>
              {paginatedData.map((d: any, index: number) => {
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
                        setSelectedDelivery(d);
                        const validStatuses = getValidStatuses(d.status);
                        const newStatus = validStatuses.length > 0 ? validStatuses[0] : updateForm.status;
                        setUpdateForm({ 
                          ...updateForm, 
                          id: String(d.id),
                          status: newStatus
                        });
                        // Clear proof image if new status is not DELIVERED
                        if (newStatus !== 'DELIVERED') {
                          setProofImage(null);
                          setProofPreview(null);
                        }
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
                            <Typography variant="body2" component="span" sx={{ fontWeight: 600, color: 'primary.main' }}>
                              ID: {d.id}
                            </Typography>
                            <Typography variant="body2" component="span">•</Typography>
                            <Typography variant="body2" component="span" sx={{ fontWeight: 600 }}>
                              {statusLabels[d.status] || d.status}
                            </Typography>
                            <Typography variant="body2" component="span">•</Typography>
                            <Typography variant="body2" component="span">
                              {getValidStatuses(d.status).length > 0 
                                ? `Can update to: ${getValidStatuses(d.status).map(s => statusLabels[s] || s).join(', ')}`
                                : 'No valid transitions'}
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
                    setSelectedDelivery(null);
                    setExpandedDelivery(null);
                    setProofImage(null);
                    setProofPreview(null);
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
                      }
                    }
                  }}
                />
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}


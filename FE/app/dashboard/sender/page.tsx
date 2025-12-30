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
  Divider,
  Collapse,
  IconButton,
  Chip,
  Pagination
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import DownloadIcon from '@mui/icons-material/Download';
import { priorityLabels, statusLabels } from '../../lib/status';
import { DeliveryEvent } from '../../lib/api';

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
    destinationAddress: '123 Office St'
  });
  const [submitError, setSubmitError] = useState('');
  const [expandedDelivery, setExpandedDelivery] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    if (ready && (!user || !token)) router.push('/login');
    if (ready && user && user.role !== 'SENDER' && user.role !== 'ADMIN') router.push('/');
  }, [ready, user, token, router]);

  const toggleExpand = (deliveryId: number) => {
    setExpandedDelivery(expandedDelivery === deliveryId ? null : deliveryId);
  };

  const handleCreate = async () => {
    if (!token) return;
    setSubmitError('');
    try {
      await deliveryApi.create(token, {
        ...form,
        priority: form.priority as 'LOW' | 'MEDIUM' | 'HIGH'
      });
      await mutate();
      setPage(1); // Reset to first page after creating new delivery
    } catch (e: any) {
      setSubmitError(e.message);
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
        Sender Dashboard
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error.message}</Alert>}
      {submitError && <Alert severity="error" sx={{ mb: 2 }}>{submitError}</Alert>}
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
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Create delivery</Typography>
            <Stack spacing={2} sx={{ mt: 2 }}>
              <TextField label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} fullWidth />
              <TextField
                label="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                fullWidth
              />
              <TextField select label="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} fullWidth>
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
                fullWidth
              />
              <TextField
                label="Receiver phone"
                value={form.receiverPhone}
                onChange={(e) => setForm({ ...form, receiverPhone: e.target.value })}
                fullWidth
              />
              <TextField
                label="Destination address"
                value={form.destinationAddress}
                onChange={(e) => setForm({ ...form, destinationAddress: e.target.value })}
                fullWidth
              />
              <Button variant="contained" onClick={handleCreate} fullWidth sx={{ mt: 2 }}>
                Create
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
                My deliveries
              </Typography>
              {data && data.length > 0 && (
                <Typography variant="body2" color="text.secondary">
                  Showing {startIndex + 1}-{Math.min(endIndex, data.length)} of {data.length}
                </Typography>
              )}
            </Stack>
            {isLoading && <Typography>Loading...</Typography>}
            {!isLoading && data?.length === 0 && <Typography>No deliveries yet.</Typography>}
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
                      onClick={() => toggleExpand(d.id)}
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
                      <Stack direction="row" spacing={1}>
                        {d.pdfUrl && (
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (token) {
                                deliveryApi.downloadPDF(token, d.id).catch((err) => {
                                  alert('Failed to download PDF: ' + err.message);
                                });
                              }
                            }}
                            sx={{
                              color: 'primary.main',
                              '&:hover': {
                                bgcolor: 'rgba(201, 162, 39, 0.1)'
                              }
                            }}
                            title="Download PDF Label"
                          >
                            <DownloadIcon />
                          </IconButton>
                        )}
                        <IconButton size="small">
                          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </Stack>
                    </ListItem>
                    
                    <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                      <Divider sx={{ borderColor: 'rgba(201, 162, 39, 0.15)' }} />
                      <Stack spacing={1.5} sx={{ p: 2 }}>
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
                                        {event.createdBy.name} ({event.createdBy.role})
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
                    setExpandedDelivery(null); // Close expanded items when changing page
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

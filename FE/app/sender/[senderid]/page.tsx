'use client';
import useSWR from 'swr';
import { useAuth } from '../../hooks/useAuth';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { deliveryApi, integrationApi, Integration } from '../../lib/api';
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
  Pagination,
  Box
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import DownloadIcon from '@mui/icons-material/Download';
import { priorityLabels, statusLabels } from '../../lib/status';
import { DeliveryEvent } from '../../lib/api';

export default function SenderDashboardById() {
  const params = useParams();
  const senderId = params?.senderid as string;
  const { user, token, ready } = useAuth();
  const router = useRouter();
  const { data, error, mutate, isLoading } = useSWR(token ? '/sender/deliveries' : null, () => deliveryApi.mine(token!));
  const { data: integrations } = useSWR('/integrations', () => integrationApi.getAll());
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
  const [processedIntegrations, setProcessedIntegrations] = useState<Array<{
    integration: Integration;
    iframeData: {
      src: string;
      title?: string | null;
      allow?: string | null;
      loading?: string | null;
      isScript: boolean;
    } | null;
  }>>([]);

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
    
    // Client-side validation
    if (!form.receiverName || form.receiverName.length < 2) {
      setSubmitError('Receiver name must be at least 2 characters');
      return;
    }
    if (!form.receiverPhone || form.receiverPhone.length < 5) {
      setSubmitError('Receiver phone must be at least 5 characters');
      return;
    }
    if (!form.destinationAddress || form.destinationAddress.length < 5) {
      setSubmitError('Destination address must be at least 5 characters');
      return;
    }
    
    try {
      await deliveryApi.create(token, {
        ...form,
        priority: form.priority as 'LOW' | 'MEDIUM' | 'HIGH'
      });
      await mutate();
      setPage(1); // Reset to first page after creating new delivery
      // Reset form after successful creation
      setForm({
        title: 'Office Package',
        description: 'Documents',
        priority: 'MEDIUM',
        receiverName: 'Recipient',
        receiverPhone: '555-0100',
        destinationAddress: '123 Office St'
      });
    } catch (e: any) {
      // Show detailed validation error if available
      const errorMessage = e.response?.data?.error || e.response?.data?.message || e.message || 'Failed to create delivery';
      setSubmitError(errorMessage);
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

  // Load and process integrations (scripts and iframes with sender ID)
  useEffect(() => {
    if (!integrations || integrations.length === 0 || !user) {
      setProcessedIntegrations([]);
      return;
    }

    const processed: Array<{
      integration: Integration;
      iframeData: {
        src: string;
        title?: string | null;
        allow?: string | null;
        loading?: string | null;
        isScript: boolean;
      } | null;
    }> = [];

    integrations.forEach((integration: Integration) => {
      if (!integration.iframeScriptTag) return;

      const embedCode = integration.iframeScriptTag;
      let url: string | null = null;
      let isScript = false;

      // Check if it's a script tag
      const scriptTagMatch = embedCode.match(/<script[^>]+src=["']([^"']+)["']/i);
      if (scriptTagMatch) {
        isScript = true;
        url = scriptTagMatch[1];
      } else {
        // Try to parse as iframe
        const wrapper = document.createElement('div');
        wrapper.innerHTML = embedCode;
        const iframe = wrapper.querySelector('iframe');
        if (iframe) {
          url = iframe.getAttribute('src');
        }
      }

      if (!url) {
        // If no URL found, still process for script tags that might be inline
        if (embedCode.trim().startsWith('<script')) {
          const scriptId = `integration-script-${integration._id || integration.contextualKey}`;
          const existingScript = document.getElementById(scriptId);
          if (existingScript) {
            existingScript.remove();
          }

          const script = document.createElement('script');
          script.id = scriptId;
          const srcMatch = embedCode.match(/src=["']([^"']+)["']/);
          const contentMatch = embedCode.match(/>(.*?)<\/script>/s);

          if (srcMatch) {
            script.src = srcMatch[1];
            document.head.appendChild(script);
          } else if (contentMatch) {
            script.textContent = contentMatch[1];
            document.head.appendChild(script);
          }
        }
        return;
      }

      // Add sender ID to URL if it's an iframe (not a script)
      // Use senderId from URL params if available, otherwise use user.id
      const userIdToUse = senderId || (user.id ? String(user.id) : null);
      if (!isScript && userIdToUse) {
        try {
          if (url.startsWith('http://') || url.startsWith('https://')) {
            const urlObj = new URL(url);
            urlObj.searchParams.set('userId', userIdToUse);
            url = urlObj.toString();
          } else {
            const separator = url.includes('?') ? '&' : '?';
            url = `${url}${separator}userId=${userIdToUse}`;
          }
        } catch (error) {
          const separator = url.includes('?') ? '&' : '?';
          url = `${url}${separator}userId=${userIdToUse}`;
        }
      }

      // For scripts, inject them directly
      if (isScript) {
        const scriptId = `integration-script-${integration._id || integration.contextualKey}`;
        const existingScript = document.getElementById(scriptId);
        if (existingScript) {
          existingScript.remove();
        }

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = url;
        document.head.appendChild(script);
      } else {
        // For iframes, store the processed data
        const wrapper = document.createElement('div');
        wrapper.innerHTML = embedCode;
        const iframe = wrapper.querySelector('iframe');
        
        processed.push({
          integration,
          iframeData: {
            src: url,
            title: iframe?.getAttribute('title') ?? null,
            allow: iframe?.getAttribute('allow') ?? null,
            loading: iframe?.getAttribute('loading') ?? null,
            isScript: false,
          },
        });
      }
    });

    setProcessedIntegrations(processed);

    // Cleanup function to remove scripts when component unmounts
    return () => {
      integrations.forEach((integration: Integration) => {
        const scriptId = `integration-script-${integration._id || integration.contextualKey}`;
        const script = document.getElementById(scriptId);
        if (script) {
          script.remove();
        }
      });
    };
  }, [integrations, user, senderId]);

  return (
    <Container sx={{ py: 4, bgcolor: 'transparent' }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
        Sender Dashboard {senderId && `(ID: ${senderId})`}
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

      {/* Integrations Section - Iframes and Scripts */}
      {processedIntegrations.length > 0 && (
        <Paper 
          sx={{ 
            p: 3,
            mt: 3,
            bgcolor: '#1F1F1F',
            border: '1px solid rgba(201, 162, 39, 0.25)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)'
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            Integrations
          </Typography>
          <Grid container spacing={2}>
            {processedIntegrations.map(({ integration, iframeData }) => {
              if (!iframeData || iframeData.isScript) return null;

              return (
                <Grid item xs={12} key={integration._id || integration.contextualKey}>
                  <Paper
                    sx={{
                      p: 2,
                      bgcolor: '#252525',
                      border: '1px solid rgba(201, 162, 39, 0.2)',
                      borderRadius: 2
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                      {integration.name || integration.contextualKey}
                    </Typography>
                    <Box
                      sx={{
                        width: '100%',
                        minHeight: '400px',
                        borderRadius: 1,
                        overflow: 'hidden',
                        border: '1px solid rgba(201, 162, 39, 0.1)'
                      }}
                    >
                      <iframe
                        src={iframeData.src}
                        title={iframeData.title || integration.name || integration.contextualKey}
                        allow={iframeData.allow || undefined}
                        loading={iframeData.loading as 'lazy' | 'eager' | undefined}
                        style={{
                          width: '100%',
                          height: '100%',
                          minHeight: '400px',
                          border: 'none',
                          borderRadius: '8px'
                        }}
                      />
                    </Box>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        </Paper>
      )}
    </Container>
  );
}


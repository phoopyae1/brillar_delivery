'use client';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import {
  Alert,
  Container,
  Grid,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
  Divider,
  Chip,
  Box,
  Card,
  CardContent
} from '@mui/material';
import {
  LocalShipping,
  LocationOn,
  Person,
  Phone,
  Email,
  Description,
  AccessTime,
  CheckCircle,
  RadioButtonUnchecked
} from '@mui/icons-material';
import { deliveryApi, DeliveryEvent } from '../../lib/api';
import { statusFlow, statusLabels, priorityLabels } from '../../lib/status';

export default function PublicTrackPage() {
  const params = useParams<{ trackingCode: string }>();
  const trackingCode = params.trackingCode;
  const { data, error, isLoading } = useSWR(trackingCode ? `/public/${trackingCode}` : null, () =>
    deliveryApi.publicTrack(trackingCode)
  );

  const activeStep = data ? Math.max(0, statusFlow.indexOf(data.status)) : 0;
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return '#f44336';
      case 'MEDIUM': return '#ff9800';
      case 'LOW': return '#4caf50';
      default: return '#9e9e9e';
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'DELIVERED') return '#4caf50';
    if (status === 'CANCELLED' || status === 'FAILED_DELIVERY') return '#f44336';
    return '#ff9800';
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4, bgcolor: 'transparent', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography 
          variant="h3" 
          sx={{ 
            fontWeight: 800, 
            mb: 1,
            background: 'linear-gradient(135deg, #C9A227 0%, #FFD700 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}
        >
          Track Your Delivery
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Real-time tracking information for your package
        </Typography>
      </Box>

      {isLoading && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">Loading tracking information...</Typography>
        </Box>
      )}

      {error && (
        <Alert 
          severity="error" 
          sx={{ 
            mb: 3,
            bgcolor: '#2d1f1f',
            border: '1px solid rgba(244, 67, 54, 0.3)',
            '& .MuiAlert-icon': { color: '#f44336' }
          }}
        >
          {(error as Error).message || 'Failed to load tracking information'}
        </Alert>
      )}

      {data && (
        <Grid container spacing={3}>
          {/* Main Tracking Card */}
          <Grid item xs={12} lg={8}>
            <Card
              sx={{
                bgcolor: '#1F1F1F',
                border: '2px solid rgba(201, 162, 39, 0.3)',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
                borderRadius: 3,
                overflow: 'hidden',
                mb: 3
              }}
            >
              <Box
                sx={{
                  background: 'linear-gradient(135deg, rgba(201, 162, 39, 0.2) 0%, rgba(201, 162, 39, 0.05) 100%)',
                  p: 3,
                  borderBottom: '1px solid rgba(201, 162, 39, 0.2)'
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                      {data.title}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                      <Chip
                        label={data.trackingCode}
                        sx={{
                          bgcolor: 'rgba(201, 162, 39, 0.2)',
                          color: '#C9A227',
                          fontWeight: 700,
                          fontSize: '0.9rem',
                          height: 32
                        }}
                      />
                      <Chip
                        label={priorityLabels[data.priority] || data.priority}
                        sx={{
                          bgcolor: getPriorityColor(data.priority),
                          color: 'white',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          height: 28
                        }}
                        size="small"
                      />
                      <Chip
                        label={statusLabels[data.status] || data.status}
                        sx={{
                          bgcolor: getStatusColor(data.status),
                          color: 'white',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          height: 28
                        }}
                        size="small"
                        icon={data.status === 'DELIVERED' ? <CheckCircle sx={{ fontSize: 16 }} /> : <RadioButtonUnchecked sx={{ fontSize: 16 }} />}
                      />
                    </Stack>
                  </Box>
                </Stack>
              </Box>

              <CardContent sx={{ p: 3 }}>
                {/* Description */}
                {data.description && (
                  <Box sx={{ mb: 3 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <Description sx={{ color: 'primary.main', fontSize: 20 }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                        Description
                      </Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ ml: 4, color: 'text.primary' }}>
                      {data.description}
                    </Typography>
                  </Box>
                )}

                {/* Status Stepper */}
                <Box sx={{ mb: 4 }}>
                  <Stepper 
                    activeStep={activeStep} 
                    alternativeLabel
                    sx={{
                      '& .MuiStepLabel-root .Mui-completed': {
                        color: '#4caf50'
                      },
                      '& .MuiStepLabel-label.Mui-completed.MuiStepLabel-alternativeLabel': {
                        color: '#4caf50'
                      },
                      '& .MuiStepLabel-root .Mui-active': {
                        color: '#C9A227'
                      },
                      '& .MuiStepLabel-label.Mui-active.MuiStepLabel-alternativeLabel': {
                        color: '#C9A227',
                        fontWeight: 700
                      }
                    }}
                  >
                    {statusFlow.map((label) => (
                      <Step key={label} completed={statusFlow.indexOf(label) <= activeStep}>
                        <StepLabel>{statusLabels[label]}</StepLabel>
                      </Step>
                    ))}
                  </Stepper>
                </Box>

                {/* Delivery Information Cards */}
                <Grid container spacing={2}>
                  {/* Receiver Information */}
                  <Grid item xs={12} sm={6}>
                    <Paper
                      sx={{
                        p: 2.5,
                        bgcolor: '#252525',
                        border: '1px solid rgba(201, 162, 39, 0.2)',
                        borderRadius: 2,
                        height: '100%'
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                        <Person sx={{ color: 'primary.main', fontSize: 24 }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          Receiver Information
                        </Typography>
                      </Stack>
                      <Stack spacing={1.5} sx={{ ml: 4 }}>
                        <Typography variant="body2">
                          <strong>Name:</strong> {data.receiverName}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Phone sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <Typography variant="body2">
                            {data.receiverPhone}
                          </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mt: 1 }}>
                          <LocationOn sx={{ fontSize: 16, color: 'text.secondary', mt: 0.5 }} />
                          <Typography variant="body2">
                            {data.destinationAddress}
                          </Typography>
                        </Stack>
                      </Stack>
                    </Paper>
                  </Grid>

                  {/* Sender Information */}
                  {data.sender && (
                    <Grid item xs={12} sm={6}>
                      <Paper
                        sx={{
                          p: 2.5,
                          bgcolor: '#252525',
                          border: '1px solid rgba(201, 162, 39, 0.2)',
                          borderRadius: 2,
                          height: '100%'
                        }}
                      >
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                          <LocalShipping sx={{ color: 'primary.main', fontSize: 24 }} />
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            Sender Information
                          </Typography>
                        </Stack>
                        <Stack spacing={1.5} sx={{ ml: 4 }}>
                          <Typography variant="body2">
                            <strong>Name:</strong> {data.sender.name}
                          </Typography>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Email sx={{ fontSize: 16, color: 'text.secondary' }} />
                            <Typography variant="body2">
                              {data.sender.email}
                            </Typography>
                          </Stack>
                          {data.sender.phone && (
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Phone sx={{ fontSize: 16, color: 'text.secondary' }} />
                              <Typography variant="body2">
                                {data.sender.phone}
                              </Typography>
                            </Stack>
                          )}
                        </Stack>
                      </Paper>
                    </Grid>
                  )}

                  {/* Delivery Details */}
                  <Grid item xs={12}>
                    <Paper
                      sx={{
                        p: 2.5,
                        bgcolor: '#252525',
                        border: '1px solid rgba(201, 162, 39, 0.2)',
                        borderRadius: 2
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                        <AccessTime sx={{ color: 'primary.main', fontSize: 24 }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          Delivery Details
                        </Typography>
                      </Stack>
                      <Stack spacing={1.5} sx={{ ml: 4 }}>
                        <Typography variant="body2">
                          <strong>Created:</strong> {new Date(data.createdAt).toLocaleString()}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Priority:</strong> {priorityLabels[data.priority] || data.priority}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Status:</strong> {statusLabels[data.status] || data.status}
                        </Typography>
                      </Stack>
                    </Paper>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Timeline Sidebar */}
          <Grid item xs={12} lg={4}>
            <Card
              sx={{
                bgcolor: '#1F1F1F',
                border: '2px solid rgba(201, 162, 39, 0.3)',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
                borderRadius: 3,
                height: 'fit-content',
                position: 'sticky',
                top: 20
              }}
            >
              <Box
                sx={{
                  background: 'linear-gradient(135deg, rgba(201, 162, 39, 0.2) 0%, rgba(201, 162, 39, 0.05) 100%)',
                  p: 2.5,
                  borderBottom: '1px solid rgba(201, 162, 39, 0.2)'
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Delivery Timeline
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {data.events.length} event{data.events.length !== 1 ? 's' : ''} recorded
                </Typography>
              </Box>
              <CardContent sx={{ p: 0 }}>
                <Box sx={{ maxHeight: 'calc(100vh - 300px)', overflow: 'auto', p: 2 }}>
                  <Stack spacing={2}>
                    {data.events.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                        No events recorded yet
                      </Typography>
                    ) : (
                      data.events.map((event: DeliveryEvent, index: number) => (
                        <Paper
                          key={event.id}
                          sx={{
                            p: 2.5,
                            bgcolor: index % 2 === 0 ? '#252525' : '#2A2A2A',
                            border: '2px solid',
                            borderColor: index === data.events.length - 1 
                              ? 'rgba(201, 162, 39, 0.5)' 
                              : 'rgba(201, 162, 39, 0.2)',
                            borderRadius: 2,
                            transition: 'all 0.3s ease',
                            position: 'relative',
                            '&:hover': {
                              bgcolor: '#2F2F2F',
                              borderColor: 'rgba(201, 162, 39, 0.6)',
                              transform: 'translateX(4px)',
                              boxShadow: '0 4px 12px rgba(201, 162, 39, 0.2)'
                            },
                            '&::before': index < data.events.length - 1 ? {
                              content: '""',
                              position: 'absolute',
                              left: '20px',
                              top: '100%',
                              width: '2px',
                              height: '16px',
                              bgcolor: 'rgba(201, 162, 39, 0.3)'
                            } : {}
                          }}
                        >
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                            <Box
                              sx={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                bgcolor: index === data.events.length - 1 ? '#C9A227' : 'rgba(201, 162, 39, 0.5)',
                                border: '2px solid',
                                borderColor: index === data.events.length - 1 ? '#FFD700' : 'rgba(201, 162, 39, 0.3)',
                                boxShadow: index === data.events.length - 1 ? '0 0 8px rgba(201, 162, 39, 0.6)' : 'none'
                              }}
                            />
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>
                              {statusLabels[event.type] || event.type}
                            </Typography>
                          </Stack>
                          <Typography variant="caption" color="text.secondary" sx={{ ml: 3, display: 'block', mb: 1 }}>
                            {new Date(event.createdAt).toLocaleString()}
                          </Typography>
                          {event.note && (
                            <Typography variant="body2" sx={{ ml: 3, mt: 1, color: 'text.primary' }}>
                              {event.note}
                            </Typography>
                          )}
                          {event.locationText && (
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: 3, mt: 1 }}>
                              <LocationOn sx={{ fontSize: 16, color: 'primary.main' }} />
                              <Typography variant="body2" color="text.secondary">
                                {event.locationText}
                              </Typography>
                            </Stack>
                          )}
                          {event.proofImageUrl && event.type === 'DELIVERED' && (
                            <Box sx={{ ml: 3, mt: 2 }}>
                              <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                                Delivery Proof:
                              </Typography>
                              <img
                                src={event.proofImageUrl}
                                alt="Delivery proof"
                                style={{
                                  width: '100%',
                                  maxHeight: '200px',
                                  objectFit: 'contain',
                                  borderRadius: '8px',
                                  border: '2px solid rgba(201, 162, 39, 0.3)',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease'
                                }}
                                onClick={() => window.open(event.proofImageUrl!, '_blank')}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.borderColor = 'rgba(201, 162, 39, 0.6)';
                                  e.currentTarget.style.transform = 'scale(1.02)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.borderColor = 'rgba(201, 162, 39, 0.3)';
                                  e.currentTarget.style.transform = 'scale(1)';
                                }}
                              />
                            </Box>
                          )}
                          {event.createdBy && (
                            <Typography variant="caption" color="text.secondary" sx={{ ml: 3, mt: 1, display: 'block' }}>
                              By {event.createdBy.name} ({event.createdBy.role})
                            </Typography>
                          )}
                        </Paper>
                      ))
                    )}
                  </Stack>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Container>
  );
}

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
  Divider
} from '@mui/material';
import { deliveryApi, DeliveryEvent } from '../../lib/api';
import { statusFlow, statusLabels } from '../../lib/status';

export default function PublicTrackPage() {
  const params = useParams<{ trackingCode: string }>();
  const trackingCode = params.trackingCode;
  const { data, error, isLoading } = useSWR(trackingCode ? `/public/${trackingCode}` : null, () =>
    deliveryApi.publicTrack(trackingCode)
  );

  const activeStep = data ? Math.max(0, statusFlow.indexOf(data.status)) : 0;

  return (
    <Container sx={{ py: 4, bgcolor: 'transparent' }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
        Public Tracking
      </Typography>
      {isLoading && <Typography>Loading...</Typography>}
      {error && <Alert severity="error" sx={{ mb: 3 }}>{(error as Error).message}</Alert>}
      {data && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper 
              sx={{ 
                p: 4,
                bgcolor: '#1F1F1F',
                border: '1px solid rgba(201, 162, 39, 0.25)',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)'
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>{data.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Tracking code: <strong>{data.trackingCode}</strong>
              </Typography>
              <Typography sx={{ mt: 1, mb: 0.5 }}>Destination: {data.destinationAddress}</Typography>
              <Typography sx={{ mb: 3 }}>Receiver: {data.receiverName}</Typography>
              <Stepper activeStep={activeStep} alternativeLabel sx={{ mt: 3 }}>
                {statusFlow.map((label) => (
                  <Step key={label} completed={statusFlow.indexOf(label) <= activeStep}>
                    <StepLabel>{statusLabels[label]}</StepLabel>
                  </Step>
                ))}
              </Stepper>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper 
              sx={{ 
                p: 3, 
                maxHeight: 500, 
                overflow: 'auto',
                bgcolor: '#252525',
                border: '1px solid rgba(201, 162, 39, 0.2)',
                boxShadow: '0 15px 45px rgba(0, 0, 0, 0.3)'
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Timeline</Typography>
              <Divider sx={{ my: 2, borderColor: 'rgba(201, 162, 39, 0.25)' }} />
              <Stack spacing={2}>
                {data.events.map((event: DeliveryEvent, index: number) => (
                  <Paper 
                    variant="outlined" 
                    key={event.id} 
                    sx={{ 
                      p: 2,
                      bgcolor: index % 2 === 0 ? '#2A2A2A' : '#2F2F2F',
                      borderColor: 'rgba(201, 162, 39, 0.2)',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: '#333333',
                        borderColor: 'rgba(201, 162, 39, 0.4)',
                        transform: 'translateX(4px)'
                      }
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {statusLabels[event.type] || event.type}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(event.createdAt).toLocaleString()}
                    </Typography>
                    {event.note && <Typography variant="body2" sx={{ mt: 0.5 }}>{event.note}</Typography>}
                    {event.locationText && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        📍 {event.locationText}
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
                    {event.createdBy && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        By {event.createdBy.name} ({event.createdBy.role})
                      </Typography>
                    )}
                  </Paper>
                ))}
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Container>
  );
}

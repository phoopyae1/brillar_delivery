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
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Public Tracking
      </Typography>
      {isLoading && <Typography>Loading...</Typography>}
      {error && <Alert severity="error">{(error as Error).message}</Alert>}
      {data && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6">{data.title}</Typography>
              <Typography variant="body2" color="text.secondary">
                Tracking code: {data.trackingCode}
              </Typography>
            <Typography sx={{ mt: 1 }}>Delivery: {data.deliveryAddress}</Typography>
              <Typography>Receiver: {data.receiverName}</Typography>
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
            <Paper sx={{ p: 2, maxHeight: 500, overflow: 'auto' }}>
              <Typography variant="subtitle1">Timeline</Typography>
              <Divider sx={{ my: 1 }} />
              <Stack spacing={1}>
                {data.events.map((event: DeliveryEvent) => (
                  <Paper variant="outlined" key={event.id} sx={{ p: 1 }}>
                    <Typography variant="subtitle2">{statusLabels[event.type] || event.type}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(event.createdAt).toLocaleString()}
                    </Typography>
                    {event.note && <Typography variant="body2">{event.note}</Typography>}
                    {event.locationText && (
                      <Typography variant="body2" color="text.secondary">
                        {event.locationText}
                      </Typography>
                    )}
                    {event.createdBy && (
                      <Typography variant="caption" color="text.secondary">
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

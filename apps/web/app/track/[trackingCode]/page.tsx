'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Container,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Paper,
  List,
  ListItem,
  ListItemText,
  Alert
} from '@mui/material';
import { getPublicTracking } from '../../lib/api';

const steps = [
  'CREATED',
  'ASSIGNED',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED'
];

export default function TrackingPage() {
  const params = useParams();
  const trackingCode = params?.trackingCode as string;
  const [delivery, setDelivery] = useState<any>(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const data = await getPublicTracking(trackingCode);
      setDelivery(data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    if (!trackingCode) return;
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [trackingCode]);

  const activeStep = delivery ? Math.max(steps.indexOf(delivery.status), 0) : 0;

  return (
    <Container sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Tracking: {trackingCode}
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {delivery && (
        <>
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6">Destination</Typography>
            <Typography>{delivery.destinationAddress}</Typography>
            <Typography color="text.secondary">Receiver: {delivery.receiverName}</Typography>
          </Paper>
          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label.replaceAll('_', ' ')}</StepLabel>
              </Step>
            ))}
          </Stepper>
          <Typography variant="h6" sx={{ mt: 3 }}>
            Events
          </Typography>
          <Paper sx={{ p: 2 }}>
            <List>
              {delivery.events.map((event: any) => (
                <ListItem key={event.id}>
                  <ListItemText
                    primary={`${event.type} - ${event.note || 'No note'}`}
                    secondary={`${new Date(event.createdAt).toLocaleString()} | By ${event.createdBy.name} (${event.createdBy.role}) ${
                      event.locationText ? '- ' + event.locationText : ''
                    }`}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </>
      )}
    </Container>
  );
}

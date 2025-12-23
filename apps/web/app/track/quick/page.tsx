'use client';
import { useState } from 'react';
import { Container, TextField, Button, Stack, Typography, Paper } from '@mui/material';
import { useRouter } from 'next/navigation';

export default function QuickTrack() {
  const [code, setCode] = useState('TRK-SEED-1');
  const router = useRouter();
  return (
    <Container maxWidth="sm" sx={{ mt: 6 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Track a Delivery
        </Typography>
        <Stack spacing={2}>
          <TextField label="Tracking Code" value={code} onChange={(e) => setCode(e.target.value)} />
          <Button variant="contained" onClick={() => router.push(`/track/${code}`)}>
            Track
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}

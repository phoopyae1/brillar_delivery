'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Container, Paper, Stack, TextField, Typography } from '@mui/material';

export default function QuickTrackPage() {
  const router = useRouter();
  const [code, setCode] = useState('');

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Track a package
        </Typography>
        <Stack spacing={2} sx={{ mt: 2 }}>
          <TextField label="Tracking code" value={code} onChange={(e) => setCode(e.target.value)} />
          <Button variant="contained" onClick={() => router.push(`/track/${code}`)} disabled={!code}>
            Track
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}

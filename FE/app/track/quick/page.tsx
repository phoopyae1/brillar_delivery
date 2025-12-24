'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Container, Paper, Stack, TextField, Typography } from '@mui/material';

export default function QuickTrackPage() {
  const router = useRouter();
  const [code, setCode] = useState('');

  return (
    <Container 
      maxWidth="sm" 
      sx={{ 
        py: 4,
        minHeight: 'calc(100vh - 64px)',
        display: 'flex',
        alignItems: 'center'
      }}
    >
      <Paper 
        sx={{ 
          p: 4,
          width: '100%',
          bgcolor: '#1F1F1F',
          border: '1px solid rgba(201, 162, 39, 0.2)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)'
        }}
      >
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
          Track a package
        </Typography>
        <Stack spacing={2} sx={{ mt: 2 }}>
          <TextField 
            label="Tracking code" 
            value={code} 
            onChange={(e) => setCode(e.target.value)}
            fullWidth
          />
          <Button 
            variant="contained" 
            onClick={() => router.push(`/track/${code}`)} 
            disabled={!code}
            fullWidth
            sx={{ mt: 2 }}
          >
            Track
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}

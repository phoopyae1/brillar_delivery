'use client';
import { useState } from 'react';
import { Button, Container, Paper, Stack, TextField, Typography } from '@mui/material';

export default function QuickTrackPage() {
  const [code, setCode] = useState('');

  const handleTrack = () => {
    if (code.trim()) {
      // Use window.location for full page refresh
      window.location.href = `/track/${code.trim()}`;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && code.trim()) {
      handleTrack();
    }
  };

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
          Track a Package
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Enter your tracking code to view delivery status and timeline
        </Typography>
        <Stack spacing={2} sx={{ mt: 2 }}>
          <TextField 
            label="Tracking code" 
            value={code} 
            onChange={(e) => setCode(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="e.g., OFF-2025-XXXXXX"
            fullWidth
            autoFocus
          />
          <Button 
            variant="contained" 
            onClick={handleTrack}
            disabled={!code.trim()}
            fullWidth
            size="large"
            sx={{ mt: 2 }}
          >
            Track Package
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}

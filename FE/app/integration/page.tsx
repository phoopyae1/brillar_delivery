'use client';
import { useState } from 'react';
import {
  Alert,
  Button,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
  Box
} from '@mui/material';
import { integrationApi } from '../lib/api';

export default function IntegrationPage() {
  const [form, setForm] = useState({
    contextualKey: '',
    iframeScriptTag: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Validate required fields
      if (!form.contextualKey.trim()) {
        setError('Contextual key is required');
        setLoading(false);
        return;
      }

      if (!form.iframeScriptTag.trim()) {
        setError('Iframe/Script tag is required');
        setLoading(false);
        return;
      }

      const dataToSave = {
        contextualKey: form.contextualKey.trim(),
        iframeScriptTag: form.iframeScriptTag.trim()
      };

      await integrationApi.create(dataToSave);
      
      setSuccess('Integration saved successfully!');
      // Reset form
      setForm({
        contextualKey: '',
        iframeScriptTag: ''
      });
    } catch (err: any) {
      setError(err.message || 'Failed to save integration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4, bgcolor: 'transparent' }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
        Integration Settings
      </Typography>

      <Paper
        sx={{
          p: 4,
          bgcolor: '#1F1F1F',
          border: '1px solid rgba(201, 162, 39, 0.25)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)'
        }}
      >
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
            {success}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Stack spacing={3}>
            <TextField
              label="Contextual Key"
              value={form.contextualKey}
              onChange={(e) => setForm({ ...form, contextualKey: e.target.value })}
              fullWidth
              required
              helperText="Unique identifier for this integration"
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: 'text.primary',
                  '& fieldset': {
                    borderColor: 'rgba(201, 162, 39, 0.3)'
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(201, 162, 39, 0.5)'
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'primary.main'
                  }
                },
                '& .MuiInputLabel-root': {
                  color: 'text.secondary'
                }
              }}
            />

            <TextField
              label="Iframe/Script Tag"
              value={form.iframeScriptTag}
              onChange={(e) => setForm({ ...form, iframeScriptTag: e.target.value })}
              fullWidth
              required
              multiline
              rows={6}
              helperText="Paste your iframe or script tag code here"
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: 'text.primary',
                  '& fieldset': {
                    borderColor: 'rgba(201, 162, 39, 0.3)'
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(201, 162, 39, 0.5)'
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'primary.main'
                  }
                },
                '& .MuiInputLabel-root': {
                  color: 'text.secondary'
                }
              }}
            />

            <Box sx={{ pt: 2 }}>
              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={loading}
                sx={{
                  py: 1.5,
                  fontWeight: 600,
                  textTransform: 'none',
                  fontSize: '1rem'
                }}
              >
                {loading ? 'Saving...' : 'Save Integration'}
              </Button>
            </Box>
          </Stack>
        </form>
      </Paper>
    </Container>
  );
}


'use client';
import { Container, Typography, Stack, Button, Paper } from '@mui/material';
import Link from 'next/link';

export default function HomePage() {
  return (
    <Container sx={{ py: 6 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          Office Delivery Tracking
        </Typography>
        <Typography variant="body1" gutterBottom>
          Internal courier tracking for office packages with sender, dispatcher, courier, and admin roles.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
          <Button variant="contained" component={Link} href="/track/quick">
            Track a package
          </Button>
          <Button variant="outlined" component={Link} href="/login">
            Log in
          </Button>
          <Button component={Link} href="/register">
            Register
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}

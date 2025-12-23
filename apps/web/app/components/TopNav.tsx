'use client';
import { AppBar, Toolbar, Typography, Button, Stack } from '@mui/material';
import Link from 'next/link';

export default function TopNav() {
  return (
    <AppBar position="static" color="primary">
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Office Delivery Tracking
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button color="inherit" component={Link} href="/login">
            Login
          </Button>
          <Button color="inherit" component={Link} href="/register">
            Register
          </Button>
          <Button color="inherit" component={Link} href="/track/quick">
            Track
          </Button>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}

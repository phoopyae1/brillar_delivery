import { Container, Typography, Grid, Paper, Button, Stack } from '@mui/material';
import Link from 'next/link';
import TopNav from './components/TopNav';

export default function HomePage() {
  return (
    <>
      <TopNav />
      <Container sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Office Delivery Tracking
        </Typography>
        <Typography variant="subtitle1" gutterBottom>
          Manage office package deliveries with sender, dispatcher, courier, and admin workflows.
        </Typography>
        <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
          <Button variant="contained" component={Link} href="/register">
            Get Started
          </Button>
          <Button variant="outlined" component={Link} href="/track/quick">
            Track a Package
          </Button>
        </Stack>
        <Grid container spacing={3}>
          {[
            { title: 'Senders', desc: 'Create and cancel delivery requests before pickup.' },
            { title: 'Dispatchers', desc: 'Assign couriers and monitor delivery status.' },
            { title: 'Couriers', desc: 'Update pickup, transit, and delivery checkpoints.' },
            { title: 'Admins', desc: 'View analytics and oversee all deliveries and users.' }
          ].map((item) => (
            <Grid item xs={12} sm={6} key={item.title}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6">{item.title}</Typography>
                <Typography color="text.secondary">{item.desc}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Container>
    </>
  );
}

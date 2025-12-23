'use client';
import useSWR from 'swr';
import { useAuth } from '../hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { deliveryApi } from '../lib/api';
import { Alert, Container, Grid, Paper, Typography } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { statusLabels, priorityLabels } from '../lib/status';

const columns: GridColDef[] = [
  { field: 'id', headerName: 'ID', width: 70 },
  { field: 'trackingCode', headerName: 'Tracking', width: 150 },
  { field: 'title', headerName: 'Title', width: 180 },
  {
    field: 'status',
    headerName: 'Status',
    width: 160,
    valueFormatter: (params) => statusLabels[params.value as string] || params.value
  },
  {
    field: 'priority',
    headerName: 'Priority',
    width: 120,
    valueFormatter: (params) => priorityLabels[params.value as string] || params.value
  },
  { field: 'destinationAddress', headerName: 'Destination', width: 200 }
];

export default function AdminPage() {
  const { user, token, ready } = useAuth();
  const router = useRouter();
  const { data: deliveries, error } = useSWR(token ? '/admin/deliveries' : null, () => deliveryApi.adminAll(token!));
  const { data: stats } = useSWR(token ? '/admin/stats' : null, () => deliveryApi.adminStats(token!));

  useEffect(() => {
    if (ready && (!user || !token)) router.push('/login');
    if (ready && user && user.role !== 'ADMIN') router.push('/');
  }, [ready, user, token, router]);

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Admin Overview
      </Typography>
      {error && <Alert severity="error">{error.message}</Alert>}
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1">Users</Typography>
            <Typography variant="h5">{stats?.users ?? '-'}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1">Deliveries</Typography>
            <Typography variant="h5">{stats?.deliveries ?? '-'}</Typography>
            <Typography color="text.secondary">Delivered: {stats?.delivered ?? '-'}</Typography>
            <Typography color="text.secondary">In transit: {stats?.inTransit ?? '-'}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Paper sx={{ height: 500, p: 1 }}>
            <DataGrid
              rows={deliveries || []}
              columns={columns}
              getRowId={(row) => row.id}
              disableRowSelectionOnClick
              density="comfortable"
            />
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}

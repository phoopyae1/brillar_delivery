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
    valueFormatter: (params: any) => statusLabels[params.value as string] || params.value
  },
  {
    field: 'priority',
    headerName: 'Priority',
    width: 120,
    valueFormatter: (params: any) => priorityLabels[params.value as string] || params.value
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
    <Container sx={{ py: 4, bgcolor: 'transparent' }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
        Admin Overview
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error.message}</Alert>}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper 
            sx={{ 
              p: 3,
              bgcolor: '#1F1F1F',
              border: '1px solid rgba(201, 162, 39, 0.25)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)'
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Users</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{stats?.users ?? '-'}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper 
            sx={{ 
              p: 3,
              bgcolor: '#252525',
              border: '1px solid rgba(201, 162, 39, 0.2)',
              boxShadow: '0 15px 45px rgba(0, 0, 0, 0.3)'
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Deliveries</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>{stats?.deliveries ?? '-'}</Typography>
            <Typography color="text.secondary">Delivered: {stats?.delivered ?? '-'}</Typography>
            <Typography color="text.secondary">In transit: {stats?.inTransit ?? '-'}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Paper 
            sx={{ 
              height: 500, 
              p: 2,
              bgcolor: '#1F1F1F',
              border: '1px solid rgba(201, 162, 39, 0.2)',
              boxShadow: '0 15px 45px rgba(0, 0, 0, 0.3)'
            }}
          >
            <DataGrid
              rows={deliveries || []}
              columns={columns}
              getRowId={(row) => row.id}
              disableRowSelectionOnClick
              density="comfortable"
              sx={{
                border: 'none',
                '& .MuiDataGrid-cell': {
                  borderColor: 'rgba(201, 162, 39, 0.1)'
                },
                '& .MuiDataGrid-columnHeaders': {
                  borderColor: 'rgba(201, 162, 39, 0.2)'
                }
              }}
            />
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}

'use client';
import useSWR from 'swr';
import { useAuth } from '../../hooks/useAuth';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { integrationApi, Integration, senderAgentApi, priceCalculatorApi, deliveryApi } from '../../lib/api';
import {
  Alert,
  Button,
  Container,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
  Stepper,
  Step,
  StepLabel,
  FormControl,
  InputLabel,
  Select,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  Card,
  CardContent,
  Chip,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab
} from '@mui/material';
import {
  Person,
  LocalShipping,
  Inventory,
  Payment,
  Schedule,
  CheckCircle
} from '@mui/icons-material';
import * as QRCode from 'qrcode';
import { statusLabels, priorityLabels } from '../../lib/status';

const DOCUMENT_TYPES = [
  'Annual Reports',
  'Bills',
  'Contracts',
  'Legal Documents',
  'Invoices',
  'Certificates',
  'Other Documents'
];

const PACKAGE_SIZES = [
  { label: 'Small (S)', value: 'S', dimensions: '20x15x10 cm' },
  { label: 'Medium (M)', value: 'M', dimensions: '30x25x20 cm' },
  { label: 'Large (L)', value: 'L', dimensions: '40x35x30 cm' },
  { label: 'Extra Large (XL)', value: 'XL', dimensions: '50x45x40 cm' },
  { label: '2XL', value: '2XL', dimensions: '60x55x50 cm' },
  { label: '3XL', value: '3XL', dimensions: '70x65x60 cm' },
  { label: 'Custom', value: 'CUSTOM', dimensions: 'Custom dimensions' }
];

const COUNTRIES = [
  { code: 'SG', name: 'Singapore' },
  { code: 'TH', name: 'Thailand' },
  { code: 'MM', name: 'Myanmar' }
];

const steps = [
  'Sender Information',
  'Recipient Information',
  'Shipment Details',
  'Payment Method',
  'Schedule',
  'Confirmation'
];

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function SenderDashboardById() {
  const params = useParams();
  const senderId = params?.senderid as string;
  const { user, token, ready } = useAuth();
  const router = useRouter();
  const { data: integrations } = useSWR('/integrations', () => integrationApi.getAll());
  const { data: deliveries, error: deliveriesError, mutate: mutateDeliveries, isLoading: isLoadingDeliveries } = useSWR(
    token ? '/sender/deliveries' : null,
    () => deliveryApi.mine(token!)
  );
  const [activeTab, setActiveTab] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [trackingCode, setTrackingCode] = useState<string | null>(null);
  const [calculatedPrice, setCalculatedPrice] = useState<number | null>(null);
  const [deliveryDays, setDeliveryDays] = useState<number | null>(null);

  // Form data - initialize without user dependency
  const [formData, setFormData] = useState({
    // Sender Information
    senderName: '',
    senderEmail: '',
    senderPhone: '',
    senderAddress: '',
    senderPostalCode: '',
    
    // Recipient Information
    recipientName: '',
    recipientPhone: '',
    recipientAddress: '',
    recipientPostalCode: '',
    recipientCountry: 'SG',
    
    // Shipment Details
    shipmentType: 'documents' as 'documents' | 'packages',
    documentType: '',
    packageSize: '',
    quantity: 1,
    weight: 1,
    originCountry: 'SG',
    destinationCountry: 'TH', // Default to different country
    serviceType: 'standard' as 'express' | 'standard',
    
    // Payment
    paymentMethod: 'pay_at_delivery',
    
    // Schedule
    preferredDate: '',
    preferredTime: ''
  });

  const [processedIntegrations, setProcessedIntegrations] = useState<Array<{
    integration: Integration;
    iframeData: {
      src: string;
      title?: string | null;
      allow?: string | null;
      loading?: string | null;
      isScript: boolean;
    } | null;
  }>>([]);

  useEffect(() => {
    if (ready && (!user || !token)) router.push('/login');
    if (ready && user && user.role !== 'SENDER' && user.role !== 'ADMIN') router.push('/');
  }, [ready, user, token, router]);

  // Populate form data with user info when available
  useEffect(() => {
    if (ready && user && !formData.senderName) {
      setFormData(prev => ({
        ...prev,
        senderName: user.name || '',
        senderEmail: user.email || '',
        senderPhone: user.phone || ''
      }));
    }
  }, [ready, user]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0: // Sender Information
        if (!formData.senderName || !formData.senderEmail || !formData.senderPhone || 
            !formData.senderAddress || !formData.senderPostalCode) {
          setError('Please fill in all sender information fields');
          return false;
        }
        return true;
      case 1: // Recipient Information
        if (!formData.recipientName || !formData.recipientPhone || 
            !formData.recipientAddress || !formData.recipientPostalCode) {
          setError('Please fill in all recipient information fields');
          return false;
        }
        return true;
      case 2: // Shipment Details
        if (formData.shipmentType === 'documents' && !formData.documentType) {
          setError('Please select a document type');
          return false;
        }
        if (formData.shipmentType === 'packages' && !formData.packageSize) {
          setError('Please select a package size');
          return false;
        }
        if (!formData.quantity || formData.quantity < 1) {
          setError('Quantity must be at least 1');
          return false;
        }
        if (!formData.weight || formData.weight <= 0) {
          setError('Weight must be greater than 0');
          return false;
        }
        if (formData.originCountry === formData.destinationCountry) {
          setError('Origin and destination countries cannot be the same. Please select different countries.');
          return false;
        }
        return true;
      case 3: // Payment Method
        return true; // Only one option
      case 4: // Schedule
        if (!formData.preferredDate || !formData.preferredTime) {
          setError('Please select preferred date and time');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const calculatePrice = async () => {
    try {
      // Validate route before calculating
      if (formData.originCountry === formData.destinationCountry) {
        setError('Origin and destination countries cannot be the same. Please select different countries.');
        setCalculatedPrice(null);
        setDeliveryDays(null);
        return;
      }

      setError(''); // Clear previous errors
      const response = await priceCalculatorApi.calculate({
        origin: formData.originCountry,
        destination: formData.destinationCountry,
        weight: formData.weight,
        serviceType: formData.serviceType
      });
      
      if (response.success && response.data) {
        setCalculatedPrice(response.data.price);
        setDeliveryDays(response.data.deliveryDays);
      } else {
        setError('Failed to calculate price. Please try again.');
        setCalculatedPrice(null);
        setDeliveryDays(null);
      }
    } catch (err: any) {
      console.error('Price calculation error:', err);
      // Extract error message from API response
      let errorMessage = 'Failed to calculate price. Please check your route selection.';
      
      if (err.message) {
        errorMessage = err.message;
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      
      setError(errorMessage);
      setCalculatedPrice(null);
      setDeliveryDays(null);
    }
  };

  const handleNext = async () => {
    // If on last step and shipment already created, switch to deliveries tab
    if (activeStep === steps.length - 1 && trackingCode) {
      setActiveTab(1); // Switch to deliveries tab
      setActiveStep(0); // Reset form for next shipment
      setTrackingCode(null);
      setQrCodeUrl(null);
      setCalculatedPrice(null);
      setDeliveryDays(null);
      return;
    }

    if (!validateStep(activeStep)) {
      return;
    }

    // Validate price calculation when moving from shipment details step
    if (activeStep === 2) {
      if (!calculatedPrice || calculatedPrice <= 0) {
        setError('Please calculate the price before proceeding. Click "Calculate Price" button.');
        return;
      }
    }

    if (activeStep === steps.length - 1) {
      await handleSubmit();
    } else {
      setActiveStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
    setError('');
  };

  const handleSubmit = async () => {
    if (!token) {
      router.push('/login');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const title = formData.shipmentType === 'documents' 
        ? `${formData.documentType} - ${formData.quantity} item(s)`
        : `Package - ${formData.packageSize} - ${formData.quantity} item(s)`;
      
      const description = formData.shipmentType === 'documents'
        ? `Document Type: ${formData.documentType}, Quantity: ${formData.quantity}, Weight: ${formData.weight}kg`
        : `Package Size: ${formData.packageSize}, Quantity: ${formData.quantity}, Weight: ${formData.weight}kg`;

      // Build destinationAddress properly, filtering out empty values
      const addressParts = [
        formData.recipientAddress,
        formData.recipientPostalCode,
        formData.destinationCountry
      ].filter(part => part && part.trim() !== '');

      const builtDestinationAddress = addressParts.length > 0 
        ? addressParts.join(', ')
        : formData.recipientAddress || '';

      const deliveryData = {
        // Basic delivery info
        title,
        description,
        priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
        
        // Receiver info (support both naming conventions)
        receiverName: formData.recipientName,
        receiverPhone: formData.recipientPhone,
        recipientName: formData.recipientName, // Also send as recipientName for compatibility
        recipientPhone: formData.recipientPhone, // Also send as recipientPhone for compatibility
        destinationAddress: builtDestinationAddress,
        recipientPostalCode: formData.recipientPostalCode,
        destinationCountry: formData.destinationCountry,
        recipientAddress: formData.recipientAddress,
        
        // Sender info
        senderName: formData.senderName,
        senderEmail: formData.senderEmail,
        senderPhone: formData.senderPhone,
        senderAddress: formData.senderAddress,
        senderPostalCode: formData.senderPostalCode,
        originCountry: formData.originCountry,
        
        // Shipment details
        shipmentType: formData.shipmentType,
        documentType: formData.documentType,
        packageSize: formData.packageSize,
        quantity: formData.quantity,
        weight: formData.weight,
        serviceType: formData.serviceType,
        
        // Payment and schedule
        paymentMethod: formData.paymentMethod,
        preferredDate: formData.preferredDate,
        preferredTime: formData.preferredTime,
        calculatedPrice: calculatedPrice,
        deliveryDays: deliveryDays
      };

      const response = await senderAgentApi.createDelivery(token, deliveryData);

      if (response && response.success && response.data) {
        setTrackingCode(response.data.trackingCode);
        
        // Generate QR code
        const qrData = `${window.location.origin}/track/${response.data.trackingCode}`;
        const qrUrl = await QRCode.toDataURL(qrData);
        setQrCodeUrl(qrUrl);
        
        // Refresh deliveries list
        await mutateDeliveries();
        
        setActiveStep(steps.length - 1);
        
        // Optionally switch to deliveries tab after showing confirmation
        // User can manually switch if they want to see the new delivery
      } else {
        setError('Failed to create shipment: Invalid response from server');
      }
    } catch (err: any) {
      console.error('Error creating shipment:', err);
      const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to create shipment. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0: // Sender Information
        return (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Person /> Sender Information
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Name"
                  value={formData.senderName}
                  onChange={(e) => handleInputChange('senderName', e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={formData.senderEmail}
                  onChange={(e) => handleInputChange('senderEmail', e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Phone Number"
                  value={formData.senderPhone}
                  onChange={(e) => handleInputChange('senderPhone', e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Postal Code"
                  value={formData.senderPostalCode}
                  onChange={(e) => handleInputChange('senderPostalCode', e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Address"
                  multiline
                  rows={3}
                  value={formData.senderAddress}
                  onChange={(e) => handleInputChange('senderAddress', e.target.value)}
                  required
                />
              </Grid>
            </Grid>
          </Box>
        );

      case 1: // Recipient Information
        return (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <LocalShipping /> Recipient Information
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Recipient Name"
                  value={formData.recipientName}
                  onChange={(e) => handleInputChange('recipientName', e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Phone Number"
                  value={formData.recipientPhone}
                  onChange={(e) => handleInputChange('recipientPhone', e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel>Destination Country</InputLabel>
                  <Select
                    value={formData.destinationCountry}
                    onChange={(e) => handleInputChange('destinationCountry', e.target.value)}
                    label="Destination Country"
                  >
                    {COUNTRIES.map(country => (
                      <MenuItem key={country.code} value={country.code}>{country.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Postal Code"
                  value={formData.recipientPostalCode}
                  onChange={(e) => handleInputChange('recipientPostalCode', e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Address"
                  multiline
                  rows={3}
                  value={formData.recipientAddress}
                  onChange={(e) => handleInputChange('recipientAddress', e.target.value)}
                  required
                />
              </Grid>
            </Grid>
          </Box>
        );

      case 2: // Shipment Details
        return (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Inventory /> Shipment Details
            </Typography>
            
            <FormControl component="fieldset" sx={{ mb: 3 }}>
              <FormLabel component="legend">Shipment Type</FormLabel>
              <RadioGroup
                row
                value={formData.shipmentType}
                onChange={(e) => handleInputChange('shipmentType', e.target.value)}
              >
                <FormControlLabel value="documents" control={<Radio />} label="Documents" />
                <FormControlLabel value="packages" control={<Radio />} label="Packages" />
              </RadioGroup>
            </FormControl>

            {formData.shipmentType === 'documents' ? (
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <FormControl fullWidth required>
                    <InputLabel>Document Type</InputLabel>
                    <Select
                      value={formData.documentType}
                      onChange={(e) => handleInputChange('documentType', e.target.value)}
                      label="Document Type"
                    >
                      {DOCUMENT_TYPES.map(type => (
                        <MenuItem key={type} value={type}>{type}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Quantity"
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => handleInputChange('quantity', parseInt(e.target.value) || 1)}
                    inputProps={{ min: 1 }}
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Weight (kg)"
                    type="number"
                    value={formData.weight}
                    onChange={(e) => handleInputChange('weight', parseFloat(e.target.value) || 1)}
                    inputProps={{ min: 0.1, step: 0.1 }}
                    required
                  />
                </Grid>
              </Grid>
            ) : (
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <FormControl fullWidth required>
                    <InputLabel>Package Size</InputLabel>
                    <Select
                      value={formData.packageSize}
                      onChange={(e) => handleInputChange('packageSize', e.target.value)}
                      label="Package Size"
                    >
                      {PACKAGE_SIZES.map(size => (
                        <MenuItem key={size.value} value={size.value}>
                          {size.label} - {size.dimensions}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Quantity"
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => handleInputChange('quantity', parseInt(e.target.value) || 1)}
                    inputProps={{ min: 1 }}
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Weight (kg)"
                    type="number"
                    value={formData.weight}
                    onChange={(e) => handleInputChange('weight', parseFloat(e.target.value) || 1)}
                    inputProps={{ min: 0.1, step: 0.1 }}
                    required
                  />
                </Grid>
              </Grid>
            )}

            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel>Origin Country</InputLabel>
                  <Select
                    value={formData.originCountry}
                    onChange={(e) => handleInputChange('originCountry', e.target.value)}
                    label="Origin Country"
                  >
                    {COUNTRIES.map(country => (
                      <MenuItem key={country.code} value={country.code}>{country.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel>Service Type</InputLabel>
                  <Select
                    value={formData.serviceType}
                    onChange={(e) => handleInputChange('serviceType', e.target.value)}
                    label="Service Type"
                  >
                    <MenuItem value="standard">Standard</MenuItem>
                    <MenuItem value="express">Express</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="outlined"
                onClick={calculatePrice}
                disabled={formData.originCountry === formData.destinationCountry || !formData.weight || formData.weight <= 0}
                sx={{ minWidth: 200 }}
              >
                Calculate Price
              </Button>
            </Box>

            {calculatedPrice !== null && calculatedPrice > 0 && (
              <Box sx={{ mt: 3, p: 2, bgcolor: '#252525', borderRadius: 2, border: '1px solid rgba(201, 162, 39, 0.3)' }}>
                <Typography variant="h6" color="primary" sx={{ fontWeight: 700 }}>
                  Estimated Price: ${calculatedPrice.toFixed(2)} USD
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Estimated Delivery: {deliveryDays} day(s)
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  Route: {COUNTRIES.find(c => c.code === formData.originCountry)?.name} → {COUNTRIES.find(c => c.code === formData.destinationCountry)?.name}
                </Typography>
              </Box>
            )}
          </Box>
        );

      case 3: // Payment Method
        return (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Payment /> Payment Method
            </Typography>
            <FormControl component="fieldset">
              <RadioGroup
                value={formData.paymentMethod}
                onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
              >
                <FormControlLabel 
                  value="pay_at_delivery" 
                  control={<Radio />} 
                  label="Pay at Delivery (Cash on Delivery)" 
                />
              </RadioGroup>
            </FormControl>
            {calculatedPrice && (
              <Box sx={{ mt: 3, p: 2, bgcolor: '#252525', borderRadius: 2 }}>
                <Typography variant="h6">Total Amount: ${calculatedPrice.toFixed(2)} USD</Typography>
                <Typography variant="body2" color="text.secondary">
                  Payment will be collected upon delivery
                </Typography>
              </Box>
            )}
          </Box>
        );

      case 4: // Schedule
        return (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Schedule /> Preferred Date & Time
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Preferred Date"
                  type="date"
                  value={formData.preferredDate}
                  onChange={(e) => handleInputChange('preferredDate', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ min: new Date().toISOString().split('T')[0] }}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Preferred Time"
                  type="time"
                  value={formData.preferredTime}
                  onChange={(e) => handleInputChange('preferredTime', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
            </Grid>
          </Box>
        );

      case 5: // Confirmation
        return (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircle /> Shipment Created Successfully!
            </Typography>
            
            {trackingCode && (
              <>
                <Alert severity="success" sx={{ mb: 3 }}>
                  <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Your shipment has been created and will appear in the Dispatcher dashboard for assignment.
                  </Typography>
                  <Typography variant="body2">
                    A dispatcher will assign a courier to handle your delivery soon.
                  </Typography>
                </Alert>
                <Card sx={{ mb: 3, bgcolor: '#252525', border: '1px solid rgba(201, 162, 39, 0.2)' }}>
                  <CardContent>
                    <Stack spacing={2} alignItems="center">
                      <Typography variant="h5" color="primary" sx={{ fontWeight: 700 }}>
                        Tracking Code: {trackingCode}
                      </Typography>
                      {qrCodeUrl && (
                        <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 2 }}>
                          <img src={qrCodeUrl} alt="QR Code" style={{ width: 200, height: 200 }} />
                        </Box>
                      )}
                      {calculatedPrice && (
                        <Box>
                          <Chip 
                            label={`Total: $${calculatedPrice.toFixed(2)} USD`} 
                            color="primary" 
                            sx={{ fontSize: '1rem', p: 2 }}
                          />
                        </Box>
                      )}
                      <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                        <Button
                          variant="outlined"
                          onClick={() => router.push(`/track/${trackingCode}`)}
                        >
                          Track Shipment
                        </Button>
                        <Button
                          variant="contained"
                          onClick={() => {
                            setActiveTab(1); // Switch to deliveries tab
                            setActiveStep(0); // Reset form
                            setTrackingCode(null);
                            setQrCodeUrl(null);
                            setCalculatedPrice(null);
                            setDeliveryDays(null);
                            // Reset form data
                            setFormData({
                              senderName: user?.name || '',
                              senderEmail: user?.email || '',
                              senderPhone: user?.phone || '',
                              senderAddress: '',
                              senderPostalCode: '',
                              recipientName: '',
                              recipientPhone: '',
                              recipientAddress: '',
                              recipientPostalCode: '',
                              recipientCountry: 'SG',
                              shipmentType: 'documents',
                              documentType: '',
                              packageSize: '',
                              quantity: 1,
                              weight: 1,
                              originCountry: 'SG',
                              destinationCountry: 'TH',
                              serviceType: 'standard',
                              paymentMethod: 'pay_at_delivery',
                              preferredDate: '',
                              preferredTime: ''
                            });
                          }}
                        >
                          View My Deliveries
                        </Button>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              </>
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  // Load and process integrations (scripts and iframes with sender ID)
  useEffect(() => {
    if (!integrations || integrations.length === 0 || !user) {
      setProcessedIntegrations([]);
      return;
    }

    const processed: Array<{
      integration: Integration;
      iframeData: {
        src: string;
        title?: string | null;
        allow?: string | null;
        loading?: string | null;
        isScript: boolean;
      } | null;
    }> = [];

    integrations.forEach((integration: Integration) => {
      if (!integration.iframeScriptTag) return;

      const embedCode = integration.iframeScriptTag;
      let url: string | null = null;
      let isScript = false;

      // Check if it's a script tag
      const scriptTagMatch = embedCode.match(/<script[^>]+src=["']([^"']+)["']/i);
      if (scriptTagMatch) {
        isScript = true;
        url = scriptTagMatch[1];
      } else {
        // Try to parse as iframe
        const wrapper = document.createElement('div');
        wrapper.innerHTML = embedCode;
        const iframe = wrapper.querySelector('iframe');
        if (iframe) {
          url = iframe.getAttribute('src');
        }
      }

      if (!url) {
        // If no URL found, still process for script tags that might be inline
        if (embedCode.trim().startsWith('<script')) {
          const scriptId = `integration-script-${integration._id || integration.contextualKey}`;
          const existingScript = document.getElementById(scriptId);
          if (existingScript) {
            existingScript.remove();
          }

          const script = document.createElement('script');
          script.id = scriptId;
          const srcMatch = embedCode.match(/src=["']([^"']+)["']/);
          const contentMatch = embedCode.match(/>(.*?)<\/script>/s);

          if (srcMatch) {
            script.src = srcMatch[1];
            document.head.appendChild(script);
          } else if (contentMatch) {
            script.textContent = contentMatch[1];
            document.head.appendChild(script);
          }
        }
        return;
      }

      // Add sender ID to URL if it's an iframe (not a script)
      // Use senderId from URL params if available, otherwise use user.id
      const userIdToUse = senderId || (user.id ? String(user.id) : null);
      if (!isScript && userIdToUse) {
        try {
          if (url.startsWith('http://') || url.startsWith('https://')) {
            const urlObj = new URL(url);
            urlObj.searchParams.set('userId', userIdToUse);
            url = urlObj.toString();
          } else {
            const separator = url.includes('?') ? '&' : '?';
            url = `${url}${separator}userId=${userIdToUse}`;
          }
        } catch (error) {
          const separator = url.includes('?') ? '&' : '?';
          url = `${url}${separator}userId=${userIdToUse}`;
        }
      }

      // For scripts, inject them directly
      if (isScript) {
        const scriptId = `integration-script-${integration._id || integration.contextualKey}`;
        const existingScript = document.getElementById(scriptId);
        if (existingScript) {
          existingScript.remove();
        }

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = url;
        document.head.appendChild(script);
      } else {
        // For iframes, store the processed data
        const wrapper = document.createElement('div');
        wrapper.innerHTML = embedCode;
        const iframe = wrapper.querySelector('iframe');
        
        processed.push({
          integration,
          iframeData: {
            src: url,
            title: iframe?.getAttribute('title') ?? null,
            allow: iframe?.getAttribute('allow') ?? null,
            loading: iframe?.getAttribute('loading') ?? null,
            isScript: false,
          },
        });
      }
    });

    setProcessedIntegrations(processed);

    // Cleanup function to remove scripts when component unmounts
    return () => {
      integrations.forEach((integration: Integration) => {
        const scriptId = `integration-script-${integration._id || integration.contextualKey}`;
        const script = document.getElementById(scriptId);
        if (script) {
          script.remove();
        }
      });
    };
  }, [integrations, user, senderId]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography 
          variant="h3" 
          gutterBottom 
          sx={{ 
            fontWeight: 800, 
            mb: 1,
            background: 'linear-gradient(135deg, #C9A227 0%, #E8C547 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}
        >
          Sender Dashboard
        </Typography>
        {senderId && (
          <Typography variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
            Account ID: {senderId}
          </Typography>
        )}
      </Box>
      
      <Paper 
        sx={{ 
          bgcolor: '#1A1A1A',
          border: 'none',
          borderRadius: 4,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(201, 162, 39, 0.1)',
          overflow: 'hidden'
        }}
      >
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange}
          sx={{
            bgcolor: '#1F1F1F',
            borderBottom: '2px solid rgba(201, 162, 39, 0.15)',
            px: 2,
            '& .MuiTab-root': {
              color: 'rgba(255, 255, 255, 0.6)',
              textTransform: 'none',
              fontSize: '1rem',
              fontWeight: 600,
              minHeight: 64,
              px: 3,
              '&:hover': {
                color: 'rgba(201, 162, 39, 0.8)',
                bgcolor: 'rgba(201, 162, 39, 0.05)'
              },
              '&.Mui-selected': {
                color: '#C9A227',
                fontWeight: 700
              }
            },
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: '3px 3px 0 0',
              backgroundColor: '#C9A227',
              boxShadow: '0 -2px 8px rgba(201, 162, 39, 0.4)'
            }
          }}
        >
          <Tab 
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <LocalShipping sx={{ fontSize: 20 }} />
                <span>Create Shipment</span>
              </Stack>
            } 
          />
          <Tab 
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <Inventory sx={{ fontSize: 20 }} />
                <span>My Deliveries</span>
              </Stack>
            } 
          />
        </Tabs>

        <TabPanel value={activeTab} index={0}>
          <Box sx={{ p: { xs: 3, md: 5 }, bgcolor: '#1A1A1A' }}>
            <Box sx={{ mb: 4, textAlign: 'center' }}>
              <Typography 
                variant="h4" 
                gutterBottom 
                sx={{ 
                  fontWeight: 700, 
                  mb: 1,
                  color: '#FFFFFF'
                }}
              >
                Create New Shipment
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Follow the steps below to create and track your delivery
              </Typography>
            </Box>

            <Stepper 
              activeStep={activeStep} 
              sx={{ 
                mb: 5,
                '& .MuiStepLabel-root .Mui-completed': {
                  color: '#C9A227'
                },
                '& .MuiStepLabel-root .Mui-active': {
                  color: '#C9A227'
                },
                '& .MuiStepLabel-label': {
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontWeight: 500,
                  '&.Mui-active': {
                color: '#C9A227',
                fontWeight: 600
                  },
                  '&.Mui-completed': {
                color: '#C9A227'
                  }
                },
                '& .MuiStepIcon-root': {
                  color: 'rgba(255, 255, 255, 0.3)',
                  '&.Mui-active': {
                    color: '#C9A227'
                  },
                  '&.Mui-completed': {
                    color: '#C9A227'
                  }
                }
              }}
            >
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {error && (
              <Alert 
                severity="error" 
                sx={{ 
                  mb: 3,
                  borderRadius: 2,
                  bgcolor: 'rgba(244, 67, 54, 0.1)',
                  border: '1px solid rgba(244, 67, 54, 0.3)',
                  '& .MuiAlert-icon': {
                    color: '#f44336'
                  }
                }}
              >
                {error}
              </Alert>
            )}

            <Box sx={{ 
              bgcolor: '#252525', 
              borderRadius: 3, 
              p: 4,
              border: '1px solid rgba(201, 162, 39, 0.1)',
              boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.3)'
            }}>
              {renderStepContent(activeStep)}
            </Box>

            <Box 
              sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                mt: 4,
                pt: 3,
                borderTop: '1px solid rgba(201, 162, 39, 0.1)'
              }}
            >
              <Button
                disabled={activeStep === 0 || loading}
                onClick={handleBack}
                sx={{
                  px: 4,
                  py: 1.5,
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600,
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                  color: 'rgba(255, 255, 255, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)'
                  },
                  '&:disabled': {
                    color: 'rgba(255, 255, 255, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.05)'
                  }
                }}
              >
                Back
              </Button>
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={loading}
                sx={{
                  px: 5,
                  py: 1.5,
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '1rem',
                  bgcolor: '#C9A227',
                  color: '#000000',
                  boxShadow: '0 4px 14px rgba(201, 162, 39, 0.4)',
                  '&:hover': {
                    bgcolor: '#E8C547',
                    boxShadow: '0 6px 20px rgba(201, 162, 39, 0.5)',
                    transform: 'translateY(-1px)'
                  },
                  '&:disabled': {
                    bgcolor: 'rgba(201, 162, 39, 0.3)',
                    color: 'rgba(0, 0, 0, 0.5)'
                  },
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                {loading ? 'Processing...' : activeStep === steps.length - 1 ? 'Complete' : 'Next'}
              </Button>
            </Box>
          </Box>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <Box sx={{ p: { xs: 3, md: 4 }, bgcolor: '#1A1A1A', minHeight: 400 }}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5, color: '#FFFFFF' }}>
                My Deliveries
              </Typography>
              <Typography variant="body2" color="text.secondary">
                View and manage all your shipments
              </Typography>
            </Box>
            
            {isLoadingDeliveries && (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography color="text.secondary">Loading deliveries...</Typography>
              </Box>
            )}
            
            {deliveriesError && (
              <Alert 
                severity="error" 
                sx={{ 
                  mb: 3,
                  borderRadius: 2,
                  bgcolor: 'rgba(244, 67, 54, 0.1)',
                  border: '1px solid rgba(244, 67, 54, 0.3)'
                }}
              >
                {deliveriesError.message || 'Failed to load deliveries'}
              </Alert>
            )}
            
            {!isLoadingDeliveries && deliveries && deliveries.length === 0 && (
              <Box 
                sx={{ 
                  textAlign: 'center', 
                  py: 8,
                  bgcolor: '#252525',
                  borderRadius: 3,
                  border: '2px dashed rgba(201, 162, 39, 0.2)'
                }}
              >
                <Inventory sx={{ fontSize: 64, color: 'rgba(201, 162, 39, 0.3)', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                  No deliveries yet
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Create your first shipment in the "Create Shipment" tab
                </Typography>
                <Button
                  variant="contained"
                  onClick={() => setActiveTab(0)}
                  sx={{
                    bgcolor: '#C9A227',
                    color: '#000000',
                    fontWeight: 600,
                    textTransform: 'none',
                    px: 4,
                    '&:hover': {
                      bgcolor: '#E8C547'
                    }
                  }}
                >
                  Create Shipment
                </Button>
              </Box>
            )}
            
            {!isLoadingDeliveries && deliveries && deliveries.length > 0 && (
              <TableContainer
                sx={{
                  borderRadius: 3,
                  border: '1px solid rgba(201, 162, 39, 0.1)',
                  bgcolor: '#252525',
                  overflow: 'hidden'
                }}
              >
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#1F1F1F' }}>
                      <TableCell sx={{ fontWeight: 700, color: '#C9A227', py: 2 }}>Tracking Code</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#C9A227', py: 2 }}>Title</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#C9A227', py: 2 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#C9A227', py: 2 }}>Priority</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#C9A227', py: 2 }}>Destination</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#C9A227', py: 2 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {deliveries.map((delivery: any, index: number) => (
                      <TableRow
                        key={delivery.id}
                        sx={{
                          bgcolor: index % 2 === 0 ? '#252525' : '#2A2A2A',
                          '&:hover': {
                            bgcolor: 'rgba(201, 162, 39, 0.08)',
                            transform: 'scale(1.01)',
                            transition: 'all 0.2s ease-in-out'
                          },
                          transition: 'all 0.2s ease-in-out'
                        }}
                      >
                        <TableCell>
                          <Chip 
                            label={delivery.trackingCode} 
                            size="small" 
                            sx={{ 
                              bgcolor: 'rgba(201, 162, 39, 0.2)',
                              color: '#C9A227',
                              fontWeight: 700,
                              fontFamily: 'monospace',
                              border: '1px solid rgba(201, 162, 39, 0.3)'
                            }} 
                          />
                        </TableCell>
                        <TableCell sx={{ color: '#FFFFFF', fontWeight: 500 }}>
                          {delivery.title}
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={statusLabels[delivery.status] || delivery.status}
                            size="small"
                            sx={{
                              bgcolor: delivery.status === 'DELIVERED' 
                                ? 'rgba(76, 175, 80, 0.2)' 
                                : delivery.status === 'CANCELLED' || delivery.status === 'FAILED_DELIVERY'
                                ? 'rgba(244, 67, 54, 0.2)'
                                : 'rgba(201, 162, 39, 0.2)',
                              color: delivery.status === 'DELIVERED'
                                ? '#4caf50'
                                : delivery.status === 'CANCELLED' || delivery.status === 'FAILED_DELIVERY'
                                ? '#f44336'
                                : '#C9A227',
                              fontWeight: 600,
                              border: `1px solid ${
                                delivery.status === 'DELIVERED' 
                                  ? 'rgba(76, 175, 80, 0.3)' 
                                  : delivery.status === 'CANCELLED' || delivery.status === 'FAILED_DELIVERY'
                                  ? 'rgba(244, 67, 54, 0.3)'
                                  : 'rgba(201, 162, 39, 0.3)'
                              }`
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ color: '#FFFFFF' }}>
                          <Chip
                            label={priorityLabels[delivery.priority] || delivery.priority}
                            size="small"
                            sx={{
                              bgcolor: delivery.priority === 'HIGH'
                                ? 'rgba(244, 67, 54, 0.15)'
                                : delivery.priority === 'MEDIUM'
                                ? 'rgba(201, 162, 39, 0.15)'
                                : 'rgba(158, 158, 158, 0.15)',
                              color: delivery.priority === 'HIGH'
                                ? '#f44336'
                                : delivery.priority === 'MEDIUM'
                                ? '#C9A227'
                                : '#9e9e9e',
                              fontWeight: 600
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ color: 'rgba(255, 255, 255, 0.8)', maxWidth: 200 }}>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {delivery.destinationAddress}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1}>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => router.push(`/track/${delivery.trackingCode}`)}
                              sx={{
                                textTransform: 'none',
                                fontWeight: 600,
                                borderColor: 'rgba(201, 162, 39, 0.5)',
                                color: '#C9A227',
                                '&:hover': {
                                  borderColor: '#C9A227',
                                  bgcolor: 'rgba(201, 162, 39, 0.1)'
                                }
                              }}
                            >
                              Track
                            </Button>
                            {delivery.pdfUrl && token && (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                  deliveryApi.downloadPDF(token, delivery.id).catch((err) => {
                                    alert('Failed to download PDF: ' + err.message);
                                  });
                                }}
                                sx={{
                                  textTransform: 'none',
                                  fontWeight: 600,
                                  borderColor: 'rgba(255, 255, 255, 0.3)',
                                  color: 'rgba(255, 255, 255, 0.7)',
                                  '&:hover': {
                                    borderColor: 'rgba(255, 255, 255, 0.5)',
                                    bgcolor: 'rgba(255, 255, 255, 0.1)'
                                  }
                                }}
                              >
                                PDF
                              </Button>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </TabPanel>
      </Paper>

      {/* Integrations Section - Iframes and Scripts */}
      {processedIntegrations.length > 0 && (
        <Paper 
          sx={{ 
            p: 4,
            mt: 4,
            bgcolor: '#1A1A1A',
            border: 'none',
            borderRadius: 4,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(201, 162, 39, 0.1)',
            overflow: 'hidden'
          }}
        >
          <Typography 
            variant="h5" 
            sx={{ 
              fontWeight: 700, 
              mb: 3,
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            <Box
              sx={{
                width: 4,
                height: 24,
                bgcolor: '#C9A227',
                borderRadius: 1
              }}
            />
            Integrations
          </Typography>
          <Grid container spacing={3}>
            {processedIntegrations.map(({ integration, iframeData }) => {
              if (!iframeData || iframeData.isScript) return null;

              return (
                <Grid item xs={12} key={integration._id || integration.contextualKey}>
                  <Paper
                    sx={{
                      p: 3,
                      bgcolor: '#252525',
                      border: '1px solid rgba(201, 162, 39, 0.15)',
                      borderRadius: 3,
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
                      transition: 'all 0.3s ease-in-out',
                      '&:hover': {
                        borderColor: 'rgba(201, 162, 39, 0.3)',
                        boxShadow: '0 6px 24px rgba(201, 162, 39, 0.2)',
                        transform: 'translateY(-2px)'
                      }
                    }}
                  >
                    <Typography 
                      variant="subtitle1" 
                      sx={{ 
                        mb: 2, 
                        fontWeight: 600,
                        color: '#C9A227',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                      }}
                    >
                      <Box
                        sx={{
                          width: 3,
                          height: 16,
                          bgcolor: '#C9A227',
                          borderRadius: 1
                        }}
                      />
                      {integration.name || integration.contextualKey}
                    </Typography>
                    <Box
                      sx={{
                        width: '100%',
                        minHeight: '400px',
                        borderRadius: 2,
                        overflow: 'hidden',
                        border: '1px solid rgba(201, 162, 39, 0.1)',
                        bgcolor: '#1A1A1A'
                      }}
                    >
                      <iframe
                        src={iframeData.src}
                        title={iframeData.title || integration.name || integration.contextualKey}
                        allow={iframeData.allow || undefined}
                        loading={iframeData.loading as 'lazy' | 'eager' | undefined}
                        style={{
                          width: '100%',
                          height: '100%',
                          minHeight: '400px',
                          border: 'none',
                          borderRadius: '8px'
                        }}
                      />
                    </Box>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        </Paper>
      )}
    </Container>
  );
}


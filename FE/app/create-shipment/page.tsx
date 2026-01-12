'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Container,
  Paper,
  Stepper,
  Step,
  StepLabel,
  TextField,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  Alert,
  Card,
  CardContent,
  Stack,
  Chip
} from '@mui/material';
import {
  Person,
  LocalShipping,
  Inventory,
  Payment,
  Schedule,
  QrCode,
  CheckCircle
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { senderAgentApi, priceCalculatorApi } from '../lib/api';
import * as QRCode from 'qrcode';

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

export default function CreateShipmentPage() {
  const router = useRouter();
  const { user, token, ready } = useAuth();
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
    
    // Restore pending shipment data if exists
    if (ready && !user) {
      const pendingShipment = sessionStorage.getItem('pendingShipment');
      if (pendingShipment) {
        try {
          const savedData = JSON.parse(pendingShipment);
          setFormData(prev => ({ ...prev, ...savedData }));
          sessionStorage.removeItem('pendingShipment');
        } catch (e) {
          console.error('Failed to restore pending shipment:', e);
        }
      }
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
    // If on last step and shipment already created, redirect to home
    if (activeStep === steps.length - 1 && trackingCode) {
      window.location.href = '/';
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
      // Store form data in sessionStorage so user can continue after login
      sessionStorage.setItem('pendingShipment', JSON.stringify(formData));
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

      const deliveryData = {
        title,
        description,
        priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
        receiverName: formData.recipientName,
        receiverPhone: formData.recipientPhone,
        destinationAddress: `${formData.recipientAddress}, ${formData.recipientPostalCode}, ${formData.destinationCountry}`
      };

      const response = await senderAgentApi.createDelivery(token, deliveryData);

      if (response && response.success && response.data) {
        setTrackingCode(response.data.trackingCode);
        
        // Generate QR code
        const qrData = `${window.location.origin}/track/${response.data.trackingCode}`;
        const qrUrl = await QRCode.toDataURL(qrData);
        setQrCodeUrl(qrUrl);
        
        setActiveStep(steps.length - 1);
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
                            window.location.href = '/';
                          }}
                        >
                          Go to Home
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

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper sx={{ p: 4, bgcolor: '#1F1F1F', border: '1px solid rgba(201, 162, 39, 0.2)' }}>
        <Typography variant="h4" gutterBottom sx={{ mb: 4, fontWeight: 700, textAlign: 'center' }}>
          Create Shipment
        </Typography>

        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {renderStepContent(activeStep)}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
          <Button
            disabled={activeStep === 0 || loading}
            onClick={handleBack}
          >
            Back
          </Button>
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={loading}
          >
            {loading ? 'Processing...' : activeStep === steps.length - 1 ? 'Finish' : 'Next'}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}


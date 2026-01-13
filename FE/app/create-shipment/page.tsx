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
  CheckCircle,
  PictureAsPdf,
  Download
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { senderAgentApi, publicAgentApi, priceCalculatorApi, deliveryApi } from '../lib/api';
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
  { code: 'KH', name: 'Cambodia' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'LA', name: 'Laos' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'MM', name: 'Myanmar' },
  { code: 'PH', name: 'Philippines' },
  { code: 'SG', name: 'Singapore' },
  { code: 'TH', name: 'Thailand' },
  { code: 'VN', name: 'Vietnam' }
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
  const [deliveryId, setDeliveryId] = useState<number | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
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

  // Debug: Track trackingCode changes
  useEffect(() => {
    console.log('Tracking code state changed:', trackingCode);
    console.log('Delivery ID state changed:', deliveryId);
    console.log('Loading state:', loading);
    console.log('Active step:', activeStep);
    console.log('User:', user);
    console.log('Token:', token ? 'Token exists' : 'No token');
  }, [trackingCode, deliveryId, loading, activeStep, user, token]);

  // Note: Users can create shipments without being logged in (public API)
  // No need to check authentication status or redirect

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

    // On confirmation step, if no tracking code yet, submit the form
    if (activeStep === steps.length - 1 && !trackingCode) {
      // Prevent any navigation during submission
      if (loading) {
        return; // Already submitting, don't do anything
      }
      await handleSubmit();
      // Don't advance step - stay on confirmation to show success view
      return;
    }
    
    // Only advance step if not on confirmation step or if shipment is already created
    setActiveStep(prev => prev + 1);
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
    setError('');
  };

  const handleSubmit = async () => {
    // Prevent double submission
    if (loading) {
      console.log('Already submitting, ignoring duplicate call');
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
        destinationAddress: `${formData.recipientAddress}, ${formData.recipientPostalCode}, ${formData.destinationCountry}`,
        recipientPostalCode: formData.recipientPostalCode,
        destinationCountry: formData.destinationCountry,
        senderName: formData.senderName,
        senderEmail: formData.senderEmail,
        senderPhone: formData.senderPhone,
        senderAddress: formData.senderAddress,
        senderPostalCode: formData.senderPostalCode,
        originCountry: formData.originCountry,
        shipmentType: formData.shipmentType,
        documentType: formData.documentType,
        packageSize: formData.packageSize,
        quantity: formData.quantity,
        weight: formData.weight,
        serviceType: formData.serviceType,
        calculatedPrice: calculatedPrice,
        deliveryDays: deliveryDays
      };

      // Use public API if user is not logged in, otherwise use authenticated API
      const currentToken = token || localStorage.getItem('token');
      const isAuthenticated = !!currentToken && !!user;
      
      console.log('Submitting delivery:', {
        isAuthenticated,
        hasToken: !!currentToken,
        hasUser: !!user
      });

      let response;
      if (isAuthenticated) {
        // Use authenticated endpoint for logged-in users
        response = await senderAgentApi.createDelivery(currentToken, deliveryData);
      } else {
        // Use public endpoint for non-logged-in users
        response = await publicAgentApi.createDelivery(deliveryData);
      }

      console.log('Create delivery response:', response);
      console.log('Response structure:', {
        success: response?.success,
        hasData: !!response?.data,
        trackingCode: response?.data?.trackingCode,
        id: response?.data?.id,
        pdfUrl: response?.data?.pdfUrl
      });

      if (response && response.success && response.data) {
        const trackingCodeValue = response.data.trackingCode;
        const deliveryIdValue = response.data.id;
        const pdfUrlValue = response.data.pdfUrl || null;
        
        console.log('Setting tracking code:', trackingCodeValue);
        console.log('Setting delivery ID:', deliveryIdValue);
        console.log('Setting PDF URL:', pdfUrlValue);
        
        if (!trackingCodeValue) {
          console.error('Tracking code is missing from response!', response);
          setError('Failed to create shipment: Tracking code not received from server');
          setLoading(false);
          return;
        }
        
        // Set state values - this will trigger re-render to show success view
        // Use functional updates to ensure state is set correctly
        setTrackingCode(trackingCodeValue);
        setDeliveryId(deliveryIdValue);
        setPdfUrl(pdfUrlValue);
        
        // Generate QR code
        try {
          const qrData = `${window.location.origin}/track/${trackingCodeValue}`;
          const qrUrl = await QRCode.toDataURL(qrData);
          setQrCodeUrl(qrUrl);
          console.log('QR code generated successfully');
        } catch (qrError) {
          console.error('Error generating QR code:', qrError);
          // Don't fail the whole submission if QR code generation fails
        }
        
        // Success - stay on confirmation step to show success view
        console.log('Delivery created successfully, tracking code:', trackingCodeValue);
        console.log('State should now show success view');
        
        // Ensure loading is set to false after successful submission
        setLoading(false);
      } else {
        console.error('Invalid response structure:', response);
        console.error('Full response:', JSON.stringify(response, null, 2));
        setError('Failed to create shipment: Invalid response from server. Please try again.');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Error creating shipment:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response,
        status: err.response?.status,
        data: err.response?.data
      });
      
      // Handle 401 Unauthorized - token might be expired (only for authenticated requests)
      if (err.response?.status === 401 && (token || localStorage.getItem('token'))) {
        const errorMsg = 'Your session has expired. Please log in again or try as a guest.';
        setError(errorMsg);
        setLoading(false);
        return;
      }
      
      // Handle other errors
      const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to create shipment. Please try again.';
      setError(errorMessage);
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
                disableRipple
                onClick={calculatePrice}
                disabled={formData.originCountry === formData.destinationCountry || !formData.weight || formData.weight <= 0}
                sx={{ 
                  minWidth: 200,
                  // '&:hover': {
                  //   backgroundColor: 'inherit',
                  //   borderColor: 'inherit'
                  // }
                }}
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
        // Show success view if shipment is already created
        if (trackingCode) {
          return (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircle color="success" /> Shipment Created Successfully!
              </Typography>
              
              <Alert severity="success" sx={{ mb: 3 }}>
                <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Your shipment has been created and will appear in the Dispatcher dashboard for assignment.
                </Typography>
                <Typography variant="body2">
                  A dispatcher will assign a courier to handle your delivery soon.
                </Typography>
              </Alert>

              {/* Delivery Receipt/Paper */}
              <Card sx={{ mb: 3, bgcolor: '#ffffff', border: '3px solid #1976d2', borderRadius: 3, boxShadow: 6 }}>
                <CardContent sx={{ p: 4 }}>
                  {/* Header */}
                  <Box sx={{ 
                    textAlign: 'center', 
                    mb: 4, 
                    borderBottom: '3px solid #1976d2', 
                    pb: 3,
                    bgcolor: '#e3f2fd',
                    borderRadius: 2,
                    p: 3
                  }}>
                    <Typography variant="h3" sx={{ fontWeight: 800, color: '#1976d2', mb: 2, fontSize: { xs: '1.75rem', md: '2.5rem' } }}>
                      DELIVERY RECEIPT
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#1a1a1a', letterSpacing: 1.5, fontSize: { xs: '1rem', md: '1.5rem' } }}>
                      TRACKING CODE: <span style={{ color: '#1976d2' }}>{trackingCode}</span>
                    </Typography>
                  </Box>

                  <Grid container spacing={3} sx={{ mb: 3 }}>
                    {/* Sender Information */}
                    <Grid item xs={12} md={6}>
                      <Box sx={{ 
                        p: 3, 
                        bgcolor: '#f8f9fa', 
                        borderRadius: 2,
                        border: '2px solid #90caf9',
                        minHeight: '100%'
                      }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#1976d2', fontSize: '1.1rem', textTransform: 'uppercase' }}>
                          FROM (SENDER)
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          <Typography variant="body1" sx={{ color: '#212529', fontSize: '0.95rem' }}>
                            <strong style={{ color: '#495057', minWidth: '100px', display: 'inline-block' }}>Name:</strong> 
                            <span style={{ color: '#1a1a1a', fontWeight: 500 }}>{formData.senderName}</span>
                          </Typography>
                          <Typography variant="body1" sx={{ color: '#212529', fontSize: '0.95rem' }}>
                            <strong style={{ color: '#495057', minWidth: '100px', display: 'inline-block' }}>Email:</strong> 
                            <span style={{ color: '#1a1a1a', fontWeight: 500 }}>{formData.senderEmail}</span>
                          </Typography>
                          <Typography variant="body1" sx={{ color: '#212529', fontSize: '0.95rem' }}>
                            <strong style={{ color: '#495057', minWidth: '100px', display: 'inline-block' }}>Phone:</strong> 
                            <span style={{ color: '#1a1a1a', fontWeight: 500 }}>{formData.senderPhone}</span>
                          </Typography>
                          <Typography variant="body1" sx={{ color: '#212529', fontSize: '0.95rem' }}>
                            <strong style={{ color: '#495057', minWidth: '100px', display: 'inline-block' }}>Address:</strong> 
                            <span style={{ color: '#1a1a1a', fontWeight: 500 }}>{formData.senderAddress}</span>
                          </Typography>
                          {formData.senderPostalCode && (
                            <Typography variant="body1" sx={{ color: '#212529', fontSize: '0.95rem' }}>
                              <strong style={{ color: '#495057', minWidth: '100px', display: 'inline-block' }}>Postal Code:</strong> 
                              <span style={{ color: '#1a1a1a', fontWeight: 500 }}>{formData.senderPostalCode}</span>
                            </Typography>
                          )}
                          {formData.originCountry && (
                            <Typography variant="body1" sx={{ color: '#212529', fontSize: '0.95rem' }}>
                              <strong style={{ color: '#495057', minWidth: '100px', display: 'inline-block' }}>Country:</strong> 
                              <span style={{ color: '#1a1a1a', fontWeight: 500 }}>{COUNTRIES.find(c => c.code === formData.originCountry)?.name}</span>
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </Grid>

                    {/* Recipient Information */}
                    <Grid item xs={12} md={6}>
                      <Box sx={{ 
                        p: 3, 
                        bgcolor: '#f8f9fa', 
                        borderRadius: 2,
                        border: '2px solid #90caf9',
                        minHeight: '100%'
                      }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#1976d2', fontSize: '1.1rem', textTransform: 'uppercase' }}>
                          TO (RECIPIENT)
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          <Typography variant="body1" sx={{ color: '#212529', fontSize: '0.95rem' }}>
                            <strong style={{ color: '#495057', minWidth: '100px', display: 'inline-block' }}>Name:</strong> 
                            <span style={{ color: '#1a1a1a', fontWeight: 500 }}>{formData.recipientName}</span>
                          </Typography>
                          <Typography variant="body1" sx={{ color: '#212529', fontSize: '0.95rem' }}>
                            <strong style={{ color: '#495057', minWidth: '100px', display: 'inline-block' }}>Phone:</strong> 
                            <span style={{ color: '#1a1a1a', fontWeight: 500 }}>{formData.recipientPhone}</span>
                          </Typography>
                          <Typography variant="body1" sx={{ color: '#212529', fontSize: '0.95rem' }}>
                            <strong style={{ color: '#495057', minWidth: '100px', display: 'inline-block' }}>Address:</strong> 
                            <span style={{ color: '#1a1a1a', fontWeight: 500 }}>{formData.recipientAddress}</span>
                          </Typography>
                          {formData.recipientPostalCode && (
                            <Typography variant="body1" sx={{ color: '#212529', fontSize: '0.95rem' }}>
                              <strong style={{ color: '#495057', minWidth: '100px', display: 'inline-block' }}>Postal Code:</strong> 
                              <span style={{ color: '#1a1a1a', fontWeight: 500 }}>{formData.recipientPostalCode}</span>
                            </Typography>
                          )}
                          {formData.destinationCountry && (
                            <Typography variant="body1" sx={{ color: '#212529', fontSize: '0.95rem' }}>
                              <strong style={{ color: '#495057', minWidth: '100px', display: 'inline-block' }}>Country:</strong> 
                              <span style={{ color: '#1a1a1a', fontWeight: 500 }}>{COUNTRIES.find(c => c.code === formData.destinationCountry)?.name}</span>
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </Grid>
                  </Grid>

                  {/* Shipment Details */}
                  <Box sx={{ 
                    p: 3, 
                    bgcolor: '#f8f9fa', 
                    borderRadius: 2, 
                    mb: 3,
                    border: '2px solid #90caf9'
                  }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 2.5, color: '#1976d2', fontSize: '1.1rem', textTransform: 'uppercase' }}>
                      SHIPMENT DETAILS
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6} md={4}>
                        <Typography variant="body1" sx={{ color: '#212529', fontSize: '0.95rem' }}>
                          <strong style={{ color: '#495057' }}>Type:</strong> 
                          <span style={{ color: '#1a1a1a', fontWeight: 500, marginLeft: '8px' }}>
                            {formData.shipmentType === 'documents' ? 'Documents' : 'Packages'}
                          </span>
                        </Typography>
                      </Grid>
                      {formData.shipmentType === 'documents' && formData.documentType && (
                        <Grid item xs={12} sm={6} md={4}>
                          <Typography variant="body1" sx={{ color: '#212529', fontSize: '0.95rem' }}>
                            <strong style={{ color: '#495057' }}>Document Type:</strong> 
                            <span style={{ color: '#1a1a1a', fontWeight: 500, marginLeft: '8px' }}>{formData.documentType}</span>
                          </Typography>
                        </Grid>
                      )}
                      {formData.shipmentType === 'packages' && formData.packageSize && (
                        <Grid item xs={12} sm={6} md={4}>
                          <Typography variant="body1" sx={{ color: '#212529', fontSize: '0.95rem' }}>
                            <strong style={{ color: '#495057' }}>Package Size:</strong> 
                            <span style={{ color: '#1a1a1a', fontWeight: 500, marginLeft: '8px' }}>{formData.packageSize}</span>
                          </Typography>
                        </Grid>
                      )}
                      <Grid item xs={12} sm={6} md={4}>
                        <Typography variant="body1" sx={{ color: '#212529', fontSize: '0.95rem' }}>
                          <strong style={{ color: '#495057' }}>Quantity:</strong> 
                          <span style={{ color: '#1a1a1a', fontWeight: 500, marginLeft: '8px' }}>{formData.quantity}</span>
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={4}>
                        <Typography variant="body1" sx={{ color: '#212529', fontSize: '0.95rem' }}>
                          <strong style={{ color: '#495057' }}>Weight:</strong> 
                          <span style={{ color: '#1a1a1a', fontWeight: 500, marginLeft: '8px' }}>{formData.weight} kg</span>
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={4}>
                        <Typography variant="body1" sx={{ color: '#212529', fontSize: '0.95rem' }}>
                          <strong style={{ color: '#495057' }}>Service:</strong> 
                          <span style={{ color: '#1a1a1a', fontWeight: 500, marginLeft: '8px' }}>
                            {formData.serviceType === 'express' ? 'Express' : 'Standard'}
                          </span>
                        </Typography>
                      </Grid>
                      {deliveryDays && (
                        <Grid item xs={12} sm={6} md={4}>
                          <Typography variant="body1" sx={{ color: '#212529', fontSize: '0.95rem' }}>
                            <strong style={{ color: '#495057' }}>Est. Delivery:</strong> 
                            <span style={{ color: '#1a1a1a', fontWeight: 500, marginLeft: '8px' }}>{deliveryDays} day(s)</span>
                          </Typography>
                        </Grid>
                      )}
                    </Grid>
                  </Box>

                  {/* QR Code and Price */}
                  <Grid container spacing={3} sx={{ mb: 3 }}>
                    <Grid item xs={12} md={6} sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      {qrCodeUrl && (
                        <Box 
                          component="div"
                          sx={{ 
                            p: 3, 
                            bgcolor: '#ffffff !important', 
                            borderRadius: 2, 
                            border: '3px solid #1976d2 !important',
                            boxShadow: '2px 2px 8px rgba(0,0,0,0.1) !important',
                            cursor: 'default',
                            '&:hover': {
                              bgcolor: '#ffffff !important',
                              borderColor: '#1976d2 !important',
                              boxShadow: '2px 2px 8px rgba(0,0,0,0.1) !important',
                              transform: 'none !important',
                              transition: 'none !important'
                            },
                            '&:active': {
                              bgcolor: '#ffffff !important',
                              borderColor: '#1976d2 !important',
                              boxShadow: '2px 2px 8px rgba(0,0,0,0.1) !important',
                              transform: 'none !important'
                            }
                          }}
                        >
                          <Typography 
                            component="div"
                            sx={{ 
                              display: 'block', 
                              textAlign: 'center', 
                              mb: 2, 
                              fontWeight: 700,
                              color: '#1976d2 !important',
                              fontSize: '1rem',
                              cursor: 'default',
                              '&:hover': {
                                color: '#1976d2 !important'
                              }
                            }}
                          >
                            Scan to Track
                          </Typography>
                          <img 
                            src={qrCodeUrl} 
                            alt="QR Code" 
                            draggable={false}
                            style={{ 
                              width: 200, 
                              height: 200, 
                              display: 'block',
                              margin: '0 auto',
                              pointerEvents: 'none',
                              userSelect: 'none',
                              WebkitUserSelect: 'none'
                            }} 
                          />
                        </Box>
                      )}
                    </Grid>
                    <Grid item xs={12} md={6} sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      {calculatedPrice && (
                        <Box 
                          component="div"
                          sx={{ 
                            textAlign: 'center', 
                            p: 4, 
                            bgcolor: '#e3f2fd !important', 
                            borderRadius: 2, 
                            border: '3px solid #1976d2 !important',
                            boxShadow: '2px 2px 8px rgba(0,0,0,0.1) !important',
                            cursor: 'default',
                            '&:hover': {
                              bgcolor: '#e3f2fd !important',
                              borderColor: '#1976d2 !important',
                              boxShadow: '2px 2px 8px rgba(0,0,0,0.1) !important',
                              transform: 'none !important',
                              transition: 'none !important'
                            },
                            '&:active': {
                              bgcolor: '#e3f2fd !important',
                              borderColor: '#1976d2 !important',
                              boxShadow: '2px 2px 8px rgba(0,0,0,0.1) !important',
                              transform: 'none !important'
                            }
                          }}
                        >
                          <Typography 
                            component="div"
                            sx={{ 
                              display: 'block', 
                              mb: 2,
                              color: '#495057 !important',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: 1,
                              cursor: 'default',
                              '&:hover': {
                                color: '#495057 !important'
                              }
                            }}
                          >
                            Total Amount
                          </Typography>
                          <Typography 
                            component="div"
                            sx={{ 
                              fontWeight: 800, 
                              color: '#1976d2 !important',
                              fontSize: { xs: '2rem', md: '2.5rem' },
                              cursor: 'default',
                              '&:hover': {
                                color: '#1976d2 !important'
                              }
                            }}
                          >
                            ${calculatedPrice.toFixed(2)} USD
                          </Typography>
                        </Box>
                      )}
                    </Grid>
                  </Grid>

                  {/* Action Buttons */}
                  <Stack direction="row" spacing={2} sx={{ mt: 3, justifyContent: 'center', flexWrap: 'wrap', gap: 2 }}>
                    {deliveryId && (token || localStorage.getItem('token')) && (
                      <Button
                        variant="contained"
                        color="secondary"
                        startIcon={<PictureAsPdf />}
                        disableRipple
                        disableElevation
                        onClick={async () => {
                          try {
                            const currentToken = token || localStorage.getItem('token');
                            if (currentToken && deliveryId) {
                              await deliveryApi.downloadPDF(currentToken, deliveryId.toString());
                            } else {
                              setError('Please log in to download the PDF receipt.');
                            }
                          } catch (err) {
                            console.error('Error downloading PDF:', err);
                            setError('Failed to download PDF. Please try again later.');
                          }
                        }}
                        sx={{ 
                          minWidth: 180,
                          '&:hover': {
                            backgroundColor: 'secondary.main',
                            opacity: 1
                          },
                          '&:active': {
                            backgroundColor: 'secondary.main',
                            opacity: 1
                          }
                        }}
                      >
                        Download Receipt PDF
                      </Button>
                    )}
                    <Button
                      variant="outlined"
                      startIcon={<QrCode />}
                      disableRipple
                      disableElevation
                      onClick={() => router.push(`/track/${trackingCode}`)}
                      sx={{ 
                        minWidth: 180,
                        '&:hover': {
                          backgroundColor: 'transparent',
                          borderColor: 'primary.main'
                        },
                        '&:active': {
                          backgroundColor: 'transparent',
                          borderColor: 'primary.main'
                        }
                      }}
                    >
                      Track Shipment
                    </Button>
                    <Button
                      variant="contained"
                      disableRipple
                      disableElevation
                      onClick={() => {
                        window.location.href = '/';
                      }}
                      sx={{ 
                        minWidth: 180,
                        '&:hover': {
                          backgroundColor: 'primary.main',
                          opacity: 1
                        },
                        '&:active': {
                          backgroundColor: 'primary.main',
                          opacity: 1
                        }
                      }}
                    >
                      Go to Home
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Box>
          );
        }

        // Show review/confirmation view before submission
        return (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircle /> Review & Confirm
            </Typography>
            
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                Please review your shipment details before confirming.
              </Typography>
              <Typography variant="body2">
                Once confirmed, your shipment will be created and a tracking code will be generated.
              </Typography>
            </Alert>

            <Card sx={{ mb: 3, bgcolor: '#252525', border: '1px solid rgba(201, 162, 39, 0.2)' }}>
              <CardContent>
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Sender Information
                    </Typography>
                    <Typography variant="body1">{formData.senderName}</Typography>
                    <Typography variant="body2" color="text.secondary">{formData.senderEmail}</Typography>
                    <Typography variant="body2" color="text.secondary">{formData.senderPhone}</Typography>
                    <Typography variant="body2" color="text.secondary">{formData.senderAddress}</Typography>
                    {formData.senderPostalCode && (
                      <Typography variant="body2" color="text.secondary">Postal: {formData.senderPostalCode}</Typography>
                    )}
                    {formData.originCountry && (
                      <Typography variant="body2" color="text.secondary">
                        Origin: {COUNTRIES.find(c => c.code === formData.originCountry)?.name}
                      </Typography>
                    )}
                  </Box>

                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Recipient Information
                    </Typography>
                    <Typography variant="body1">{formData.recipientName}</Typography>
                    <Typography variant="body2" color="text.secondary">{formData.recipientPhone}</Typography>
                    <Typography variant="body2" color="text.secondary">{formData.recipientAddress}</Typography>
                    {formData.recipientPostalCode && (
                      <Typography variant="body2" color="text.secondary">Postal: {formData.recipientPostalCode}</Typography>
                    )}
                    {formData.destinationCountry && (
                      <Typography variant="body2" color="text.secondary">
                        Destination: {COUNTRIES.find(c => c.code === formData.destinationCountry)?.name}
                      </Typography>
                    )}
                  </Box>

                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Shipment Details
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Type: {formData.shipmentType === 'documents' ? 'Documents' : 'Packages'}
                    </Typography>
                    {formData.shipmentType === 'documents' && formData.documentType && (
                      <Typography variant="body2" color="text.secondary">
                        Document Type: {formData.documentType}
                      </Typography>
                    )}
                    {formData.shipmentType === 'packages' && formData.packageSize && (
                      <Typography variant="body2" color="text.secondary">
                        Package Size: {formData.packageSize}
                      </Typography>
                    )}
                    <Typography variant="body2" color="text.secondary">
                      Quantity: {formData.quantity}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Weight: {formData.weight} kg
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Service: {formData.serviceType === 'express' ? 'Express' : 'Standard'}
                    </Typography>
                    {calculatedPrice && (
                      <Typography variant="body1" color="primary" sx={{ mt: 1, fontWeight: 600 }}>
                        Total: ${calculatedPrice.toFixed(2)} USD
                      </Typography>
                    )}
                    {deliveryDays && (
                      <Typography variant="body2" color="text.secondary">
                        Estimated Delivery: {deliveryDays} day(s)
                      </Typography>
                    )}
                  </Box>

                  <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
                    <Button
                      variant="contained"
                      size="large"
                      disableRipple
                      onClick={handleSubmit}
                      disabled={loading}
                      sx={{ 
                        minWidth: 200,
                        '&:hover': {
                          backgroundColor: 'inherit',
                          opacity: 1
                        }
                      }}
                    >
                      {loading ? 'Creating Shipment...' : 'Confirm & Create Shipment'}
                    </Button>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
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
            disableRipple
            disabled={activeStep === 0 || loading}
            onClick={handleBack}
            sx={{
              '&:hover': {
                backgroundColor: 'inherit',
                opacity: 1
              }
            }}
          >
            Back
          </Button>
          <Button
            variant="contained"
            disableRipple
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleNext();
            }}
            disabled={loading || (activeStep === steps.length - 1 && !trackingCode)}
            type="button"
            sx={{
              '&:hover': {
                backgroundColor: 'inherit',
                opacity: 1
              }
            }}
          >
            {loading ? 'Processing...' : activeStep === steps.length - 1 && !trackingCode ? 'Confirm to Continue' : activeStep === steps.length - 1 ? 'Finish' : 'Next'}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}


'use client';
import { useState } from 'react';
import {
  Button,
  Container,
  Stack,
  TextField,
  Typography,
  Box,
  Paper,
  Grid,
  MenuItem,
  Card,
  CardContent,
  Divider
} from '@mui/material';
import {
  LocalShipping,
  LocationOn,
  Calculate,
  AttachMoney,
  Public,
  Schedule,
  CheckCircle
} from '@mui/icons-material';

// Available countries for international shipping
const COUNTRIES = [
  { code: 'SG', name: 'Singapore' },
  { code: 'TH', name: 'Thailand' },
  { code: 'MM', name: 'Myanmar' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'PH', name: 'Philippines' },
  { code: 'KH', name: 'Cambodia' },
  { code: 'LA', name: 'Laos' }
];

// Pricing structure (base prices in USD)
const PRICING = {
  // Base price per route
  'SG-TH': { base: 25, perKg: 8, express: 35, standard: 25 },
  'TH-SG': { base: 25, perKg: 8, express: 35, standard: 25 },
  'TH-MM': { base: 20, perKg: 6, express: 30, standard: 20 },
  'MM-TH': { base: 20, perKg: 6, express: 30, standard: 20 },
  'SG-MM': { base: 30, perKg: 10, express: 45, standard: 30 },
  'MM-SG': { base: 30, perKg: 10, express: 45, standard: 30 },
  // Default pricing for other routes
  default: { base: 22, perKg: 7, express: 32, standard: 22 }
};

// Estimated delivery times (in days)
const DELIVERY_TIMES = {
  'SG-TH': { express: 2, standard: 5 },
  'TH-SG': { express: 2, standard: 5 },
  'TH-MM': { express: 3, standard: 7 },
  'MM-TH': { express: 3, standard: 7 },
  'SG-MM': { express: 4, standard: 8 },
  'MM-SG': { express: 4, standard: 8 },
  default: { express: 3, standard: 6 }
};

export default function PriceCalculatorPage() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [weight, setWeight] = useState('');
  const [serviceType, setServiceType] = useState<'express' | 'standard'>('standard');
  const [calculated, setCalculated] = useState(false);
  const [price, setPrice] = useState(0);
  const [deliveryDays, setDeliveryDays] = useState(0);

  const calculatePrice = () => {
    if (!origin || !destination || !weight) {
      return;
    }

    const routeKey = `${origin}-${destination}`;
    const routePricing = PRICING[routeKey as keyof typeof PRICING] || PRICING.default;
    const routeDelivery = DELIVERY_TIMES[routeKey as keyof typeof DELIVERY_TIMES] || DELIVERY_TIMES.default;

    const weightNum = parseFloat(weight) || 0;
    const basePrice = serviceType === 'express' ? routePricing.express : routePricing.standard;
    const totalPrice = basePrice + (routePricing.perKg * Math.max(0, weightNum - 1)); // First kg included

    setPrice(totalPrice);
    setDeliveryDays(serviceType === 'express' ? routeDelivery.express : routeDelivery.standard);
    setCalculated(true);
  };

  const handleCalculate = () => {
    if (origin && destination && weight) {
      calculatePrice();
    }
  };

  const handleReset = () => {
    setOrigin('');
    setDestination('');
    setWeight('');
    setServiceType('standard');
    setCalculated(false);
    setPrice(0);
    setDeliveryDays(0);
  };

  const isSameCountry = origin && destination && origin === destination;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#0a0a0a',
        position: 'relative',
        overflow: 'hidden',
        py: 6
      }}
    >
      {/* Background Effects */}
      <Box
        sx={{
          position: 'absolute',
          top: '-50%',
          left: '-50%',
          width: '200%',
          height: '200%',
          background: 'radial-gradient(circle, rgba(201, 162, 39, 0.1) 0%, transparent 70%)',
          animation: 'rotate 20s linear infinite',
          '@keyframes rotate': {
            '0%': { transform: 'rotate(0deg)' },
            '100%': { transform: 'rotate(360deg)' }
          }
        }}
      />

      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 2,
              animation: 'float 3s ease-in-out infinite',
              '@keyframes float': {
                '0%, 100%': { transform: 'translateY(0px)' },
                '50%': { transform: 'translateY(-10px)' }
              }
            }}
          >
            <Calculate sx={{ fontSize: 48, color: '#C9A227', mr: 2 }} />
            <Typography
              variant="h3"
              sx={{
                fontWeight: 700,
                color: '#C9A227',
                letterSpacing: 1
              }}
            >
              Price Calculator
            </Typography>
          </Box>
          <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 300 }}>
            Calculate shipping costs for international routes
          </Typography>
        </Box>

        <Grid container spacing={4}>
          {/* Left Side - Calculator Form */}
          <Grid item xs={12} md={6}>
            <Paper
              elevation={0}
              sx={{
                bgcolor: '#252525',
                border: '1px solid rgba(201, 162, 39, 0.2)',
                borderRadius: 3,
                p: 4,
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
              }}
            >
              <Stack spacing={3}>
                <Typography variant="h5" sx={{ color: '#C9A227', mb: 2, fontWeight: 600 }}>
                  Shipping Details
                </Typography>

                {/* Origin Country */}
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'text.secondary', fontWeight: 600 }}>
                    Origin Country
                  </Typography>
                  <TextField
                    select
                    fullWidth
                    value={origin}
                    onChange={(e) => {
                      setOrigin(e.target.value);
                      setCalculated(false);
                    }}
                    SelectProps={{
                      MenuProps: {
                        PaperProps: {
                          sx: {
                            bgcolor: '#1a1a1a',
                            border: '1px solid rgba(201, 162, 39, 0.2)'
                          }
                        }
                      }
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: '#1F1F1F',
                        borderRadius: 2,
                        '& fieldset': {
                          borderColor: 'rgba(201, 162, 39, 0.3)',
                          borderWidth: 2
                        },
                        '&:hover fieldset': {
                          borderColor: 'rgba(201, 162, 39, 0.5)'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#C9A227',
                          borderWidth: 2
                        }
                      },
                      '& .MuiInputBase-input': {
                        color: 'text.primary'
                      }
                    }}
                  >
                    {COUNTRIES.map((country) => (
                      <MenuItem key={country.code} value={country.code} sx={{ color: 'text.primary' }}>
                        {country.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>

                {/* Destination Country */}
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'text.secondary', fontWeight: 600 }}>
                    Destination Country
                  </Typography>
                  <TextField
                    select
                    fullWidth
                    value={destination}
                    onChange={(e) => {
                      setDestination(e.target.value);
                      setCalculated(false);
                    }}
                    SelectProps={{
                      MenuProps: {
                        PaperProps: {
                          sx: {
                            bgcolor: '#1a1a1a',
                            border: '1px solid rgba(201, 162, 39, 0.2)'
                          }
                        }
                      }
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: '#1F1F1F',
                        borderRadius: 2,
                        '& fieldset': {
                          borderColor: 'rgba(201, 162, 39, 0.3)',
                          borderWidth: 2
                        },
                        '&:hover fieldset': {
                          borderColor: 'rgba(201, 162, 39, 0.5)'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#C9A227',
                          borderWidth: 2
                        }
                      },
                      '& .MuiInputBase-input': {
                        color: 'text.primary'
                      }
                    }}
                  >
                    {COUNTRIES.map((country) => (
                      <MenuItem key={country.code} value={country.code} sx={{ color: 'text.primary' }}>
                        {country.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>

                {isSameCountry && (
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: 'rgba(255, 152, 0, 0.1)',
                      border: '1px solid rgba(255, 152, 0, 0.3)',
                      borderRadius: 2
                    }}
                  >
                    <Typography variant="body2" sx={{ color: '#ff9800' }}>
                      Please select different origin and destination countries for international shipping.
                    </Typography>
                  </Box>
                )}

                {/* Weight */}
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'text.secondary', fontWeight: 600 }}>
                    Package Weight (kg)
                  </Typography>
                  <TextField
                    type="number"
                    fullWidth
                    value={weight}
                    onChange={(e) => {
                      setWeight(e.target.value);
                      setCalculated(false);
                    }}
                    placeholder="Enter weight in kilograms"
                    inputProps={{ min: 0.1, step: 0.1 }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: '#1F1F1F',
                        borderRadius: 2,
                        '& fieldset': {
                          borderColor: 'rgba(201, 162, 39, 0.3)',
                          borderWidth: 2
                        },
                        '&:hover fieldset': {
                          borderColor: 'rgba(201, 162, 39, 0.5)'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#C9A227',
                          borderWidth: 2
                        }
                      },
                      '& .MuiInputBase-input': {
                        color: 'text.primary'
                      }
                    }}
                  />
                </Box>

                {/* Service Type */}
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'text.secondary', fontWeight: 600 }}>
                    Service Type
                  </Typography>
                  <TextField
                    select
                    fullWidth
                    value={serviceType}
                    onChange={(e) => {
                      setServiceType(e.target.value as 'express' | 'standard');
                      setCalculated(false);
                    }}
                    SelectProps={{
                      MenuProps: {
                        PaperProps: {
                          sx: {
                            bgcolor: '#1a1a1a',
                            border: '1px solid rgba(201, 162, 39, 0.2)'
                          }
                        }
                      }
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: '#1F1F1F',
                        borderRadius: 2,
                        '& fieldset': {
                          borderColor: 'rgba(201, 162, 39, 0.3)',
                          borderWidth: 2
                        },
                        '&:hover fieldset': {
                          borderColor: 'rgba(201, 162, 39, 0.5)'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#C9A227',
                          borderWidth: 2
                        }
                      },
                      '& .MuiInputBase-input': {
                        color: 'text.primary'
                      }
                    }}
                  >
                    <MenuItem value="standard" sx={{ color: 'text.primary' }}>
                      Standard Delivery
                    </MenuItem>
                    <MenuItem value="express" sx={{ color: 'text.primary' }}>
                      Express Delivery
                    </MenuItem>
                  </TextField>
                </Box>

                {/* Action Buttons */}
                <Stack direction="row" spacing={2}>
                  <Button
                    variant="contained"
                    onClick={handleCalculate}
                    disabled={!origin || !destination || !weight || isSameCountry}
                    fullWidth
                    size="large"
                    startIcon={<Calculate />}
                    sx={{
                      py: 1.5,
                      fontSize: '1rem',
                      fontWeight: 600,
                      borderRadius: 2,
                      bgcolor: '#C9A227',
                      color: '#000',
                      textTransform: 'none',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: '#FFD700',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 6px 20px rgba(201, 162, 39, 0.4)'
                      },
                      '&:disabled': {
                        bgcolor: 'rgba(201, 162, 39, 0.1)',
                        color: 'rgba(255, 255, 255, 0.2)'
                      }
                    }}
                  >
                    Calculate Price
                  </Button>
                  {calculated && (
                    <Button
                      variant="outlined"
                      onClick={handleReset}
                      size="large"
                      sx={{
                        py: 1.5,
                        borderRadius: 2,
                        borderColor: 'rgba(201, 162, 39, 0.3)',
                        color: '#C9A227',
                        textTransform: 'none',
                        '&:hover': {
                          borderColor: '#C9A227',
                          bgcolor: 'rgba(201, 162, 39, 0.1)'
                        }
                      }}
                    >
                      Reset
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Paper>
          </Grid>

          {/* Right Side - Results & Info */}
          <Grid item xs={12} md={6}>
            {calculated ? (
              <Card
                sx={{
                  bgcolor: '#252525',
                  border: '1px solid rgba(201, 162, 39, 0.2)',
                  borderRadius: 3,
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                  height: '100%'
                }}
              >
                <CardContent sx={{ p: 4 }}>
                  <Stack spacing={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <CheckCircle sx={{ fontSize: 48, color: '#4caf50', mb: 2 }} />
                      <Typography variant="h5" sx={{ color: '#C9A227', mb: 1, fontWeight: 600 }}>
                        Estimated Price
                      </Typography>
                    </Box>

                    <Divider sx={{ borderColor: 'rgba(201, 162, 39, 0.2)' }} />

                    <Box
                      sx={{
                        textAlign: 'center',
                        p: 3,
                        bgcolor: 'rgba(201, 162, 39, 0.05)',
                        borderRadius: 2,
                        border: '1px solid rgba(201, 162, 39, 0.2)'
                      }}
                    >
                      <Typography variant="h3" sx={{ color: '#C9A227', fontWeight: 700 }}>
                        ${price.toFixed(2)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        USD
                      </Typography>
                    </Box>

                    <Stack spacing={2}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <LocationOn sx={{ color: '#C9A227' }} />
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Route
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            {COUNTRIES.find(c => c.code === origin)?.name} → {COUNTRIES.find(c => c.code === destination)?.name}
                          </Typography>
                        </Box>
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Schedule sx={{ color: '#C9A227' }} />
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Estimated Delivery
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            {deliveryDays} {deliveryDays === 1 ? 'day' : 'days'}
                          </Typography>
                        </Box>
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <LocalShipping sx={{ color: '#C9A227' }} />
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Service Type
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            {serviceType === 'express' ? 'Express Delivery' : 'Standard Delivery'}
                          </Typography>
                        </Box>
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <AttachMoney sx={{ color: '#C9A227' }} />
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Package Weight
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            {weight} kg
                          </Typography>
                        </Box>
                      </Box>
                    </Stack>

                    <Box
                      sx={{
                        mt: 2,
                        p: 2,
                        bgcolor: 'rgba(201, 162, 39, 0.05)',
                        border: '1px solid rgba(201, 162, 39, 0.15)',
                        borderRadius: 2
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        * Prices are estimates and may vary based on customs, taxes, and additional services.
                        Final pricing will be confirmed upon booking.
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            ) : (
              <Card
                sx={{
                  bgcolor: '#252525',
                  border: '1px solid rgba(201, 162, 39, 0.2)',
                  borderRadius: 3,
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <CardContent sx={{ p: 4, textAlign: 'center' }}>
                  <Public sx={{ fontSize: 64, color: 'rgba(201, 162, 39, 0.3)', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                    International Shipping Calculator
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Fill in the form to calculate your shipping costs
                  </Typography>
                </CardContent>
              </Card>
            )}
          </Grid>
        </Grid>

        {/* Popular Routes Info */}
        <Box sx={{ mt: 6 }}>
          <Typography variant="h6" sx={{ color: '#C9A227', mb: 3, textAlign: 'center', fontWeight: 600 }}>
            Popular International Routes
          </Typography>
          <Grid container spacing={2}>
            {[
              { route: 'SG-TH', name: 'Singapore → Thailand' },
              { route: 'TH-MM', name: 'Thailand → Myanmar' },
              { route: 'SG-MM', name: 'Singapore → Myanmar' },
              { route: 'TH-SG', name: 'Thailand → Singapore' }
            ].map((route) => {
              const routePricing = PRICING[route.route as keyof typeof PRICING] || PRICING.default;
              return (
                <Grid item xs={12} sm={6} md={3} key={route.route}>
                  <Paper
                    sx={{
                      p: 2,
                      bgcolor: 'rgba(201, 162, 39, 0.05)',
                      border: '1px solid rgba(201, 162, 39, 0.15)',
                      borderRadius: 2,
                      textAlign: 'center',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-5px)',
                        boxShadow: '0 8px 24px rgba(201, 162, 39, 0.2)',
                        borderColor: 'rgba(201, 162, 39, 0.3)'
                      }
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: '#C9A227' }}>
                      {route.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      From ${routePricing.standard} USD
                    </Typography>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      </Container>
    </Box>
  );
}


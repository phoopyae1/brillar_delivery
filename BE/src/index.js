require('dotenv').config();
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { connectMongoDB } = require('./mongodb');
const authRoutes = require('./routes/auth');
const deliveryRoutes = require('./routes/deliveries');
const integrationRoutes = require('./routes/integrations');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/', (_req, res) => {
  res.json({ message: 'Brillar Delivery API' });
});

// Connect to MongoDB
connectMongoDB().catch(err => {
  console.error('Failed to connect to MongoDB:', err);
  console.error('MongoDB connection error details:', err.message);
  // Continue running even if MongoDB fails (for backward compatibility)
  // But log a warning that integration features won't work
  console.warn('WARNING: Integration features will not work without MongoDB connection');
});

app.use('/auth', authRoutes);
app.use('/', deliveryRoutes);
app.use('/', integrationRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});

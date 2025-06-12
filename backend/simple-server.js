const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Basic middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    message: 'AdventureConnect Backend is running!',
    services: {
      database: 'Not configured',
      redis: 'Not configured',
      amadeus: 'Not configured'
    }
  });
});

// Placeholder API routes
app.get('/api/trips/custom', (req, res) => {
  res.json({ message: 'Custom trips endpoint - not implemented yet', trips: [] });
});

app.post('/api/trips/custom', (req, res) => {
  res.json({ message: 'Trip created successfully', trip: { id: 1, ...req.body } });
});

app.get('/api/search/listings', (req, res) => {
  res.json({ 
    message: 'Search listings endpoint - not implemented yet', 
    listings: [],
    totalCount: 0,
    limit: 10,
    offset: 0
  });
});

app.get('/api/recommendations/destination', (req, res) => {
  res.json({ message: 'Destination recommendations endpoint - not implemented yet' });
});

// Visa requirements endpoints (to fix the 404 errors)
app.get('/api/visa-requirement.p.r*', (req, res) => {
  res.json({ message: 'Visa requirements endpoint - not implemented yet' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: `Not Found - ${req.originalUrl}` });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Simple AdventureConnect Backend running on port ${port}`);
  console.log(`✅ Health check available at http://localhost:${port}/api/health`);
  console.log('Press Ctrl-C to stop\n');
});

module.exports = app; 
/**
 * Trip Customization Routes
 * Handles comprehensive trip planning with real API integrations
 */

const express = require('express');
const Joi = require('joi');
const TripCustomizationService = require('../services/tripCustomizationService');
const { authenticateToken } = require('../middleware/auth');
const pool = require('../models/database');

const router = express.Router();
const tripService = new TripCustomizationService();

// Validation schemas
const tripPackageSearchSchema = Joi.object({
  origin: Joi.string().length(3).uppercase().required()
    .messages({
      'string.length': 'Origin must be a 3-letter airport code',
      'any.required': 'Origin airport is required'
    }),
  destinations: Joi.array().items(Joi.string().length(3).uppercase()).min(1).max(5).required()
    .messages({
      'array.min': 'At least one destination is required',
      'array.max': 'Maximum 5 destinations allowed',
      'any.required': 'Destinations are required'
    }),
  startDate: Joi.date().iso().min('now').required()
    .messages({
      'date.min': 'Start date must be in the future',
      'any.required': 'Start date is required'
    }),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).required()
    .messages({
      'date.min': 'End date must be after start date',
      'any.required': 'End date is required'
    }),
  travelers: Joi.object({
    adults: Joi.number().integer().min(1).max(9).default(1),
    children: Joi.number().integer().min(0).max(8).default(0),
    infants: Joi.number().integer().min(0).max(4).default(0),
    cabinClass: Joi.string().valid('economy', 'premium_economy', 'business', 'first').default('economy')
  }).default({ adults: 1, children: 0, infants: 0, cabinClass: 'economy' }),
  budget: Joi.number().positive().optional(),
  currency: Joi.string().length(3).uppercase().default('USD'),
  preferences: Joi.object({
    accommodation: Joi.string().valid('budget', 'mid-range', 'luxury').default('mid-range'),
    activities: Joi.array().items(Joi.string().valid('cultural', 'adventure', 'food', 'shopping', 'entertainment', 'nature')).default([]),
    pace: Joi.string().valid('relaxed', 'moderate', 'fast').default('moderate'),
    interests: Joi.array().items(Joi.string()).default([])
  }).default({})
});

const tripBookingSchema = Joi.object({
  packageId: Joi.string().required(),
  tripData: Joi.object().required(),
  travelerDetails: Joi.object({
    primaryTraveler: Joi.object({
      firstName: Joi.string().required(),
      lastName: Joi.string().required(),
      email: Joi.string().email().required(),
      phone: Joi.string().required(),
      dateOfBirth: Joi.date().required(),
      passport: Joi.object({
        number: Joi.string().required(),
        expiryDate: Joi.date().min('now').required(),
        nationality: Joi.string().required()
      }).required()
    }).required(),
    additionalTravelers: Joi.array().items(Joi.object({
      firstName: Joi.string().required(),
      lastName: Joi.string().required(),
      dateOfBirth: Joi.date().required(),
      passport: Joi.object({
        number: Joi.string().required(),
        expiryDate: Joi.date().min('now').required(),
        nationality: Joi.string().required()
      }).required()
    })).default([])
  }).required(),
  paymentDetails: Joi.object({
    method: Joi.string().valid('credit_card', 'debit_card', 'paypal', 'bank_transfer').required(),
    cardDetails: Joi.when('method', {
      is: Joi.string().valid('credit_card', 'debit_card'),
      then: Joi.object({
        number: Joi.string().creditCard().required(),
        expiryMonth: Joi.number().integer().min(1).max(12).required(),
        expiryYear: Joi.number().integer().min(new Date().getFullYear()).required(),
        cvv: Joi.string().length(3).required(),
        holderName: Joi.string().required()
      }).required(),
      otherwise: Joi.optional()
    })
  }).required()
});

/**
 * POST /api/trip-customization/search
 * Search for comprehensive trip packages
 */
router.post('/search', authenticateToken, async (req, res) => {
  try {
    const { error, value } = tripPackageSearchSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid search parameters',
        errors: error.details.map(detail => detail.message)
      });
    }

    const searchParams = value;
    
    // Log search for analytics
    try {
      await pool.query(
        `INSERT INTO search_history (user_id, search_type, search_params, created_at) 
         VALUES ($1, $2, $3, NOW())`,
        [req.user.id, 'trip_package', JSON.stringify(searchParams)]
      );
    } catch (logError) {
      console.warn('Failed to log search history:', logError);
    }

    // Search for trip packages
    const tripPackages = await tripService.createTripPackage(searchParams);

    res.json({
      success: true,
      data: tripPackages.data,
      meta: {
        ...tripPackages.meta,
        searchId: `search_${Date.now()}_${req.user.id}`,
        userId: req.user.id
      }
    });

  } catch (error) {
    console.error('Trip package search error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search trip packages',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/trip-customization/destinations
 * Get popular destinations with airport codes
 */
router.get('/destinations', async (req, res) => {
  try {
    const popularDestinations = [
      { code: 'NYC', name: 'New York City', country: 'United States', airports: ['JFK', 'LGA', 'EWR'] },
      { code: 'LON', name: 'London', country: 'United Kingdom', airports: ['LHR', 'LGW', 'STN'] },
      { code: 'PAR', name: 'Paris', country: 'France', airports: ['CDG', 'ORY'] },
      { code: 'TYO', name: 'Tokyo', country: 'Japan', airports: ['NRT', 'HND'] },
      { code: 'SIN', name: 'Singapore', country: 'Singapore', airports: ['SIN'] },
      { code: 'DXB', name: 'Dubai', country: 'United Arab Emirates', airports: ['DXB'] },
      { code: 'BKK', name: 'Bangkok', country: 'Thailand', airports: ['BKK', 'DMK'] },
      { code: 'HKG', name: 'Hong Kong', country: 'Hong Kong', airports: ['HKG'] },
      { code: 'SYD', name: 'Sydney', country: 'Australia', airports: ['SYD'] },
      { code: 'LAX', name: 'Los Angeles', country: 'United States', airports: ['LAX'] },
      { code: 'BCN', name: 'Barcelona', country: 'Spain', airports: ['BCN'] },
      { code: 'ROM', name: 'Rome', country: 'Italy', airports: ['FCO', 'CIA'] },
      { code: 'IST', name: 'Istanbul', country: 'Turkey', airports: ['IST', 'SAW'] },
      { code: 'BER', name: 'Berlin', country: 'Germany', airports: ['BER'] },
      { code: 'AMS', name: 'Amsterdam', country: 'Netherlands', airports: ['AMS'] }
    ];

    res.json({
      success: true,
      data: popularDestinations,
      meta: {
        total: popularDestinations.length,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching destinations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch destinations'
    });
  }
});

/**
 * POST /api/trip-customization/customize-package
 * Customize a specific trip package
 */
router.post('/customize-package', authenticateToken, async (req, res) => {
  try {
    const { packageId, customizations } = req.body;

    if (!packageId || !customizations) {
      return res.status(400).json({
        success: false,
        message: 'Package ID and customizations are required'
      });
    }

    // Here you would implement package customization logic
    // For now, return a mock customized package
    const customizedPackage = {
      id: `custom_${packageId}_${Date.now()}`,
      originalPackageId: packageId,
      customizations,
      status: 'customized',
      estimatedPrice: Math.floor(Math.random() * 2000) + 1000,
      currency: 'USD',
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    };

    res.json({
      success: true,
      data: customizedPackage,
      message: 'Package customized successfully'
    });

  } catch (error) {
    console.error('Package customization error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to customize package'
    });
  }
});

/**
 * POST /api/trip-customization/book
 * Book a trip package
 */
router.post('/book', authenticateToken, async (req, res) => {
  try {
    const { error, value } = tripBookingSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking data',
        errors: error.details.map(detail => detail.message)
      });
    }

    const bookingData = value;
    
    // Generate booking reference
    const bookingReference = `TRP${Date.now().toString().slice(-8)}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    // Store booking in database
    const bookingResult = await pool.query(
      `INSERT INTO bookings (user_id, booking_type, booking_data, total_price, currency, status, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING id`,
      [
        req.user.id,
        'trip_package',
        JSON.stringify({
          ...bookingData,
          bookingReference,
          bookedAt: new Date().toISOString()
        }),
        bookingData.tripData.totalPrice || 0,
        bookingData.tripData.currency || 'USD',
        'confirmed'
      ]
    );

    const bookingId = bookingResult.rows[0].id;

    // Mock payment processing
    const paymentResult = {
      success: true,
      transactionId: `txn_${Date.now()}`,
      amount: bookingData.tripData.totalPrice || 0,
      currency: bookingData.tripData.currency || 'USD',
      status: 'completed'
    };

    res.json({
      success: true,
      data: {
        bookingId,
        bookingReference,
        status: 'confirmed',
        payment: paymentResult,
        tripDetails: bookingData.tripData,
        travelerDetails: bookingData.travelerDetails,
        confirmationEmail: 'Confirmation email sent to ' + bookingData.travelerDetails.primaryTraveler.email
      },
      message: 'Trip booked successfully!'
    });

  } catch (error) {
    console.error('Trip booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to book trip',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/trip-customization/bookings
 * Get user's trip bookings
 */
router.get('/bookings', authenticateToken, async (req, res) => {
  try {
    const { status, limit = 10, offset = 0 } = req.query;

    let query = `
      SELECT id, booking_data, total_price, currency, status, created_at, updated_at
      FROM bookings 
      WHERE user_id = $1 AND booking_type = 'trip_package'
    `;
    const params = [req.user.id];

    if (status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    const bookings = result.rows.map(row => ({
      id: row.id,
      bookingReference: row.booking_data.bookingReference,
      tripDetails: row.booking_data.tripData,
      totalPrice: row.total_price,
      currency: row.currency,
      status: row.status,
      bookedAt: row.created_at,
      updatedAt: row.updated_at
    }));

    res.json({
      success: true,
      data: bookings,
      meta: {
        total: bookings.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings'
    });
  }
});

/**
 * GET /api/trip-customization/booking/:bookingId
 * Get specific booking details
 */
router.get('/booking/:bookingId', authenticateToken, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const result = await pool.query(
      `SELECT * FROM bookings WHERE id = $1 AND user_id = $2 AND booking_type = 'trip_package'`,
      [bookingId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = result.rows[0];

    res.json({
      success: true,
      data: {
        id: booking.id,
        bookingReference: booking.booking_data.bookingReference,
        tripDetails: booking.booking_data.tripData,
        travelerDetails: booking.booking_data.travelerDetails,
        totalPrice: booking.total_price,
        currency: booking.currency,
        status: booking.status,
        bookedAt: booking.created_at,
        updatedAt: booking.updated_at
      }
    });

  } catch (error) {
    console.error('Error fetching booking details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking details'
    });
  }
});

/**
 * GET /api/trip-customization/status
 * Get service status
 */
router.get('/status', async (req, res) => {
  try {
    const status = tripService.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting service status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get service status'
    });
  }
});

module.exports = router; 
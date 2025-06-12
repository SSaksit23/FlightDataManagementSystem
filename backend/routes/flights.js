/**
 * Flight Routes
 * Handles flight search, details, and related operations using Google Flights API
 */

const express = require('express');
const Joi = require('joi');
const FlightApiService = require('../services/flightApiService');
const { authenticateToken } = require('../middleware/auth');
const pool = require('../models/database');

const router = express.Router();
const flightApi = new FlightApiService();

// Validation schemas
const flightSearchSchema = Joi.object({
  origin: Joi.string().length(3).uppercase().required()
    .messages({
      'string.length': 'Origin must be a 3-letter airport code',
      'any.required': 'Origin airport code is required'
    }),
  destination: Joi.string().length(3).uppercase().required()
    .messages({
      'string.length': 'Destination must be a 3-letter airport code',
      'any.required': 'Destination airport code is required'
    }),
  departureDate: Joi.date().iso().min('now').required()
    .messages({
      'date.min': 'Departure date must be in the future',
      'any.required': 'Departure date is required'
    }),
  returnDate: Joi.date().iso().min(Joi.ref('departureDate')).optional()
    .messages({
      'date.min': 'Return date must be after departure date'
    }),
  adults: Joi.number().integer().min(1).max(9).default(1),
  children: Joi.number().integer().min(0).max(8).default(0),
  infants: Joi.number().integer().min(0).max(8).default(0),
  cabinClass: Joi.string().valid('ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST').default('ECONOMY'),
  maxPrice: Joi.number().positive().optional(),
  currency: Joi.string().length(3).uppercase().default('USD'),
  directFlights: Joi.boolean().default(false),
  maxStops: Joi.number().integer().min(0).max(3).optional()
});

/**
 * POST /api/flights/search
 * Search for flights
 */
router.post('/search', async (req, res) => {
  try {
    // Validate input
    const { error, value } = flightSearchSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(d => d.message)
      });
    }

    const searchParams = value;

    // Format dates for API
    searchParams.departureDate = new Date(searchParams.departureDate).toISOString().split('T')[0];
    if (searchParams.returnDate) {
      searchParams.returnDate = new Date(searchParams.returnDate).toISOString().split('T')[0];
    }

    // Search flights using FlightAPI.io
    const flightResults = await flightApi.searchFlights(searchParams);

    // Save search history if user is authenticated
    if (req.user) {
      try {
        await pool.query(
          'INSERT INTO search_history (user_id, search_type, search_params, results_count) VALUES ($1, $2, $3, $4)',
          [
            req.user.userId,
            'flight',
            JSON.stringify(searchParams),
            flightResults.results.totalResults
          ]
        );
      } catch (dbError) {
        console.error('Failed to save search history:', dbError);
        // Don't fail the request if search history save fails
      }
    }

    // Cache results for performance (optional)
    if (flightResults.results.totalResults > 0) {
      try {
        const cacheKey = `flight_search_${Buffer.from(JSON.stringify(searchParams)).toString('base64')}`;
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

        await pool.query(
          'INSERT INTO flight_cache (cache_key, search_params, results, expires_at) VALUES ($1, $2, $3, $4) ON CONFLICT (cache_key) DO UPDATE SET results = $2, expires_at = $4',
          [cacheKey, JSON.stringify(searchParams), JSON.stringify(flightResults), expiresAt]
        );
      } catch (cacheError) {
        console.error('Failed to cache results:', cacheError);
        // Don't fail the request if caching fails
      }
    }

    res.json({
      success: true,
      message: 'Flight search completed successfully',
      data: flightResults
    });

  } catch (error) {
    console.error('Flight search error:', error);
    
    if (error.message.includes('Invalid API key')) {
      return res.status(503).json({
        success: false,
        message: 'Flight search service is temporarily unavailable',
        error: 'API configuration issue'
      });
    }

    if (error.message.includes('rate limit')) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        error: 'Rate limit exceeded'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Flight search failed',
      error: error.message
    });
  }
});

/**
 * GET /api/flights/details/:flightId
 * Get detailed information about a specific flight
 */
router.get('/details/:flightId', async (req, res) => {
  try {
    const { flightId } = req.params;

    if (!flightId) {
      return res.status(400).json({
        success: false,
        message: 'Flight ID is required'
      });
    }

    // FlightAPI.io doesn't have a specific flight details endpoint
    // Return cached data or redirect to search
    const flightDetails = { 
      id: flightId, 
      message: 'Flight details available through search results',
      provider: 'FlightAPI.io'
    };

    res.json({
      success: true,
      message: 'Flight details retrieved successfully',
      data: flightDetails
    });

  } catch (error) {
    console.error('Get flight details error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to get flight details',
      error: error.message
    });
  }
});

/**
 * GET /api/flights/destinations/:origin
 * Get popular destinations from an origin airport
 */
router.get('/destinations/:origin', async (req, res) => {
  try {
    const { origin } = req.params;

    // Validate airport code
    if (!origin || !flightApi.isValidAirportCode(origin.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: 'Valid 3-letter airport code is required'
      });
    }

    // FlightAPI.io doesn't have a specific popular destinations endpoint
    // Return a message indicating this feature is not available
    const destinations = {
      message: 'Popular destinations feature not available with FlightAPI.io',
      suggestion: 'Use the flight search to find flights to specific destinations'
    };

    res.json({
      success: true,
      message: 'Popular destinations retrieved successfully',
      data: {
        origin: origin.toUpperCase(),
        destinations
      }
    });

  } catch (error) {
    console.error('Get popular destinations error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to get popular destinations',
      error: error.message
    });
  }
});

/**
 * GET /api/flights/airports/search
 * Search for airports by name or code
 */
router.get('/airports/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters long'
      });
    }

    try {
      // Try FlightAPI.io first
      const apiResult = await flightApi.getAirlineAirportCodes(q);
      
      if (apiResult.success && apiResult.data.airports.length > 0) {
        return res.json({
          success: true,
          message: 'Airport search completed successfully',
          data: {
            query: q,
            airports: apiResult.data.airports,
            source: 'FlightAPI.io'
          }
        });
      }
    } catch (apiError) {
      console.log('FlightAPI search failed, falling back to local database:', apiError.message);
    }

    // Fallback to local database search
    const searchQuery = `%${q.toLowerCase()}%`;
    const result = await pool.query(
      `SELECT iata_code, name, city, country, country_code, type 
       FROM locations 
       WHERE type = 'airport' 
       AND is_active = true 
       AND (
         LOWER(name) LIKE $1 
         OR LOWER(city) LIKE $1 
         OR LOWER(iata_code) LIKE $1
       )
       ORDER BY 
         CASE 
           WHEN LOWER(iata_code) = LOWER($2) THEN 1
           WHEN LOWER(iata_code) LIKE LOWER($2) || '%' THEN 2
           WHEN LOWER(city) = LOWER($2) THEN 3
           ELSE 4
         END,
         name
       LIMIT 20`,
      [searchQuery, q.toLowerCase()]
    );

    const airports = result.rows.map(row => ({
      code: row.iata_code,
      name: row.name,
      city: row.city,
      country: row.country,
      countryCode: row.country_code,
      displayName: `${row.city} (${row.iata_code}) - ${row.name}`
    }));

    res.json({
      success: true,
      message: 'Airport search completed successfully',
      data: {
        query: q,
        airports,
        source: 'Local Database'
      }
    });

  } catch (error) {
    console.error('Airport search error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Airport search failed',
      error: error.message
    });
  }
});

/**
 * GET /api/flights/history
 * Get user's flight search history (requires authentication)
 */
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT id, search_params, results_count, created_at 
       FROM search_history 
       WHERE user_id = $1 AND search_type = 'flight'
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [req.user.userId, limit, offset]
    );

    const totalResult = await pool.query(
      'SELECT COUNT(*) FROM search_history WHERE user_id = $1 AND search_type = \'flight\'',
      [req.user.userId]
    );

    const searchHistory = result.rows.map(row => ({
      id: row.id,
      searchParams: row.search_params,
      resultsCount: row.results_count,
      searchDate: row.created_at
    }));

    res.json({
      success: true,
      message: 'Search history retrieved successfully',
      data: {
        searches: searchHistory,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(totalResult.rows[0].count),
          totalPages: Math.ceil(totalResult.rows[0].count / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get search history error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to get search history',
      error: error.message
    });
  }
});

/**
 * GET /api/flights/status
 * Get flight service status
 */
router.get('/status', (req, res) => {
  try {
    const status = flightApi.getStatus();
    
    res.json({
      success: true,
      message: 'Flight service status retrieved successfully',
      data: status
    });

  } catch (error) {
    console.error('Get flight service status error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to get service status',
      error: error.message
    });
  }
});

/**
 * POST /api/flights/favorites
 * Add flight to user favorites (requires authentication)
 */
router.post('/favorites', authenticateToken, async (req, res) => {
  try {
    const { flightData } = req.body;

    if (!flightData) {
      return res.status(400).json({
        success: false,
        message: 'Flight data is required'
      });
    }

    await pool.query(
      'INSERT INTO user_favorites (user_id, favorite_type, favorite_data) VALUES ($1, $2, $3)',
      [req.user.userId, 'flight', JSON.stringify(flightData)]
    );

    res.json({
      success: true,
      message: 'Flight added to favorites successfully'
    });

  } catch (error) {
    console.error('Add flight to favorites error:', error);
    
    if (error.code === '23505') { // Duplicate key error
      return res.status(409).json({
        success: false,
        message: 'Flight is already in favorites'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to add flight to favorites',
      error: error.message
    });
  }
});

/**
 * GET /api/flights/favorites
 * Get user's favorite flights (requires authentication)
 */
router.get('/favorites', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, favorite_data, created_at FROM user_favorites WHERE user_id = $1 AND favorite_type = \'flight\' ORDER BY created_at DESC',
      [req.user.userId]
    );

    const favorites = result.rows.map(row => ({
      id: row.id,
      flightData: row.favorite_data,
      addedDate: row.created_at
    }));

    res.json({
      success: true,
      message: 'Favorite flights retrieved successfully',
      data: {
        favorites
      }
    });

  } catch (error) {
    console.error('Get favorite flights error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to get favorite flights',
      error: error.message
    });
  }
});

module.exports = router; 
/**
 * Hotel Routes
 * Handles hotel search, details, and related operations using Makcorps Hotel API
 */

const express = require('express');
const Joi = require('joi');
const HotelApiService = require('../services/hotelApiService');
const { authenticateToken } = require('../middleware/auth');
const pool = require('../models/database');

const router = express.Router();
const hotelApi = new HotelApiService();

// Validation schemas
const hotelSearchSchema = Joi.object({
  cityId: Joi.string().optional(),
  hotelId: Joi.string().optional(),
  city: Joi.string().optional(),
  checkIn: Joi.date().iso().min('now').required()
    .messages({
      'date.min': 'Check-in date must be in the future',
      'any.required': 'Check-in date is required'
    }),
  checkOut: Joi.date().iso().min(Joi.ref('checkIn')).required()
    .messages({
      'date.min': 'Check-out date must be after check-in date',
      'any.required': 'Check-out date is required'
    }),
  adults: Joi.number().integer().min(1).max(10).default(2),
  children: Joi.number().integer().min(0).max(8).default(0),
  rooms: Joi.number().integer().min(1).max(5).default(1),
  currency: Joi.string().length(3).uppercase().default('USD'),
  maxPrice: Joi.number().positive().optional(),
  minRating: Joi.number().min(1).max(5).optional()
}).or('cityId', 'hotelId', 'city');

/**
 * POST /api/hotels/search
 * Search for hotels
 */
router.post('/search', async (req, res) => {
  try {
    // Validate input
    const { error, value } = hotelSearchSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(d => d.message)
      });
    }

    const searchParams = value;

    // Format dates for API
    searchParams.checkIn = new Date(searchParams.checkIn).toISOString().split('T')[0];
    searchParams.checkOut = new Date(searchParams.checkOut).toISOString().split('T')[0];

    // If city name is provided but no cityId, try to get cityId first
    if (searchParams.city && !searchParams.cityId) {
      try {
        const mappingResult = await hotelApi.getCityHotelMapping(searchParams.city);
        if (mappingResult.success && mappingResult.data.cities.length > 0) {
          searchParams.cityId = mappingResult.data.cities[0].cityId;
        } else {
          return res.status(404).json({
            success: false,
            message: 'City not found. Please provide a valid city name or cityId.',
            suggestion: 'Use the /api/hotels/cities/search endpoint to find valid cities'
          });
        }
      } catch (mappingError) {
        return res.status(400).json({
          success: false,
          message: 'Unable to find city. Please provide a valid cityId.',
          error: mappingError.message
        });
      }
    }

    // Search hotels using Makcorps Hotel API
    const hotelResults = await hotelApi.searchHotels(searchParams);

    // Save search history if user is authenticated
    if (req.user) {
      try {
        await pool.query(
          'INSERT INTO search_history (user_id, search_type, search_params, results_count) VALUES ($1, $2, $3, $4)',
          [
            req.user.userId,
            'hotel',
            JSON.stringify(searchParams),
            hotelResults.results.totalResults
          ]
        );
      } catch (dbError) {
        console.error('Failed to save search history:', dbError);
        // Don't fail the request if search history save fails
      }
    }

    // Cache results for performance (optional)
    if (hotelResults.results.totalResults > 0) {
      try {
        const cacheKey = `hotel_search_${Buffer.from(JSON.stringify(searchParams)).toString('base64')}`;
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await pool.query(
          'INSERT INTO hotel_cache (cache_key, search_params, results, expires_at) VALUES ($1, $2, $3, $4) ON CONFLICT (cache_key) DO UPDATE SET results = $2, expires_at = $4',
          [cacheKey, JSON.stringify(searchParams), JSON.stringify(hotelResults), expiresAt]
        );
      } catch (cacheError) {
        console.error('Failed to cache results:', cacheError);
        // Don't fail the request if caching fails
      }
    }

    res.json({
      success: true,
      message: 'Hotel search completed successfully',
      data: hotelResults
    });

  } catch (error) {
    console.error('Hotel search error:', error);
    
    if (error.message.includes('Invalid API key')) {
      return res.status(503).json({
        success: false,
        message: 'Hotel search service is temporarily unavailable',
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
      message: 'Hotel search failed',
      error: error.message
    });
  }
});

/**
 * GET /api/hotels/cities/search
 * Search for cities and get their IDs for hotel search
 */
router.get('/cities/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters long'
      });
    }

    const mappingResult = await hotelApi.getCityHotelMapping(q);

    res.json({
      success: true,
      message: 'City search completed successfully',
      data: {
        query: q,
        cities: mappingResult.data.cities
      }
    });

  } catch (error) {
    console.error('City search error:', error);
    
    res.status(500).json({
      success: false,
      message: 'City search failed',
      error: error.message
    });
  }
});

/**
 * GET /api/hotels/details/:hotelId
 * Get detailed information about a specific hotel
 */
router.get('/details/:hotelId', async (req, res) => {
  try {
    const { hotelId } = req.params;
    const { checkIn, checkOut, adults = 2, children = 0, rooms = 1, currency = 'USD' } = req.query;

    if (!hotelId) {
      return res.status(400).json({
        success: false,
        message: 'Hotel ID is required'
      });
    }

    if (!checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        message: 'Check-in and check-out dates are required'
      });
    }

    const searchParams = {
      hotelId,
      checkIn,
      checkOut,
      adults: parseInt(adults),
      children: parseInt(children),
      rooms: parseInt(rooms),
      currency
    };

    const hotelDetails = await hotelApi.searchHotelByHotelId(searchParams);

    res.json({
      success: true,
      message: 'Hotel details retrieved successfully',
      data: hotelDetails
    });

  } catch (error) {
    console.error('Get hotel details error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to get hotel details',
      error: error.message
    });
  }
});

/**
 * GET /api/hotels/history
 * Get user's hotel search history (requires authentication)
 */
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT id, search_params, results_count, created_at 
       FROM search_history 
       WHERE user_id = $1 AND search_type = 'hotel'
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [req.user.userId, limit, offset]
    );

    const totalResult = await pool.query(
      'SELECT COUNT(*) FROM search_history WHERE user_id = $1 AND search_type = \'hotel\'',
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
 * GET /api/hotels/status
 * Get hotel service status
 */
router.get('/status', (req, res) => {
  try {
    const status = hotelApi.getStatus();
    
    res.json({
      success: true,
      message: 'Hotel service status retrieved successfully',
      data: status
    });

  } catch (error) {
    console.error('Get hotel service status error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to get service status',
      error: error.message
    });
  }
});

/**
 * POST /api/hotels/favorites
 * Add hotel to user favorites (requires authentication)
 */
router.post('/favorites', authenticateToken, async (req, res) => {
  try {
    const { hotelData } = req.body;

    if (!hotelData) {
      return res.status(400).json({
        success: false,
        message: 'Hotel data is required'
      });
    }

    await pool.query(
      'INSERT INTO user_favorites (user_id, favorite_type, favorite_data) VALUES ($1, $2, $3)',
      [req.user.userId, 'hotel', JSON.stringify(hotelData)]
    );

    res.json({
      success: true,
      message: 'Hotel added to favorites successfully'
    });

  } catch (error) {
    console.error('Add hotel to favorites error:', error);
    
    if (error.code === '23505') { // Duplicate key error
      return res.status(409).json({
        success: false,
        message: 'Hotel is already in favorites'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to add hotel to favorites',
      error: error.message
    });
  }
});

/**
 * GET /api/hotels/favorites
 * Get user's favorite hotels (requires authentication)
 */
router.get('/favorites', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, favorite_data, created_at FROM user_favorites WHERE user_id = $1 AND favorite_type = \'hotel\' ORDER BY created_at DESC',
      [req.user.userId]
    );

    const favorites = result.rows.map(row => ({
      id: row.id,
      hotelData: row.favorite_data,
      addedDate: row.created_at
    }));

    res.json({
      success: true,
      message: 'Favorite hotels retrieved successfully',
      data: {
        favorites
      }
    });

  } catch (error) {
    console.error('Get favorite hotels error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to get favorite hotels',
      error: error.message
    });
  }
});

/**
 * GET /api/hotels/popular/:cityId
 * Get popular hotels in a specific city
 */
router.get('/popular/:cityId', async (req, res) => {
  try {
    const { cityId } = req.params;
    
    if (!cityId) {
      return res.status(400).json({
        success: false,
        message: 'City ID is required'
      });
    }

    // Use a default date range for popular hotels (next month)
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + 30);
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + 1);

    const searchParams = {
      cityId,
      checkIn: checkIn.toISOString().split('T')[0],
      checkOut: checkOut.toISOString().split('T')[0],
      adults: 2,
      rooms: 1,
      currency: 'USD'
    };

    const hotelResults = await hotelApi.searchHotelsByCityId(searchParams);

    // Sort by rating and limit to top 10
    const popularHotels = hotelResults.results.hotels
      .sort((a, b) => (b.rating.score || 0) - (a.rating.score || 0))
      .slice(0, 10);

    res.json({
      success: true,
      message: 'Popular hotels retrieved successfully',
      data: {
        cityId,
        hotels: popularHotels,
        totalResults: popularHotels.length
      }
    });

  } catch (error) {
    console.error('Get popular hotels error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to get popular hotels',
      error: error.message
    });
  }
});

module.exports = router; 
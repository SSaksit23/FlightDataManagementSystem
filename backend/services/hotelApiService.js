/**
 * Makcorps Hotel API Service
 * Integrates with Makcorps Hotel API for hotel search functionality
 * Documentation: https://docs.makcorps.com/
 */

const axios = require('axios');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'hotel-api-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

class HotelApiService {
  constructor() {
    this.baseURL = 'https://api.makcorps.com';
    this.apiKey = process.env.MAKCORPS_API_KEY;
    
    if (!this.apiKey) {
      logger.warn('MAKCORPS_API_KEY not found in environment variables');
    }

    // Configure axios instance
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.info('Makcorps Hotel API Request', {
          method: config.method,
          url: config.url,
          params: config.params
        });
        return config;
      },
      (error) => {
        logger.error('Makcorps Hotel API Request Error', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.info('Makcorps Hotel API Response', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        logger.error('Makcorps Hotel API Response Error', {
          status: error.response?.status,
          message: error.message,
          url: error.config?.url
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Search hotels by city ID
   * @param {Object} searchParams - Hotel search parameters
   * @returns {Promise<Object>} - Hotel search results
   */
  async searchHotelsByCityId(searchParams) {
    try {
      const {
        cityId,
        checkIn,
        checkOut,
        adults = 2,
        children = 0,
        rooms = 1,
        currency = 'USD'
      } = searchParams;

      // Validate required parameters
      if (!cityId || !checkIn || !checkOut) {
        throw new Error('Missing required parameters: cityId, checkIn, or checkOut');
      }

      // Format dates for Makcorps API (YYYY-MM-DD)
      const formattedCheckIn = new Date(checkIn).toISOString().split('T')[0];
      const formattedCheckOut = new Date(checkOut).toISOString().split('T')[0];

      // Prepare request parameters
      const requestParams = {
        api_key: this.apiKey,
        cityid: cityId,
        checkin: formattedCheckIn,
        checkout: formattedCheckOut,
        adults: adults,
        children: children,
        rooms: rooms,
        currency: currency
      };

      logger.info('Searching hotels by city ID with parameters', requestParams);

      const response = await this.client.get('/free/hotel', {
        params: requestParams
      });

      return this.formatHotelResults(response.data, searchParams, 'city');

    } catch (error) {
      logger.error('Hotel search by city ID error', {
        error: error.message,
        searchParams
      });
      
      return this.handleApiError(error);
    }
  }

  /**
   * Search hotels by hotel ID
   * @param {Object} searchParams - Hotel search parameters
   * @returns {Promise<Object>} - Hotel search results
   */
  async searchHotelByHotelId(searchParams) {
    try {
      const {
        hotelId,
        checkIn,
        checkOut,
        adults = 2,
        children = 0,
        rooms = 1,
        currency = 'USD'
      } = searchParams;

      // Validate required parameters
      if (!hotelId || !checkIn || !checkOut) {
        throw new Error('Missing required parameters: hotelId, checkIn, or checkOut');
      }

      // Format dates for Makcorps API
      const formattedCheckIn = new Date(checkIn).toISOString().split('T')[0];
      const formattedCheckOut = new Date(checkOut).toISOString().split('T')[0];

      // Prepare request parameters
      const requestParams = {
        api_key: this.apiKey,
        hotelid: hotelId,
        checkin: formattedCheckIn,
        checkout: formattedCheckOut,
        adults: adults,
        children: children,
        rooms: rooms,
        currency: currency
      };

      logger.info('Searching hotel by hotel ID with parameters', requestParams);

      const response = await this.client.get('/free/hotel', {
        params: requestParams
      });

      return this.formatHotelResults(response.data, searchParams, 'hotel');

    } catch (error) {
      logger.error('Hotel search by hotel ID error', {
        error: error.message,
        searchParams
      });
      
      return this.handleApiError(error);
    }
  }

  /**
   * Search hotels (automatically determines search type)
   * @param {Object} searchParams - Hotel search parameters
   * @returns {Promise<Object>} - Hotel search results
   */
  async searchHotels(searchParams) {
    if (searchParams.hotelId) {
      return this.searchHotelByHotelId(searchParams);
    } else if (searchParams.cityId) {
      return this.searchHotelsByCityId(searchParams);
    } else {
      throw new Error('Either cityId or hotelId is required for hotel search');
    }
  }

  /**
   * Get city/hotel mapping data
   * @param {string} query - Search query for city/hotel
   * @returns {Promise<Object>} - Mapping results
   */
  async getCityHotelMapping(query) {
    try {
      if (!query) {
        throw new Error('Search query is required');
      }

      const requestParams = {
        api_key: this.apiKey,
        query: query
      };

      logger.info('Getting city/hotel mapping', requestParams);

      const response = await this.client.get('/free/mapping', {
        params: requestParams
      });

      return this.formatMappingResults(response.data);

    } catch (error) {
      logger.error('City/hotel mapping error', {
        error: error.message,
        query
      });
      
      return this.handleApiError(error);
    }
  }

  /**
   * Format hotel search results to standardized format
   * @param {Object} rawData - Raw API response
   * @param {Object} searchParams - Original search parameters
   * @param {string} searchType - Search type (city/hotel)
   * @returns {Object} - Formatted hotel results
   */
  formatHotelResults(rawData, searchParams, searchType) {
    try {
      // Makcorps API returns different structures
      const hotels = rawData.hotels || rawData.data || [];
      
      const formattedHotels = hotels.map((hotel, index) => ({
        id: hotel.hotel_id || hotel.id || `hotel_${index}_${Date.now()}`,
        name: hotel.hotel_name || hotel.name,
        description: hotel.description || '',
        address: hotel.address || '',
        city: hotel.city || searchParams.city,
        country: hotel.country || '',
        coordinates: {
          latitude: hotel.latitude || hotel.lat,
          longitude: hotel.longitude || hotel.lng
        },
        rating: {
          stars: hotel.star_rating || hotel.stars,
          score: hotel.rating_score || hotel.score,
          reviewCount: hotel.review_count || hotel.reviews
        },
        price: {
          total: parseFloat(hotel.price || hotel.total_price || 0),
          currency: searchParams.currency || 'USD',
          perNight: parseFloat(hotel.price_per_night || hotel.nightly_rate || 0),
          taxes: parseFloat(hotel.taxes || 0),
          fees: parseFloat(hotel.fees || 0)
        },
        amenities: hotel.amenities || [],
        images: hotel.images || [],
        availability: {
          checkIn: searchParams.checkIn,
          checkOut: searchParams.checkOut,
          rooms: searchParams.rooms || 1,
          adults: searchParams.adults || 2,
          children: searchParams.children || 0
        },
        bookingOptions: hotel.booking_options || [],
        cancellationPolicy: hotel.cancellation_policy || '',
        searchType: searchType
      }));

      return {
        success: true,
        searchParams,
        results: {
          hotels: formattedHotels,
          totalResults: formattedHotels.length,
          searchType: searchType
        },
        meta: {
          currency: searchParams.currency || 'USD',
          searchTime: new Date().toISOString(),
          provider: 'Makcorps Hotel API'
        }
      };

    } catch (error) {
      logger.error('Error formatting hotel results', error);
      throw new Error('Failed to format hotel results');
    }
  }

  /**
   * Format mapping results
   * @param {Object} rawData - Raw mapping data
   * @returns {Object} - Formatted mapping results
   */
  formatMappingResults(rawData) {
    const cities = rawData.cities || rawData.data || [];
    
    return {
      success: true,
      data: {
        cities: cities.map(city => ({
          cityId: city.city_id || city.id,
          cityName: city.city_name || city.name,
          country: city.country,
          countryCode: city.country_code,
          hotelCount: city.hotel_count || 0,
          displayName: `${city.city_name || city.name}, ${city.country}`
        }))
      },
      meta: {
        provider: 'Makcorps Hotel API',
        searchTime: new Date().toISOString()
      }
    };
  }

  /**
   * Handle API errors
   * @param {Error} error - Error object
   * @returns {Object} - Formatted error response
   */
  handleApiError(error) {
    if (error.response?.status === 404) {
      throw new Error('No hotels found for the specified search criteria');
    } else if (error.response?.status === 403) {
      throw new Error('API rate limit exceeded. Please try again later or upgrade your plan.');
    } else if (error.response?.status === 401) {
      throw new Error('Invalid API key. Please check your Makcorps credentials.');
    }
    
    throw new Error(`Hotel search failed: ${error.message}`);
  }

  /**
   * Validate date format
   * @param {string} date - Date string
   * @returns {boolean} - Is valid
   */
  isValidDate(date) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    return dateRegex.test(date) && !isNaN(Date.parse(date));
  }

  /**
   * Get service status
   * @returns {Object} - Service status
   */
  getStatus() {
    return {
      service: 'Makcorps Hotel API',
      status: this.apiKey ? 'configured' : 'not_configured',
      baseURL: this.baseURL,
      hasApiKey: !!this.apiKey,
      apiKey: this.apiKey ? `${this.apiKey.substring(0, 8)}...` : 'not_set'
    };
  }
}

module.exports = HotelApiService; 
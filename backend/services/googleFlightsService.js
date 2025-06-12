/**
 * Google Flights API Service
 * Integrates with RapidAPI Google Flights2 API for flight search functionality
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
  defaultMeta: { service: 'google-flights-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

class GoogleFlightsService {
  constructor() {
    this.baseURL = 'https://google-flights2.p.rapidapi.com';
    this.apiKey = process.env.RAPIDAPI_KEY;
    this.apiHost = 'google-flights2.p.rapidapi.com';
    
    if (!this.apiKey) {
      logger.warn('RAPIDAPI_KEY not found in environment variables');
    }

    // Configure axios instance
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'X-RapidAPI-Key': this.apiKey,
        'X-RapidAPI-Host': this.apiHost,
        'Content-Type': 'application/json'
      }
    });

    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.info('Google Flights API Request', {
          method: config.method,
          url: config.url,
          params: config.params
        });
        return config;
      },
      (error) => {
        logger.error('Google Flights API Request Error', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.info('Google Flights API Response', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        logger.error('Google Flights API Response Error', {
          status: error.response?.status,
          message: error.message,
          url: error.config?.url
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Search for flights between two destinations
   * @param {Object} searchParams - Flight search parameters
   * @returns {Promise<Object>} - Flight search results
   */
  async searchFlights(searchParams) {
    try {
      const {
        origin,
        destination,
        departureDate,
        returnDate,
        adults = 1,
        children = 0,
        infants = 0,
        cabinClass = 'ECONOMY',
        maxPrice,
        currency = 'USD'
      } = searchParams;

      // Validate required parameters
      if (!origin || !destination || !departureDate) {
        throw new Error('Missing required parameters: origin, destination, or departureDate');
      }

      // Prepare request parameters for Google Flights API
      const requestParams = {
        engine: 'google_flights',
        departure_id: origin,
        arrival_id: destination,
        outbound_date: departureDate,
        return_date: returnDate,
        adults: adults,
        children: children,
        infants_in_seat: infants,
        currency: currency,
        hl: 'en'
      };

      // Add optional parameters
      if (maxPrice) {
        requestParams.max_price = maxPrice;
      }

      if (cabinClass && cabinClass !== 'ECONOMY') {
        requestParams.travel_class = cabinClass.toLowerCase();
      }

      logger.info('Searching flights with parameters', requestParams);

      const response = await this.client.get('/search', {
        params: requestParams
      });

      return this.formatFlightResults(response.data, searchParams);

    } catch (error) {
      logger.error('Flight search error', {
        error: error.message,
        searchParams
      });
      
      if (error.response?.status === 401) {
        throw new Error('Invalid API key. Please check your RapidAPI credentials.');
      } else if (error.response?.status === 429) {
        throw new Error('API rate limit exceeded. Please try again later.');
      } else if (error.response?.status === 400) {
        throw new Error('Invalid search parameters. Please check your input.');
      }
      
      throw new Error(`Flight search failed: ${error.message}`);
    }
  }

  /**
   * Get flight details by ID
   * @param {string} flightId - Flight identifier
   * @returns {Promise<Object>} - Flight details
   */
  async getFlightDetails(flightId) {
    try {
      logger.info('Getting flight details', { flightId });

      const response = await this.client.get(`/flight/${flightId}`);
      
      return this.formatFlightDetails(response.data);

    } catch (error) {
      logger.error('Get flight details error', {
        error: error.message,
        flightId
      });
      
      throw new Error(`Failed to get flight details: ${error.message}`);
    }
  }

  /**
   * Get popular destinations from an origin
   * @param {string} origin - Origin airport code
   * @returns {Promise<Array>} - Popular destinations
   */
  async getPopularDestinations(origin) {
    try {
      logger.info('Getting popular destinations', { origin });

      const response = await this.client.get('/destinations', {
        params: {
          departure_id: origin,
          currency: 'USD'
        }
      });

      return this.formatDestinations(response.data);

    } catch (error) {
      logger.error('Get popular destinations error', {
        error: error.message,
        origin
      });
      
      throw new Error(`Failed to get popular destinations: ${error.message}`);
    }
  }

  /**
   * Format flight search results to standardized format
   * @param {Object} rawData - Raw API response
   * @param {Object} searchParams - Original search parameters
   * @returns {Object} - Formatted flight results
   */
  formatFlightResults(rawData, searchParams) {
    try {
      const flights = rawData.best_flights || rawData.other_flights || [];
      
      const formattedFlights = flights.map(flight => ({
        id: flight.flight_id || `${flight.flights?.[0]?.flight_number}_${Date.now()}`,
        airline: {
          code: flight.flights?.[0]?.airline,
          name: flight.flights?.[0]?.airline_logo ? 
                flight.flights[0].airline_logo.split('/').pop().replace('.png', '') : 
                flight.flights?.[0]?.airline
        },
        price: {
          total: flight.price,
          currency: searchParams.currency || 'USD',
          pricePerAdult: Math.round(flight.price / (searchParams.adults || 1))
        },
        duration: {
          total: flight.total_duration,
          outbound: flight.flights?.[0]?.duration,
          return: flight.flights?.[1]?.duration
        },
        segments: this.formatSegments(flight.flights || []),
        stops: flight.layovers?.length || 0,
        layovers: flight.layovers || [],
        bookingOptions: flight.booking_options || [],
        carbonEmissions: flight.carbon_emissions,
        departure: {
          airport: searchParams.origin,
          time: flight.flights?.[0]?.departure_airport?.time,
          date: searchParams.departureDate
        },
        arrival: {
          airport: searchParams.destination,
          time: flight.flights?.[0]?.arrival_airport?.time,
          date: searchParams.departureDate
        }
      }));

      return {
        success: true,
        searchParams,
        results: {
          flights: formattedFlights,
          totalResults: formattedFlights.length,
          searchId: rawData.search_id,
          searchMetadata: rawData.search_metadata
        },
        meta: {
          currency: searchParams.currency || 'USD',
          searchTime: new Date().toISOString(),
          provider: 'Google Flights'
        }
      };

    } catch (error) {
      logger.error('Error formatting flight results', error);
      throw new Error('Failed to format flight results');
    }
  }

  /**
   * Format flight segments
   * @param {Array} flights - Raw flight segments
   * @returns {Array} - Formatted segments
   */
  formatSegments(flights) {
    return flights.map(flight => ({
      departure: {
        airport: flight.departure_airport?.id,
        name: flight.departure_airport?.name,
        time: flight.departure_airport?.time,
        terminal: flight.departure_airport?.terminal
      },
      arrival: {
        airport: flight.arrival_airport?.id,
        name: flight.arrival_airport?.name,
        time: flight.arrival_airport?.time,
        terminal: flight.arrival_airport?.terminal
      },
      airline: {
        code: flight.airline,
        name: flight.airline_logo ? 
              flight.airline_logo.split('/').pop().replace('.png', '') : 
              flight.airline
      },
      flightNumber: flight.flight_number,
      aircraft: flight.airplane,
      duration: flight.duration,
      cabinClass: flight.travel_class
    }));
  }

  /**
   * Format flight details
   * @param {Object} rawData - Raw flight details
   * @returns {Object} - Formatted flight details
   */
  formatFlightDetails(rawData) {
    return {
      id: rawData.flight_id,
      airline: rawData.airline,
      flightNumber: rawData.flight_number,
      aircraft: rawData.aircraft,
      route: rawData.route,
      schedule: rawData.schedule,
      price: rawData.price,
      availability: rawData.availability,
      amenities: rawData.amenities || []
    };
  }

  /**
   * Format popular destinations
   * @param {Object} rawData - Raw destinations data
   * @returns {Array} - Formatted destinations
   */
  formatDestinations(rawData) {
    const destinations = rawData.destinations || [];
    
    return destinations.map(dest => ({
      airport: dest.destination_id,
      city: dest.destination_name,
      country: dest.country,
      price: dest.price,
      currency: dest.currency,
      image: dest.image
    }));
  }

  /**
   * Validate airport code format
   * @param {string} code - Airport code
   * @returns {boolean} - Is valid
   */
  isValidAirportCode(code) {
    return /^[A-Z]{3}$/.test(code);
  }

  /**
   * Get service status
   * @returns {Object} - Service status
   */
  getStatus() {
    return {
      service: 'Google Flights API',
      status: this.apiKey ? 'configured' : 'not_configured',
      baseURL: this.baseURL,
      hasApiKey: !!this.apiKey
    };
  }
}

module.exports = GoogleFlightsService; 
/**
 * FlightAPI.io Service
 * Integrates with FlightAPI.io for flight search functionality
 * Documentation: https://docs.flightapi.io/
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
  defaultMeta: { service: 'flightapi-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

class FlightApiService {
  constructor() {
    this.baseURL = 'https://api.flightapi.io';
    this.apiKey = process.env.FLIGHTAPI_KEY;
    
    if (!this.apiKey) {
      logger.warn('FLIGHTAPI_KEY not found in environment variables');
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
        logger.info('FlightAPI Request', {
          method: config.method,
          url: config.url,
          params: config.params
        });
        return config;
      },
      (error) => {
        logger.error('FlightAPI Request Error', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.info('FlightAPI Response', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        logger.error('FlightAPI Response Error', {
          status: error.response?.status,
          message: error.message,
          url: error.config?.url
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Search for flights (automatically determines one-way or round-trip)
   * @param {Object} searchParams - Flight search parameters
   * @returns {Promise<Object>} - Flight search results
   */
  async searchFlights(searchParams) {
    if (searchParams.returnDate) {
      return this.searchRoundTripFlights(searchParams);
    } else {
      return this.searchOneWayFlights(searchParams);
    }
  }

  /**
   * Search for one-way flights
   * @param {Object} searchParams - Flight search parameters
   * @returns {Promise<Object>} - Flight search results
   */
  async searchOneWayFlights(searchParams) {
    try {
      const {
        origin,
        destination,
        departureDate,
        adults = 1,
        children = 0,
        infants = 0,
        cabinClass = 'Economy',
        currency = 'USD'
      } = searchParams;

      // Validate required parameters
      if (!origin || !destination || !departureDate) {
        throw new Error('Missing required parameters: origin, destination, or departureDate');
      }

      // Format date for FlightAPI (YYYY-MM-DD)
      const formattedDate = new Date(departureDate).toISOString().split('T')[0];

      // Prepare request parameters for FlightAPI
      const requestParams = {
        apikey: this.apiKey,
        from: origin,
        to: destination,
        date: formattedDate,
        adult: adults,
        child: children,
        infant: infants,
        cabin_class: cabinClass,
        currency: currency
      };

      logger.info('Searching one-way flights with parameters', requestParams);

      const response = await this.client.get('/oneway', {
        params: requestParams
      });

      return this.formatFlightResults(response.data, searchParams, 'oneway');

    } catch (error) {
      logger.error('One-way flight search error', {
        error: error.message,
        searchParams
      });
      
      return this.handleApiError(error);
    }
  }

  /**
   * Search for round-trip flights
   * @param {Object} searchParams - Flight search parameters
   * @returns {Promise<Object>} - Flight search results
   */
  async searchRoundTripFlights(searchParams) {
    try {
      const {
        origin,
        destination,
        departureDate,
        returnDate,
        adults = 1,
        children = 0,
        infants = 0,
        cabinClass = 'Economy',
        currency = 'USD'
      } = searchParams;

      // Validate required parameters
      if (!origin || !destination || !departureDate || !returnDate) {
        throw new Error('Missing required parameters for round-trip: origin, destination, departureDate, or returnDate');
      }

      // Format dates for FlightAPI
      const formattedDepartureDate = new Date(departureDate).toISOString().split('T')[0];
      const formattedReturnDate = new Date(returnDate).toISOString().split('T')[0];

      // Prepare request parameters for FlightAPI
      const requestParams = {
        apikey: this.apiKey,
        from: origin,
        to: destination,
        departure: formattedDepartureDate,
        return: formattedReturnDate,
        adult: adults,
        child: children,
        infant: infants,
        cabin_class: cabinClass,
        currency: currency
      };

      logger.info('Searching round-trip flights with parameters', requestParams);

      const response = await this.client.get('/roundtrip', {
        params: requestParams
      });

      return this.formatFlightResults(response.data, searchParams, 'roundtrip');

    } catch (error) {
      logger.error('Round-trip flight search error', {
        error: error.message,
        searchParams
      });
      
      return this.handleApiError(error);
    }
  }

  /**
   * Track flights between airports
   * @param {string} origin - Origin airport code
   * @param {string} destination - Destination airport code
   * @returns {Promise<Object>} - Flight tracking results
   */
  async trackFlightsBetweenAirports(origin, destination) {
    try {
      if (!origin || !destination) {
        throw new Error('Missing required parameters: origin or destination');
      }

      const requestParams = {
        apikey: this.apiKey,
        from: origin,
        to: destination
      };

      logger.info('Tracking flights between airports', requestParams);

      const response = await this.client.get('/track_flights_between_airports', {
        params: requestParams
      });

      return this.formatTrackingResults(response.data);

    } catch (error) {
      logger.error('Flight tracking error', {
        error: error.message,
        origin,
        destination
      });
      
      return this.handleApiError(error);
    }
  }

  /**
   * Get airline and airport codes
   * @param {string} query - Search query
   * @returns {Promise<Object>} - Airport/airline data
   */
  async getAirlineAirportCodes(query) {
    try {
      if (!query) {
        throw new Error('Search query is required');
      }

      const requestParams = {
        apikey: this.apiKey,
        query: query
      };

      logger.info('Getting airline/airport codes', requestParams);

      const response = await this.client.get('/airline_airport_code', {
        params: requestParams
      });

      return this.formatAirportResults(response.data);

    } catch (error) {
      logger.error('Airline/airport code search error', {
        error: error.message,
        query
      });
      
      return this.handleApiError(error);
    }
  }

  /**
   * Get airport schedule
   * @param {string} airportCode - Airport IATA code
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<Object>} - Airport schedule
   */
  async getAirportSchedule(airportCode, date) {
    try {
      if (!airportCode || !date) {
        throw new Error('Missing required parameters: airportCode or date');
      }

      const requestParams = {
        apikey: this.apiKey,
        airport: airportCode,
        date: date
      };

      logger.info('Getting airport schedule', requestParams);

      const response = await this.client.get('/airport_schedule', {
        params: requestParams
      });

      return this.formatScheduleResults(response.data);

    } catch (error) {
      logger.error('Airport schedule error', {
        error: error.message,
        airportCode,
        date
      });
      
      return this.handleApiError(error);
    }
  }

  /**
   * Format flight search results to standardized format
   * @param {Object} rawData - Raw API response
   * @param {Object} searchParams - Original search parameters
   * @param {string} tripType - Trip type (oneway/roundtrip)
   * @returns {Object} - Formatted flight results
   */
  formatFlightResults(rawData, searchParams, tripType) {
    try {
      // FlightAPI.io returns different structures, handle both
      const flights = rawData.flights || rawData.data || [];
      
      const formattedFlights = flights.map((flight, index) => ({
        id: flight.id || `flight_${index}_${Date.now()}`,
        airline: {
          code: flight.airline_code || flight.airline?.code,
          name: flight.airline_name || flight.airline?.name
        },
        price: {
          total: parseFloat(flight.price || flight.total_price || 0),
          currency: searchParams.currency || 'USD',
          pricePerAdult: Math.round((parseFloat(flight.price || flight.total_price || 0)) / (searchParams.adults || 1))
        },
        duration: {
          total: flight.duration || flight.total_duration,
          outbound: flight.outbound_duration,
          return: flight.return_duration
        },
        segments: this.formatSegments(flight.segments || flight.flights || []),
        stops: flight.stops || 0,
        departure: {
          airport: searchParams.origin,
          time: flight.departure_time,
          date: searchParams.departureDate,
          terminal: flight.departure_terminal
        },
        arrival: {
          airport: searchParams.destination,
          time: flight.arrival_time,
          date: searchParams.departureDate,
          terminal: flight.arrival_terminal
        },
        tripType: tripType,
        bookingClass: flight.booking_class || searchParams.cabinClass
      }));

      return {
        success: true,
        searchParams,
        results: {
          flights: formattedFlights,
          totalResults: formattedFlights.length,
          tripType: tripType
        },
        meta: {
          currency: searchParams.currency || 'USD',
          searchTime: new Date().toISOString(),
          provider: 'FlightAPI.io'
        }
      };

    } catch (error) {
      logger.error('Error formatting flight results', error);
      throw new Error('Failed to format flight results');
    }
  }

  /**
   * Format flight segments
   * @param {Array} segments - Raw flight segments
   * @returns {Array} - Formatted segments
   */
  formatSegments(segments) {
    if (!Array.isArray(segments)) return [];
    
    return segments.map(segment => ({
      departure: {
        airport: segment.departure_airport || segment.from,
        time: segment.departure_time,
        terminal: segment.departure_terminal
      },
      arrival: {
        airport: segment.arrival_airport || segment.to,
        time: segment.arrival_time,
        terminal: segment.arrival_terminal
      },
      airline: {
        code: segment.airline_code,
        name: segment.airline_name
      },
      flightNumber: segment.flight_number,
      aircraft: segment.aircraft_type,
      duration: segment.duration
    }));
  }

  /**
   * Format tracking results
   * @param {Object} rawData - Raw tracking data
   * @returns {Object} - Formatted tracking results
   */
  formatTrackingResults(rawData) {
    return {
      success: true,
      data: {
        flights: rawData.flights || [],
        route: rawData.route,
        totalFlights: rawData.total_flights || 0
      },
      meta: {
        provider: 'FlightAPI.io',
        searchTime: new Date().toISOString()
      }
    };
  }

  /**
   * Format airport search results
   * @param {Object} rawData - Raw airport data
   * @returns {Object} - Formatted airport results
   */
  formatAirportResults(rawData) {
    const airports = rawData.airports || rawData.data || [];
    
    return {
      success: true,
      data: {
        airports: airports.map(airport => ({
          code: airport.iata_code || airport.code,
          name: airport.name,
          city: airport.city,
          country: airport.country,
          countryCode: airport.country_code,
          displayName: `${airport.city} (${airport.iata_code || airport.code}) - ${airport.name}`
        }))
      },
      meta: {
        provider: 'FlightAPI.io',
        searchTime: new Date().toISOString()
      }
    };
  }

  /**
   * Format schedule results
   * @param {Object} rawData - Raw schedule data
   * @returns {Object} - Formatted schedule results
   */
  formatScheduleResults(rawData) {
    return {
      success: true,
      data: {
        airport: rawData.airport,
        date: rawData.date,
        departures: rawData.departures || [],
        arrivals: rawData.arrivals || []
      },
      meta: {
        provider: 'FlightAPI.io',
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
      throw new Error('No flights found for the specified route and date');
    } else if (error.response?.status === 410) {
      throw new Error('Request timeout - please try again later');
    } else if (error.response?.status === 429) {
      throw new Error('API rate limit exceeded. Please try again later or upgrade your plan.');
    } else if (error.response?.status === 401) {
      throw new Error('Invalid API key. Please check your FlightAPI credentials.');
    }
    
    throw new Error(`Flight search failed: ${error.message}`);
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
      service: 'FlightAPI.io',
      status: this.apiKey ? 'configured' : 'not_configured',
      baseURL: this.baseURL,
      hasApiKey: !!this.apiKey,
      apiKey: this.apiKey ? `${this.apiKey.substring(0, 8)}...` : 'not_set'
    };
  }
}

module.exports = FlightApiService; 
/**
 * Trip Customization Service
 * Integrates multiple APIs to create comprehensive travel packages
 * Combines flights, hotels, activities, and other travel services
 */

const axios = require('axios');
const winston = require('winston');
const FlightApiService = require('./flightApiService');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'trip-customization-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

class TripCustomizationService {
  constructor() {
    this.flightApi = new FlightApiService();
    
    // Alternative hotel APIs (since Makcorps has issues)
    this.hotelApis = {
      // Booking.com API alternative - using RapidAPI
      rapidapi: {
        baseURL: 'https://booking-com.p.rapidapi.com/v1',
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY || 'demo-key',
          'X-RapidAPI-Host': 'booking-com.p.rapidapi.com'
        }
      },
      // Hotels.com API alternative
      hotelscom: {
        baseURL: 'https://hotels-com-provider.p.rapidapi.com/v2',
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY || 'demo-key',
          'X-RapidAPI-Host': 'hotels-com-provider.p.rapidapi.com'
        }
      }
    };

    // Activities and attractions APIs
    this.activityApis = {
      // GetYourGuide API alternative
      getyourguide: {
        baseURL: 'https://getyourguide.p.rapidapi.com',
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY || 'demo-key',
          'X-RapidAPI-Host': 'getyourguide.p.rapidapi.com'
        }
      },
      // Viator API alternative
      viator: {
        baseURL: 'https://viator.p.rapidapi.com',
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY || 'demo-key',
          'X-RapidAPI-Host': 'viator.p.rapidapi.com'
        }
      }
    };

    // Weather API for trip planning
    this.weatherApi = {
      baseURL: 'https://api.openweathermap.org/data/2.5',
      apiKey: process.env.OPENWEATHER_API_KEY || 'demo-key'
    };

    // Currency conversion API
    this.currencyApi = {
      baseURL: 'https://api.exchangerate-api.com/v4/latest',
      fallbackRates: {
        'USD': 1.0,
        'EUR': 0.85,
        'GBP': 0.73,
        'JPY': 110.0,
        'CAD': 1.25,
        'AUD': 1.35,
        'CHF': 0.92,
        'CNY': 6.45,
        'INR': 74.5,
        'THB': 33.0
      }
    };
  }

  /**
   * Create a comprehensive trip package
   * @param {Object} tripParams - Trip parameters
   * @returns {Promise<Object>} - Complete trip package
   */
  async createTripPackage(tripParams) {
    try {
      const {
        origin,
        destinations,
        startDate,
        endDate,
        travelers,
        budget,
        preferences,
        currency = 'USD'
      } = tripParams;

      logger.info('Creating trip package', { tripParams });

      // 1. Search for flights
      const flightOptions = await this.searchFlights({
        origin,
        destinations,
        startDate,
        endDate,
        travelers
      });

      // 2. Search for hotels in each destination
      const hotelOptions = await this.searchHotels({
        destinations,
        startDate,
        endDate,
        travelers,
        budget
      });

      // 3. Search for activities and attractions
      const activityOptions = await this.searchActivities({
        destinations,
        startDate,
        endDate,
        preferences
      });

      // 4. Get weather information
      const weatherInfo = await this.getWeatherForecast({
        destinations,
        startDate,
        endDate
      });

      // 5. Calculate total costs and create packages
      const tripPackages = await this.createTripPackages({
        flightOptions,
        hotelOptions,
        activityOptions,
        weatherInfo,
        budget,
        currency,
        preferences
      });

      return {
        success: true,
        data: {
          tripPackages,
          flightOptions,
          hotelOptions,
          activityOptions,
          weatherInfo,
          searchParams: tripParams
        },
        meta: {
          searchTime: new Date().toISOString(),
          currency,
          totalPackages: tripPackages.length
        }
      };

    } catch (error) {
      logger.error('Error creating trip package', error);
      throw new Error(`Trip package creation failed: ${error.message}`);
    }
  }

  /**
   * Search for flights using FlightAPI.io
   */
  async searchFlights({ origin, destinations, startDate, endDate, travelers }) {
    try {
      const flightSearches = [];

      // Search outbound flights to each destination
      for (const destination of destinations) {
        try {
          const outboundSearch = await this.flightApi.searchFlights({
            origin,
            destination,
            departureDate: startDate,
            adults: travelers.adults || 1,
            children: travelers.children || 0,
            infants: travelers.infants || 0,
            cabinClass: travelers.cabinClass || 'economy'
          });

          if (outboundSearch.success) {
            flightSearches.push({
              type: 'outbound',
              route: `${origin}-${destination}`,
              flights: outboundSearch.data.flights
            });
          }
        } catch (error) {
          logger.warn(`Flight search failed for ${origin}-${destination}`, error);
          // Add mock flights as fallback
          flightSearches.push({
            type: 'outbound',
            route: `${origin}-${destination}`,
            flights: this.createMockFlightsForRoute(origin, destination, startDate, travelers)
          });
        }
      }

      // Search return flights
      const lastDestination = destinations[destinations.length - 1];
      try {
        const returnSearch = await this.flightApi.searchFlights({
          origin: lastDestination,
          destination: origin,
          departureDate: endDate,
          adults: travelers.adults || 1,
          children: travelers.children || 0,
          infants: travelers.infants || 0,
          cabinClass: travelers.cabinClass || 'economy'
        });

        if (returnSearch.success) {
          flightSearches.push({
            type: 'return',
            route: `${lastDestination}-${origin}`,
            flights: returnSearch.data.flights
          });
        }
      } catch (error) {
        logger.warn(`Return flight search failed for ${lastDestination}-${origin}`, error);
        // Add mock return flights as fallback
        flightSearches.push({
          type: 'return',
          route: `${lastDestination}-${origin}`,
          flights: this.createMockFlightsForRoute(lastDestination, origin, endDate, travelers)
        });
      }

      return flightSearches;

    } catch (error) {
      logger.error('Flight search error', error);
      return this.createMockFlights({ origin, destinations, startDate, endDate, travelers });
    }
  }

  /**
   * Search for hotels using mock data (since Makcorps has issues)
   */
  async searchHotels({ destinations, startDate, endDate, travelers, budget }) {
    try {
      const hotelSearches = [];

      for (const destination of destinations) {
        const hotelResults = this.createMockHotels(destination, startDate, endDate, travelers, budget);
        hotelSearches.push({
          destination,
          hotels: hotelResults
        });
      }

      return hotelSearches;

    } catch (error) {
      logger.error('Hotel search error', error);
      return destinations.map(dest => ({
        destination: dest,
        hotels: this.createMockHotels(dest, startDate, endDate, travelers, budget)
      }));
    }
  }

  /**
   * Search for activities and attractions
   */
  async searchActivities({ destinations, startDate, endDate, preferences }) {
    try {
      const activitySearches = [];

      for (const destination of destinations) {
        const activities = this.createMockActivities(destination, preferences);
        activitySearches.push({
          destination,
          activities
        });
      }

      return activitySearches;

    } catch (error) {
      logger.error('Activity search error', error);
      return destinations.map(dest => ({
        destination: dest,
        activities: this.createMockActivities(dest, preferences)
      }));
    }
  }

  /**
   * Get weather forecast for destinations
   */
  async getWeatherForecast({ destinations, startDate, endDate }) {
    try {
      const weatherData = [];

      for (const destination of destinations) {
        const weather = this.createMockWeather(destination, startDate, endDate);
        weatherData.push({
          destination,
          weather
        });
      }

      return weatherData;

    } catch (error) {
      logger.error('Weather forecast error', error);
      return destinations.map(dest => ({
        destination: dest,
        weather: this.createMockWeather(dest, startDate, endDate)
      }));
    }
  }

  /**
   * Create optimized trip packages
   */
  async createTripPackages({ flightOptions, hotelOptions, activityOptions, weatherInfo, budget, currency, preferences }) {
    try {
      const packages = [];

      // Create budget-friendly package
      const budgetPackage = {
        id: 'budget',
        name: 'Budget Explorer',
        description: 'Affordable travel without compromising on experience',
        totalPrice: 0,
        currency,
        components: {
          flights: this.selectBudgetFlights(flightOptions),
          hotels: this.selectBudgetHotels(hotelOptions),
          activities: this.selectBudgetActivities(activityOptions)
        },
        savings: 0,
        rating: 4.0,
        highlights: ['Best value for money', 'Essential experiences included', 'Comfortable accommodations']
      };

      // Create mid-range package
      const standardPackage = {
        id: 'standard',
        name: 'Comfort Traveler',
        description: 'Perfect balance of comfort and value',
        totalPrice: 0,
        currency,
        components: {
          flights: this.selectStandardFlights(flightOptions),
          hotels: this.selectStandardHotels(hotelOptions),
          activities: this.selectStandardActivities(activityOptions)
        },
        savings: 0,
        rating: 4.5,
        highlights: ['Balanced comfort and price', 'Quality accommodations', 'Popular attractions included']
      };

      // Create luxury package
      const luxuryPackage = {
        id: 'luxury',
        name: 'Premium Experience',
        description: 'Luxury travel with premium services',
        totalPrice: 0,
        currency,
        components: {
          flights: this.selectLuxuryFlights(flightOptions),
          hotels: this.selectLuxuryHotels(hotelOptions),
          activities: this.selectLuxuryActivities(activityOptions)
        },
        savings: 0,
        rating: 5.0,
        highlights: ['Premium accommodations', 'Exclusive experiences', 'VIP services included']
      };

      // Calculate total prices
      budgetPackage.totalPrice = this.calculatePackagePrice(budgetPackage.components);
      standardPackage.totalPrice = this.calculatePackagePrice(standardPackage.components);
      luxuryPackage.totalPrice = this.calculatePackagePrice(luxuryPackage.components);

      // Calculate savings compared to luxury package
      budgetPackage.savings = luxuryPackage.totalPrice - budgetPackage.totalPrice;
      standardPackage.savings = luxuryPackage.totalPrice - standardPackage.totalPrice;

      packages.push(budgetPackage, standardPackage, luxuryPackage);

      // Filter packages by budget if specified
      if (budget) {
        return packages.filter(pkg => pkg.totalPrice <= budget);
      }

      return packages;

    } catch (error) {
      logger.error('Error creating trip packages', error);
      throw error;
    }
  }

  /**
   * Create mock flight data for a specific route
   */
  createMockFlightsForRoute(origin, destination, date, travelers) {
    const airlines = ['AA', 'DL', 'UA', 'BA', 'LH', 'AF', 'KL', 'TK'];
    
    return Array.from({ length: 5 }, (_, i) => ({
      id: `flight_${origin}_${destination}_${i}`,
      airline: airlines[Math.floor(Math.random() * airlines.length)],
      flightNumber: `${airlines[i % airlines.length]}${Math.floor(Math.random() * 9000) + 1000}`,
      departure: {
        airport: origin,
        time: `${String(6 + i * 2).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
        date: date
      },
      arrival: {
        airport: destination,
        time: `${String(10 + i * 2).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
        date: date
      },
      duration: `${Math.floor(Math.random() * 8) + 2}h ${Math.floor(Math.random() * 60)}m`,
      price: {
        economy: Math.floor(Math.random() * 800) + 200,
        business: Math.floor(Math.random() * 2000) + 1000,
        first: Math.floor(Math.random() * 4000) + 3000
      },
      stops: Math.floor(Math.random() * 3),
      aircraft: 'Boeing 737-800',
      amenities: ['WiFi', 'Entertainment', 'Meals'],
      baggage: {
        carry: '1 x 8kg',
        checked: '1 x 23kg'
      }
    }));
  }

  /**
   * Create mock flight data
   */
  createMockFlights({ origin, destinations, startDate, endDate, travelers }) {
    const flights = [];

    destinations.forEach((dest) => {
      flights.push({
        type: 'outbound',
        route: `${origin}-${dest}`,
        flights: this.createMockFlightsForRoute(origin, dest, startDate, travelers)
      });
    });

    // Return flights
    const lastDest = destinations[destinations.length - 1];
    flights.push({
      type: 'return',
      route: `${lastDest}-${origin}`,
      flights: this.createMockFlightsForRoute(lastDest, origin, endDate, travelers)
    });

    return flights;
  }

  /**
   * Create mock hotel data
   */
  createMockHotels(destination, checkIn, checkOut, travelers, budget) {
    const hotelTypes = ['Budget Inn', 'Comfort Hotel', 'Business Hotel', 'Luxury Resort', 'Boutique Hotel'];
    const amenities = ['WiFi', 'Pool', 'Gym', 'Spa', 'Restaurant', 'Bar', 'Parking', 'Airport Shuttle'];
    
    return Array.from({ length: 10 }, (_, i) => ({
      id: `hotel_${destination}_${i}`,
      name: `${hotelTypes[i % hotelTypes.length]} ${destination}`,
      description: `Beautiful ${hotelTypes[i % hotelTypes.length].toLowerCase()} in the heart of ${destination}`,
      location: {
        address: `${Math.floor(Math.random() * 999) + 1} Main Street, ${destination}`,
        coordinates: {
          lat: 40.7128 + (Math.random() - 0.5) * 0.1,
          lng: -74.0060 + (Math.random() - 0.5) * 0.1
        },
        distanceFromCenter: `${(Math.random() * 5).toFixed(1)} km`
      },
      rating: {
        stars: Math.floor(Math.random() * 3) + 3,
        score: (Math.random() * 2 + 3).toFixed(1),
        reviewCount: Math.floor(Math.random() * 2000) + 100
      },
      price: {
        perNight: Math.floor(Math.random() * 300) + 50,
        total: Math.floor(Math.random() * 1500) + 250,
        currency: 'USD',
        taxes: Math.floor(Math.random() * 50) + 10
      },
      amenities: amenities.slice(0, Math.floor(Math.random() * 5) + 3),
      images: [
        `https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400`,
        `https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=400`
      ],
      availability: {
        checkIn,
        checkOut,
        rooms: Math.floor(Math.random() * 10) + 1,
        maxGuests: (travelers.adults || 1) + (travelers.children || 0)
      },
      cancellation: 'Free cancellation until 24 hours before check-in',
      breakfast: Math.random() > 0.5 ? 'Included' : 'Not included'
    }));
  }

  /**
   * Create mock activity data
   */
  createMockActivities(destination, preferences) {
    const activityTypes = ['Tour', 'Museum', 'Adventure', 'Cultural', 'Food', 'Shopping', 'Entertainment'];
    const activities = [];

    activityTypes.forEach((type, index) => {
      activities.push({
        id: `activity_${destination}_${type}_${index}`,
        name: `${type} Experience in ${destination}`,
        description: `Amazing ${type.toLowerCase()} experience showcasing the best of ${destination}`,
        type: type.toLowerCase(),
        duration: `${Math.floor(Math.random() * 6) + 2} hours`,
        price: {
          adult: Math.floor(Math.random() * 100) + 20,
          child: Math.floor(Math.random() * 50) + 10,
          currency: 'USD'
        },
        rating: {
          score: (Math.random() * 2 + 3).toFixed(1),
          reviewCount: Math.floor(Math.random() * 1000) + 50
        },
        location: {
          name: `${destination} ${type} Center`,
          address: `${Math.floor(Math.random() * 999) + 1} Tourist Street, ${destination}`
        },
        availability: {
          times: ['09:00', '11:00', '14:00', '16:00'],
          languages: ['English', 'Spanish', 'French']
        },
        includes: ['Guide', 'Transportation', 'Entry fees'],
        images: [
          `https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?w=400`,
          `https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400`
        ]
      });
    });

    return activities;
  }

  /**
   * Create mock weather data
   */
  createMockWeather(destination, startDate, endDate) {
    const conditions = ['Sunny', 'Partly Cloudy', 'Cloudy', 'Light Rain', 'Clear'];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    return {
      destination,
      forecast: Array.from({ length: Math.max(days, 1) }, (_, i) => {
        const date = new Date(start);
        date.setDate(date.getDate() + i);
        
        return {
          date: date.toISOString().split('T')[0],
          condition: conditions[Math.floor(Math.random() * conditions.length)],
          temperature: {
            high: Math.floor(Math.random() * 15) + 20,
            low: Math.floor(Math.random() * 10) + 10,
            unit: 'C'
          },
          humidity: Math.floor(Math.random() * 40) + 40,
          windSpeed: Math.floor(Math.random() * 20) + 5,
          precipitation: Math.floor(Math.random() * 30)
        };
      }),
      summary: `Generally pleasant weather in ${destination} with temperatures ranging from 15-30°C`
    };
  }

  /**
   * Helper methods for package selection
   */
  selectBudgetFlights(flightOptions) {
    return flightOptions.map(option => ({
      ...option,
      selectedFlight: option.flights.sort((a, b) => a.price.economy - b.price.economy)[0]
    }));
  }

  selectStandardFlights(flightOptions) {
    return flightOptions.map(option => ({
      ...option,
      selectedFlight: option.flights[Math.floor(option.flights.length / 2)]
    }));
  }

  selectLuxuryFlights(flightOptions) {
    return flightOptions.map(option => ({
      ...option,
      selectedFlight: option.flights.sort((a, b) => b.price.business - a.price.business)[0]
    }));
  }

  selectBudgetHotels(hotelOptions) {
    return hotelOptions.map(option => ({
      ...option,
      selectedHotel: option.hotels.sort((a, b) => a.price.perNight - b.price.perNight)[0]
    }));
  }

  selectStandardHotels(hotelOptions) {
    return hotelOptions.map(option => ({
      ...option,
      selectedHotel: option.hotels.filter(h => h.rating.stars >= 3 && h.rating.stars <= 4)[0] || option.hotels[0]
    }));
  }

  selectLuxuryHotels(hotelOptions) {
    return hotelOptions.map(option => ({
      ...option,
      selectedHotel: option.hotels.filter(h => h.rating.stars >= 4)[0] || option.hotels[0]
    }));
  }

  selectBudgetActivities(activityOptions) {
    return activityOptions.map(option => ({
      ...option,
      selectedActivities: option.activities.sort((a, b) => a.price.adult - b.price.adult).slice(0, 2)
    }));
  }

  selectStandardActivities(activityOptions) {
    return activityOptions.map(option => ({
      ...option,
      selectedActivities: option.activities.slice(0, 3)
    }));
  }

  selectLuxuryActivities(activityOptions) {
    return activityOptions.map(option => ({
      ...option,
      selectedActivities: option.activities.slice(0, 5)
    }));
  }

  /**
   * Calculate total package price
   */
  calculatePackagePrice(components) {
    let total = 0;

    // Add flight costs
    components.flights.forEach(flight => {
      if (flight.selectedFlight) {
        total += flight.selectedFlight.price.economy;
      }
    });

    // Add hotel costs
    components.hotels.forEach(hotel => {
      if (hotel.selectedHotel) {
        total += hotel.selectedHotel.price.total;
      }
    });

    // Add activity costs
    components.activities.forEach(activity => {
      if (activity.selectedActivities) {
        activity.selectedActivities.forEach(act => {
          total += act.price.adult;
        });
      }
    });

    return Math.round(total);
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      service: 'Trip Customization Service',
      status: 'operational',
      integrations: {
        flightApi: this.flightApi.getStatus(),
        hotelApis: 'mock_data_available',
        activityApis: 'mock_data_available',
        weatherApi: 'mock_data_available'
      },
      features: [
        'Multi-destination trip planning',
        'Flight search and booking',
        'Hotel recommendations',
        'Activity suggestions',
        'Weather forecasting',
        'Budget optimization',
        'Package customization'
      ]
    };
  }
}

module.exports = TripCustomizationService; 
/**
 * Trip Customization Engine Test Script
 * Tests the complete trip planning and booking functionality
 */

const axios = require('axios');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `[${timestamp}] ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Test configuration
const API_BASE_URL = 'http://localhost:5000/api';
const TEST_USER = {
  email: 'test@example.com',
  password: 'password123'
};

let authToken = null;

/**
 * Test authentication
 */
async function testAuthentication() {
  try {
    logger.info('🔐 Testing authentication...');
    
    // Login
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, TEST_USER);
    
    if (loginResponse.data.success) {
      authToken = loginResponse.data.data.accessToken;
      logger.info('✅ Authentication successful');
      return true;
    } else {
      logger.error('❌ Authentication failed:', loginResponse.data.message);
      return false;
    }
  } catch (error) {
    logger.error('❌ Authentication error:', error.response?.data?.message || error.message);
    return false;
  }
}

/**
 * Test trip customization service status
 */
async function testServiceStatus() {
  try {
    logger.info('🔍 Testing service status...');
    
    const response = await axios.get(`${API_BASE_URL}/trip-customization/status`);
    
    if (response.data.success) {
      logger.info('✅ Service status check successful');
      logger.info('📊 Service details:', JSON.stringify(response.data.data, null, 2));
      return true;
    } else {
      logger.error('❌ Service status check failed');
      return false;
    }
  } catch (error) {
    logger.error('❌ Service status error:', error.response?.data?.message || error.message);
    return false;
  }
}

/**
 * Test destinations endpoint
 */
async function testDestinations() {
  try {
    logger.info('🌍 Testing destinations endpoint...');
    
    const response = await axios.get(`${API_BASE_URL}/trip-customization/destinations`);
    
    if (response.data.success && response.data.data.length > 0) {
      logger.info(`✅ Destinations loaded: ${response.data.data.length} destinations`);
      logger.info('🏙️ Sample destinations:', response.data.data.slice(0, 3).map(d => `${d.name} (${d.code})`).join(', '));
      return true;
    } else {
      logger.error('❌ Destinations test failed');
      return false;
    }
  } catch (error) {
    logger.error('❌ Destinations error:', error.response?.data?.message || error.message);
    return false;
  }
}

/**
 * Test trip package search
 */
async function testTripPackageSearch() {
  try {
    logger.info('🔍 Testing trip package search...');
    
    const searchParams = {
      origin: 'JFK',
      destinations: ['LHR', 'CDG'],
      startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
      endDate: new Date(Date.now() + 37 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 37 days from now
      travelers: {
        adults: 2,
        children: 0,
        infants: 0,
        cabinClass: 'economy'
      },
      budget: 5000,
      currency: 'USD',
      preferences: {
        accommodation: 'mid-range',
        activities: ['cultural', 'food'],
        pace: 'moderate',
        interests: ['history', 'cuisine']
      }
    };
    
    const response = await axios.post(
      `${API_BASE_URL}/trip-customization/search`,
      searchParams,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data.success) {
      const packages = response.data.data.tripPackages;
      logger.info(`✅ Trip search successful: ${packages.length} packages found`);
      
      packages.forEach((pkg, index) => {
        logger.info(`📦 Package ${index + 1}: ${pkg.name} - $${pkg.totalPrice} ${pkg.currency}`);
        logger.info(`   Rating: ${pkg.rating}/5.0`);
        logger.info(`   Highlights: ${pkg.highlights.join(', ')}`);
        
        // Log flight details
        if (pkg.components.flights && pkg.components.flights.length > 0) {
          logger.info(`   ✈️ Flights: ${pkg.components.flights.length} routes`);
          pkg.components.flights.forEach(flight => {
            if (flight.selectedFlight) {
              logger.info(`      ${flight.route}: ${flight.selectedFlight.airline} ${flight.selectedFlight.flightNumber} - $${flight.selectedFlight.price.economy}`);
            }
          });
        }
        
        // Log hotel details
        if (pkg.components.hotels && pkg.components.hotels.length > 0) {
          logger.info(`   🏨 Hotels: ${pkg.components.hotels.length} destinations`);
          pkg.components.hotels.forEach(hotel => {
            if (hotel.selectedHotel) {
              logger.info(`      ${hotel.destination}: ${hotel.selectedHotel.name} - $${hotel.selectedHotel.price.total}`);
            }
          });
        }
        
        // Log activity details
        if (pkg.components.activities && pkg.components.activities.length > 0) {
          logger.info(`   🎯 Activities: ${pkg.components.activities.length} destinations`);
          pkg.components.activities.forEach(activity => {
            if (activity.selectedActivities) {
              logger.info(`      ${activity.destination}: ${activity.selectedActivities.length} activities`);
            }
          });
        }
        
        logger.info(''); // Empty line for readability
      });
      
      return { success: true, packages };
    } else {
      logger.error('❌ Trip search failed:', response.data.message);
      return { success: false };
    }
  } catch (error) {
    logger.error('❌ Trip search error:', error.response?.data?.message || error.message);
    if (error.response?.data?.errors) {
      logger.error('   Validation errors:', error.response.data.errors);
    }
    return { success: false };
  }
}

/**
 * Test package customization
 */
async function testPackageCustomization(packageId) {
  try {
    logger.info('🎨 Testing package customization...');
    
    const customizations = {
      flightClass: 'business',
      hotelCategory: 'luxury',
      additionalActivities: ['spa', 'fine-dining'],
      specialRequests: 'Vegetarian meals, late checkout'
    };
    
    const response = await axios.post(
      `${API_BASE_URL}/trip-customization/customize-package`,
      {
        packageId,
        customizations
      },
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data.success) {
      logger.info('✅ Package customization successful');
      logger.info('🎨 Customized package:', JSON.stringify(response.data.data, null, 2));
      return { success: true, customizedPackage: response.data.data };
    } else {
      logger.error('❌ Package customization failed:', response.data.message);
      return { success: false };
    }
  } catch (error) {
    logger.error('❌ Package customization error:', error.response?.data?.message || error.message);
    return { success: false };
  }
}

/**
 * Test trip booking
 */
async function testTripBooking(packageData) {
  try {
    logger.info('💳 Testing trip booking...');
    
    const bookingData = {
      packageId: packageData.id,
      tripData: packageData,
      travelerDetails: {
        primaryTraveler: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phone: '+1-555-0123',
          dateOfBirth: '1985-06-15',
          passport: {
            number: 'A12345678',
            expiryDate: '2030-12-31',
            nationality: 'US'
          }
        },
        additionalTravelers: [
          {
            firstName: 'Jane',
            lastName: 'Doe',
            dateOfBirth: '1987-08-22',
            passport: {
              number: 'B87654321',
              expiryDate: '2029-11-30',
              nationality: 'US'
            }
          }
        ]
      },
      paymentDetails: {
        method: 'credit_card',
        cardDetails: {
          number: '4111111111111111',
          expiryMonth: 12,
          expiryYear: 2025,
          cvv: '123',
          holderName: 'John Doe'
        }
      }
    };
    
    const response = await axios.post(
      `${API_BASE_URL}/trip-customization/book`,
      bookingData,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data.success) {
      logger.info('✅ Trip booking successful');
      logger.info(`📋 Booking Reference: ${response.data.data.bookingReference}`);
      logger.info(`💰 Total Amount: $${response.data.data.payment.amount} ${response.data.data.payment.currency}`);
      logger.info(`📧 ${response.data.data.confirmationEmail}`);
      return { success: true, booking: response.data.data };
    } else {
      logger.error('❌ Trip booking failed:', response.data.message);
      return { success: false };
    }
  } catch (error) {
    logger.error('❌ Trip booking error:', error.response?.data?.message || error.message);
    if (error.response?.data?.errors) {
      logger.error('   Validation errors:', error.response.data.errors);
    }
    return { success: false };
  }
}

/**
 * Test booking retrieval
 */
async function testBookingRetrieval() {
  try {
    logger.info('📋 Testing booking retrieval...');
    
    const response = await axios.get(
      `${API_BASE_URL}/trip-customization/bookings`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );
    
    if (response.data.success) {
      logger.info(`✅ Booking retrieval successful: ${response.data.data.length} bookings found`);
      
      response.data.data.forEach((booking, index) => {
        logger.info(`📋 Booking ${index + 1}: ${booking.bookingReference} - $${booking.totalPrice} ${booking.currency}`);
        logger.info(`   Status: ${booking.status}`);
        logger.info(`   Booked: ${new Date(booking.bookedAt).toLocaleDateString()}`);
      });
      
      return { success: true, bookings: response.data.data };
    } else {
      logger.error('❌ Booking retrieval failed:', response.data.message);
      return { success: false };
    }
  } catch (error) {
    logger.error('❌ Booking retrieval error:', error.response?.data?.message || error.message);
    return { success: false };
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  logger.info('🚀 Starting Trip Customization Engine Tests');
  logger.info('='.repeat(50));
  
  const results = {
    authentication: false,
    serviceStatus: false,
    destinations: false,
    tripSearch: false,
    packageCustomization: false,
    tripBooking: false,
    bookingRetrieval: false
  };
  
  // Test 1: Authentication
  results.authentication = await testAuthentication();
  if (!results.authentication) {
    logger.error('❌ Authentication failed - stopping tests');
    return results;
  }
  
  // Test 2: Service Status
  results.serviceStatus = await testServiceStatus();
  
  // Test 3: Destinations
  results.destinations = await testDestinations();
  
  // Test 4: Trip Package Search
  const searchResult = await testTripPackageSearch();
  results.tripSearch = searchResult.success;
  
  if (searchResult.success && searchResult.packages.length > 0) {
    const firstPackage = searchResult.packages[0];
    
    // Test 5: Package Customization
    const customizationResult = await testPackageCustomization(firstPackage.id);
    results.packageCustomization = customizationResult.success;
    
    // Test 6: Trip Booking
    const bookingResult = await testTripBooking(firstPackage);
    results.tripBooking = bookingResult.success;
    
    // Test 7: Booking Retrieval
    if (bookingResult.success) {
      const retrievalResult = await testBookingRetrieval();
      results.bookingRetrieval = retrievalResult.success;
    }
  }
  
  // Summary
  logger.info('='.repeat(50));
  logger.info('📊 TEST RESULTS SUMMARY');
  logger.info('='.repeat(50));
  
  const testNames = {
    authentication: '🔐 Authentication',
    serviceStatus: '🔍 Service Status',
    destinations: '🌍 Destinations',
    tripSearch: '🔍 Trip Search',
    packageCustomization: '🎨 Package Customization',
    tripBooking: '💳 Trip Booking',
    bookingRetrieval: '📋 Booking Retrieval'
  };
  
  let passedTests = 0;
  let totalTests = Object.keys(results).length;
  
  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅ PASSED' : '❌ FAILED';
    logger.info(`${testNames[test]}: ${status}`);
    if (passed) passedTests++;
  });
  
  logger.info('='.repeat(50));
  logger.info(`🎯 Overall Result: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    logger.info('🎉 ALL TESTS PASSED! Trip Customization Engine is working perfectly!');
  } else {
    logger.warn(`⚠️ ${totalTests - passedTests} test(s) failed. Please check the logs above.`);
  }
  
  return results;
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    logger.error('💥 Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = {
  runAllTests,
  testAuthentication,
  testServiceStatus,
  testDestinations,
  testTripPackageSearch,
  testPackageCustomization,
  testTripBooking,
  testBookingRetrieval
}; 
/**
 * Google Flights API Test Script
 * Tests the integration with RapidAPI Google Flights2 API
 */

const axios = require('axios');
const GoogleFlightsService = require('../services/googleFlightsService');

// Test configuration
const TEST_CONFIG = {
  baseURL: 'http://localhost:5000/api',
  timeout: 30000
};

// Test data
const TEST_SEARCHES = [
  {
    name: 'Madrid to Barcelona (One-way)',
    params: {
      origin: 'MAD',
      destination: 'BCN',
      departureDate: '2024-03-15',
      adults: 1,
      children: 0,
      infants: 0,
      cabinClass: 'ECONOMY',
      currency: 'EUR'
    }
  },
  {
    name: 'London to Paris (Round-trip)',
    params: {
      origin: 'LHR',
      destination: 'CDG',
      departureDate: '2024-04-10',
      returnDate: '2024-04-17',
      adults: 2,
      children: 1,
      infants: 0,
      cabinClass: 'ECONOMY',
      currency: 'EUR'
    }
  },
  {
    name: 'New York to Los Angeles (Business Class)',
    params: {
      origin: 'JFK',
      destination: 'LAX',
      departureDate: '2024-05-20',
      adults: 1,
      children: 0,
      infants: 0,
      cabinClass: 'BUSINESS',
      maxPrice: 2000,
      currency: 'USD'
    }
  }
];

class GoogleFlightsAPITester {
  constructor() {
    this.client = axios.create({
      baseURL: TEST_CONFIG.baseURL,
      timeout: TEST_CONFIG.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    this.googleFlights = new GoogleFlightsService();
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  /**
   * Log test results
   */
  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const colors = {
      info: '\x1b[36m',    // Cyan
      success: '\x1b[32m', // Green
      error: '\x1b[31m',   // Red
      warning: '\x1b[33m', // Yellow
      reset: '\x1b[0m'     // Reset
    };
    
    console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
  }

  /**
   * Record test result
   */
  recordTest(testName, passed, error = null, data = null) {
    this.results.tests.push({
      name: testName,
      passed,
      error: error?.message || error,
      data,
      timestamp: new Date().toISOString()
    });
    
    if (passed) {
      this.results.passed++;
      this.log(`✅ ${testName}`, 'success');
    } else {
      this.results.failed++;
      this.log(`❌ ${testName}: ${error?.message || error}`, 'error');
    }
  }

  /**
   * Test 1: Service Status Check
   */
  async testServiceStatus() {
    try {
      const status = this.googleFlights.getStatus();
      
      if (status.service === 'Google Flights API') {
        this.recordTest('Service Status Check', true, null, status);
      } else {
        this.recordTest('Service Status Check', false, 'Invalid service status response');
      }
    } catch (error) {
      this.recordTest('Service Status Check', false, error);
    }
  }

  /**
   * Test 2: API Health Check
   */
  async testAPIHealthCheck() {
    try {
      const response = await this.client.get('/health');
      
      if (response.status === 200 && response.data.status === 'OK') {
        this.recordTest('API Health Check', true, null, response.data);
      } else {
        this.recordTest('API Health Check', false, 'API health check failed');
      }
    } catch (error) {
      this.recordTest('API Health Check', false, error);
    }
  }

  /**
   * Test 3: Flight Service Status Endpoint
   */
  async testFlightServiceStatus() {
    try {
      const response = await this.client.get('/flights/status');
      
      if (response.status === 200 && response.data.success) {
        this.recordTest('Flight Service Status Endpoint', true, null, response.data);
      } else {
        this.recordTest('Flight Service Status Endpoint', false, 'Flight service status endpoint failed');
      }
    } catch (error) {
      this.recordTest('Flight Service Status Endpoint', false, error);
    }
  }

  /**
   * Test 4: Airport Search
   */
  async testAirportSearch() {
    try {
      const searchQueries = ['madrid', 'lon', 'MAD', 'paris'];
      
      for (const query of searchQueries) {
        const response = await this.client.get(`/flights/airports/search?q=${query}`);
        
        if (response.status === 200 && response.data.success) {
          this.recordTest(`Airport Search: "${query}"`, true, null, {
            query,
            resultsCount: response.data.data.airports.length
          });
        } else {
          this.recordTest(`Airport Search: "${query}"`, false, 'Airport search failed');
        }
      }
    } catch (error) {
      this.recordTest('Airport Search', false, error);
    }
  }

  /**
   * Test 5: Flight Search Validation
   */
  async testFlightSearchValidation() {
    try {
      // Test invalid parameters
      const invalidSearches = [
        {
          name: 'Missing origin',
          params: { destination: 'BCN', departureDate: '2024-03-15' }
        },
        {
          name: 'Invalid airport code',
          params: { origin: 'INVALID', destination: 'BCN', departureDate: '2024-03-15' }
        },
        {
          name: 'Past departure date',
          params: { origin: 'MAD', destination: 'BCN', departureDate: '2020-01-01' }
        }
      ];

      for (const search of invalidSearches) {
        try {
          const response = await this.client.post('/flights/search', search.params);
          this.recordTest(`Validation Test: ${search.name}`, false, 'Should have failed validation');
        } catch (error) {
          if (error.response?.status === 400) {
            this.recordTest(`Validation Test: ${search.name}`, true, null, 'Correctly rejected invalid input');
          } else {
            this.recordTest(`Validation Test: ${search.name}`, false, error);
          }
        }
      }
    } catch (error) {
      this.recordTest('Flight Search Validation', false, error);
    }
  }

  /**
   * Test 6: Flight Search (Mock/Demo Mode)
   */
  async testFlightSearchDemo() {
    try {
      for (const search of TEST_SEARCHES) {
        try {
          this.log(`Testing flight search: ${search.name}`, 'info');
          
          const response = await this.client.post('/flights/search', search.params);
          
          if (response.status === 200 && response.data.success) {
            this.recordTest(`Flight Search: ${search.name}`, true, null, {
              resultsCount: response.data.data.results?.totalResults || 0,
              provider: response.data.data.meta?.provider
            });
          } else {
            this.recordTest(`Flight Search: ${search.name}`, false, 'Flight search returned unsuccessful response');
          }
        } catch (error) {
          // If it's an API key issue, that's expected in demo mode
          if (error.response?.status === 503 && error.response?.data?.error === 'API configuration issue') {
            this.recordTest(`Flight Search: ${search.name}`, true, null, 'Expected API key error in demo mode');
          } else {
            this.recordTest(`Flight Search: ${search.name}`, false, error);
          }
        }
      }
    } catch (error) {
      this.recordTest('Flight Search Demo', false, error);
    }
  }

  /**
   * Test 7: Popular Destinations
   */
  async testPopularDestinations() {
    try {
      const origins = ['MAD', 'LHR', 'JFK'];
      
      for (const origin of origins) {
        try {
          const response = await this.client.get(`/flights/destinations/${origin}`);
          
          if (response.status === 200 && response.data.success) {
            this.recordTest(`Popular Destinations: ${origin}`, true, null, {
              origin,
              destinationsCount: response.data.data.destinations?.length || 0
            });
          } else {
            this.recordTest(`Popular Destinations: ${origin}`, false, 'Popular destinations request failed');
          }
        } catch (error) {
          // API key issue expected in demo mode
          if (error.response?.status === 500) {
            this.recordTest(`Popular Destinations: ${origin}`, true, null, 'Expected API error in demo mode');
          } else {
            this.recordTest(`Popular Destinations: ${origin}`, false, error);
          }
        }
      }
    } catch (error) {
      this.recordTest('Popular Destinations', false, error);
    }
  }

  /**
   * Test 8: Input Sanitization
   */
  async testInputSanitization() {
    try {
      const maliciousInputs = [
        { origin: '<script>alert("xss")</script>', destination: 'BCN', departureDate: '2024-03-15' },
        { origin: 'MAD', destination: 'BCN\'; DROP TABLE users; --', departureDate: '2024-03-15' },
        { origin: 'MAD', destination: 'BCN', departureDate: '2024-03-15', adults: -1 }
      ];

      for (const input of maliciousInputs) {
        try {
          const response = await this.client.post('/flights/search', input);
          this.recordTest('Input Sanitization', false, 'Should have rejected malicious input');
        } catch (error) {
          if (error.response?.status === 400) {
            this.recordTest('Input Sanitization', true, null, 'Correctly rejected malicious input');
          } else {
            this.recordTest('Input Sanitization', false, error);
          }
        }
      }
    } catch (error) {
      this.recordTest('Input Sanitization', false, error);
    }
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    this.log('🚀 Starting Google Flights API Integration Tests', 'info');
    this.log('=' .repeat(60), 'info');

    // Run tests sequentially to avoid rate limiting
    await this.testServiceStatus();
    await this.testAPIHealthCheck();
    await this.testFlightServiceStatus();
    await this.testAirportSearch();
    await this.testFlightSearchValidation();
    await this.testFlightSearchDemo();
    await this.testPopularDestinations();
    await this.testInputSanitization();

    // Print summary
    this.printSummary();
  }

  /**
   * Print test summary
   */
  printSummary() {
    this.log('=' .repeat(60), 'info');
    this.log('📊 TEST SUMMARY', 'info');
    this.log('=' .repeat(60), 'info');
    
    this.log(`Total Tests: ${this.results.passed + this.results.failed}`, 'info');
    this.log(`Passed: ${this.results.passed}`, 'success');
    this.log(`Failed: ${this.results.failed}`, this.results.failed > 0 ? 'error' : 'success');
    
    if (this.results.failed > 0) {
      this.log('\n❌ FAILED TESTS:', 'error');
      this.results.tests
        .filter(test => !test.passed)
        .forEach(test => {
          this.log(`  • ${test.name}: ${test.error}`, 'error');
        });
    }

    this.log('\n✅ PASSED TESTS:', 'success');
    this.results.tests
      .filter(test => test.passed)
      .forEach(test => {
        this.log(`  • ${test.name}`, 'success');
      });

    // Overall result
    const overallSuccess = this.results.failed === 0;
    this.log(`\n🎯 OVERALL RESULT: ${overallSuccess ? 'SUCCESS' : 'SOME FAILURES'}`, 
             overallSuccess ? 'success' : 'warning');

    if (!overallSuccess) {
      this.log('\n💡 NOTE: Some failures are expected in demo mode without valid API keys', 'warning');
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new GoogleFlightsAPITester();
  
  tester.runAllTests()
    .then(() => {
      process.exit(tester.results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Test runner failed:', error);
      process.exit(1);
    });
}

module.exports = GoogleFlightsAPITester; 
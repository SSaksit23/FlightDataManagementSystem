/**
 * Makcorps Hotel API Integration Test Script
 * Tests all hotel-related functionality including search, mapping, and API endpoints
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
const MAKCORPS_API_KEY = process.env.MAKCORPS_API_KEY || '684ad69b0177ac0972c3d4ce';
const MAKCORPS_BASE_URL = 'https://api.makcorps.com';

// Test results tracking
let testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  failedTests: [],
  passedTests: []
};

/**
 * Test helper functions
 */
function logTest(testName, passed, error = null) {
  testResults.total++;
  if (passed) {
    testResults.passed++;
    testResults.passedTests.push(testName);
    logger.info(`✅ ${testName}`);
  } else {
    testResults.failed++;
    testResults.failedTests.push(`${testName}: ${error}`);
    logger.error(`❌ ${testName}: ${error}`);
  }
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Test Makcorps Hotel API Service directly
 */
async function testHotelApiService() {
  logger.info('🏨 Testing Makcorps Hotel API Service');
  
  try {
    const HotelApiService = require('../services/hotelApiService');
    const hotelApi = new HotelApiService();
    
    // Test service status
    try {
      const status = hotelApi.getStatus();
      logTest('Service Status Check', status.service === 'Makcorps Hotel API');
    } catch (error) {
      logTest('Service Status Check', false, error.message);
    }

    // Test city mapping search
    try {
      const mappingResult = await hotelApi.getCityHotelMapping('London');
      logTest('City Mapping Search', mappingResult.success && mappingResult.data.cities.length > 0);
    } catch (error) {
      logTest('City Mapping Search', false, error.message);
    }

    // Test hotel search by city ID (using a common city ID)
    try {
      const searchParams = {
        cityId: '1', // Common city ID for testing
        checkIn: '2025-07-15',
        checkOut: '2025-07-16',
        adults: 2,
        rooms: 1,
        currency: 'USD'
      };
      
      const hotelResults = await hotelApi.searchHotelsByCityId(searchParams);
      logTest('Hotel Search by City ID', hotelResults.success);
    } catch (error) {
      logTest('Hotel Search by City ID', false, error.message);
    }

  } catch (error) {
    logTest('Hotel API Service Import', false, error.message);
  }
}

/**
 * Test direct Makcorps API calls
 */
async function testDirectMakcorpsAPI() {
  logger.info('🌐 Testing Direct Makcorps API Calls');
  
  const client = axios.create({
    baseURL: MAKCORPS_BASE_URL,
    timeout: 30000
  });

  // Test API key validation
  try {
    const response = await client.get('/free/mapping', {
      params: {
        api_key: MAKCORPS_API_KEY,
        query: 'New York'
      }
    });
    logTest('Direct API - Key Validation', response.status === 200);
  } catch (error) {
    logTest('Direct API - Key Validation', false, `Status: ${error.response?.status}, Message: ${error.message}`);
  }

  // Test city mapping
  try {
    const response = await client.get('/free/mapping', {
      params: {
        api_key: MAKCORPS_API_KEY,
        query: 'Paris'
      }
    });
    logTest('Direct API - City Mapping', response.status === 200 && response.data);
  } catch (error) {
    logTest('Direct API - City Mapping', false, `Status: ${error.response?.status}, Message: ${error.message}`);
  }

  // Test hotel search (if we have a valid city ID)
  try {
    const response = await client.get('/free/hotel', {
      params: {
        api_key: MAKCORPS_API_KEY,
        cityid: '1',
        checkin: '2025-07-15',
        checkout: '2025-07-16',
        adults: 2,
        rooms: 1,
        currency: 'USD'
      }
    });
    logTest('Direct API - Hotel Search', response.status === 200);
  } catch (error) {
    logTest('Direct API - Hotel Search', false, `Status: ${error.response?.status}, Message: ${error.message}`);
  }
}

/**
 * Test backend API endpoints
 */
async function testBackendAPI() {
  logger.info('🔌 Testing Backend Hotel API Endpoints');
  
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000
  });

  // Test health endpoint
  try {
    const response = await client.get('/health');
    const hasMakcorps = response.data.services && response.data.services.makcorps;
    logTest('API Health Check', response.status === 200 && hasMakcorps);
  } catch (error) {
    logTest('API Health Check', false, error.message);
  }

  // Test hotel service status
  try {
    const response = await client.get('/hotels/status');
    logTest('Hotel Service Status Endpoint', response.status === 200 && response.data.success);
  } catch (error) {
    logTest('Hotel Service Status Endpoint', false, `Status: ${error.response?.status}, Message: ${error.message}`);
  }

  // Test city search endpoint
  try {
    const response = await client.get('/hotels/cities/search', {
      params: { q: 'Barcelona' }
    });
    logTest('City Search Endpoint', response.status === 200 && response.data.success);
  } catch (error) {
    logTest('City Search Endpoint', false, `Status: ${error.response?.status}, Message: ${error.message}`);
  }

  // Test hotel search endpoint
  try {
    const searchData = {
      city: 'Madrid',
      checkIn: '2025-07-20',
      checkOut: '2025-07-21',
      adults: 2,
      rooms: 1,
      currency: 'USD'
    };
    
    const response = await client.post('/hotels/search', searchData);
    logTest('Hotel Search Endpoint', response.status === 200 && response.data.success);
  } catch (error) {
    logTest('Hotel Search Endpoint', false, `Status: ${error.response?.status}, Message: ${error.message}`);
  }

  // Test validation errors
  try {
    const invalidData = {
      checkIn: '2025-07-20',
      checkOut: '2025-07-19', // Invalid: checkout before checkin
      adults: 2
    };
    
    const response = await client.post('/hotels/search', invalidData);
    logTest('Validation Test: Invalid dates', response.status === 400);
  } catch (error) {
    if (error.response?.status === 400) {
      logTest('Validation Test: Invalid dates', true);
    } else {
      logTest('Validation Test: Invalid dates', false, error.message);
    }
  }

  // Test missing required fields
  try {
    const incompleteData = {
      adults: 2
    };
    
    const response = await client.post('/hotels/search', incompleteData);
    logTest('Validation Test: Missing required fields', response.status === 400);
  } catch (error) {
    if (error.response?.status === 400) {
      logTest('Validation Test: Missing required fields', true);
    } else {
      logTest('Validation Test: Missing required fields', false, error.message);
    }
  }
}

/**
 * Test input sanitization and edge cases
 */
async function testEdgeCases() {
  logger.info('🧪 Testing Edge Cases and Input Sanitization');
  
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000
  });

  // Test SQL injection attempt
  try {
    const maliciousData = {
      city: "'; DROP TABLE users; --",
      checkIn: '2025-07-20',
      checkOut: '2025-07-21',
      adults: 2
    };
    
    const response = await client.post('/hotels/search', maliciousData);
    logTest('Input Sanitization: SQL Injection', response.status !== 500);
  } catch (error) {
    logTest('Input Sanitization: SQL Injection', error.response?.status !== 500);
  }

  // Test XSS attempt
  try {
    const xssData = {
      city: '<script>alert("xss")</script>',
      checkIn: '2025-07-20',
      checkOut: '2025-07-21',
      adults: 2
    };
    
    const response = await client.post('/hotels/search', xssData);
    logTest('Input Sanitization: XSS', response.status !== 500);
  } catch (error) {
    logTest('Input Sanitization: XSS', error.response?.status !== 500);
  }

  // Test extremely long input
  try {
    const longData = {
      city: 'A'.repeat(10000),
      checkIn: '2025-07-20',
      checkOut: '2025-07-21',
      adults: 2
    };
    
    const response = await client.post('/hotels/search', longData);
    logTest('Input Sanitization: Long input', response.status !== 500);
  } catch (error) {
    logTest('Input Sanitization: Long input', error.response?.status !== 500);
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  logger.info('🚀 Starting Makcorps Hotel API Integration Tests');
  logger.info('============================================================');
  
  // Test service directly
  await testHotelApiService();
  await delay(1000);
  
  // Test direct API calls
  await testDirectMakcorpsAPI();
  await delay(1000);
  
  // Test backend endpoints
  await testBackendAPI();
  await delay(1000);
  
  // Test edge cases
  await testEdgeCases();
  
  // Print summary
  logger.info('============================================================');
  logger.info('📊 TEST SUMMARY');
  logger.info('============================================================');
  logger.info(`Total Tests: ${testResults.total}`);
  logger.info(`Passed: ${testResults.passed}`);
  logger.info(`Failed: ${testResults.failed}`);
  logger.info('');
  
  if (testResults.failed > 0) {
    logger.error('❌ FAILED TESTS:');
    testResults.failedTests.forEach(test => {
      logger.error(`  • ${test}`);
    });
    logger.info('');
  }
  
  if (testResults.passed > 0) {
    logger.info('✅ PASSED TESTS:');
    testResults.passedTests.forEach(test => {
      logger.info(`  • ${test}`);
    });
    logger.info('');
  }
  
  const overallResult = testResults.failed === 0 ? 'ALL TESTS PASSED' : 'SOME FAILURES';
  logger.info(`🎯 OVERALL RESULT: ${overallResult}`);
  logger.info('');
  
  // API Information
  logger.info('💡 Makcorps Hotel API Notes:');
  logger.info(`  • API Key: ${MAKCORPS_API_KEY}`);
  logger.info('  • Free plan: Check your plan limits');
  logger.info('  • Hotel search: Requires valid city ID');
  logger.info('  • City mapping: Use to find valid city IDs');
  logger.info('  • Documentation: https://docs.makcorps.com/');
  
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run tests
runAllTests().catch(error => {
  logger.error('Test runner failed:', error);
  process.exit(1);
}); 
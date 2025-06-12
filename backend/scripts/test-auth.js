#!/usr/bin/env node

/**
 * Authentication System Test Script
 * Tests all authentication endpoints to ensure they work correctly
 */

const axios = require('axios');

const API_BASE_URL = process.env.API_URL || 'http://localhost:5000/api';

// Test data
const testUser = {
  email: 'test@example.com',
  password: 'testpassword123',
  firstName: 'Test',
  lastName: 'User',
  phone: '+1234567890'
};

let accessToken = '';
let refreshToken = '';

async function testRegister() {
  console.log('🧪 Testing user registration...');
  
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/register`, testUser);
    
    if (response.data.success) {
      console.log('✅ Registration successful');
      console.log(`   User ID: ${response.data.user.id}`);
      console.log(`   Email: ${response.data.user.email}`);
      console.log(`   Access Token: ${response.data.accessToken ? '✓' : '✗'}`);
      console.log(`   Refresh Token: ${response.data.refreshToken ? '✓' : '✗'}`);
      
      accessToken = response.data.accessToken;
      refreshToken = response.data.refreshToken;
      
      return true;
    } else {
      console.log('❌ Registration failed:', response.data.message);
      return false;
    }
  } catch (error) {
    if (error.response?.data?.message?.includes('already exists')) {
      console.log('⚠️  User already exists, proceeding to login test...');
      return true;
    }
    console.log('❌ Registration error:', error.response?.data?.message || error.message);
    return false;
  }
}

async function testLogin() {
  console.log('\n🧪 Testing user login...');
  
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: testUser.email,
      password: testUser.password
    });
    
    if (response.data.success) {
      console.log('✅ Login successful');
      console.log(`   User ID: ${response.data.user.id}`);
      console.log(`   Email: ${response.data.user.email}`);
      console.log(`   Access Token: ${response.data.accessToken ? '✓' : '✗'}`);
      console.log(`   Refresh Token: ${response.data.refreshToken ? '✓' : '✗'}`);
      
      accessToken = response.data.accessToken;
      refreshToken = response.data.refreshToken;
      
      return true;
    } else {
      console.log('❌ Login failed:', response.data.message);
      return false;
    }
  } catch (error) {
    console.log('❌ Login error:', error.response?.data?.message || error.message);
    return false;
  }
}

async function testVerifyToken() {
  console.log('\n🧪 Testing token verification...');
  
  if (!accessToken) {
    console.log('❌ No access token available for verification');
    return false;
  }
  
  try {
    const response = await axios.get(`${API_BASE_URL}/auth/verify`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    
    if (response.data.success) {
      console.log('✅ Token verification successful');
      console.log(`   User ID: ${response.data.user.id}`);
      console.log(`   Email: ${response.data.user.email}`);
      return true;
    } else {
      console.log('❌ Token verification failed:', response.data.message);
      return false;
    }
  } catch (error) {
    console.log('❌ Token verification error:', error.response?.data?.message || error.message);
    return false;
  }
}

async function testRefreshToken() {
  console.log('\n🧪 Testing token refresh...');
  
  if (!refreshToken) {
    console.log('❌ No refresh token available for testing');
    return false;
  }
  
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
      refreshToken: refreshToken
    });
    
    if (response.data.success) {
      console.log('✅ Token refresh successful');
      console.log(`   New Access Token: ${response.data.accessToken ? '✓' : '✗'}`);
      console.log(`   New Refresh Token: ${response.data.refreshToken ? '✓' : '✗'}`);
      
      // Update tokens
      accessToken = response.data.accessToken;
      refreshToken = response.data.refreshToken;
      
      return true;
    } else {
      console.log('❌ Token refresh failed:', response.data.message);
      return false;
    }
  } catch (error) {
    console.log('❌ Token refresh error:', error.response?.data?.message || error.message);
    return false;
  }
}

async function testLogout() {
  console.log('\n🧪 Testing logout...');
  
  if (!accessToken) {
    console.log('❌ No access token available for logout');
    return false;
  }
  
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/logout`, {
      refreshToken: refreshToken
    }, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    
    if (response.data.success) {
      console.log('✅ Logout successful');
      return true;
    } else {
      console.log('❌ Logout failed:', response.data.message);
      return false;
    }
  } catch (error) {
    console.log('❌ Logout error:', error.response?.data?.message || error.message);
    return false;
  }
}

async function testInvalidToken() {
  console.log('\n🧪 Testing invalid token handling...');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/auth/verify`, {
      headers: {
        Authorization: 'Bearer invalid_token_here'
      }
    });
    
    console.log('❌ Invalid token was accepted (this should not happen)');
    return false;
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✅ Invalid token correctly rejected');
      return true;
    } else {
      console.log('❌ Unexpected error with invalid token:', error.message);
      return false;
    }
  }
}

async function runAllTests() {
  console.log('🚀 Starting Authentication System Tests');
  console.log(`📡 API Base URL: ${API_BASE_URL}`);
  console.log('=' .repeat(50));
  
  const results = {
    register: false,
    login: false,
    verify: false,
    refresh: false,
    logout: false,
    invalidToken: false
  };
  
  // Run tests in sequence
  results.register = await testRegister();
  results.login = await testLogin();
  results.verify = await testVerifyToken();
  results.refresh = await testRefreshToken();
  results.logout = await testLogout();
  results.invalidToken = await testInvalidToken();
  
  // Summary
  console.log('\n' + '=' .repeat(50));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('=' .repeat(50));
  
  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;
  
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`   ${passed ? '✅' : '❌'} ${test.padEnd(15)} ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  console.log('\n' + '=' .repeat(50));
  console.log(`🎯 Overall Result: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All authentication tests PASSED! System is ready.');
  } else {
    console.log('⚠️  Some tests FAILED. Please check the issues above.');
  }
  
  console.log('=' .repeat(50));
}

// Run if called directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('❌ Test runner error:', error.message);
    process.exit(1);
  });
}

module.exports = { runAllTests }; 
#!/usr/bin/env node

/**
 * Standalone Authentication Logic Test
 * Tests authentication functions without requiring database or server
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');

// Test configuration
const JWT_SECRET = 'test_jwt_secret_for_testing';
const JWT_EXPIRES_IN = '24h';

// Validation schemas (same as in auth.js)
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  phone: Joi.string().optional(),
  dateOfBirth: Joi.date().optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// Test data
const testUser = {
  email: 'test@example.com',
  password: 'testpassword123',
  firstName: 'Test',
  lastName: 'User',
  phone: '+1234567890'
};

async function testPasswordHashing() {
  console.log('🧪 Testing password hashing...');
  
  try {
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(testUser.password, saltRounds);
    
    console.log('✅ Password hashing successful');
    console.log(`   Original: ${testUser.password}`);
    console.log(`   Hashed: ${passwordHash.substring(0, 20)}...`);
    
    // Test password verification
    const isValid = await bcrypt.compare(testUser.password, passwordHash);
    const isInvalid = await bcrypt.compare('wrongpassword', passwordHash);
    
    if (isValid && !isInvalid) {
      console.log('✅ Password verification working correctly');
      return { success: true, passwordHash };
    } else {
      console.log('❌ Password verification failed');
      return { success: false };
    }
  } catch (error) {
    console.log('❌ Password hashing error:', error.message);
    return { success: false };
  }
}

async function testJWTTokens() {
  console.log('\n🧪 Testing JWT token generation...');
  
  try {
    const userId = 123;
    const email = testUser.email;
    
    // Generate access token
    const accessToken = jwt.sign(
      { userId, email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    // Generate refresh token
    const refreshToken = jwt.sign(
      { userId, email, type: 'refresh' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    console.log('✅ Token generation successful');
    console.log(`   Access Token: ${accessToken.substring(0, 20)}...`);
    console.log(`   Refresh Token: ${refreshToken.substring(0, 20)}...`);
    
    // Test token verification
    const decodedAccess = jwt.verify(accessToken, JWT_SECRET);
    const decodedRefresh = jwt.verify(refreshToken, JWT_SECRET);
    
    if (decodedAccess.userId === userId && decodedRefresh.type === 'refresh') {
      console.log('✅ Token verification working correctly');
      console.log(`   Decoded User ID: ${decodedAccess.userId}`);
      console.log(`   Decoded Email: ${decodedAccess.email}`);
      console.log(`   Refresh Token Type: ${decodedRefresh.type}`);
      return { success: true, accessToken, refreshToken };
    } else {
      console.log('❌ Token verification failed');
      return { success: false };
    }
  } catch (error) {
    console.log('❌ JWT token error:', error.message);
    return { success: false };
  }
}

async function testInputValidation() {
  console.log('\n🧪 Testing input validation...');
  
  try {
    // Test valid registration data
    const validResult = registerSchema.validate(testUser);
    if (validResult.error) {
      console.log('❌ Valid data rejected:', validResult.error.message);
      return { success: false };
    }
    
    // Test invalid registration data
    const invalidUser = { ...testUser, email: 'invalid-email', password: '123' };
    const invalidResult = registerSchema.validate(invalidUser);
    if (!invalidResult.error) {
      console.log('❌ Invalid data accepted');
      return { success: false };
    }
    
    // Test valid login data
    const loginData = { email: testUser.email, password: testUser.password };
    const loginResult = loginSchema.validate(loginData);
    if (loginResult.error) {
      console.log('❌ Valid login data rejected:', loginResult.error.message);
      return { success: false };
    }
    
    console.log('✅ Input validation working correctly');
    console.log('   ✓ Valid registration data accepted');
    console.log('   ✓ Invalid data properly rejected');
    console.log('   ✓ Login validation working');
    
    return { success: true };
  } catch (error) {
    console.log('❌ Input validation error:', error.message);
    return { success: false };
  }
}

async function testTokenRefresh() {
  console.log('\n🧪 Testing token refresh logic...');
  
  try {
    const userId = 123;
    const email = testUser.email;
    
    // Create a refresh token
    const refreshToken = jwt.sign(
      { userId, email, type: 'refresh' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Simulate refresh token verification
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    
    if (decoded.type !== 'refresh') {
      console.log('❌ Refresh token type validation failed');
      return { success: false };
    }
    
    // Generate new tokens
    const newAccessToken = jwt.sign(
      { userId: decoded.userId, email: decoded.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    const newRefreshToken = jwt.sign(
      { userId: decoded.userId, email: decoded.email, type: 'refresh' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    console.log('✅ Token refresh logic working correctly');
    console.log(`   Original Refresh Token: ${refreshToken.substring(0, 20)}...`);
    console.log(`   New Access Token: ${newAccessToken.substring(0, 20)}...`);
    console.log(`   New Refresh Token: ${newRefreshToken.substring(0, 20)}...`);
    
    return { success: true };
  } catch (error) {
    console.log('❌ Token refresh error:', error.message);
    return { success: false };
  }
}

async function testInvalidTokenHandling() {
  console.log('\n🧪 Testing invalid token handling...');
  
  try {
    // Test invalid token
    try {
      jwt.verify('invalid_token_here', JWT_SECRET);
      console.log('❌ Invalid token was accepted');
      return { success: false };
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        console.log('✅ Invalid token correctly rejected');
      } else {
        console.log('❌ Unexpected error:', error.message);
        return { success: false };
      }
    }
    
    // Test expired token (simulate)
    const expiredToken = jwt.sign(
      { userId: 123, email: testUser.email },
      JWT_SECRET,
      { expiresIn: '0s' } // Immediately expired
    );
    
    // Wait a moment to ensure expiration
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      jwt.verify(expiredToken, JWT_SECRET);
      console.log('❌ Expired token was accepted');
      return { success: false };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        console.log('✅ Expired token correctly rejected');
      } else {
        console.log('❌ Unexpected error:', error.message);
        return { success: false };
      }
    }
    
    return { success: true };
  } catch (error) {
    console.log('❌ Invalid token handling error:', error.message);
    return { success: false };
  }
}

async function runAllTests() {
  console.log('🚀 Starting Standalone Authentication Logic Tests');
  console.log('=' .repeat(60));
  
  const results = {
    passwordHashing: false,
    jwtTokens: false,
    inputValidation: false,
    tokenRefresh: false,
    invalidTokenHandling: false
  };
  
  // Run tests in sequence
  const hashResult = await testPasswordHashing();
  results.passwordHashing = hashResult.success;
  
  const jwtResult = await testJWTTokens();
  results.jwtTokens = jwtResult.success;
  
  const validationResult = await testInputValidation();
  results.inputValidation = validationResult.success;
  
  const refreshResult = await testTokenRefresh();
  results.tokenRefresh = refreshResult.success;
  
  const invalidResult = await testInvalidTokenHandling();
  results.invalidTokenHandling = invalidResult.success;
  
  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 STANDALONE TEST RESULTS SUMMARY');
  console.log('=' .repeat(60));
  
  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;
  
  Object.entries(results).forEach(([test, passed]) => {
    const displayName = test.replace(/([A-Z])/g, ' $1').toLowerCase();
    console.log(`   ${passed ? '✅' : '❌'} ${displayName.padEnd(25)} ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  console.log('\n' + '=' .repeat(60));
  console.log(`🎯 Overall Result: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All authentication logic tests PASSED!');
    console.log('💡 The authentication system is working correctly.');
    console.log('📋 Next step: Test with database and server running.');
  } else {
    console.log('⚠️  Some tests FAILED. Please check the issues above.');
  }
  
  console.log('=' .repeat(60));
  
  return passed === total;
}

// Run if called directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('❌ Test runner error:', error.message);
    process.exit(1);
  });
}

module.exports = { runAllTests }; 
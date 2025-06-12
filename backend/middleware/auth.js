// backend/middleware/auth.js
const jwt = require('jsonwebtoken');
const pool = require('../models/database');
const winston = require('winston');

// Configure logger for this middleware
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'auth-middleware' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
    // Removed file transports to avoid logs directory issues
  ]
});

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (token == null) {
    logger.warn('Authentication token required but not provided.', { path: req.path });
    return res.status(401).json({ 
      success: false,
      message: 'Authentication token required.' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_jwt_secret_change_in_production');
    
    // Get user from database
    const result = await pool.query(
      'SELECT id, email, first_name, last_name, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );
    
    if (result.rows.length === 0) {
      logger.warn(`User not found for token. User ID: ${decoded.userId}`, { path: req.path });
      return res.status(403).json({ 
        success: false,
        message: 'User not found for this token.' 
      });
    }
    
    const user = result.rows[0];
    
    // Check if user is active
    if (!user.is_active) {
      logger.warn(`Inactive user attempted access. User ID: ${user.id}`, { path: req.path });
      return res.status(403).json({ 
        success: false,
        message: 'Account is deactivated.' 
      });
    }
    
    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name
    };
    
    logger.info(`User authenticated: ${user.email} (ID: ${user.id})`, { path: req.path });
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      logger.warn('Token expired.', { error: err.message, path: req.path });
      return res.status(401).json({ 
        success: false,
        message: 'Token expired. Please log in again.' 
      });
    }
    if (err.name === 'JsonWebTokenError') {
      logger.warn('Invalid token.', { error: err.message, path: req.path });
      return res.status(403).json({ 
        success: false,
        message: 'Invalid token.' 
      });
    }
    logger.error("Token verification failed.", { error: err.message, stack: err.stack, path: req.path });
    return res.status(403).json({ 
      success: false,
      message: 'Token verification failed.' 
    });
  }
};

// Simplified authentication middleware for basic tour operator system
// Additional role-based middleware can be added later as needed

module.exports = {
  authenticateToken
};

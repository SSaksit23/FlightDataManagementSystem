const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const winston = require('winston');
const Amadeus = require('amadeus');
const rateLimit = require('express-rate-limit');
const http = require('http'); // For Socket.IO and graceful shutdown
const { Server } = require("socket.io"); // For Socket.IO

// Load environment variables
dotenv.config();

// --- Custom Modules ---
const { pool, connectRedis, redisClient: directRedisClient } = require('./models/database'); // Assuming redisClient is exported after connection
const authRoutes = require('./routes/auth');
const flightRoutes = require('./routes/flights');
const hotelRoutes = require('./routes/hotels');
const tripCustomizationRoutes = require('./routes/tripCustomization');
// const providerRoutes = require('./routes/providers'); // Temporarily disabled - complex provider system
const tripRoutes = require('./routes/trips');
const searchRoutes = require('./routes/search');
// const recommendationsRoutes = require('./routes/recommendations'); // Temporarily disabled

// --- Winston Logger Setup ---
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'adventureconnect-api' },
  transports: [
    // File logging disabled to avoid directory issues in Docker
    // new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    // new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}

// Morgan stream for HTTP request logging through Winston
const morganStream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

// --- Initialize Express App ---
const app = express();
const server = http.createServer(app); // Create HTTP server for Express and Socket.IO
const port = process.env.PORT || 5000;

// --- Initialize Amadeus Client ---
// Ensure AMADEUS_CLIENT_ID, AMADEUS_CLIENT_SECRET, and AMADEUS_HOSTNAME are set in your .env file
const amadeus = new Amadeus({
  clientId: process.env.AMADEUS_CLIENT_ID,
  clientSecret: process.env.AMADEUS_CLIENT_SECRET,
  hostname: process.env.AMADEUS_HOSTNAME || 'test', // Defaults to test environment
  logger: logger, 
  logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'silent'
});

// --- Connect to Redis ---
let redisClientInstance;
connectRedis()
  .then(client => {
    redisClientInstance = client;
    logger.info('Redis connected successfully for the main application.');
  })
  .catch(err => {
    logger.error('Failed to connect to Redis for the main application:', err);
    // Potentially exit or run in a degraded mode
  });

// --- Socket.IO Setup ---
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  logger.info(`Socket.IO: User connected ${socket.id}`);
  socket.on('disconnect', () => {
    logger.info(`Socket.IO: User disconnected ${socket.id}`);
  });
});
app.set('socketio', io);


// --- Core Middleware ---
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(helmet()); 
app.use(compression()); 
app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ extended: true, limit: '10mb' })); 
app.use(morgan(':method :url :status :res[content-length] - :response-time ms', { stream: morganStream }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// --- Rate Limiting ---
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 200, 
  standardHeaders: true, 
  legacyHeaders: false, 
  message: 'Too many requests from this IP, please try again after 15 minutes.',
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit exceeded for IP ${req.ip}`, { path: req.path, limit: options.max, windowMs: options.windowMs });
    res.status(options.statusCode).json({ message: options.message });
  }
});
app.use(generalLimiter);

const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, 
  max: 10, 
  message: 'Too many authentication attempts, please try again after 5 minutes.',
  handler: (req, res, next, options) => {
    logger.warn(`Auth rate limit exceeded for IP ${req.ip}`, { path: req.path, limit: options.max, windowMs: options.windowMs });
    res.status(options.statusCode).json({ message: options.message });
  }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);


// --- API Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/flights', flightRoutes);
app.use('/api/hotels', hotelRoutes);
app.use('/api/trip-customization', tripCustomizationRoutes);
// app.use('/api/providers', providerRoutes); // Temporarily disabled
app.use('/api/trips', tripRoutes);
app.use('/api/search', searchRoutes);
// app.use('/api/recommendations', recommendationsRoutes); // Temporarily disabled

// Health Check Endpoint
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    const dbStatus = 'Connected';

    let redisStatus = 'Disconnected';
    if (redisClientInstance && redisClientInstance.isOpen) {
        await redisClientInstance.ping();
        redisStatus = 'Connected';
    } else if (directRedisClient && directRedisClient.isOpen) { 
        await directRedisClient.ping();
        redisStatus = 'Connected';
    }

    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      message: 'AdventureConnect Backend is running and healthy!',
      services: {
        database: dbStatus,
        redis: redisStatus,
        amadeus: 'Configured',
        flightapi: process.env.FLIGHTAPI_KEY ? 'Configured' : 'Not Configured',
        makcorps: process.env.MAKCORPS_API_KEY ? 'Configured' : 'Not Configured',
        tripCustomization: 'Operational'
      },
      uptime: process.uptime() 
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'Service Unavailable',
      timestamp: new Date().toISOString(),
      message: 'One or more services are down.',
      error: error.message,
      details: {
        database: error.message.includes('database') || error.message.includes('PostgreSQL') ? 'Error' : 'Connected',
        redis: error.message.includes('redis') ? 'Error' : 'Connected',
      }
    });
  }
});


// --- 404 Not Found Handler ---
app.use((req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.status = 404;
  next(error);
});

// --- Global Error Handler ---
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error(`${err.status || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`, {
    error: {
      message: err.message,
      status: err.status,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined, 
      path: req.originalUrl,
      method: req.method,
      ip: req.ip
    }
  });

  res.status(err.status || 500);
  res.json({
    error: {
      message: err.message || 'An unexpected error occurred.',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
});

// --- Start Server and Graceful Shutdown ---
const startServer = () => {
  server.listen(port, '0.0.0.0', () => {
    logger.info(`🚀 AdventureConnect Backend running on port ${port} in ${process.env.NODE_ENV || 'development'} mode`);
    logger.info(`✅ Health check available at http://localhost:${port}/api/health`);
    logger.info('Press Ctrl-C to stop\n');
  });
};

const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    logger.info('HTTP server closed.');
    try {
      await pool.end();
      logger.info('PostgreSQL pool has ended.');
    } catch (e) {
      logger.error('Error closing PostgreSQL pool:', e);
    }
    try {
      if (redisClientInstance && redisClientInstance.isOpen) {
        await redisClientInstance.quit();
        logger.info('Redis client disconnected.');
      } else if (directRedisClient && directRedisClient.isOpen) {
        await directRedisClient.quit();
        logger.info('Direct Redis client disconnected.');
      }
    } catch (e) {
      logger.error('Error closing Redis client:', e);
    }
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT')); 

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException').then(() => process.exit(1));
});

startServer();

module.exports = app;

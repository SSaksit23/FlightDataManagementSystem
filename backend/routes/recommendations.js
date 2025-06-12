// backend/routes/recommendations.js
const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { authenticateToken } = require('../middleware/auth');
const recommendationEngine = require('../services/recommendationEngine');
const winston = require('winston');

// Configure logger for this route
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'recommendations-routes' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple())
    }),
    new winston.transports.File({ filename: 'logs/recommendations-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/recommendations.log' })
  ]
});

/**
 * @swagger
 * tags:
 *   name: Recommendations
 *   description: AI-powered travel recommendations
 */

// --- Validation Schemas ---

const budgetAnalysisSchema = Joi.object({
  budgetAmount: Joi.number().positive().required(),
  tripDurationDays: Joi.number().integer().min(1).required(),
  numTravelers: Joi.number().integer().min(1).required(),
  preferences: Joi.object({
    travelStyle: Joi.string().valid('budget', 'mid-range', 'luxury', 'backpacker', 'family', 'adventure').optional(),
    interests: Joi.array().items(Joi.string()).optional()
  }).optional().default({})
});

const destinationRecsSchema = Joi.object({
  destinationName: Joi.string().trim().min(2).required(),
  preferences: Joi.object({
    interests: Joi.array().items(Joi.string()).optional(),
    activityTypes: Joi.array().items(Joi.string()).optional(), // e.g., 'sightseeing', 'culture', 'nature'
    // Add more preference fields as needed
  }).optional().default({}),
  budgetCategory: Joi.string().valid(...Object.values(recommendationEngine.BUDGET_CATEGORIES)).optional()
});

const itineraryGenSchema = Joi.object({
  destination: Joi.string().trim().min(2).required(),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
  numTravelers: Joi.number().integer().min(1).required(),
  budgetAmount: Joi.number().positive().required(),
  preferences: Joi.object({
    travelStyle: Joi.string().optional(),
    interests: Joi.array().items(Joi.string()).optional(),
    pace: Joi.string().valid('relaxed', 'moderate', 'fast-paced').optional()
  }).optional().default({})
});

const budgetOptimizeSchema = Joi.object({
  tripComponents: Joi.array().items(
    Joi.object({
      id: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
      title: Joi.string().required(),
      component_type: Joi.string().required(),
      price: Joi.number().min(0).required(),
      // Add other relevant fields from trip_components if needed for optimization logic
    })
  ).min(1).required(),
  targetBudgetCategory: Joi.string().valid(...Object.values(recommendationEngine.BUDGET_CATEGORIES)).required()
});

// --- API Routes ---

/**
 * @swagger
 * /api/recommendations/budget-analysis:
 *   post:
 *     summary: Analyze user budget and provide category and suggestions
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               budgetAmount:
 *                 type: number
 *                 example: 1000
 *               tripDurationDays:
 *                 type: integer
 *                 example: 7
 *               numTravelers:
 *                 type: integer
 *                 example: 2
 *               preferences:
 *                 type: object
 *                 properties:
 *                   travelStyle:
 *                     type: string
 *                     example: "mid-range"
 *     responses:
 *       200:
 *         description: Budget analysis successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 budgetCategory:
 *                   type: string
 *                 budgetPerDayPerPerson:
 *                   type: number
 *                 suggestions:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post('/budget-analysis', authenticateToken, async (req, res) => {
  try {
    const { error, value } = budgetAnalysisSchema.validate(req.body);
    if (error) {
      logger.warn('Budget analysis validation error:', { error: error.details[0].message, input: req.body });
      return res.status(400).json({ message: error.details[0].message });
    }

    const { budgetAmount, tripDurationDays, numTravelers, preferences } = value;
    const analysis = await recommendationEngine.analyzeUserBudget(budgetAmount, tripDurationDays, numTravelers, preferences);
    res.status(200).json(analysis);
  } catch (err) {
    logger.error('Error in budget analysis route:', { error: err.message, stack: err.stack });
    res.status(500).json({ message: 'Failed to analyze budget', error: err.message });
  }
});

/**
 * @swagger
 * /api/recommendations/destination:
 *   post:
 *     summary: Get destination-specific recommendations for activities and hotels
 *     tags: [Recommendations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               destinationName:
 *                 type: string
 *                 example: "Paris"
 *               preferences:
 *                 type: object
 *                 properties:
 *                   interests:
 *                     type: array
 *                     items:
 *                       type: string
 *                     example: ["art", "history"]
 *               budgetCategory:
 *                 type: string
 *                 enum: ["budget", "mid-range", "luxury"]
 *                 example: "mid-range"
 *     responses:
 *       200:
 *         description: Destination recommendations retrieved
 *       400:
 *         description: Invalid input
 */
router.post('/destination', async (req, res) => { // Public endpoint
  try {
    const { error, value } = destinationRecsSchema.validate(req.body);
    if (error) {
      logger.warn('Destination recommendation validation error:', { error: error.details[0].message, input: req.body });
      return res.status(400).json({ message: error.details[0].message });
    }

    const { destinationName, preferences, budgetCategory } = value;
    const recommendations = await recommendationEngine.getDestinationRecommendations(destinationName, preferences, budgetCategory);
    res.status(200).json(recommendations);
  } catch (err) {
    logger.error('Error in destination recommendations route:', { error: err.message, stack: err.stack });
    res.status(500).json({ message: 'Failed to get destination recommendations', error: err.message });
  }
});

/**
 * @swagger
 * /api/recommendations/itinerary:
 *   post:
 *     summary: Generate a personalized itinerary
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               destination:
 *                 type: string
 *                 example: "Kyoto"
 *               startDate:
 *                 type: string
 *                 format: date
 *                 example: "2025-10-01"
 *               endDate:
 *                 type: string
 *                 format: date
 *                 example: "2025-10-05"
 *               numTravelers:
 *                 type: integer
 *                 example: 1
 *               budgetAmount:
 *                 type: number
 *                 example: 700
 *               preferences:
 *                 type: object
 *                 properties:
 *                   interests: ["temples", "nature"]
 *                   pace: "moderate"
 *     responses:
 *       200:
 *         description: Personalized itinerary generated
 *       400:
 *         description: Invalid input
 */
router.post('/itinerary', authenticateToken, async (req, res) => {
  try {
    const { error, value } = itineraryGenSchema.validate(req.body);
    if (error) {
      logger.warn('Itinerary generation validation error:', { error: error.details[0].message, input: req.body });
      return res.status(400).json({ message: error.details[0].message });
    }

    const itinerary = await recommendationEngine.generatePersonalizedItinerary(req.user.id, value);
    res.status(200).json(itinerary);
  } catch (err) {
    logger.error('Error in itinerary generation route:', { error: err.message, stack: err.stack });
    res.status(500).json({ message: 'Failed to generate itinerary', error: err.message });
  }
});

/**
 * @swagger
 * /api/recommendations/provider-match/{providerId}:
 *   get:
 *     summary: Score how well a provider matches the current user's preferences
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: providerId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the provider profile
 *     responses:
 *       200:
 *         description: Provider match score retrieved
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Provider not found
 */
router.get('/provider-match/:providerId', authenticateToken, async (req, res) => {
  try {
    const providerId = parseInt(req.params.providerId, 10);
    if (isNaN(providerId)) {
      return res.status(400).json({ message: 'Invalid provider ID.' });
    }

    const matchResult = await recommendationEngine.scoreProviderMatch(req.user.id, providerId);
    if (matchResult.matchReasons.includes("User or provider not found.")) {
        return res.status(404).json({ message: "User or provider profile not found." });
    }
    res.status(200).json(matchResult);
  } catch (err) {
    logger.error('Error in provider match route:', { error: err.message, stack: err.stack, userId: req.user.id, providerId: req.params.providerId });
    res.status(500).json({ message: 'Failed to score provider match', error: err.message });
  }
});

/**
 * @swagger
 * /api/recommendations/budget-optimize:
 *   post:
 *     summary: Suggest budget optimizations for a given set of trip components
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tripComponents:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string # or integer
 *                     title:
 *                       type: string
 *                     component_type:
 *                       type: string
 *                     price:
 *                       type: number
 *                 example: [{ "id": "comp1", "title": "Luxury Hotel Stay", "component_type": "accommodation", "price": 300 }]
 *               targetBudgetCategory:
 *                 type: string
 *                 enum: ["budget", "mid-range", "luxury"]
 *                 example: "mid-range"
 *     responses:
 *       200:
 *         description: Budget optimization suggestions retrieved
 *       400:
 *         description: Invalid input
 */
router.post('/budget-optimize', authenticateToken, async (req, res) => {
  try {
    const { error, value } = budgetOptimizeSchema.validate(req.body);
    if (error) {
      logger.warn('Budget optimization validation error:', { error: error.details[0].message, input: req.body });
      return res.status(400).json({ message: error.details[0].message });
    }

    const { tripComponents, targetBudgetCategory } = value;
    const optimizationResult = await recommendationEngine.suggestBudgetOptimizations(tripComponents, targetBudgetCategory);
    res.status(200).json(optimizationResult);
  } catch (err) {
    logger.error('Error in budget optimization route:', { error: err.message, stack: err.stack });
    res.status(500).json({ message: 'Failed to suggest budget optimizations', error: err.message });
  }
});

/**
 * @swagger
 * /api/recommendations/seasonal/{destination}/{month}:
 *   get:
 *     summary: Get seasonal recommendations for a destination and month
 *     tags: [Recommendations]
 *     parameters:
 *       - in: path
 *         name: destination
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the destination
 *         example: Paris
 *       - in: path
 *         name: month
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *         description: Month of travel (1-12)
 *         example: 7
 *     responses:
 *       200:
 *         description: Seasonal recommendations retrieved
 *       400:
 *         description: Invalid input (e.g., invalid month)
 */
router.get('/seasonal/:destination/:month', async (req, res) => { // Public endpoint
  try {
    const destinationName = req.params.destination;
    const month = parseInt(req.params.month, 10);

    if (isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ message: 'Invalid month. Must be between 1 and 12.' });
    }
    if (!destinationName || destinationName.trim().length < 2) {
      return res.status(400).json({ message: 'Invalid destination name.' });
    }

    const seasonalRecs = await recommendationEngine.getSeasonalRecommendations(destinationName, month);
    res.status(200).json(seasonalRecs);
  } catch (err) {
    logger.error('Error in seasonal recommendations route:', { error: err.message, stack: err.stack, params: req.params });
    res.status(500).json({ message: 'Failed to get seasonal recommendations', error: err.message });
  }
});

module.exports = router;

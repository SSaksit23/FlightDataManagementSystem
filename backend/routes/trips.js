const express = require('express');
const router = express.Router();
const Joi = require('joi');
const Amadeus = require('amadeus');
const { authenticateToken } = require('../middleware/auth');
const {
  customTripModel,
  tripComponentModel,
  listingModel, // For example itineraries/templates
  aiTripSuggestionModel,
  bookingModel,
  userModel, // For traveler details
  // paymentModel, // For payment processing during booking
  // notificationModel // For notifications after booking
} = require('../models/database');
const { generateBookingReference } = require('../utils/bookingUtils'); // Assuming a utility function
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Initialize Amadeus client (ensure environment variables are set)
const amadeus = new Amadeus({
  clientId: process.env.AMADEUS_CLIENT_ID,
  clientSecret: process.env.AMADEUS_CLIENT_SECRET,
  hostname: process.env.AMADEUS_HOSTNAME || 'test' // Default to test environment
});

// Configure Multer for AI image uploads
const aiImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '..', 'uploads', 'ai_inspiration_images', req.user.id.toString());
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const aiImageFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images are allowed for AI inspiration.'), false);
  }
};

const aiUpload = multer({
  storage: aiImageStorage,
  fileFilter: aiImageFileFilter,
  limits: { fileSize: 1024 * 1024 * 10 } // 10MB limit for AI images
});

// Helper function to calculate total trip cost
const calculateTotalTripCost = async (tripId) => {
  const components = await tripComponentModel.getByTripId(tripId);
  return components.reduce((total, component) => total + parseFloat(component.price || 0), 0);
};

// ====================================
// Custom Trip CRUD Routes
// ====================================

const customTripSchema = Joi.object({
  title: Joi.string().max(255).required(),
  description: Joi.string().optional().allow(null, ''),
  start_date: Joi.date().iso().optional().allow(null),
  end_date: Joi.date().iso().optional().allow(null).min(Joi.ref('start_date')),
  number_of_travelers: Joi.number().integer().min(1).optional().allow(null),
  inspiration_source: Joi.string().valid('example_trip', 'ai_image', 'manual').optional().allow(null),
  inspiration_reference_id: Joi.number().integer().optional().allow(null),
  // Fields that might be updated but not strictly part of initial creation schema
  currency: Joi.string().length(3).optional().default('USD'),
  status: Joi.string().valid('draft', 'planned', 'booked', 'completed', 'cancelled').optional(),
  destinations: Joi.string().optional().allow(null, ''), // Added for Step2CoreDetails
  ai_image_url: Joi.string().uri().optional().allow(null, ''),
  ai_suggestion_id: Joi.number().integer().optional().allow(null)
});

// POST /api/trips/custom - Create a new custom trip
router.post('/custom', authenticateToken, async (req, res) => {
  try {
    const { error } = customTripSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const tripData = {
      ...req.body,
      traveler_id: req.user.id,
      status: req.body.status || 'draft' // Initial status
    };
    const newTrip = await customTripModel.create(tripData);
    res.status(201).json(newTrip);
  } catch (err) {
    console.error('Error creating custom trip:', err);
    res.status(500).json({ message: 'Failed to create custom trip', error: err.message });
  }
});

// GET /api/trips/custom - Get all custom trips for the logged-in traveler
router.get('/custom', authenticateToken, async (req, res) => {
  try {
    const trips = await customTripModel.getByTravelerId(req.user.id, req.query.status);
    res.status(200).json(trips);
  } catch (err) {
    console.error('Error fetching custom trips:', err);
    res.status(500).json({ message: 'Failed to fetch custom trips', error: err.message });
  }
});

// GET /api/trips/custom/:tripId - Get a specific custom trip with its components
router.get('/custom/:tripId', authenticateToken, async (req, res) => {
  try {
    const { tripId } = req.params;
    const trip = await customTripModel.getWithComponents(tripId);

    if (!trip) return res.status(404).json({ message: 'Custom trip not found.' });
    if (trip.traveler_id !== req.user.id && req.user.role !== 'admin') { // Admins can view any trip
      return res.status(403).json({ message: 'You are not authorized to view this trip.' });
    }
    res.status(200).json(trip);
  } catch (err) {
    console.error('Error fetching custom trip details:', err);
    res.status(500).json({ message: 'Failed to fetch custom trip details', error: err.message });
  }
});

// PUT /api/trips/custom/:tripId - Update a custom trip
router.put('/custom/:tripId', authenticateToken, async (req, res) => {
  try {
    const { tripId } = req.params;
    // Use a less strict schema for updates, or allow partial updates
    const updateSchema = customTripSchema.keys({
        title: Joi.string().max(255).optional(), // Title might be optional on update
        // Add other fields as optional if they can be updated partially
    });
    const { error } = updateSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const existingTrip = await customTripModel.findById(tripId);
    if (!existingTrip) return res.status(404).json({ message: 'Custom trip not found.' });
    if (existingTrip.traveler_id !== req.user.id) {
      return res.status(403).json({ message: 'You are not authorized to update this trip.' });
    }
    if (existingTrip.status === 'booked' || existingTrip.status === 'completed') {
        return res.status(403).json({ message: `Cannot update trip with status: ${existingTrip.status}` });
    }

    const updatedTripData = { ...req.body };
    // Recalculate total price if components exist, or allow manual override if needed
    // This should ideally be done when components are added/removed, not on general trip update
    // unless specific price fields are being updated.
    // updatedTripData.total_price = await calculateTotalTripCost(tripId); 

    const updatedTrip = await customTripModel.update(tripId, updatedTripData);
    res.status(200).json(updatedTrip);
  } catch (err) {
    console.error('Error updating custom trip:', err);
    res.status(500).json({ message: 'Failed to update custom trip', error: err.message });
  }
});

// DELETE /api/trips/custom/:tripId - Delete a custom trip
router.delete('/custom/:tripId', authenticateToken, async (req, res) => {
  try {
    const { tripId } = req.params;
    const existingTrip = await customTripModel.findById(tripId);
    if (!existingTrip) return res.status(404).json({ message: 'Custom trip not found.' });
    if (existingTrip.traveler_id !== req.user.id) {
      return res.status(403).json({ message: 'You are not authorized to delete this trip.' });
    }
    if (existingTrip.status === 'booked' || existingTrip.status === 'completed') {
        return res.status(403).json({ message: `Cannot delete trip with status: ${existingTrip.status}` });
    }

    await tripComponentModel.deleteByTripId(tripId); 
    await customTripModel.delete(tripId);
    res.status(200).json({ message: 'Custom trip deleted successfully.' });
  } catch (err) {
    console.error('Error deleting custom trip:', err);
    res.status(500).json({ message: 'Failed to delete custom trip', error: err.message });
  }
});

// ====================================
// Trip Component CRUD Routes
// ====================================

const tripComponentSchema = Joi.object({
  component_type: Joi.string().valid('accommodation', 'activity', 'transportation', 'meal', 'guide', 'flight', 'other').required(),
  service_component_id: Joi.number().integer().optional().allow(null), 
  listing_id: Joi.number().integer().optional().allow(null), 
  external_provider: Joi.string().max(255).optional().allow(null, ''),
  external_reference_id: Joi.string().max(255).optional().allow(null, ''),
  title: Joi.string().max(255).required(),
  description: Joi.string().optional().allow(null, ''),
  start_date: Joi.date().iso().optional().allow(null),
  end_date: Joi.date().iso().optional().allow(null).min(Joi.ref('start_date')),
  start_time: Joi.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().allow(null), // HH:MM
  end_time: Joi.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().allow(null),   // HH:MM
  location_id: Joi.number().integer().optional().allow(null),
  custom_location: Joi.object().optional().allow(null), 
  price: Joi.number().min(0).required(),
  currency: Joi.string().length(3).default('USD'),
  status: Joi.string().valid('planned', 'booked', 'completed', 'cancelled').default('planned'),
  notes: Joi.string().optional().allow(null, '')
});

// POST /api/trips/custom/:tripId/components - Add a component to a custom trip
router.post('/custom/:tripId/components', authenticateToken, async (req, res) => {
  try {
    const { tripId } = req.params;
    const { error } = tripComponentSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const trip = await customTripModel.findById(tripId);
    if (!trip) return res.status(404).json({ message: 'Custom trip not found.' });
    if (trip.traveler_id !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized.' });
    }
    if (trip.status === 'booked' || trip.status === 'completed') {
        return res.status(403).json({ message: `Cannot add components to trip with status: ${trip.status}` });
    }

    const componentData = { ...req.body, trip_id: parseInt(tripId) };
    const newComponent = await tripComponentModel.create(componentData);

    const newTotalPrice = await calculateTotalTripCost(tripId);
    await customTripModel.update(tripId, { total_price: newTotalPrice });

    res.status(201).json(newComponent);
  } catch (err) {
    console.error('Error adding trip component:', err);
    res.status(500).json({ message: 'Failed to add trip component', error: err.message });
  }
});

router.get('/custom/:tripId/components', authenticateToken, async (req, res) => {
    try {
      const { tripId } = req.params;
      const trip = await customTripModel.findById(tripId);
      if (!trip) return res.status(404).json({ message: 'Custom trip not found.' });
      if (trip.traveler_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Unauthorized.' });
      }
      const components = await tripComponentModel.getByTripId(tripId);
      res.status(200).json(components);
    } catch (err) {
      console.error('Error fetching trip components:', err);
      res.status(500).json({ message: 'Failed to fetch trip components', error: err.message });
    }
  });

router.put('/custom/:tripId/components/:componentId', authenticateToken, async (req, res) => {
  try {
    const { tripId, componentId } = req.params;
    const { error } = tripComponentSchema.validate(req.body); 
    if (error) return res.status(400).json({ message: error.details[0].message });

    const trip = await customTripModel.findById(tripId);
    if (!trip) return res.status(404).json({ message: 'Custom trip not found.' });
    if (trip.traveler_id !== req.user.id) return res.status(403).json({ message: 'Unauthorized.' });
    if (trip.status === 'booked' || trip.status === 'completed') {
        return res.status(403).json({ message: `Cannot update components for trip with status: ${trip.status}` });
    }

    const component = await tripComponentModel.findById(componentId);
    if (!component || component.trip_id !== parseInt(tripId)) {
      return res.status(404).json({ message: 'Trip component not found or does not belong to this trip.' });
    }

    const updatedComponent = await tripComponentModel.update(componentId, req.body);

    const newTotalPrice = await calculateTotalTripCost(tripId);
    await customTripModel.update(tripId, { total_price: newTotalPrice });

    res.status(200).json(updatedComponent);
  } catch (err) {
    console.error('Error updating trip component:', err);
    res.status(500).json({ message: 'Failed to update trip component', error: err.message });
  }
});

router.delete('/custom/:tripId/components/:componentId', authenticateToken, async (req, res) => {
  try {
    const { tripId, componentId } = req.params;

    const trip = await customTripModel.findById(tripId);
    if (!trip) return res.status(404).json({ message: 'Custom trip not found.' });
    if (trip.traveler_id !== req.user.id) return res.status(403).json({ message: 'Unauthorized.' });
    if (trip.status === 'booked' || trip.status === 'completed') {
        return res.status(403).json({ message: `Cannot delete components from trip with status: ${trip.status}` });
    }

    const component = await tripComponentModel.findById(componentId);
    if (!component || component.trip_id !== parseInt(tripId)) {
      return res.status(404).json({ message: 'Trip component not found or does not belong to this trip.' });
    }

    await tripComponentModel.delete(componentId);

    const newTotalPrice = await calculateTotalTripCost(tripId);
    await customTripModel.update(tripId, { total_price: newTotalPrice });

    res.status(200).json({ message: 'Trip component deleted successfully.' });
  } catch (err) {
    console.error('Error deleting trip component:', err);
    res.status(500).json({ message: 'Failed to delete trip component', error: err.message });
  }
});

// ====================================
// AI Image Analysis for Trip Inspiration
// ====================================

router.post('/inspire/image', authenticateToken, aiUpload.single('inspirationImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file uploaded.' });
    }

    const imageUrl = `/uploads/ai_inspiration_images/${req.user.id}/${req.file.filename}`;
    console.log(`AI Image Uploaded: ${imageUrl}. User: ${req.user.id}. TODO: Process image for suggestions.`);

    const placeholderSuggestion = {
      user_id: req.user.id,
      image_url: imageUrl,
      suggested_destinations: { message: "AI processing pending for destinations." },
      suggested_activities: { message: "AI processing pending for activities." },
      suggested_example_trips: { message: "AI processing pending for example trips." },
      processing_status: 'pending'
    };
    const suggestionRecord = await aiTripSuggestionModel.create(placeholderSuggestion);

    res.status(202).json({
      message: 'Image uploaded successfully. AI analysis is pending.',
      imageUrl: imageUrl,
      suggestionId: suggestionRecord.id,
    });
  } catch (err) {
    console.error('Error processing AI inspiration image:', err);
    res.status(500).json({ message: 'Failed to process AI inspiration image', error: err.message });
  }
});

router.get('/inspire/suggestions/:suggestionId', authenticateToken, async (req, res) => {
    try {
        const { suggestionId } = req.params;
        const suggestion = await aiTripSuggestionModel.findById(suggestionId);

        if (!suggestion) return res.status(404).json({ message: 'AI suggestion not found.' });
        if (suggestion.user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Unauthorized to view this suggestion.' });
        }
        res.status(200).json(suggestion);
    } catch (err) {
        console.error('Error fetching AI suggestion:', err);
        res.status(500).json({ message: 'Failed to fetch AI suggestion', error: err.message });
    }
});

// ====================================
// Trip Cost Calculation Route
// ====================================

router.get('/custom/:tripId/cost', authenticateToken, async (req, res) => {
  try {
    const { tripId } = req.params;
    const trip = await customTripModel.findById(tripId);

    if (!trip) return res.status(404).json({ message: 'Custom trip not found.' });
    if (trip.traveler_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized.' });
    }

    const components = await tripComponentModel.getByTripId(tripId);
    const totalCost = components.reduce((total, component) => total + parseFloat(component.price || 0), 0);

    if (parseFloat(trip.total_price) !== totalCost) {
        await customTripModel.update(tripId, { total_price: totalCost });
        trip.total_price = totalCost; 
    }

    res.status(200).json({
      tripId: trip.id,
      title: trip.title,
      total_price: totalCost,
      currency: trip.currency || 'USD',
      number_of_travelers: trip.number_of_travelers,
      cost_per_person: trip.number_of_travelers > 0 ? totalCost / trip.number_of_travelers : totalCost,
      components: components.map(c => ({
        id: c.id,
        title: c.title,
        type: c.component_type,
        price: c.price,
        currency: c.currency
      }))
    });
  } catch (err) {
    console.error('Error calculating trip cost:', err);
    res.status(500).json({ message: 'Failed to calculate trip cost', error: err.message });
  }
});

// ====================================
// Trip Booking and Confirmation
// ====================================
const bookingSchema = Joi.object({
    special_requests: Joi.string().optional().allow(null, ''),
    traveler_contact_info: Joi.object({ 
        phone: Joi.string().optional().allow(null, ''),
        email: Joi.string().email().optional().allow(null, '') 
    }).optional()
});

router.post('/custom/:tripId/book', authenticateToken, async (req, res) => {
  try {
    const { tripId } = req.params;
    const { error } = bookingSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const trip = await customTripModel.getWithComponents(tripId);
    if (!trip) return res.status(404).json({ message: 'Custom trip not found.' });
    if (trip.traveler_id !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized to book this trip.' });
    }
    if (trip.status !== 'draft' && trip.status !== 'planned') {
      return res.status(400).json({ message: `Trip cannot be booked. Current status: ${trip.status}` });
    }
    if (!trip.components || trip.components.length === 0) {
        return res.status(400).json({ message: 'Trip has no components and cannot be booked.' });
    }

    const paymentSuccessful = true; 

    if (!paymentSuccessful) {
      return res.status(402).json({ message: 'Payment failed.' }); 
    }

    const bookingReference = generateBookingReference(); 
    const bookingData = {
      booking_reference: bookingReference,
      traveler_id: req.user.id,
      custom_trip_id: trip.id,
      listing_id: null, 
      start_date: trip.start_date,
      end_date: trip.end_date,
      number_of_travelers: trip.number_of_travelers,
      total_price: trip.total_price,
      currency: trip.currency || 'USD',
      status: 'confirmed', 
      special_requests: req.body.special_requests,
      traveler_contact_info: req.body.traveler_contact_info || { email: req.user.email }
    };
    const newBooking = await bookingModel.create(bookingData);

    const bookingComponentsData = trip.components.map(tc => ({
        booking_id: newBooking.id,
        component_id: tc.id, 
        provider_id: tc.listing_id ? (async () => { 
            const listing = await listingModel.findById(tc.listing_id);
            return listing ? listing.provider_id : null;
        })() : null, 
        status: 'confirmed', 
        price: tc.price,
        currency: tc.currency
    }));
    for (let i = 0; i < bookingComponentsData.length; i++) {
        if (typeof bookingComponentsData[i].provider_id === 'function') {
            bookingComponentsData[i].provider_id = await bookingComponentsData[i].provider_id;
        }
    }
    await bookingComponentModel.createBulk(bookingComponentsData);

    await customTripModel.update(tripId, { status: 'booked' });

    res.status(201).json({
      message: 'Trip booked successfully!',
      booking: newBooking
    });
  } catch (err) {
    console.error('Error booking custom trip:', err);
    res.status(500).json({ message: 'Failed to book custom trip', error: err.message });
  }
});


// ====================================
// Flight Component Integration (Amadeus)
// ====================================
const flightSearchSchema = Joi.object({
    originLocationCode: Joi.string().length(3).uppercase().required(),
    destinationLocationCode: Joi.string().length(3).uppercase().required(),
    departureDate: Joi.date().iso().required(),
    returnDate: Joi.date().iso().optional().min(Joi.ref('departureDate')),
    adults: Joi.number().integer().min(1).default(1),
    travelClass: Joi.string().valid('ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST').optional(),
    nonStop: Joi.boolean().optional(),
    maxPrice: Joi.number().integer().min(0).optional()
});

router.post('/custom/:tripId/components/flights/search', authenticateToken, async (req, res) => {
    const { tripId } = req.params;
    const { error } = flightSearchSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const trip = await customTripModel.findById(tripId);
    if (!trip) return res.status(404).json({ message: 'Custom trip not found.' });
    if (trip.traveler_id !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized.' });
    }

    try {
        const { originLocationCode, destinationLocationCode, departureDate, returnDate, adults, travelClass, nonStop, maxPrice } = req.body;
        const searchParams = {
            originLocationCode,
            destinationLocationCode,
            departureDate,
            adults,
            ...(travelClass && { travelClass }),
            ...(returnDate && { returnDate }),
            ...(nonStop !== undefined && { nonStop: nonStop }), // Ensure boolean is passed if present
            ...(maxPrice && { maxPrice: maxPrice }),
            currencyCode: trip.currency || 'USD' 
        };

        const flightOffersResponse = await amadeus.shopping.flightOffersSearch.get(searchParams);
        
        res.status(200).json({
            message: "Flight search successful. Select an offer to add to your trip.",
            flightOffers: flightOffersResponse.data,
            dictionaries: flightOffersResponse.result.dictionaries // Amadeus often includes dictionaries for carriers, aircraft etc.
        });

    } catch (err) {
        console.error('Amadeus Flight Search Error:', err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
        const amadeusError = err.response?.data?.errors?.[0];
        const statusCode = err.response?.statusCode || 500;
        res.status(statusCode).json({
            message: 'Failed to search flights via Amadeus.',
            detail: amadeusError ? `${amadeusError.title} (Code: ${amadeusError.code}): ${amadeusError.detail}` : 'An unexpected error occurred with the flight provider.',
            amadeus_error_code: amadeusError?.code
        });
    }
});

router.post('/custom/:tripId/components/flights/add', authenticateToken, async (req, res) => {
    const { tripId } = req.params;
    const { selectedFlightOffer } = req.body; 

    if (!selectedFlightOffer || !selectedFlightOffer.id || !selectedFlightOffer.price?.total) {
        return res.status(400).json({ message: "Valid selectedFlightOffer object with id and price is required."});
    }

    const trip = await customTripModel.findById(tripId);
    if (!trip) return res.status(404).json({ message: 'Custom trip not found.' });
    if (trip.traveler_id !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized.' });
    }
    if (trip.status === 'booked' || trip.status === 'completed') {
        return res.status(403).json({ message: `Cannot add components to trip with status: ${trip.status}` });
    }

    try {
        const firstItinerary = selectedFlightOffer.itineraries?.[0];
        const firstSegment = firstItinerary?.segments?.[0];
        const lastItinerary = selectedFlightOffer.itineraries?.[selectedFlightOffer.itineraries.length -1];
        const lastSegment = lastItinerary?.segments?.[lastItinerary.segments.length -1];

        if (!firstSegment || !lastSegment) {
            return res.status(400).json({ message: "Invalid flight offer structure: missing segments." });
        }
        
        const departureTime = firstSegment.departure.at.split('T')[1]?.substring(0,5) || null;
        const arrivalTime = lastSegment.arrival.at.split('T')[1]?.substring(0,5) || null;


        const componentData = {
            trip_id: parseInt(tripId),
            component_type: 'flight',
            external_provider: 'Amadeus', 
            external_reference_id: selectedFlightOffer.id, 
            title: `Flight: ${firstSegment.departure.iataCode} to ${lastSegment.arrival.iataCode}`,
            description: `Carrier: ${firstSegment.carrierCode} ${firstSegment.number}. Segments: ${selectedFlightOffer.itineraries.reduce((sum, itin) => sum + itin.segments.length, 0)}.`, 
            start_date: firstSegment.departure.at.split('T')[0],
            start_time: departureTime,
            end_date: lastSegment.arrival.at.split('T')[0],
            end_time: arrivalTime,
            price: parseFloat(selectedFlightOffer.price.total),
            currency: selectedFlightOffer.price.currency,
            status: 'planned',
            notes: `Travelers: ${selectedFlightOffer.travelerPricings?.length || 1}. Offer source: ${selectedFlightOffer.source}`
        };

        const newComponent = await tripComponentModel.create(componentData);
        const newTotalPrice = await calculateTotalTripCost(tripId);
        await customTripModel.update(tripId, { total_price: newTotalPrice });

        res.status(201).json(newComponent);

    } catch (err) {
        console.error('Error adding flight component:', err);
        res.status(500).json({ message: 'Failed to add flight component', error: err.message });
    }
});


// ====================================
// Hotel Component Integration (Amadeus)
// ====================================
const hotelSearchSchema = Joi.object({
    cityCode: Joi.string().length(3).uppercase().required(),
    checkInDate: Joi.date().iso().required(),
    checkOutDate: Joi.date().iso().required().min(Joi.ref('checkInDate')),
    adults: Joi.number().integer().min(1).default(1),
    roomQuantity: Joi.number().integer().min(1).default(1),
    priceRange: Joi.string().pattern(/^\d+-\d+$/).optional().allow(null, ''), // e.g., "200-500"
    hotelName: Joi.string().optional().allow(null, ''), // For potential keyword search or post-filtering
    amenities: Joi.array().items(Joi.string()).optional().allow(null), // e.g., ["WIFI", "PARKING"]
    currency: Joi.string().length(3).uppercase().default('USD'),
    ratings: Joi.array().items(Joi.number().integer().min(1).max(5)).optional().allow(null), // Hotel star ratings e.g., [3,4,5]
    bestRateOnly: Joi.boolean().default(true)
});

// POST /api/trips/custom/:tripId/components/hotels/search - Search Amadeus hotels
router.post('/custom/:tripId/components/hotels/search', authenticateToken, async (req, res) => {
    const { tripId } = req.params;
    const { error } = hotelSearchSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const trip = await customTripModel.findById(tripId);
    if (!trip) return res.status(404).json({ message: 'Custom trip not found.' });
    if (trip.traveler_id !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized.' });
    }

    try {
        const { cityCode, checkInDate, checkOutDate, adults, roomQuantity, priceRange, amenities, currency, ratings, bestRateOnly } = req.body;
        const searchParams = {
            cityCode,
            checkInDate,
            checkOutDate,
            adults,
            roomQuantity,
            currency,
            bestRateOnly,
            ...(priceRange && { priceRange }),
            ...(amenities && amenities.length > 0 && { amenities: amenities.join(',') }),
            ...(ratings && ratings.length > 0 && { ratings: ratings.join(',') })
        };
        
        const hotelOffersResponse = await amadeus.shopping.hotelOffersSearch.get(searchParams);
        
        res.status(200).json({
            message: "Hotel search successful. Select an offer to add to your trip.",
            hotelOffers: hotelOffersResponse.data,
            // Amadeus hotel search might not have 'dictionaries' like flights, adjust if needed
        });

    } catch (err) {
        console.error('Amadeus Hotel Search Error:', err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
        const amadeusError = err.response?.data?.errors?.[0];
        const statusCode = err.response?.statusCode || 500;
        res.status(statusCode).json({
            message: 'Failed to search hotels via Amadeus.',
            detail: amadeusError ? `${amadeusError.title} (Code: ${amadeusError.code}): ${amadeusError.detail}` : 'An unexpected error occurred with the hotel provider.',
            amadeus_error_code: amadeusError?.code
        });
    }
});

// POST /api/trips/custom/:tripId/components/hotels/add - Add a selected hotel as a trip component
router.post('/custom/:tripId/components/hotels/add', authenticateToken, async (req, res) => {
    const { tripId } = req.params;
    const { selectedHotelOffer, checkInDate, checkOutDate } = req.body; // Expects a full hotel offer object and dates

    if (!selectedHotelOffer || !selectedHotelOffer.hotel?.hotelId || !selectedHotelOffer.offers?.[0]?.price?.total) {
        return res.status(400).json({ message: "Valid selectedHotelOffer object with hotelId and price is required."});
    }
    if (!checkInDate || !checkOutDate) {
        return res.status(400).json({ message: "checkInDate and checkOutDate are required." });
    }

    const trip = await customTripModel.findById(tripId);
    if (!trip) return res.status(404).json({ message: 'Custom trip not found.' });
    if (trip.traveler_id !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized.' });
    }
    if (trip.status === 'booked' || trip.status === 'completed') {
        return res.status(403).json({ message: `Cannot add components to trip with status: ${trip.status}` });
    }

    try {
        const offer = selectedHotelOffer.offers[0];
        const hotel = selectedHotelOffer.hotel;

        const componentData = {
            trip_id: parseInt(tripId),
            component_type: 'accommodation',
            external_provider: 'Amadeus', // Or specific hotel name/chain
            external_reference_id: offer.id, // Amadeus offer ID
            title: hotel.name || `Hotel Stay in ${hotel.cityCode}`,
            description: `${offer.room?.typeEstimated?.category || offer.room?.description?.text || 'Hotel Room'}. Board: ${offer.boardType || 'N/A'}`,
            start_date: checkInDate,
            end_date: checkOutDate,
            // Hotel bookings usually don't have specific start/end times, but check-in/out times
            // start_time: hotel.checkInTime, // If available
            // end_time: hotel.checkOutTime,   // If available
            custom_location: {
                address: hotel.address?.lines?.join(', ') || null,
                city: hotel.address?.cityName || hotel.cityCode,
                country: hotel.address?.countryCode || null,
                latitude: hotel.latitude || null,
                longitude: hotel.longitude || null,
            },
            price: parseFloat(offer.price.total),
            currency: offer.price.currency,
            status: 'planned',
            notes: `Hotel ID: ${hotel.hotelId}. Guests: ${offer.guests?.adults || 1}. Room Quantity: ${offer.roomQuantity || 1}.`
        };

        const newComponent = await tripComponentModel.create(componentData);
        const newTotalPrice = await calculateTotalTripCost(tripId);
        await customTripModel.update(tripId, { total_price: newTotalPrice });

        res.status(201).json(newComponent);

    } catch (err) {
        console.error('Error adding hotel component:', err);
        res.status(500).json({ message: 'Failed to add hotel component', error: err.message });
    }
});


// ====================================


// =======================================================================
// Amadeus Tours & Activities Integration
// =======================================================================

const toursActivitiesSearchSchema = Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    radius: Joi.number().integer().min(1).max(20).default(5), // Radius in KM, max 20 for Amadeus
    // Amadeus API also supports page[offset] for pagination if needed
});

// POST /api/trips/custom/:tripId/components/activities/search - Search Amadeus Tours & Activities
router.post('/custom/:tripId/components/activities/search', authenticateToken, async (req, res) => {
    const { tripId } = req.params;
    const { error } = toursActivitiesSearchSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    try {
        const trip = await customTripModel.findById(tripId);
        if (!trip) return res.status(404).json({ message: 'Custom trip not found.' });
        if (trip.traveler_id !== req.user.id) {
            return res.status(403).json({ message: 'Unauthorized.' });
        }

        const { latitude, longitude, radius } = req.body;
        const searchParams = { latitude, longitude, radius };

        const activitiesResponse = await amadeus.shopping.activities.get(searchParams);
        
        res.status(200).json({
            message: "Tours & Activities search successful. Select an activity to add to your trip.",
            activities: activitiesResponse.data,
            meta: activitiesResponse.result.meta // Contains pagination info if available
        });

    } catch (err) {
        console.error('Amadeus Tours & Activities Search Error:', err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
        const amadeusError = err.response?.data?.errors?.[0];
        const statusCode = err.response?.statusCode || 500;
        res.status(statusCode).json({
            message: 'Failed to search tours & activities via Amadeus.',
            detail: amadeusError ? `${amadeusError.title} (Code: ${amadeusError.code}): ${amadeusError.detail}` : 'An unexpected error occurred with the activities provider.',
            amadeus_error_code: amadeusError?.code
        });
    }
});

const addActivitySchema = Joi.object({
    selectedActivity: Joi.object().required(), // Expects a full activity object from Amadeus response
    activityDate: Joi.date().iso().optional().allow(null), 
});

// POST /api/trips/custom/:tripId/components/activities/add - Add a selected activity as a trip component
router.post('/custom/:tripId/components/activities/add', authenticateToken, async (req, res) => {
    const { tripId } = req.params;
    const { error } = addActivitySchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { selectedActivity, activityDate } = req.body;

    if (!selectedActivity || !selectedActivity.id || !selectedActivity.price) {
        return res.status(400).json({ message: "Valid selectedActivity object with id and price is required."});
    }

    try {
        const trip = await customTripModel.findById(tripId);
        if (!trip) return res.status(404).json({ message: 'Custom trip not found.' });
        if (trip.traveler_id !== req.user.id) {
          return res.status(403).json({ message: 'Unauthorized.' });
        }
        if (trip.status === 'booked' || trip.status === 'completed') {
            return res.status(403).json({ message: `Cannot add components to trip with status: ${trip.status}` });
        }

        const componentData = {
            trip_id: parseInt(tripId),
            component_type: 'activity',
            external_provider: 'Amadeus',
            external_reference_id: selectedActivity.id, // Amadeus activity ID
            title: selectedActivity.name || 'Activity',
            description: selectedActivity.shortDescription || selectedActivity.description || 'Activity details from Amadeus',
            start_date: activityDate || trip.start_date, // Use specified date or trip start date as default
            price: parseFloat(selectedActivity.price.amount),
            currency: selectedActivity.price.currencyCode || 'USD',
            status: 'planned',
            notes: `Booking Link: ${selectedActivity.bookingLink || 'N/A'}. Duration: ${selectedActivity.minimumDuration || 'N/A'}`,
            custom_location: selectedActivity.geoCode ? { 
                latitude: selectedActivity.geoCode.latitude, 
                longitude: selectedActivity.geoCode.longitude 
            } : null
        };
        
        const newComponent = await tripComponentModel.create(componentData);
        const newTotalPrice = await calculateTotalTripCost(tripId); // Recalculate after adding component
        await customTripModel.update(tripId, { total_price: newTotalPrice });

        res.status(201).json(newComponent);

    } catch (err) {
        console.error('Error adding activity component:', err);
        res.status(500).json({ message: 'Failed to add activity component', error: err.message });
    }
});


// =======================================================================
// Amadeus Points of Interest (POIs) Integration
// =======================================================================

const poisSearchSchema = Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    radius: Joi.number().integer().min(0).max(20).default(2), // Radius in KM, max 20 for Amadeus
    pageLimit: Joi.number().integer().min(1).max(100).default(10),
    pageOffset: Joi.number().integer().min(0).default(0),
    categories: Joi.array().items(Joi.string().valid(
        'SIGHTS', 'NIGHTLIFE', 'RESTAURANT', 'SHOPPING', 'BEACH_PARK', 'HISTORICAL', 'NATURE', 'MUSEUM'
    )).optional().allow(null)
});

// POST /api/trips/custom/:tripId/components/pois/search - Search Amadeus Points of Interest
router.post('/custom/:tripId/components/pois/search', authenticateToken, async (req, res) => {
    const { tripId } = req.params;
    const { error } = poisSearchSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    try {
        const trip = await customTripModel.findById(tripId);
        if (!trip) return res.status(404).json({ message: 'Custom trip not found.' });
        if (trip.traveler_id !== req.user.id) {
            return res.status(403).json({ message: 'Unauthorized.' });
        }

        const { latitude, longitude, radius, pageLimit, pageOffset, categories } = req.body;
        const searchParams = { 
            latitude, 
            longitude, 
            radius,
            page: { limit: pageLimit, offset: pageOffset }, // Amadeus SDK uses page.limit and page.offset
            ...(categories && categories.length > 0 && { categories: categories.join(',') })
        };
        
        const poisResponse = await amadeus.referenceData.locations.pointsOfInterest.get(searchParams);
        
        res.status(200).json({
            message: "Points of Interest search successful. Select a POI to add to your trip.",
            pois: poisResponse.data,
            meta: poisResponse.result.meta // Contains pagination info if available
        });

    } catch (err) {
        console.error('Amadeus POI Search Error:', err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
        const amadeusError = err.response?.data?.errors?.[0];
        const statusCode = err.response?.statusCode || 500;
        res.status(statusCode).json({
            message: 'Failed to search Points of Interest via Amadeus.',
            detail: amadeusError ? `${amadeusError.title} (Code: ${amadeusError.code}): ${amadeusError.detail}` : 'An unexpected error occurred with the POI provider.',
            amadeus_error_code: amadeusError?.code
        });
    }
});

const addPoiSchema = Joi.object({
    selectedPoi: Joi.object().required(), 
    visitDate: Joi.date().iso().optional().allow(null), 
});

// POST /api/trips/custom/:tripId/components/pois/add - Add a selected POI as a trip component (informational)
router.post('/custom/:tripId/components/pois/add', authenticateToken, async (req, res) => {
    const { tripId } = req.params;
    const { error } = addPoiSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { selectedPoi, visitDate } = req.body;

    if (!selectedPoi || !selectedPoi.id || !selectedPoi.name) {
        return res.status(400).json({ message: "Valid selectedPoi object with id and name is required."});
    }

    try {
        const trip = await customTripModel.findById(tripId);
        if (!trip) return res.status(404).json({ message: 'Custom trip not found.' });
        if (trip.traveler_id !== req.user.id) {
          return res.status(403).json({ message: 'Unauthorized.' });
        }
         if (trip.status === 'booked' || trip.status === 'completed') {
            return res.status(403).json({ message: `Cannot add components to trip with status: ${trip.status}` });
        }

        const componentData = {
            trip_id: parseInt(tripId),
            component_type: 'other', // Or a new 'poi' type if schema is updated
            external_provider: 'Amadeus POI',
            external_reference_id: selectedPoi.id, // Amadeus POI ID
            title: selectedPoi.name,
            description: `Category: ${selectedPoi.category || 'N/A'}. Tags: ${(selectedPoi.tags || []).join(', ')}`,
            start_date: visitDate || null, 
            price: 0, // POIs are generally free unless ticketed
            currency: trip.currency || 'USD',
            status: 'planned',
            notes: `Rank: ${selectedPoi.rank || 'N/A'}`,
            custom_location: selectedPoi.geoCode ? { 
                latitude: selectedPoi.geoCode.latitude, 
                longitude: selectedPoi.geoCode.longitude 
            } : null
        };
        
        const newComponent = await tripComponentModel.create(componentData);
        // POIs usually don't have a cost, so total trip price might not change.
        // If they could, then:
        // const newTotalPrice = await calculateTotalTripCost(tripId);
        // await customTripModel.update(tripId, { total_price: newTotalPrice });

        res.status(201).json(newComponent);

    } catch (err) {
        console.error('Error adding POI component:', err);
        res.status(500).json({ message: 'Failed to add POI component', error: err.message });
    }
});
// ====================================

router.get('/templates', async (req, res) => { 
  try {
    const templates = await listingModel.search({ isExampleItinerary: true, status: 'published' }, 50, 0); 
    res.status(200).json(templates);
  } catch (err) {
    console.error('Error fetching trip templates:', err);
    res.status(500).json({ message: 'Failed to fetch trip templates', error: err.message });
  }
});

router.post('/custom/from-template/:templateId', authenticateToken, async (req, res) => {
  try {
    const { templateId } = req.params;
    const templateListing = await listingModel.findById(templateId);

    if (!templateListing || !templateListing.is_example_itinerary) {
      return res.status(404).json({ message: 'Trip template not found or is not an example itinerary.' });
    }

    const newTripData = {
      traveler_id: req.user.id,
      title: `Custom Trip based on: ${templateListing.title}`,
      description: templateListing.description,
      start_date: null, 
      end_date: null,   
      number_of_travelers: templateListing.max_travelers || 1,
      total_price: templateListing.base_price, 
      currency: templateListing.currency || 'USD',
      status: 'draft',
      inspiration_source: 'example_trip',
      inspiration_reference_id: templateListing.id
    };
    const newCustomTrip = await customTripModel.create(newTripData);

    const templateComponents = await componentModel.getByListingId(templateListing.id);
    if (templateComponents && templateComponents.length > 0) {
      const newTripComponentsData = templateComponents.map(tc => ({
        trip_id: newCustomTrip.id,
        component_type: tc.component_type,
        service_component_id: tc.id, 
        listing_id: tc.listing_id, 
        title: tc.title,
        description: tc.description,
        start_date: null,
        end_date: null,
        start_time: null,
        end_time: null,
        location_id: tc.location_id,
        custom_location: tc.custom_location,
        price: tc.price,
        currency: tc.currency,
        status: 'planned'
      }));
      await tripComponentModel.createBulk(newTripComponentsData);
    }
    
    const finalPrice = await calculateTotalTripCost(newCustomTrip.id);
    const finalTrip = await customTripModel.update(newCustomTrip.id, { total_price: finalPrice });


    res.status(201).json(finalTrip);
  } catch (err) {
    console.error('Error creating custom trip from template:', err);
    res.status(500).json({ message: 'Failed to create custom trip from template', error: err.message });
  }
});

// ====================================
// Trip Duplicate/Clone Functionality
// ====================================

router.post('/custom/:tripId/clone', authenticateToken, async (req, res) => {
  try {
    const { tripId } = req.params;
    const originalTrip = await customTripModel.getWithComponents(tripId);

    if (!originalTrip) return res.status(404).json({ message: 'Original custom trip not found.' });
    if (originalTrip.traveler_id !== req.user.id) {
      return res.status(403).json({ message: 'You are not authorized to clone this trip.' });
    }

    const clonedTripData = {
      traveler_id: req.user.id,
      title: `Copy of ${originalTrip.title}`,
      description: originalTrip.description,
      start_date: originalTrip.start_date,
      end_date: originalTrip.end_date,
      number_of_travelers: originalTrip.number_of_travelers,
      total_price: originalTrip.total_price,
      currency: originalTrip.currency,
      status: 'draft', 
      inspiration_source: originalTrip.inspiration_source,
      inspiration_reference_id: originalTrip.inspiration_reference_id
    };
    const clonedTrip = await customTripModel.create(clonedTripData);

    if (originalTrip.components && originalTrip.components.length > 0) {
      const clonedComponentsData = originalTrip.components.map(tc => ({
        ...tc, 
        id: undefined, 
        trip_id: clonedTrip.id, 
        created_at: undefined,
        updated_at: undefined,
        status: 'planned' 
      }));
      await tripComponentModel.createBulk(clonedComponentsData);
    }
    
    const finalClonedTrip = await customTripModel.getWithComponents(clonedTrip.id);
    res.status(201).json(finalClonedTrip);

  } catch (err) {
    console.error('Error cloning custom trip:', err);
    res.status(500).json({ message: 'Failed to clone custom trip', error: err.message });
  }
});


module.exports = router;

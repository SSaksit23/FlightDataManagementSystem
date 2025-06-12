// --- Start of code to be inserted into backend/routes/trips.js ---
// This block assumes 'router', 'Joi', 'amadeus', 'authenticateToken', 
// 'customTripModel', 'tripComponentModel', and 'calculateTotalTripCost' 
// are already defined and in scope from the parent trips.js file.

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
    // Optional: allow user to specify date/time if activity is for a specific slot
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
            description: selectedActivity.shortDescription || selectedActivity.description || 'Details from Amadeus',
            start_date: activityDate || trip.start_date, // Use specified date or trip start date as default
            // start_time: selectedActivity.startTime, // If available and needed
            // end_date: activityDate, // For single day activities, or calculate if duration is known
            // end_time: selectedActivity.endTime, // If available
            price: parseFloat(selectedActivity.price.amount),
            currency: selectedActivity.price.currencyCode || 'USD',
            status: 'planned',
            notes: `Booking Link (if available): ${selectedActivity.bookingLink || 'N/A'}. Duration: ${selectedActivity.minimumDuration || 'N/A'}`,
            // custom_location might be derived from activity's geoCode if available
            custom_location: selectedActivity.geoCode ? { 
                latitude: selectedActivity.geoCode.latitude, 
                longitude: selectedActivity.geoCode.longitude 
            } : null
        };
        
        const newComponent = await tripComponentModel.create(componentData);
        const newTotalPrice = await calculateTotalTripCost(tripId);
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
        'SIGHTS', 'NIGHTLIFE', 'RESTAURANT', 'SHOPPING', 'BEACH_PARK', 'HISTORICAL', 'NATURE', 'MUSEUM' // Common Amadeus POI categories
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
            page: { limit: pageLimit, offset: pageOffset },
            ...(categories && categories.length > 0 && { categories: categories.join(',') })
        };
        
        const poisResponse = await amadeus.referenceData.locations.pointsOfInterest.get(searchParams);
        
        res.status(200).json({
            message: "Points of Interest search successful. Select a POI to add to your trip notes or itinerary.",
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
    selectedPoi: Joi.object().required(), // Expects a full POI object from Amadeus response
    visitDate: Joi.date().iso().optional().allow(null), // Optional: if user wants to schedule a visit
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
            external_provider: 'Amadeus',
            external_reference_id: selectedPoi.id, // Amadeus POI ID
            title: selectedPoi.name,
            description: `Category: ${selectedPoi.category || 'N/A'}. Tags: ${(selectedPoi.tags || []).join(', ')}`,
            start_date: visitDate || null, // POIs might not have specific dates unless user plans a visit
            price: 0, // POIs are generally informational and free, unless ticketed (not handled here)
            currency: trip.currency || 'USD',
            status: 'planned',
            notes: `Rank: ${selectedPoi.rank || 'N/A'}`,
            custom_location: selectedPoi.geoCode ? { 
                latitude: selectedPoi.geoCode.latitude, 
                longitude: selectedPoi.geoCode.longitude 
            } : null
        };
        
        const newComponent = await tripComponentModel.create(componentData);
        // No price change for POIs, so no need to recalculate total trip cost unless POIs can have a price
        // If POIs could have a price, uncomment:
        // const newTotalPrice = await calculateTotalTripCost(tripId);
        // await customTripModel.update(tripId, { total_price: newTotalPrice });

        res.status(201).json(newComponent);

    } catch (err) {
        console.error('Error adding POI component:', err);
        res.status(500).json({ message: 'Failed to add POI component', error: err.message });
    }
});

// --- End of code to be inserted ---

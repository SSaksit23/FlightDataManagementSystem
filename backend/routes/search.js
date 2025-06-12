const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { authenticateToken } = require('../middleware/auth'); // Assuming auth middleware exists
const {
  listingModel,
  providerProfileModel,
  categoryModel,
  componentModel, // Added for fetching components for detail page
  // locationModel, // Assuming a locationModel will be created based on locations table
  // For now, we'll use direct queries or simplified logic for locations
  query // Direct query function from database.js
} = require('../models/database');

// ====================================
// 1. Service Listing Search
// ====================================
const listingSearchSchema = Joi.object({
  keyword: Joi.string().optional().allow('', null),
  categoryId: Joi.number().integer().optional().allow(null),
  locationId: Joi.number().integer().optional().allow(null),
  city: Joi.string().optional().allow('', null),
  country: Joi.string().optional().allow('', null),
  iataCode: Joi.string().length(3).uppercase().optional().allow(null),
  minPrice: Joi.number().min(0).optional().allow(null),
  maxPrice: Joi.number().min(Joi.ref('minPrice')).optional().allow(null),
  minDuration: Joi.number().min(0).optional().allow(null), // in hours
  maxDuration: Joi.number().min(Joi.ref('minDuration')).optional().allow(null),
  isMultiDay: Joi.boolean().optional().allow(null),
  isCustomizable: Joi.boolean().optional().allow(null),
  isExampleItinerary: Joi.boolean().optional().allow(null),
  providerId: Joi.number().integer().optional().allow(null),
  sortBy: Joi.string().valid('rating', 'price_asc', 'price_desc', 'newest', 'popularity').default('rating'),
  limit: Joi.number().integer().min(1).max(100).default(10),
  offset: Joi.number().integer().min(0).default(0)
});

// GET /api/search/listings - Search for service listings with advanced filters
router.get('/listings', async (req, res) => {
  try {
    const { error, value } = listingSearchSchema.validate(req.query);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { limit, offset, sortBy, ...filters } = value;
    
    const listings = await listingModel.search(filters, limit, offset, sortBy);
    // A robust implementation of countSearch should apply the same filters as the search method.
    const countResult = await listingModel.countSearch(filters);
    const totalCount = countResult?.count || 0;


    res.status(200).json({
      listings,
      totalCount,
      limit,
      offset
    });
  } catch (err) {
    console.error('Error searching listings:', err);
    res.status(500).json({ message: 'Failed to search listings', error: err.message });
  }
});

// GET /api/search/listings/public/:listingId - Get a single public listing by ID
router.get('/listings/public/:listingId', async (req, res) => {
  try {
    const { listingId } = req.params;
    if (isNaN(parseInt(listingId))) {
        return res.status(400).json({ message: 'Invalid listing ID format.' });
    }

    const listing = await listingModel.findById(parseInt(listingId));

    if (!listing || listing.status !== 'published') { // Only show published listings publicly
      return res.status(404).json({ message: 'Listing not found or not available.' });
    }

    // listingModel.findById already fetches media via subquery.
    // If itinerary is stored in service_components and not directly in listing.itinerary JSONB, fetch them:
    // For now, assuming listing.itinerary (JSONB) is populated by the CreateListingForm for multi-day trips.
    // If service_components are also needed for detailed public view:
    // listing.components = await componentModel.getByListingId(listing.id);
    // The `listingModel.findById` in `database.js` was updated to include category_name, provider details, location details, and media.
    // The `service_listings` table itself has an `itinerary` JSONB field which should be part of the `listing` object.

    res.status(200).json(listing);
  } catch (err) {
    console.error(`Error fetching public listing ${req.params.listingId}:`, err);
    res.status(500).json({ message: 'Failed to fetch listing details', error: err.message });
  }
});


// ====================================
// 2. Provider Discovery and Search
// ====================================
const providerSearchSchema = Joi.object({
  keyword: Joi.string().optional().allow('', null), // Search by name, business name
  specialty: Joi.string().optional().allow('', null), // e.g., 'hiking', 'culinary'
  businessType: Joi.string().optional().allow('', null), // e.g., 'individual_guide', 'boutique_hotel'
  minRating: Joi.number().min(0).max(5).optional().allow(null),
  limit: Joi.number().integer().min(1).max(100).default(10),
  offset: Joi.number().integer().min(0).default(0)
});

// GET /api/search/providers - Search for service providers
router.get('/providers', async (req, res) => {
  try {
    const { error, value } = providerSearchSchema.validate(req.query);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    const { limit, offset, ...searchParams } = value;
    const providers = await providerProfileModel.search(searchParams, limit, offset);
    // TODO: Get total count for pagination for providers
    // const totalCount = await providerProfileModel.countSearch(searchParams);

    res.status(200).json({
      providers,
      // totalCount,
      limit,
      offset
    });
  } catch (err) {
    console.error('Error searching providers:', err);
    res.status(500).json({ message: 'Failed to search providers', error: err.message });
  }
});

// ====================================
// 3. Category-based Browsing
// ====================================

// GET /api/search/categories - List all top-level categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await categoryModel.getAll(); // Assuming this gets all, might need filtering for top-level
    res.status(200).json(categories);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ message: 'Failed to fetch categories', error: err.message });
  }
});

// GET /api/search/categories/tree - List categories with their subcategories
router.get('/categories/tree', async (req, res) => {
  try {
    const categoryTree = await categoryModel.getCategoriesWithSubcategories();
    res.status(200).json(categoryTree);
  } catch (err) {
    console.error('Error fetching category tree:', err);
    res.status(500).json({ message: 'Failed to fetch category tree', error: err.message });
  }
});

// GET /api/search/categories/:categoryId/listings - List services within a specific category
router.get('/categories/:categoryId/listings', async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { limit = 10, offset = 0, sortBy = 'rating' } = req.query; // Added sortBy

    // Validate categoryId
    const category = await categoryModel.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: 'Category not found.' });
    }

    const filters = { categoryId: parseInt(categoryId) };
    const listings = await listingModel.search(filters, parseInt(limit), parseInt(offset), sortBy);
    const countResult = await listingModel.countSearch(filters);
    const totalCount = countResult?.count || 0;

    res.status(200).json({
      category,
      listings,
      totalCount,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (err) {
    console.error('Error fetching listings by category:', err);
    res.status(500).json({ message: 'Failed to fetch listings by category', error: err.message });
  }
});

// ====================================
// 4. Location-based Search
// ====================================

// GET /api/search/locations/suggestions - Autocomplete for location names/IATA codes
router.get('/locations/suggestions', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.status(400).json({ message: 'Query parameter "q" must be at least 2 characters long.' });
    }
    // Simplified location suggestion (assumes locationModel.searchByNameOrIata exists)
    // const suggestions = await locationModel.searchByNameOrIata(q, 10);
    const result = await query(
      `SELECT id, name, city, country, iata_code, location_type 
       FROM locations 
       WHERE name ILIKE $1 OR city ILIKE $1 OR country ILIKE $1 OR iata_code ILIKE $2
       LIMIT 10`,
      [`%${q}%`, `${q.toUpperCase()}%`]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching location suggestions:', err);
    res.status(500).json({ message: 'Failed to fetch location suggestions', error: err.message });
  }
});

// ====================================
// 5. Featured Listings
// ====================================

// GET /api/search/listings/featured - Get featured listings
router.get('/listings/featured', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;
    const featuredListings = await listingModel.getFeatured(limit);
    res.status(200).json(featuredListings);
  } catch (err) {
    console.error('Error fetching featured listings:', err);
    res.status(500).json({ message: 'Failed to fetch featured listings', error: err.message });
  }
});

// ====================================
// 6. Popular Destinations
// ====================================

// GET /api/search/destinations/popular - List popular destinations
router.get('/destinations/popular', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    // This could be based on number of listings, bookings, or curated.
    // Simple version: locations with most published listings.
    const result = await query(
      `SELECT l.id, l.name, l.city, l.country, l.iata_code, l.location_type, COUNT(sl.id) as listing_count
       FROM locations l
       JOIN service_listings sl ON l.id = sl.location_id
       WHERE sl.status = 'published' AND l.location_type = 'city' -- Focus on cities
       GROUP BY l.id
       ORDER BY listing_count DESC
       LIMIT $1`,
      [limit]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching popular destinations:', err);
    res.status(500).json({ message: 'Failed to fetch popular destinations', error: err.message });
  }
});

// ====================================
// 7. Personalized Recommendations (Placeholder)
// ====================================

// GET /api/search/recommendations/personalized - Get personalized recommendations for the logged-in user
router.get('/recommendations/personalized', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 5;
    // TODO: Implement recommendation logic based on:
    // - User's past bookings (bookingModel)
    // - User's wishlist items (wishlistModel)
    // - User's profile preferences (userModel.preferences)
    // - Collaborative filtering (users who liked X also liked Y)
    // - Content-based filtering (similar items to what user liked)

    // Placeholder: Return some highly-rated listings for now
    const recommendations = await listingModel.getFeatured(limit); // Re-use featured as placeholder
    res.status(200).json(recommendations);
  } catch (err) {
    console.error('Error fetching personalized recommendations:', err);
    res.status(500).json({ message: 'Failed to fetch personalized recommendations', error: err.message });
  }
});

// ====================================
// 8. Search Suggestions and Autocomplete
// ====================================

// GET /api/search/suggestions - Provide autocomplete suggestions for listings, providers, locations
router.get('/suggestions', async (req, res) => {
  try {
    const { q } = req.query;
    const limit = parseInt(req.query.limit) || 5; // Limit per type

    if (!q || q.length < 2) {
      return res.status(400).json({ message: 'Query "q" must be at least 2 characters.' });
    }

    const searchPattern = `%${q}%`;

    // Listings suggestions
    const listingSuggestions = await query(
      `SELECT id, title, 'listing' as type FROM service_listings 
       WHERE title ILIKE $1 AND status = 'published' LIMIT $2`,
      [searchPattern, limit]
    );

    // Providers suggestions
    const providerSuggestions = await query(
      `SELECT pp.id, COALESCE(pp.business_name, CONCAT(u.first_name, ' ', u.last_name)) as name, 'provider' as type 
       FROM provider_profiles pp
       JOIN users u ON pp.user_id = u.id
       WHERE (pp.business_name ILIKE $1 OR u.first_name ILIKE $1 OR u.last_name ILIKE $1) 
       AND pp.verification_status = 'verified' LIMIT $2`,
      [searchPattern, limit]
    );

    // Locations suggestions (cities/countries)
    const locationSuggestions = await query(
      `SELECT id, name, city, country, 'location' as type FROM locations 
       WHERE (name ILIKE $1 OR city ILIKE $1 OR country ILIKE $1 OR iata_code ILIKE $2) LIMIT $3`,
      [searchPattern, `${q.toUpperCase()}%`, limit]
    );
    
    // Category suggestions
    const categorySuggestions = await query(
        `SELECT id, name, 'category' as type FROM service_categories
         WHERE name ILIKE $1 LIMIT $2`,
        [searchPattern, limit]
    );

    const allSuggestions = [
      ...listingSuggestions.rows.map(r => ({ id: r.id, name: r.title, type: r.type })),
      ...providerSuggestions.rows.map(r => ({ id: r.id, name: r.name, type: r.type })),
      ...locationSuggestions.rows.map(r => ({ id: r.id, name: r.city ? `${r.name}, ${r.city}, ${r.country}` : `${r.name}, ${r.country}`, type: r.type })),
      ...categorySuggestions.rows.map(r => ({ id: r.id, name: r.name, type: r.type }))
    ];
    
    // Simple de-duplication and ranking (can be improved)
    const uniqueSuggestions = Array.from(new Map(allSuggestions.map(item => [item.name + item.type, item])).values());
    
    res.status(200).json(uniqueSuggestions.slice(0, 15)); // Overall limit

  } catch (err) {
    console.error('Error fetching search suggestions:', err);
    res.status(500).json({ message: 'Failed to fetch search suggestions', error: err.message });
  }
});

// ====================================
// 9. Trending Experiences
// ====================================

// GET /api/search/experiences/trending - Get trending experiences
router.get('/experiences/trending', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    // Trending could be based on:
    // - Recently booked (requires booking timestamps and counts)
    // - Highly rated and recently added
    // - Most viewed (requires tracking views)

    // Placeholder: Recently published, highly-rated listings
    const trendingListings = await query(
      `SELECT sl.*, sc.name as category_name, pp.business_name as provider_name,
        (SELECT url FROM service_media sm WHERE sm.listing_id = sl.id AND sm.is_featured = true ORDER BY sm.display_order ASC LIMIT 1) as featured_image_url
       FROM service_listings sl
       LEFT JOIN service_categories sc ON sl.category_id = sc.id
       LEFT JOIN provider_profiles pp ON sl.provider_id = pp.id
       WHERE sl.status = 'published'
       ORDER BY sl.created_at DESC, sl.average_rating DESC NULLS LAST
       LIMIT $1`,
      [limit]
    );

    res.status(200).json(trendingListings.rows);
  } catch (err) {
    console.error('Error fetching trending experiences:', err);
    res.status(500).json({ message: 'Failed to fetch trending experiences', error: err.message });
  }
});

module.exports = router;

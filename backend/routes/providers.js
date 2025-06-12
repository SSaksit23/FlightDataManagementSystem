const express = require('express');
const router = express.Router();
const { authenticateToken, isProvider, isVerifiedProvider } = require('../middleware/auth');
const { 
  providerProfileModel, 
  listingModel, 
  componentModel, 
  availabilityModel, 
  mediaModel,
  bookingModel,
  // paymentModel, // Assuming paymentModel will handle payouts
  // reviewModel 
} = require('../models/database'); // Assuming models are in database.js
const Joi = require('joi');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '..', 'uploads', req.user.id.toString()); // User-specific folder
    fs.mkdirSync(uploadPath, { recursive: true }); // Create directory if it doesn't exist
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and videos are allowed.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 1024 * 1024 * 20 } // 20MB limit
});


// ====================================
// Provider Profile Routes
// ====================================

// Schema for provider profile creation/update
const providerProfileSchema = Joi.object({
  business_name: Joi.string().max(255).optional(),
  business_type: Joi.string().max(100).optional(),
  specialty_areas: Joi.array().items(Joi.string()).optional(),
  years_experience: Joi.number().integer().min(0).optional(),
  languages: Joi.array().items(Joi.string()).optional(),
  certifications: Joi.array().items(Joi.string()).optional(),
  payout_information: Joi.object().optional() // Stripe account ID, bank details etc.
});

// POST /api/providers/profile - Create or update provider profile
router.post('/profile', authenticateToken, isProvider, async (req, res) => {
  try {
    const { error } = providerProfileSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    let profile = await providerProfileModel.findByUserId(req.user.id);
    if (profile) {
      // Update existing profile
      const updatedProfile = await providerProfileModel.update(profile.id, { ...req.body });
      return res.status(200).json(updatedProfile);
    } else {
      // Create new profile
      const newProfileData = { ...req.body, user_id: req.user.id };
      const newProfile = await providerProfileModel.create(newProfileData);
      return res.status(201).json(newProfile);
    }
  } catch (err) {
    console.error('Error creating/updating provider profile:', err);
    res.status(500).json({ message: 'Failed to create or update provider profile', error: err.message });
  }
});

// GET /api/providers/profile - Get current provider's profile
router.get('/profile', authenticateToken, isProvider, async (req, res) => {
  try {
    const profile = await providerProfileModel.findByUserId(req.user.id);
    if (!profile) {
      return res.status(404).json({ message: 'Provider profile not found. Please create one.' });
    }
    res.status(200).json(profile);
  } catch (err) {
    console.error('Error fetching provider profile:', err);
    res.status(500).json({ message: 'Failed to fetch provider profile', error: err.message });
  }
});

// POST /api/providers/profile/verify - Submit documents for verification
// For simplicity, this route will just update the status. Real implementation needs secure file handling.
router.post('/profile/verify', authenticateToken, isProvider, upload.array('verification_documents', 5), async (req, res) => {
  try {
    const profile = await providerProfileModel.findByUserId(req.user.id);
    if (!profile) {
      return res.status(404).json({ message: 'Provider profile not found.' });
    }

    const documentPaths = req.files ? req.files.map(file => `/uploads/${req.user.id}/${file.filename}`) : [];
    
    // In a real app, save documentPaths to profile.verification_documents
    // For now, just simulate by changing status
    const updatedProfile = await providerProfileModel.update(profile.id, { 
      verification_status: 'pending', // Or 'submitted_for_review'
      verification_documents: JSON.stringify(documentPaths) // Store as JSON string or JSONB
    });
    
    res.status(200).json({ message: 'Verification documents submitted. Status is pending review.', profile: updatedProfile });
  } catch (err) {
    console.error('Error submitting verification documents:', err);
    res.status(500).json({ message: 'Failed to submit verification documents', error: err.message });
  }
});

// GET /api/providers/profile/verification-status - Get verification status
router.get('/profile/verification-status', authenticateToken, isProvider, async (req, res) => {
  try {
    const profile = await providerProfileModel.findByUserId(req.user.id);
    if (!profile) {
      return res.status(404).json({ message: 'Provider profile not found.' });
    }
    res.status(200).json({ verification_status: profile.verification_status });
  } catch (err) {
    console.error('Error fetching verification status:', err);
    res.status(500).json({ message: 'Failed to fetch verification status', error: err.message });
  }
});


// ====================================
// Service Listing Routes
// ====================================

const listingSchema = Joi.object({
  title: Joi.string().max(255).required(),
  description: Joi.string().required(),
  category_id: Joi.number().integer().required(),
  location_id: Joi.number().integer().optional().allow(null),
  custom_location: Joi.object({
    address: Joi.string().required(),
    city: Joi.string().required(),
    country: Joi.string().required(),
    latitude: Joi.number().optional(),
    longitude: Joi.number().optional()
  }).optional().allow(null),
  duration_hours: Joi.number().min(0).optional().allow(null),
  is_multi_day: Joi.boolean().default(false),
  total_days: Joi.number().integer().min(0).when('is_multi_day', { is: true, then: Joi.required(), otherwise: Joi.optional().allow(null) }),
  max_travelers: Joi.number().integer().min(1).optional().allow(null),
  base_price: Joi.number().min(0).required(),
  currency: Joi.string().length(3).default('USD'),
  is_customizable: Joi.boolean().default(false),
  is_example_itinerary: Joi.boolean().default(false),
  inclusions: Joi.array().items(Joi.string()).optional(),
  exclusions: Joi.array().items(Joi.string()).optional(),
  requirements: Joi.string().optional().allow(null, ''),
  cancellation_policy: Joi.string().optional().allow(null, '')
});

// POST /api/providers/listings - Create a new service listing
router.post('/listings', authenticateToken, isVerifiedProvider, async (req, res) => {
  try {
    const { error } = listingSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const providerProfile = await providerProfileModel.findByUserId(req.user.id);
    if (!providerProfile) {
      return res.status(403).json({ message: 'Provider profile required to create listings.' });
    }

    const listingData = { ...req.body, provider_id: providerProfile.id };
    const newListing = await listingModel.create(listingData);
    res.status(201).json(newListing);
  } catch (err) {
    console.error('Error creating service listing:', err);
    res.status(500).json({ message: 'Failed to create service listing', error: err.message });
  }
});

// GET /api/providers/listings - Get all listings for the current provider
router.get('/listings', authenticateToken, isProvider, async (req, res) => {
  try {
    const providerProfile = await providerProfileModel.findByUserId(req.user.id);
    if (!providerProfile) {
      return res.status(404).json({ message: 'Provider profile not found.' });
    }
    const listings = await listingModel.getByProviderId(providerProfile.id, req.query.status);
    res.status(200).json(listings);
  } catch (err) {
    console.error('Error fetching provider listings:', err);
    res.status(500).json({ message: 'Failed to fetch provider listings', error: err.message });
  }
});

// GET /api/providers/listings/:listingId - Get a specific listing by ID (owned by provider)
router.get('/listings/:listingId', authenticateToken, isProvider, async (req, res) => {
  try {
    const { listingId } = req.params;
    const listing = await listingModel.findById(listingId);
    
    if (!listing) {
      return res.status(404).json({ message: 'Listing not found.' });
    }

    const providerProfile = await providerProfileModel.findByUserId(req.user.id);
    if (!providerProfile || listing.provider_id !== providerProfile.id) {
      return res.status(403).json({ message: 'You are not authorized to view this listing.' });
    }
    // Fetch components and media as well
    listing.components = await componentModel.getByListingId(listingId);
    listing.media = await mediaModel.getByListingId(listingId);

    res.status(200).json(listing);
  } catch (err) {
    console.error('Error fetching listing details:', err);
    res.status(500).json({ message: 'Failed to fetch listing details', error: err.message });
  }
});

// PUT /api/providers/listings/:listingId - Update a specific listing
router.put('/listings/:listingId', authenticateToken, isVerifiedProvider, async (req, res) => {
  try {
    const { listingId } = req.params;
    const { error } = listingSchema.validate(req.body); // Validate against full schema for update
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const existingListing = await listingModel.findById(listingId);
    if (!existingListing) {
      return res.status(404).json({ message: 'Listing not found.' });
    }

    const providerProfile = await providerProfileModel.findByUserId(req.user.id);
    if (!providerProfile || existingListing.provider_id !== providerProfile.id) {
      return res.status(403).json({ message: 'You are not authorized to update this listing.' });
    }

    const updatedListing = await listingModel.update(listingId, req.body);
    res.status(200).json(updatedListing);
  } catch (err) {
    console.error('Error updating service listing:', err);
    res.status(500).json({ message: 'Failed to update service listing', error: err.message });
  }
});

// DELETE /api/providers/listings/:listingId - Delete a specific listing
router.delete('/listings/:listingId', authenticateToken, isVerifiedProvider, async (req, res) => {
  try {
    const { listingId } = req.params;
    const existingListing = await listingModel.findById(listingId);
    if (!existingListing) {
      return res.status(404).json({ message: 'Listing not found.' });
    }

    const providerProfile = await providerProfileModel.findByUserId(req.user.id);
    if (!providerProfile || existingListing.provider_id !== providerProfile.id) {
      return res.status(403).json({ message: 'You are not authorized to delete this listing.' });
    }

    await listingModel.delete(listingId); // Ensure this also handles related data (components, media, availability) via DB constraints or model logic
    res.status(200).json({ message: 'Listing deleted successfully.' });
  } catch (err) {
    console.error('Error deleting service listing:', err);
    res.status(500).json({ message: 'Failed to delete service listing', error: err.message });
  }
});

// POST /api/providers/listings/:listingId/media - Upload media for a listing
router.post('/listings/:listingId/media', authenticateToken, isVerifiedProvider, upload.array('mediaFiles', 10), async (req, res) => {
  try {
    const { listingId } = req.params;
    const listing = await listingModel.findById(listingId);
    if (!listing) {
      return res.status(404).json({ message: 'Listing not found.' });
    }

    const providerProfile = await providerProfileModel.findByUserId(req.user.id);
    if (!providerProfile || listing.provider_id !== providerProfile.id) {
      return res.status(403).json({ message: 'You are not authorized to add media to this listing.' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded.' });
    }

    const mediaItems = req.files.map(file => ({
      listing_id: parseInt(listingId),
      media_type: file.mimetype.startsWith('image') ? 'image' : 'video',
      url: `/uploads/${req.user.id}/${file.filename}`, // Relative path, serve statically or via S3
      caption: req.body.caption || file.originalname,
      is_featured: req.body.is_featured === 'true' || false,
      display_order: parseInt(req.body.display_order) || 0
    }));

    const createdMedia = await mediaModel.createBulk(mediaItems);
    res.status(201).json(createdMedia);
  } catch (err) {
    console.error('Error uploading media:', err);
    res.status(500).json({ message: 'Failed to upload media', error: err.message });
  }
});

// DELETE /api/providers/listings/:listingId/media/:mediaId - Delete media from a listing
router.delete('/listings/:listingId/media/:mediaId', authenticateToken, isVerifiedProvider, async (req, res) => {
  try {
    const { listingId, mediaId } = req.params;
    const mediaItem = await mediaModel.findById(mediaId);

    if (!mediaItem || mediaItem.listing_id !== parseInt(listingId)) {
      return res.status(404).json({ message: 'Media not found or does not belong to this listing.' });
    }

    const listing = await listingModel.findById(listingId);
    const providerProfile = await providerProfileModel.findByUserId(req.user.id);
    if (!providerProfile || !listing || listing.provider_id !== providerProfile.id) {
      return res.status(403).json({ message: 'You are not authorized to delete this media.' });
    }
    
    // TODO: Add logic to delete the actual file from storage (fs.unlink or S3 delete)
    // For example: fs.unlinkSync(path.join(__dirname, '..', mediaItem.url));

    await mediaModel.delete(mediaId);
    res.status(200).json({ message: 'Media deleted successfully.' });
  } catch (err) {
    console.error('Error deleting media:', err);
    res.status(500).json({ message: 'Failed to delete media', error: err.message });
  }
});


// ====================================
// Service Component Routes (Sub-routes of listings)
// ====================================
const componentSchema = Joi.object({
  component_type: Joi.string().valid('accommodation', 'activity', 'transportation', 'meal', 'guide', 'other').required(),
  title: Joi.string().max(255).required(),
  description: Joi.string().optional().allow(null, ''),
  price: Joi.number().min(0).required(),
  currency: Joi.string().length(3).default('USD'),
  duration_hours: Joi.number().min(0).optional().allow(null),
  is_optional: Joi.boolean().default(false),
  day_number: Joi.number().integer().min(0).optional().allow(null),
  time_slot: Joi.string().valid('morning', 'afternoon', 'evening', 'full_day').optional().allow(null),
  location_id: Joi.number().integer().optional().allow(null),
  custom_location: Joi.object().optional().allow(null),
  capacity: Joi.number().integer().min(1).optional().allow(null)
});

// POST /api/providers/listings/:listingId/components - Create a service component
router.post('/listings/:listingId/components', authenticateToken, isVerifiedProvider, async (req, res) => {
  try {
    const { listingId } = req.params;
    const { error } = componentSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const listing = await listingModel.findById(listingId);
    const providerProfile = await providerProfileModel.findByUserId(req.user.id);
    if (!providerProfile || !listing || listing.provider_id !== providerProfile.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const componentData = { ...req.body, listing_id: parseInt(listingId) };
    const newComponent = await componentModel.create(componentData);
    res.status(201).json(newComponent);
  } catch (err) {
    console.error('Error creating service component:', err);
    res.status(500).json({ message: 'Failed to create service component', error: err.message });
  }
});

// GET /api/providers/listings/:listingId/components - Get all components for a listing
router.get('/listings/:listingId/components', authenticateToken, isProvider, async (req, res) => {
  try {
    const { listingId } = req.params;
    const listing = await listingModel.findById(listingId);
    const providerProfile = await providerProfileModel.findByUserId(req.user.id);
     // Public listings can be viewed, but only owners can see all components if listing is draft/archived
    if (!listing) return res.status(404).json({ message: 'Listing not found.' });
    if (listing.status !== 'published' && (!providerProfile || listing.provider_id !== providerProfile.id)) {
        return res.status(403).json({ message: 'Unauthorized to view components for this listing status.' });
    }

    const components = await componentModel.getByListingId(listingId);
    res.status(200).json(components);
  } catch (err) {
    console.error('Error fetching service components:', err);
    res.status(500).json({ message: 'Failed to fetch service components', error: err.message });
  }
});

// PUT /api/providers/listings/:listingId/components/:componentId - Update a service component
router.put('/listings/:listingId/components/:componentId', authenticateToken, isVerifiedProvider, async (req, res) => {
  try {
    const { listingId, componentId } = req.params;
    const { error } = componentSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const component = await componentModel.findById(componentId);
    if (!component || component.listing_id !== parseInt(listingId)) {
      return res.status(404).json({ message: 'Component not found or does not belong to this listing.' });
    }
    const listing = await listingModel.findById(listingId);
    const providerProfile = await providerProfileModel.findByUserId(req.user.id);
    if (!providerProfile || !listing || listing.provider_id !== providerProfile.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const updatedComponent = await componentModel.update(componentId, req.body);
    res.status(200).json(updatedComponent);
  } catch (err) {
    console.error('Error updating service component:', err);
    res.status(500).json({ message: 'Failed to update service component', error: err.message });
  }
});

// DELETE /api/providers/listings/:listingId/components/:componentId - Delete a service component
router.delete('/listings/:listingId/components/:componentId', authenticateToken, isVerifiedProvider, async (req, res) => {
  try {
    const { listingId, componentId } = req.params;
    const component = await componentModel.findById(componentId);
    if (!component || component.listing_id !== parseInt(listingId)) {
      return res.status(404).json({ message: 'Component not found or does not belong to this listing.' });
    }
    const listing = await listingModel.findById(listingId);
    const providerProfile = await providerProfileModel.findByUserId(req.user.id);
    if (!providerProfile || !listing || listing.provider_id !== providerProfile.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    await componentModel.delete(componentId);
    res.status(200).json({ message: 'Service component deleted successfully.' });
  } catch (err) {
    console.error('Error deleting service component:', err);
    res.status(500).json({ message: 'Failed to delete service component', error: err.message });
  }
});


// ====================================
// Availability Management Routes
// ====================================
const availabilitySchema = Joi.object({
  listing_id: Joi.number().integer().optional().allow(null),
  component_id: Joi.number().integer().optional().allow(null),
  available_date: Joi.date().iso().required(),
  start_time: Joi.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().allow(null), // HH:MM format
  end_time: Joi.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().allow(null),
  max_bookings: Joi.number().integer().min(0).optional().allow(null),
  is_available: Joi.boolean().default(true),
  price_override: Joi.number().min(0).optional().allow(null)
}).xor('listing_id', 'component_id'); // Either listing_id or component_id must be present

// POST /api/providers/availability - Add availability (can be for listing or component)
router.post('/availability', authenticateToken, isVerifiedProvider, async (req, res) => {
  try {
    const { error } = availabilitySchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const providerProfile = await providerProfileModel.findByUserId(req.user.id);
    if (!providerProfile) return res.status(403).json({ message: 'Provider profile required.' });

    // Check ownership
    if (req.body.listing_id) {
      const listing = await listingModel.findById(req.body.listing_id);
      if (!listing || listing.provider_id !== providerProfile.id) {
        return res.status(403).json({ message: 'Unauthorized to manage availability for this listing.' });
      }
    } else if (req.body.component_id) {
      const component = await componentModel.findById(req.body.component_id);
      if (!component) return res.status(404).json({ message: 'Component not found.' });
      const listing = await listingModel.findById(component.listing_id);
      if (!listing || listing.provider_id !== providerProfile.id) {
        return res.status(403).json({ message: 'Unauthorized to manage availability for this component.' });
      }
    }

    const newAvailability = await availabilityModel.create(req.body);
    res.status(201).json(newAvailability);
  } catch (err) {
    console.error('Error adding availability:', err);
    res.status(500).json({ message: 'Failed to add availability', error: err.message });
  }
});

// GET /api/providers/listings/:listingId/availability - Get availability for a listing
router.get('/listings/:listingId/availability', authenticateToken, isProvider, async (req, res) => {
  try {
    const { listingId } = req.params;
    const { startDate, endDate } = req.query; // Expect YYYY-MM-DD
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate query parameters are required.' });
    }

    // Ownership check (optional for public view, strict for provider editing)
    // For this provider-specific route, let's assume strict check
    const listing = await listingModel.findById(listingId);
    const providerProfile = await providerProfileModel.findByUserId(req.user.id);
    if (!providerProfile || !listing || listing.provider_id !== providerProfile.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const availabilities = await availabilityModel.getByListingIdAndDateRange(listingId, startDate, endDate);
    res.status(200).json(availabilities);
  } catch (err) {
    console.error('Error fetching listing availability:', err);
    res.status(500).json({ message: 'Failed to fetch listing availability', error: err.message });
  }
});

// GET /api/providers/components/:componentId/availability - Get availability for a component
router.get('/components/:componentId/availability', authenticateToken, isProvider, async (req, res) => {
    try {
      const { componentId } = req.params;
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        return res.status(400).json({ message: 'startDate and endDate query parameters are required.' });
      }
  
      const component = await componentModel.findById(componentId);
      if (!component) return res.status(404).json({ message: 'Component not found.' });
      const listing = await listingModel.findById(component.listing_id);
      const providerProfile = await providerProfileModel.findByUserId(req.user.id);
      if (!providerProfile || !listing || listing.provider_id !== providerProfile.id) {
        return res.status(403).json({ message: 'Unauthorized' });
      }
  
      const availabilities = await availabilityModel.getByComponentIdAndDateRange(componentId, startDate, endDate);
      res.status(200).json(availabilities);
    } catch (err) {
      console.error('Error fetching component availability:', err);
      res.status(500).json({ message: 'Failed to fetch component availability', error: err.message });
    }
  });

// PUT /api/providers/availability/:availabilityId - Update an availability slot
router.put('/availability/:availabilityId', authenticateToken, isVerifiedProvider, async (req, res) => {
  try {
    const { availabilityId } = req.params;
    // Validate req.body against a schema similar to availabilitySchema but without listing_id/component_id
    const updateSchema = Joi.object({
        available_date: Joi.date().iso().optional(),
        start_time: Joi.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().allow(null),
        end_time: Joi.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().allow(null),
        max_bookings: Joi.number().integer().min(0).optional().allow(null),
        is_available: Joi.boolean().optional(),
        price_override: Joi.number().min(0).optional().allow(null)
      });
    const { error } = updateSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const availability = await availabilityModel.findById(availabilityId);
    if (!availability) return res.status(404).json({ message: 'Availability slot not found.' });

    const providerProfile = await providerProfileModel.findByUserId(req.user.id);
    if (!providerProfile) return res.status(403).json({ message: 'Provider profile required.' });

    // Check ownership
    if (availability.listing_id) {
      const listing = await listingModel.findById(availability.listing_id);
      if (!listing || listing.provider_id !== providerProfile.id) {
        return res.status(403).json({ message: 'Unauthorized.' });
      }
    } else if (availability.component_id) {
      const component = await componentModel.findById(availability.component_id);
      if (!component) return res.status(404).json({ message: 'Component not found.' });
      const listing = await listingModel.findById(component.listing_id);
      if (!listing || listing.provider_id !== providerProfile.id) {
        return res.status(403).json({ message: 'Unauthorized.' });
      }
    }

    const updatedAvailability = await availabilityModel.update(availabilityId, req.body);
    res.status(200).json(updatedAvailability);
  } catch (err) {
    console.error('Error updating availability:', err);
    res.status(500).json({ message: 'Failed to update availability', error: err.message });
  }
});

// DELETE /api/providers/availability/:availabilityId - Delete an availability slot
router.delete('/availability/:availabilityId', authenticateToken, isVerifiedProvider, async (req, res) => {
  try {
    const { availabilityId } = req.params;
    const availability = await availabilityModel.findById(availabilityId);
    if (!availability) return res.status(404).json({ message: 'Availability slot not found.' });

    const providerProfile = await providerProfileModel.findByUserId(req.user.id);
     if (!providerProfile) return res.status(403).json({ message: 'Provider profile required.' });

    // Check ownership (similar to PUT route)
    if (availability.listing_id) {
        const listing = await listingModel.findById(availability.listing_id);
        if (!listing || listing.provider_id !== providerProfile.id) {
          return res.status(403).json({ message: 'Unauthorized.' });
        }
      } else if (availability.component_id) {
        const component = await componentModel.findById(availability.component_id);
        if (!component) return res.status(404).json({ message: 'Component not found.' });
        const listing = await listingModel.findById(component.listing_id);
        if (!listing || listing.provider_id !== providerProfile.id) {
          return res.status(403).json({ message: 'Unauthorized.' });
        }
      }

    await availabilityModel.delete(availabilityId);
    res.status(200).json({ message: 'Availability slot deleted successfully.' });
  } catch (err) {
    console.error('Error deleting availability:', err);
    res.status(500).json({ message: 'Failed to delete availability', error: err.message });
  }
});


// ====================================
// Booking Management Routes (for providers)
// ====================================

// GET /api/providers/bookings - Get all bookings for the provider's services
router.get('/bookings', authenticateToken, isProvider, async (req, res) => {
  try {
    const providerProfile = await providerProfileModel.findByUserId(req.user.id);
    if (!providerProfile) {
      return res.status(404).json({ message: 'Provider profile not found.' });
    }
    const bookings = await bookingModel.getByProviderId(providerProfile.id, req.query.status);
    res.status(200).json(bookings);
  } catch (err) {
    console.error('Error fetching provider bookings:', err);
    res.status(500).json({ message: 'Failed to fetch provider bookings', error: err.message });
  }
});

// GET /api/providers/bookings/:bookingId - Get details of a specific booking
router.get('/bookings/:bookingId', authenticateToken, isProvider, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await bookingModel.getWithComponents(bookingId); // Use getWithComponents for detailed view
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    // Check if this booking belongs to the provider
    const providerProfile = await providerProfileModel.findByUserId(req.user.id);
    if (!providerProfile) return res.status(403).json({ message: 'Provider profile required.' });

    let isOwner = false;
    if (booking.listing_id) {
        const listing = await listingModel.findById(booking.listing_id);
        if (listing && listing.provider_id === providerProfile.id) isOwner = true;
    } else if (booking.custom_trip_id && booking.components) {
        // For custom trips, check if any component is managed by this provider
        // This requires booking_components to link to provider_id
        const providerBookingComponents = await bookingComponentModel.getByBookingIdAndProviderId(bookingId, providerProfile.id);
        if(providerBookingComponents.length > 0) isOwner = true;
    }

    if (!isOwner) {
      return res.status(403).json({ message: 'You are not authorized to view this booking.' });
    }

    res.status(200).json(booking);
  } catch (err) {
    console.error('Error fetching booking details:', err);
    res.status(500).json({ message: 'Failed to fetch booking details', error: err.message });
  }
});

// PUT /api/providers/bookings/:bookingId/status - Update the status of a booking
const bookingStatusSchema = Joi.object({
  status: Joi.string().valid('confirmed', 'cancelled', 'completed').required(), // Provider can confirm, cancel, or complete
  // Optionally add reason for cancellation
  cancellation_reason: Joi.string().when('status', { is: 'cancelled', then: Joi.optional(), otherwise: Joi.forbidden() })
});
router.put('/bookings/:bookingId/status', authenticateToken, isVerifiedProvider, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { error } = bookingStatusSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const booking = await bookingModel.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }
    
    // Ownership check (similar to GET /bookings/:bookingId)
    const providerProfile = await providerProfileModel.findByUserId(req.user.id);
    if (!providerProfile) return res.status(403).json({ message: 'Provider profile required.' });
    let isOwner = false;
    if (booking.listing_id) {
        const listing = await listingModel.findById(booking.listing_id);
        if (listing && listing.provider_id === providerProfile.id) isOwner = true;
    } else if (booking.custom_trip_id) {
        const providerBookingComponents = await bookingComponentModel.getByBookingIdAndProviderId(bookingId, providerProfile.id);
        if(providerBookingComponents.length > 0) isOwner = true;
        // If updating status of a custom trip, this might affect multiple providers.
        // For now, assume provider can only update status of their components or overall if they are primary.
        // This logic might need refinement based on how custom trip bookings are structured.
        // For simplicity, if it's a custom trip, a provider might only confirm *their part*.
        // The overall booking status might be managed by the platform or a lead provider.
        // Let's assume for now, if it's a direct listing booking, provider can update.
        // If custom_trip, this endpoint might be more complex or restricted.
        if (booking.custom_trip_id && !booking.listing_id && req.body.status !== 'completed') { // Allow completing their part
             // Only allow updating status of their specific components in a custom trip.
             // This route might be better suited for /api/providers/booking-components/:componentBookingId/status
             // For now, we'll keep it simple: if it's a listing booking, proceed.
        }
    }
    if (!isOwner && booking.listing_id) { // Only allow full status update for direct listing bookings by owner
        return res.status(403).json({ message: 'You are not authorized to update this booking status.' });
    }
    if (!isOwner && booking.custom_trip_id) {
        return res.status(403).json({ message: 'Updating full custom trip status by individual providers is restricted. Manage component status instead.' });
    }


    const updatedBooking = await bookingModel.update(bookingId, { status: req.body.status });
    // TODO: Add logic for notifications, refunds if 'cancelled', inventory updates.

    res.status(200).json(updatedBooking);
  } catch (err) {
    console.error('Error updating booking status:', err);
    res.status(500).json({ message: 'Failed to update booking status', error: err.message });
  }
});

// ====================================
// Dashboard & Analytics Routes
// ====================================

// GET /api/providers/dashboard/summary - Get provider dashboard summary
router.get('/dashboard/summary', authenticateToken, isProvider, async (req, res) => {
  try {
    const providerProfile = await providerProfileModel.findByUserId(req.user.id);
    if (!providerProfile) {
      return res.status(404).json({ message: 'Provider profile not found.' });
    }

    // Example: Fetch total bookings, upcoming bookings, total revenue (simplified)
    const totalBookingsResult = await bookingModel.countByProviderId(providerProfile.id);
    const upcomingBookingsResult = await bookingModel.countByProviderIdAndStatus(providerProfile.id, 'confirmed', new Date()); // status and future date
    // const totalRevenueResult = await paymentModel.getTotalRevenueForProvider(providerProfile.id); // Needs paymentModel

    res.status(200).json({
      totalListings: (await listingModel.getByProviderId(providerProfile.id)).length,
      totalBookings: totalBookingsResult.count || 0,
      upcomingBookings: upcomingBookingsResult.count || 0,
      // totalRevenue: totalRevenueResult.sum || 0, // Placeholder
      // averageRating: providerProfile.average_rating || 0 // From provider_profiles table
    });
  } catch (err) {
    console.error('Error fetching dashboard summary:', err);
    res.status(500).json({ message: 'Failed to fetch dashboard summary', error: err.message });
  }
});

// GET /api/providers/dashboard/earnings - Get detailed earnings and payout information
router.get('/dashboard/earnings', authenticateToken, isProvider, async (req, res) => {
  try {
    const providerProfile = await providerProfileModel.findByUserId(req.user.id);
    if (!providerProfile) {
      return res.status(404).json({ message: 'Provider profile not found.' });
    }

    // const payouts = await paymentModel.getPayoutsForProvider(providerProfile.id, req.query.startDate, req.query.endDate);
    // const earningsBreakdown = await paymentModel.getEarningsBreakdownForProvider(providerProfile.id, req.query.period);
    
    // Placeholder response
    res.status(200).json({
      message: "Earnings and payout details endpoint - to be implemented with paymentModel.",
      // payouts: payouts,
      // earningsBreakdown: earningsBreakdown
    });
  } catch (err) {
    console.error('Error fetching earnings data:', err);
    res.status(500).json({ message: 'Failed to fetch earnings data', error: err.message });
  }
});


module.exports = router;

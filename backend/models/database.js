/**
 * Database Connection and Models for AdventureConnect
 * 
 * This file provides database connections and model functions for all database tables.
 */

const { Pool } = require('pg');
const redis = require('redis');
const format = require('pg-format');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'database-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/database-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/database.log' })
  ]
});

// PostgreSQL Connection Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://tour_operator:secure_password@postgres:5432/tour_operator_db',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test PostgreSQL connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    logger.error('PostgreSQL connection error:', err);
  } else {
    logger.info('PostgreSQL connected:', res.rows[0].now);
  }
});

// Redis Client
let redisClient;

const connectRedis = async () => {
  try {
    redisClient = redis.createClient({
      url: `redis://${process.env.REDIS_HOST || 'redis'}:${process.env.REDIS_PORT || 6379}`
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    await redisClient.connect();
    logger.info('Redis connected');
    return redisClient;
  } catch (err) {
    logger.error('Redis connection error:', err);
    // No explicit throw here, allow server.js to handle it if needed
    // or rely on redisClient being undefined/null.
  }
};

/**
 * Helper function to execute database queries with error handling
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise} - Query result
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (err) {
    logger.error('Query error', { text, error: err.message, stack: err.stack });
    throw err;
  }
};

/**
 * Begin a database transaction
 * @returns {Object} - Client object with transaction methods
 */
const beginTransaction = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    return {
      query: (text, params) => client.query(text, params),
      commit: async () => {
        await client.query('COMMIT');
        client.release();
      },
      rollback: async () => {
        await client.query('ROLLBACK');
        client.release();
      }
    };
  } catch (err) {
    client.release();
    throw err;
  }
};

// ====================================
// User Models
// ====================================

const userModel = {
  /**
   * Create a new user
   * @param {Object} userData - User data (email, password_hash, first_name, last_name, role)
   * @returns {Promise} - New user object
   */
  create: async (userData) => {
    const { email, password_hash, first_name, last_name, role = 'traveler' } = userData;
    
    const result = await query(
      'INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [email, password_hash, first_name, last_name, role]
    );
    
    return result.rows[0];
  },
  
  /**
   * Find a user by email
   * @param {string} email - User email
   * @returns {Promise} - User object or null
   */
  findByEmail: async (email) => {
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] || null;
  },
  
  /**
   * Find a user by ID
   * @param {number} id - User ID
   * @returns {Promise} - User object or null
   */
  findById: async (id) => {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] || null;
  },
  
  /**
   * Update a user
   * @param {number} id - User ID
   * @param {Object} userData - User data to update
   * @returns {Promise} - Updated user object
   */
  update: async (id, userData) => {
    const allowedFields = ['first_name', 'last_name', 'email', 'profile_image_url', 'phone_number', 'bio', 'preferences'];
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    Object.keys(userData).forEach(key => {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = $${paramIndex}`);
        values.push(userData[key]);
        paramIndex++;
      }
    });
    
    if (updates.length === 0) return null;
    
    values.push(id);
    const result = await query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    
    return result.rows[0];
  },
  
  /**
   * Update user password
   * @param {number} id - User ID
   * @param {string} passwordHash - New password hash
   * @returns {Promise} - Success status
   */
  updatePassword: async (id, passwordHash) => {
    const result = await query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id',
      [passwordHash, id]
    );
    
    return result.rows[0] || null;
  },
  
  /**
   * Update last login timestamp
   * @param {number} id - User ID
   * @returns {Promise} - Success status
   */
  updateLastLogin: async (id) => {
    await query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
    
    return true;
  },
  
  /**
   * Verify user email
   * @param {number} id - User ID
   * @returns {Promise} - Success status
   */
  verifyEmail: async (id) => {
    const result = await query(
      'UPDATE users SET email_verified = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id',
      [id]
    );
    
    return result.rows[0] || null;
  },
  
  /**
   * Delete a user
   * @param {number} id - User ID
   * @returns {Promise} - Success status
   */
  delete: async (id) => {
    const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    return result.rows[0] || null;
  }
};

// ====================================
// Refresh Token Models
// ====================================

const tokenModel = {
  /**
   * Create a refresh token
   * @param {number} userId - User ID
   * @param {string} token - Refresh token
   * @param {number} expiresInDays - Token expiration in days
   * @returns {Promise} - New token object
   */
  create: async (userId, token, expiresInDays = 7) => {
    const result = await query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL \'$3 days\') RETURNING *',
      [userId, token, expiresInDays]
    );
    
    return result.rows[0];
  },
  
  /**
   * Find a token
   * @param {string} token - Refresh token
   * @returns {Promise} - Token object or null
   */
  findByToken: async (token) => {
    const result = await query('SELECT * FROM refresh_tokens WHERE token = $1', [token]);
    return result.rows[0] || null;
  },
  
  /**
   * Delete a token
   * @param {string} token - Refresh token
   * @returns {Promise} - Success status
   */
  delete: async (token) => {
    const result = await query('DELETE FROM refresh_tokens WHERE token = $1 RETURNING id', [token]);
    return result.rows[0] || null;
  },
  
  /**
   * Delete all tokens for a user
   * @param {number} userId - User ID
   * @returns {Promise} - Success status
   */
  deleteAllForUser: async (userId) => {
    const result = await query('DELETE FROM refresh_tokens WHERE user_id = $1 RETURNING id', [userId]);
    return result.rowCount > 0;
  },
  
  /**
   * Delete expired tokens
   * @returns {Promise} - Number of deleted tokens
   */
  deleteExpired: async () => {
    const result = await query('DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP RETURNING id');
    return result.rowCount;
  }
};

// ====================================
// Provider Profile Models
// ====================================

const providerProfileModel = {
  /**
   * Create a provider profile
   * @param {Object} profileData - Provider profile data
   * @returns {Promise} - New provider profile object
   */
  create: async (profileData) => {
    const { 
      user_id, business_name, business_type, specialty_areas, 
      years_experience, languages, certifications, payout_information 
    } = profileData;
    
    const result = await query(
      `INSERT INTO provider_profiles 
        (user_id, business_name, business_type, specialty_areas, years_experience, languages, certifications, payout_information) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [user_id, business_name, business_type, specialty_areas, years_experience, languages, certifications, payout_information]
    );
    
    return result.rows[0];
  },
  
  /**
   * Find a provider profile by user ID
   * @param {number} userId - User ID
   * @returns {Promise} - Provider profile object or null
   */
  findByUserId: async (userId) => {
    const result = await query('SELECT * FROM provider_profiles WHERE user_id = $1', [userId]);
    return result.rows[0] || null;
  },
  
  /**
   * Find a provider profile by ID
   * @param {number} id - Provider profile ID
   * @returns {Promise} - Provider profile object or null
   */
  findById: async (id) => {
    const result = await query('SELECT * FROM provider_profiles WHERE id = $1', [id]);
    return result.rows[0] || null;
  },
  
  /**
   * Update a provider profile
   * @param {number} id - Provider profile ID
   * @param {Object} profileData - Provider profile data to update
   * @returns {Promise} - Updated provider profile object
   */
  update: async (id, profileData) => {
    const allowedFields = [
      'business_name', 'business_type', 'specialty_areas', 'years_experience',
      'languages', 'certifications', 'verification_status', 'verification_documents',
      'payout_information'
    ];
    
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    Object.keys(profileData).forEach(key => {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = $${paramIndex}`);
        values.push(profileData[key]);
        paramIndex++;
      }
    });
    
    if (updates.length === 0) return null;
    
    values.push(id);
    const result = await query(
      `UPDATE provider_profiles SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    
    return result.rows[0];
  },
  
  /**
   * Update provider rating
   * @param {number} id - Provider profile ID
   * @param {number} rating - New average rating
   * @param {number} totalReviews - New total reviews count
   * @returns {Promise} - Success status
   */
  updateRating: async (id, rating, totalReviews) => {
    const result = await query(
      'UPDATE provider_profiles SET average_rating = $1, total_reviews = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING id',
      [rating, totalReviews, id]
    );
    
    return result.rows[0] || null;
  },
  
  /**
   * Get verified providers with pagination
   * @param {number} limit - Number of providers to return
   * @param {number} offset - Pagination offset
   * @returns {Promise} - Array of provider profiles
   */
  getVerifiedProviders: async (limit = 10, offset = 0) => {
    const result = await query(
      `SELECT pp.*, u.first_name, u.last_name, u.email, u.profile_image_url
       FROM provider_profiles pp
       JOIN users u ON pp.user_id = u.id
       WHERE pp.verification_status = 'verified'
       ORDER BY pp.average_rating DESC NULLS LAST
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    return result.rows;
  },
  
  /**
   * Search providers
   * @param {Object} searchParams - Search parameters
   * @param {number} limit - Number of providers to return
   * @param {number} offset - Pagination offset
   * @returns {Promise} - Array of provider profiles
   */
  search: async (searchParams, limit = 10, offset = 0) => {
    const { keyword, specialty, businessType, minRating } = searchParams;
    const conditions = ['verification_status = \'verified\''];
    const values = [];
    let paramIndex = 1;
    
    if (keyword) {
      conditions.push(`(
        business_name ILIKE $${paramIndex} OR 
        u.first_name ILIKE $${paramIndex} OR 
        u.last_name ILIKE $${paramIndex}
      )`);
      values.push(`%${keyword}%`);
      paramIndex++;
    }
    
    if (specialty) {
      conditions.push(`$${paramIndex} = ANY(specialty_areas)`);
      values.push(specialty);
      paramIndex++;
    }
    
    if (businessType) {
      conditions.push(`business_type = $${paramIndex}`);
      values.push(businessType);
      paramIndex++;
    }
    
    if (minRating) {
      conditions.push(`average_rating >= $${paramIndex}`);
      values.push(minRating);
      paramIndex++;
    }
    
    values.push(limit, offset);
    
    const result = await query(
      `SELECT pp.*, u.first_name, u.last_name, u.email, u.profile_image_url
       FROM provider_profiles pp
       JOIN users u ON pp.user_id = u.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY pp.average_rating DESC NULLS LAST
       LIMIT $${values.length -1} OFFSET $${values.length}`, // Corrected paramIndex usage
      values
    );
    
    return result.rows;
  }
};

// ====================================
// Service Category Models
// ====================================

const categoryModel = {
  /**
   * Get all categories
   * @returns {Promise} - Array of categories
   */
  getAll: async () => {
    const result = await query('SELECT * FROM categories ORDER BY name');
    return result.rows;
  },
  
  /**
   * Get category by ID
   * @param {number} id - Category ID
   * @returns {Promise} - Category object or null
   */
  findById: async (id) => {
    const result = await query('SELECT * FROM categories WHERE id = $1', [id]);
    return result.rows[0] || null;
  },
  
  /**
   * Create a category
   * @param {Object} categoryData - Category data
   * @returns {Promise} - New category object
   */
  create: async (categoryData) => {
    const { name, description, parent_id } = categoryData;
    
    const result = await query(
      'INSERT INTO categories (name, description, parent_id) VALUES ($1, $2, $3) RETURNING *',
      [name, description, parent_id]
    );
    
    return result.rows[0];
  },
  
  /**
   * Update a category
   * @param {number} id - Category ID
   * @param {Object} categoryData - Category data to update
   * @returns {Promise} - Updated category object
   */
  update: async (id, categoryData) => {
    const { name, description, parent_id } = categoryData;
    
    const result = await query(
      `UPDATE categories 
       SET name = $1, description = $2, parent_id = $3 
       WHERE id = $4 RETURNING *`,
      [name, description, parent_id, id]
    );
    
    return result.rows[0];
  },
  
  /**
   * Delete a category
   * @param {number} id - Category ID
   * @returns {Promise} - Success status
   */
  delete: async (id) => {
    const result = await query('DELETE FROM categories WHERE id = $1 RETURNING id', [id]);
    return result.rows[0] || null;
  },
  
  /**
   * Get categories with subcategories
   * @returns {Promise} - Array of categories with subcategories
   */
  getCategoriesWithSubcategories: async () => {
    const result = await query(
      `SELECT c.id, c.name, c.description, c.parent_id,
        (SELECT json_agg(json_build_object(
          'id', sc.id,
          'name', sc.name,
          'description', sc.description
        ))
        FROM categories sc
        WHERE sc.parent_id = c.id) as subcategories
       FROM categories c
       WHERE c.parent_id IS NULL
       ORDER BY c.name`
    );
    
    return result.rows;
  }
};

// ====================================
// Service Listing Models
// ====================================

const listingModel = {
  /**
   * Create a service listing
   * @param {Object} listingData - Service listing data
   * @returns {Promise} - New service listing object
   */
  create: async (listingData) => {
    const { 
      provider_id, title, description, category_id, location_id, custom_location,
      duration_hours, is_multi_day, total_days, max_travelers, base_price, currency,
      is_customizable, is_example_itinerary, inclusions, exclusions, requirements, cancellation_policy, status
    } = listingData;
    
    const result = await query(
      `INSERT INTO service_listings 
        (provider_id, title, description, category_id, location_id, custom_location,
         duration_hours, is_multi_day, total_days, max_travelers, base_price, currency,
         is_customizable, is_example_itinerary, inclusions, exclusions, requirements, cancellation_policy, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) 
       RETURNING *`,
      [
        provider_id, title, description, category_id, location_id, custom_location,
        duration_hours, is_multi_day, total_days, max_travelers, base_price, currency,
        is_customizable, is_example_itinerary, inclusions, exclusions, requirements, cancellation_policy, status || 'draft'
      ]
    );
    
    return result.rows[0];
  },
  
  /**
   * Find a service listing by ID
   * @param {number} id - Service listing ID
   * @returns {Promise} - Service listing object or null
   */
  findById: async (id) => {
    const result = await query(
      `SELECT sl.*, 
        sc.name as category_name, 
        pp.business_name as provider_business_name,
        u.first_name as provider_first_name,
        u.last_name as provider_last_name,
        u.profile_image_url as provider_image,
        l.name as location_name,
        l.city as location_city,
        l.country as location_country
       FROM service_listings sl
       LEFT JOIN service_categories sc ON sl.category_id = sc.id
       LEFT JOIN provider_profiles pp ON sl.provider_id = pp.id
       LEFT JOIN users u ON pp.user_id = u.id
       LEFT JOIN locations l ON sl.location_id = l.id
       WHERE sl.id = $1`,
      [id]
    );
    
    return result.rows[0] || null;
  },
  
  /**
   * Get listings by provider ID
   * @param {number} providerId - Provider ID
   * @param {string} status - Listing status filter
   * @returns {Promise} - Array of service listings
   */
  getByProviderId: async (providerId, status = null) => {
    let queryString = `
      SELECT sl.*, sc.name as category_name
      FROM service_listings sl
      LEFT JOIN service_categories sc ON sl.category_id = sc.id
      WHERE sl.provider_id = $1
    `;
    
    const values = [providerId];
    
    if (status) {
      queryString += ' AND sl.status = $2';
      values.push(status);
    }
    
    queryString += ' ORDER BY sl.created_at DESC';
    
    const result = await query(queryString, values);
    return result.rows;
  },
  
  /**
   * Update a service listing
   * @param {number} id - Service listing ID
   * @param {Object} listingData - Service listing data to update
   * @returns {Promise} - Updated service listing object
   */
  update: async (id, listingData) => {
    const allowedFields = [
      'title', 'description', 'category_id', 'location_id', 'custom_location',
      'duration_hours', 'is_multi_day', 'total_days', 'max_travelers', 'base_price', 
      'currency', 'is_customizable', 'is_example_itinerary', 'inclusions', 'exclusions', 
      'requirements', 'cancellation_policy', 'status'
    ];
    
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    Object.keys(listingData).forEach(key => {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = $${paramIndex}`);
        values.push(listingData[key]);
        paramIndex++;
      }
    });
    
    if (updates.length === 0) return null;
    
    values.push(id);
    const result = await query(
      `UPDATE service_listings SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    
    return result.rows[0];
  },
  
  /**
   * Update listing rating
   * @param {number} id - Listing ID
   * @param {number} rating - New average rating
   * @param {number} totalReviews - New total reviews count
   * @returns {Promise} - Success status
   */
  updateRating: async (id, rating, totalReviews) => {
    const result = await query(
      'UPDATE service_listings SET average_rating = $1, total_reviews = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING id',
      [rating, totalReviews, id]
    );
    
    return result.rows[0] || null;
  },
  
  /**
   * Delete a service listing
   * @param {number} id - Service listing ID
   * @returns {Promise} - Success status
   */
  delete: async (id) => {
    const result = await query('DELETE FROM service_listings WHERE id = $1 RETURNING id', [id]);
    return result.rows[0] || null;
  },
  
  /**
   * Search listings with filters
   * @param {Object} filters - Search filters
   * @param {number} limit - Number of listings to return
   * @param {number} offset - Pagination offset
   * @param {string} sortBy - Sort order
   * @returns {Promise} - Array of service listings
   */
  search: async (filters, limit = 10, offset = 0, sortBy = 'rating') => {
    const {
      keyword, categoryId, locationId, city, country, minPrice, maxPrice,
      minDuration, maxDuration, isMultiDay, isCustomizable, isExampleItinerary, providerId
    } = filters;
    
    let selectClause = `SELECT sl.*,
      sc.name as category_name, 
      pp.business_name as provider_business_name,
      u.first_name as provider_first_name,
      u.last_name as provider_last_name,
      l.name as location_name,
      l.city as location_city,
      l.country as location_country,
      (
        SELECT json_agg(json_build_object(
          'id', sm.id, 
          'url', sm.url, 
          'is_featured', sm.is_featured,
          'media_type', sm.media_type
        ))
        FROM service_media sm
        WHERE sm.listing_id = sl.id
        ORDER BY sm.is_featured DESC, sm.display_order ASC
        LIMIT 5
      ) as media`;

    let fromClause = ` FROM service_listings sl
       LEFT JOIN service_categories sc ON sl.category_id = sc.id
       LEFT JOIN provider_profiles pp ON sl.provider_id = pp.id
       LEFT JOIN users u ON pp.user_id = u.id
       LEFT JOIN locations l ON sl.location_id = l.id`;
    
    const conditions = ['sl.status = \'published\''];
    const values = [];
    let paramIndex = 1;
    
    if (keyword) {
      conditions.push(`(
        sl.title ILIKE $${paramIndex} OR 
        sl.description ILIKE $${paramIndex} OR
        pp.business_name ILIKE $${paramIndex}
      )`);
      values.push(`%${keyword}%`);
      paramIndex++;
    }
    
    if (categoryId) {
      conditions.push(`sl.category_id = $${paramIndex}`);
      values.push(categoryId);
      paramIndex++;
    }
    
    if (locationId) {
      conditions.push(`sl.location_id = $${paramIndex}`);
      values.push(locationId);
      paramIndex++;
    }
    
    if (city) {
      conditions.push(`(l.city ILIKE $${paramIndex} OR sl.custom_location->>'city' ILIKE $${paramIndex})`);
      values.push(`%${city}%`);
      paramIndex++;
    }
    
    if (country) {
      conditions.push(`(l.country ILIKE $${paramIndex} OR sl.custom_location->>'country' ILIKE $${paramIndex})`);
      values.push(`%${country}%`);
      paramIndex++;
    }
    
    if (minPrice !== undefined && minPrice !== '') {
      conditions.push(`sl.base_price >= $${paramIndex}`);
      values.push(minPrice);
      paramIndex++;
    }
    
    if (maxPrice !== undefined && maxPrice !== '') {
      conditions.push(`sl.base_price <= $${paramIndex}`);
      values.push(maxPrice);
      paramIndex++;
    }
    
    if (minDuration !== undefined && minDuration !== '') {
      conditions.push(`sl.duration_hours >= $${paramIndex}`);
      values.push(minDuration);
      paramIndex++;
    }
    
    if (maxDuration !== undefined && maxDuration !== '') {
      conditions.push(`sl.duration_hours <= $${paramIndex}`);
      values.push(maxDuration);
      paramIndex++;
    }
    
    if (isMultiDay !== undefined) {
      conditions.push(`sl.is_multi_day = $${paramIndex}`);
      values.push(isMultiDay);
      paramIndex++;
    }
    
    if (isCustomizable !== undefined) {
      conditions.push(`sl.is_customizable = $${paramIndex}`);
      values.push(isCustomizable);
      paramIndex++;
    }
    
    if (isExampleItinerary !== undefined) {
      conditions.push(`sl.is_example_itinerary = $${paramIndex}`);
      values.push(isExampleItinerary);
      paramIndex++;
    }

    if (providerId) {
      conditions.push(`sl.provider_id = $${paramIndex}`);
      values.push(providerId);
      paramIndex++;
    }
    
    let orderByClause = 'ORDER BY sl.average_rating DESC NULLS LAST, sl.created_at DESC';
    if (sortBy === 'price_asc') {
      orderByClause = 'ORDER BY sl.base_price ASC, sl.average_rating DESC NULLS LAST';
    } else if (sortBy === 'price_desc') {
      orderByClause = 'ORDER BY sl.base_price DESC, sl.average_rating DESC NULLS LAST';
    } else if (sortBy === 'newest') {
      orderByClause = 'ORDER BY sl.created_at DESC, sl.average_rating DESC NULLS LAST';
    } else if (sortBy === 'popularity') { // Example: by total_reviews and rating
      orderByClause = 'ORDER BY sl.total_reviews DESC, sl.average_rating DESC NULLS LAST';
    }


    values.push(limit, offset);
    
    const queryString = `${selectClause} ${fromClause} WHERE ${conditions.join(' AND ')} ${orderByClause} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    const result = await query(queryString, values);
    
    return result.rows;
  },

  /**
   * Count search results with filters
   * @param {Object} filters - Search filters (same as search method)
   * @returns {Promise<Object>} - Object with count property
   */
  countSearch: async (filters) => {
    const {
      keyword, categoryId, locationId, city, country, minPrice, maxPrice,
      minDuration, maxDuration, isMultiDay, isCustomizable, isExampleItinerary, providerId
    } = filters;

    let countFromClause = `FROM service_listings sl
      LEFT JOIN provider_profiles pp ON sl.provider_id = pp.id
      LEFT JOIN locations l ON sl.location_id = l.id`;
      // Note: No need to join service_categories or users if not used in WHERE for count

    const conditions = ['sl.status = \'published\''];
    const values = [];
    let paramIndex = 1;

    if (keyword) {
      conditions.push(`(
        sl.title ILIKE $${paramIndex} OR 
        sl.description ILIKE $${paramIndex} OR
        pp.business_name ILIKE $${paramIndex}
      )`);
      values.push(`%${keyword}%`);
      paramIndex++;
    }
    
    if (categoryId) {
      conditions.push(`sl.category_id = $${paramIndex}`);
      values.push(categoryId);
      paramIndex++;
    }
    
    if (locationId) {
      conditions.push(`sl.location_id = $${paramIndex}`);
      values.push(locationId);
      paramIndex++;
    }
    
    if (city) {
      conditions.push(`(l.city ILIKE $${paramIndex} OR sl.custom_location->>'city' ILIKE $${paramIndex})`);
      values.push(`%${city}%`);
      paramIndex++;
    }
    
    if (country) {
      conditions.push(`(l.country ILIKE $${paramIndex} OR sl.custom_location->>'country' ILIKE $${paramIndex})`);
      values.push(`%${country}%`);
      paramIndex++;
    }
    
    if (minPrice !== undefined && minPrice !== '') {
      conditions.push(`sl.base_price >= $${paramIndex}`);
      values.push(minPrice);
      paramIndex++;
    }
    
    if (maxPrice !== undefined && maxPrice !== '') {
      conditions.push(`sl.base_price <= $${paramIndex}`);
      values.push(maxPrice);
      paramIndex++;
    }
    
    if (minDuration !== undefined && minDuration !== '') {
      conditions.push(`sl.duration_hours >= $${paramIndex}`);
      values.push(minDuration);
      paramIndex++;
    }
    
    if (maxDuration !== undefined && maxDuration !== '') {
      conditions.push(`sl.duration_hours <= $${paramIndex}`);
      values.push(maxDuration);
      paramIndex++;
    }
    
    if (isMultiDay !== undefined) {
      conditions.push(`sl.is_multi_day = $${paramIndex}`);
      values.push(isMultiDay);
      paramIndex++;
    }
    
    if (isCustomizable !== undefined) {
      conditions.push(`sl.is_customizable = $${paramIndex}`);
      values.push(isCustomizable);
      paramIndex++;
    }
    
    if (isExampleItinerary !== undefined) {
      conditions.push(`sl.is_example_itinerary = $${paramIndex}`);
      values.push(isExampleItinerary);
      paramIndex++;
    }

    if (providerId) {
      conditions.push(`sl.provider_id = $${paramIndex}`);
      values.push(providerId);
      paramIndex++;
    }

    const countQueryString = `SELECT COUNT(*) as count ${countFromClause} WHERE ${conditions.join(' AND ')}`;
    const result = await query(countQueryString, values);
    return result.rows[0] || { count: 0 };
  },
  
  /**
   * Get featured listings
   * @param {number} limit - Number of listings to return
   * @returns {Promise} - Array of service listings
   */
  getFeatured: async (limit = 6) => {
    const result = await query(
      `SELECT sl.*,
        sc.name as category_name, 
        pp.business_name as provider_business_name,
        u.first_name as provider_first_name,
        u.last_name as provider_last_name,
        l.name as location_name,
        l.city as location_city,
        l.country as location_country,
        (
          SELECT json_agg(json_build_object(
            'id', sm.id, 
            'url', sm.url, 
            'is_featured', sm.is_featured,
            'media_type', sm.media_type
          ))
          FROM service_media sm
          WHERE sm.listing_id = sl.id
          ORDER BY sm.is_featured DESC, sm.display_order ASC
          LIMIT 5
        ) as media
       FROM service_listings sl
       LEFT JOIN service_categories sc ON sl.category_id = sc.id
       LEFT JOIN provider_profiles pp ON sl.provider_id = pp.id
       LEFT JOIN users u ON pp.user_id = u.id
       LEFT JOIN locations l ON sl.location_id = l.id
       WHERE sl.status = 'published'
       ORDER BY sl.average_rating DESC NULLS LAST, sl.total_reviews DESC
       LIMIT $1`,
      [limit]
    );
    
    return result.rows;
  }
};

// ====================================
// Service Component Models
// ====================================

const componentModel = {
  /**
   * Create a service component
   * @param {Object} componentData - Service component data
   * @returns {Promise} - New service component object
   */
  create: async (componentData) => {
    const { 
      listing_id, component_type, title, description, price, currency,
      duration_hours, is_optional, day_number, time_slot, location_id, custom_location, capacity
    } = componentData;
    
    const result = await query(
      `INSERT INTO service_components 
        (listing_id, component_type, title, description, price, currency,
         duration_hours, is_optional, day_number, time_slot, location_id, custom_location, capacity) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
       RETURNING *`,
      [
        listing_id, component_type, title, description, price, currency,
        duration_hours, is_optional, day_number, time_slot, location_id, custom_location, capacity
      ]
    );
    
    return result.rows[0];
  },
  
  /**
   * Find a service component by ID
   * @param {number} id - Service component ID
   * @returns {Promise} - Service component object or null
   */
  findById: async (id) => {
    const result = await query(
      `SELECT sc.*, 
        l.name as location_name,
        l.city as location_city,
        l.country as location_country
       FROM service_components sc
       LEFT JOIN locations l ON sc.location_id = l.id
       WHERE sc.id = $1`,
      [id]
    );
    
    return result.rows[0] || null;
  },
  
  /**
   * Get components by listing ID
   * @param {number} listingId - Listing ID
   * @returns {Promise} - Array of service components
   */
  getByListingId: async (listingId) => {
    const result = await query(
      `SELECT sc.*, 
        l.name as location_name,
        l.city as location_city,
        l.country as location_country
       FROM service_components sc
       LEFT JOIN locations l ON sc.location_id = l.id
       WHERE sc.listing_id = $1
       ORDER BY sc.day_number ASC NULLS LAST, sc.time_slot ASC NULLS LAST, sc.id ASC`,
      [listingId]
    );
    
    return result.rows;
  },
  
  /**
   * Update a service component
   * @param {number} id - Service component ID
   * @param {Object} componentData - Service component data to update
   * @returns {Promise} - Updated service component object
   */
  update: async (id, componentData) => {
    const allowedFields = [
      'component_type', 'title', 'description', 'price', 'currency',
      'duration_hours', 'is_optional', 'day_number', 'time_slot', 'location_id', 
      'custom_location', 'capacity'
    ];
    
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    Object.keys(componentData).forEach(key => {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = $${paramIndex}`);
        values.push(componentData[key]);
        paramIndex++;
      }
    });
    
    if (updates.length === 0) return null;
    
    values.push(id);
    const result = await query(
      `UPDATE service_components SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    
    return result.rows[0];
  },
  
  /**
   * Delete a service component
   * @param {number} id - Service component ID
   * @returns {Promise} - Success status
   */
  delete: async (id) => {
    const result = await query('DELETE FROM service_components WHERE id = $1 RETURNING id', [id]);
    return result.rows[0] || null;
  },
  
  /**
   * Get components by type for a listing
   * @param {number} listingId - Listing ID
   * @param {string} componentType - Component type
   * @returns {Promise} - Array of service components
   */
  getByType: async (listingId, componentType) => {
    const result = await query(
      `SELECT sc.*, 
        l.name as location_name,
        l.city as location_city,
        l.country as location_country
       FROM service_components sc
       LEFT JOIN locations l ON sc.location_id = l.id
       WHERE sc.listing_id = $1 AND sc.component_type = $2
       ORDER BY sc.day_number ASC NULLS LAST, sc.time_slot ASC NULLS LAST, sc.id ASC`,
      [listingId, componentType]
    );
    
    return result.rows;
  }
};

// ====================================
// Service Availability Models
// ====================================

const availabilityModel = {
  /**
   * Create service availability
   * @param {Object} availabilityData - Service availability data
   * @returns {Promise} - New service availability object
   */
  create: async (availabilityData) => {
    const { 
      listing_id, component_id, available_date, start_time, end_time,
      max_bookings, is_available, price_override
    } = availabilityData;
    
    const result = await query(
      `INSERT INTO service_availability 
        (listing_id, component_id, available_date, start_time, end_time,
         max_bookings, is_available, price_override) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [
        listing_id, component_id, available_date, start_time, end_time,
        max_bookings, is_available, price_override
      ]
    );
    
    return result.rows[0];
  },
  
  /**
   * Create multiple service availabilities
   * @param {Array} availabilities - Array of service availability data
   * @returns {Promise} - Success status
   */
  createBulk: async (availabilities) => {
    if (!availabilities || availabilities.length === 0) {
      return [];
    }
    
    const values = availabilities.map(a => [
      a.listing_id, a.component_id, a.available_date, a.start_time, a.end_time,
      a.max_bookings, a.is_available, a.price_override
    ]);
    
    const queryString = format(
      `INSERT INTO service_availability 
        (listing_id, component_id, available_date, start_time, end_time,
         max_bookings, is_available, price_override) 
       VALUES %L 
       RETURNING *`,
      values
    );
    
    const result = await query(queryString);
    return result.rows;
  },
  
  /**
   * Find service availability by ID
   * @param {number} id - Service availability ID
   * @returns {Promise} - Service availability object or null
   */
  findById: async (id) => {
    const result = await query('SELECT * FROM service_availability WHERE id = $1', [id]);
    return result.rows[0] || null;
  },
  
  /**
   * Get availabilities by listing ID and date range
   * @param {number} listingId - Listing ID
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise} - Array of service availabilities
   */
  getByListingIdAndDateRange: async (listingId, startDate, endDate) => {
    const result = await query(
      `SELECT * FROM service_availability 
       WHERE listing_id = $1 AND available_date BETWEEN $2 AND $3
       ORDER BY available_date ASC, start_time ASC`,
      [listingId, startDate, endDate]
    );
    
    return result.rows;
  },
  
  /**
   * Get availabilities by component ID and date range
   * @param {number} componentId - Component ID
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise} - Array of service availabilities
   */
  getByComponentIdAndDateRange: async (componentId, startDate, endDate) => {
    const result = await query(
      `SELECT * FROM service_availability 
       WHERE component_id = $1 AND available_date BETWEEN $2 AND $3
       ORDER BY available_date ASC, start_time ASC`,
      [componentId, startDate, endDate]
    );
    
    return result.rows;
  },
  
  /**
   * Update service availability
   * @param {number} id - Service availability ID
   * @param {Object} availabilityData - Service availability data to update
   * @returns {Promise} - Updated service availability object
   */
  update: async (id, availabilityData) => {
    const allowedFields = [
      'available_date', 'start_time', 'end_time', 'max_bookings', 
      'current_bookings', 'is_available', 'price_override'
    ];
    
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    Object.keys(availabilityData).forEach(key => {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = $${paramIndex}`);
        values.push(availabilityData[key]);
        paramIndex++;
      }
    });
    
    if (updates.length === 0) return null;
    
    values.push(id);
    const result = await query(
      `UPDATE service_availability SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    
    return result.rows[0];
  },
  
  /**
   * Delete service availability
   * @param {number} id - Service availability ID
   * @returns {Promise} - Success status
   */
  delete: async (id) => {
    const result = await query('DELETE FROM service_availability WHERE id = $1 RETURNING id', [id]);
    return result.rows[0] || null;
  },
  
  /**
   * Check availability for booking
   * @param {number} listingId - Listing ID
   * @param {string} date - Date (YYYY-MM-DD)
   * @param {number} travelers - Number of travelers
   * @returns {Promise} - Available slot or null
   */
  checkAvailability: async (listingId, date, travelers) => {
    const result = await query(
      `SELECT * FROM service_availability 
       WHERE listing_id = $1 AND available_date = $2 AND is_available = true
       AND (max_bookings - current_bookings) >= $3
       LIMIT 1`,
      [listingId, date, travelers]
    );
    
    return result.rows[0] || null;
  },
  
  /**
   * Update current bookings count
   * @param {number} id - Service availability ID
   * @param {number} increment - Number to increment (positive) or decrement (negative)
   * @returns {Promise} - Updated service availability object
   */
  updateBookingCount: async (id, increment) => {
    const result = await query(
      `UPDATE service_availability 
       SET current_bookings = current_bookings + $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING *`,
      [increment, id]
    );
    
    return result.rows[0];
  }
};

// ====================================
// Service Media Models
// ====================================

const mediaModel = {
  /**
   * Create service media
   * @param {Object} mediaData - Service media data
   * @returns {Promise} - New service media object
   */
  create: async (mediaData) => {
    const { 
      listing_id, component_id, media_type, url, caption, is_featured, display_order
    } = mediaData;
    
    const result = await query(
      `INSERT INTO service_media 
        (listing_id, component_id, media_type, url, caption, is_featured, display_order) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [
        listing_id, component_id, media_type, url, caption, is_featured, display_order || 0
      ]
    );
    
    return result.rows[0];
  },
  
  /**
   * Create multiple service media
   * @param {Array} mediaItems - Array of service media data
   * @returns {Promise} - Success status
   */
  createBulk: async (mediaItems) => {
    if (!mediaItems || mediaItems.length === 0) {
      return [];
    }
    
    const values = mediaItems.map(m => [
      m.listing_id, m.component_id, m.media_type, m.url, m.caption, 
      m.is_featured || false, m.display_order || 0
    ]);
    
    const queryString = format(
      `INSERT INTO service_media 
        (listing_id, component_id, media_type, url, caption, is_featured, display_order) 
       VALUES %L 
       RETURNING *`,
      values
    );
    
    const result = await query(queryString);
    return result.rows;
  },
  
  /**
   * Find service media by ID
   * @param {number} id - Service media ID
   * @returns {Promise} - Service media object or null
   */
  findById: async (id) => {
    const result = await query('SELECT * FROM service_media WHERE id = $1', [id]);
    return result.rows[0] || null;
  },
  
  /**
   * Get media by listing ID
   * @param {number} listingId - Listing ID
   * @returns {Promise} - Array of service media
   */
  getByListingId: async (listingId) => {
    const result = await query(
      `SELECT * FROM service_media 
       WHERE listing_id = $1
       ORDER BY is_featured DESC, display_order ASC, id ASC`,
      [listingId]
    );
    
    return result.rows;
  },
  
  /**
   * Get media by component ID
   * @param {number} componentId - Component ID
   * @returns {Promise} - Array of service media
   */
  getByComponentId: async (componentId) => {
    const result = await query(
      `SELECT * FROM service_media 
       WHERE component_id = $1
       ORDER BY is_featured DESC, display_order ASC, id ASC`,
      [componentId]
    );
    
    return result.rows;
  },
  
  /**
   * Update service media
   * @param {number} id - Service media ID
   * @param {Object} mediaData - Service media data to update
   * @returns {Promise} - Updated service media object
   */
  update: async (id, mediaData) => {
    const allowedFields = [
      'media_type', 'url', 'caption', 'is_featured', 'display_order'
    ];
    
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    Object.keys(mediaData).forEach(key => {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = $${paramIndex}`);
        values.push(mediaData[key]);
        paramIndex++;
      }
    });
    
    if (updates.length === 0) return null;
    
    values.push(id);
    const result = await query(
      `UPDATE service_media SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    
    return result.rows[0];
  },
  
  /**
   * Delete service media
   * @param {number} id - Service media ID
   * @returns {Promise} - Success status
   */
  delete: async (id) => {
    const result = await query('DELETE FROM service_media WHERE id = $1 RETURNING id', [id]);
    return result.rows[0] || null;
  }
};

// ====================================
// Custom Trip Models
// ====================================

const customTripModel = {
  /**
   * Create a custom trip
   * @param {Object} tripData - Custom trip data
   * @returns {Promise} - New custom trip object
   */
  create: async (tripData) => {
    const { 
      traveler_id, title, description, start_date, end_date, number_of_travelers,
      total_price, currency, status, inspiration_source, inspiration_reference_id
    } = tripData;
    
    const result = await query(
      `INSERT INTO custom_trips 
        (traveler_id, title, description, start_date, end_date, number_of_travelers,
         total_price, currency, status, inspiration_source, inspiration_reference_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
       RETURNING *`,
      [
        traveler_id, title, description, start_date, end_date, number_of_travelers,
        total_price, currency, status || 'draft', inspiration_source, inspiration_reference_id
      ]
    );
    
    return result.rows[0];
  },
  
  /**
   * Find a custom trip by ID
   * @param {number} id - Custom trip ID
   * @returns {Promise} - Custom trip object or null
   */
  findById: async (id) => {
    const result = await query('SELECT * FROM custom_trips WHERE id = $1', [id]);
    return result.rows[0] || null;
  },
  
  /**
   * Get custom trips by traveler ID
   * @param {number} travelerId - Traveler ID
   * @param {string} status - Trip status filter
   * @returns {Promise} - Array of custom trips
   */
  getByTravelerId: async (travelerId, status = null) => {
    let queryString = 'SELECT * FROM custom_trips WHERE traveler_id = $1';
    const values = [travelerId];
    
    if (status) {
      queryString += ' AND status = $2';
      values.push(status);
    }
    
    queryString += ' ORDER BY created_at DESC';
    
    const result = await query(queryString, values);
    return result.rows;
  },
  
  /**
   * Update a custom trip
   * @param {number} id - Custom trip ID
   * @param {Object} tripData - Custom trip data to update
   * @returns {Promise} - Updated custom trip object
   */
  update: async (id, tripData) => {
    const allowedFields = [
      'title', 'description', 'start_date', 'end_date', 'number_of_travelers',
      'total_price', 'currency', 'status'
    ];
    
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    Object.keys(tripData).forEach(key => {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = $${paramIndex}`);
        values.push(tripData[key]);
        paramIndex++;
      }
    });
    
    if (updates.length === 0) return null;
    
    values.push(id);
    const result = await query(
      `UPDATE custom_trips SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    
    return result.rows[0];
  },
  
  /**
   * Delete a custom trip
   * @param {number} id - Custom trip ID
   * @returns {Promise} - Success status
   */
  delete: async (id) => {
    const result = await query('DELETE FROM custom_trips WHERE id = $1 RETURNING id', [id]);
    return result.rows[0] || null;
  },
  
  /**
   * Get a custom trip with all components
   * @param {number} id - Custom trip ID
   * @returns {Promise} - Custom trip object with components
   */
  getWithComponents: async (id) => {
    const tripResult = await query('SELECT * FROM custom_trips WHERE id = $1', [id]);
    const trip = tripResult.rows[0];
    
    if (!trip) return null;
    
    const componentsResult = await query(
      `SELECT tc.*, 
        l.name as location_name,
        l.city as location_city,
        l.country as location_country
       FROM trip_components tc
       LEFT JOIN locations l ON tc.location_id = l.id
       WHERE tc.trip_id = $1
       ORDER BY tc.start_date ASC, tc.start_time ASC, tc.id ASC`,
      [id]
    );
    
    trip.components = componentsResult.rows;
    return trip;
  }
};

// ====================================
// Trip Component Models
// ====================================

const tripComponentModel = {
  /**
   * Create a trip component
   * @param {Object} componentData - Trip component data
   * @returns {Promise} - New trip component object
   */
  create: async (componentData) => {
    const { 
      trip_id, component_type, service_component_id, listing_id, external_provider,
      external_reference_id, title, description, start_date, end_date, start_time,
      end_time, location_id, custom_location, price, currency, status, notes
    } = componentData;
    
    const result = await query(
      `INSERT INTO trip_components 
        (trip_id, component_type, service_component_id, listing_id, external_provider,
         external_reference_id, title, description, start_date, end_date, start_time,
         end_time, location_id, custom_location, price, currency, status, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) 
       RETURNING *`,
      [
        trip_id, component_type, service_component_id, listing_id, external_provider,
        external_reference_id, title, description, start_date, end_date, start_time,
        end_time, location_id, custom_location, price, currency, status || 'planned', notes
      ]
    );
    
    return result.rows[0];
  },
  
  /**
   * Create multiple trip components
   * @param {Array} components - Array of trip component data
   * @returns {Promise} - Success status
   */
  createBulk: async (components) => {
    if (!components || components.length === 0) {
      return [];
    }
    
    const client = await beginTransaction();
    try {
      const createdComponents = [];
      for (const component of components) {
        const { 
          trip_id, component_type, service_component_id, listing_id, external_provider,
          external_reference_id, title, description, start_date, end_date, start_time,
          end_time, location_id, custom_location, price, currency, status, notes
        } = component;
        
        const result = await client.query(
          `INSERT INTO trip_components 
            (trip_id, component_type, service_component_id, listing_id, external_provider,
             external_reference_id, title, description, start_date, end_date, start_time,
             end_time, location_id, custom_location, price, currency, status, notes) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) 
           RETURNING *`,
          [
            trip_id, component_type, service_component_id, listing_id, external_provider,
            external_reference_id, title, description, start_date, end_date, start_time,
            end_time, location_id, custom_location, price, currency, status || 'planned', notes
          ]
        );
        
        createdComponents.push(result.rows[0]);
      }
      
      await client.commit();
      return createdComponents;
    } catch (err) {
      await client.rollback();
      throw err;
    }
  },
  
  /**
   * Find a trip component by ID
   * @param {number} id - Trip component ID
   * @returns {Promise} - Trip component object or null
   */
  findById: async (id) => {
    const result = await query(
      `SELECT tc.*, 
        l.name as location_name,
        l.city as location_city,
        l.country as location_country
       FROM trip_components tc
       LEFT JOIN locations l ON tc.location_id = l.id
       WHERE tc.id = $1`,
      [id]
    );
    
    return result.rows[0] || null;
  },
  
  /**
   * Get components by trip ID
   * @param {number} tripId - Trip ID
   * @returns {Promise} - Array of trip components
   */
  getByTripId: async (tripId) => {
    const result = await query(
      `SELECT tc.*, 
        l.name as location_name,
        l.city as location_city,
        l.country as location_country
       FROM trip_components tc
       LEFT JOIN locations l ON tc.location_id = l.id
       WHERE tc.trip_id = $1
       ORDER BY tc.start_date ASC, tc.start_time ASC, tc.id ASC`,
      [tripId]
    );
    
    return result.rows;
  },
  
  /**
   * Update a trip component
   * @param {number} id - Trip component ID
   * @param {Object} componentData - Trip component data to update
   * @returns {Promise} - Updated trip component object
   */
  update: async (id, componentData) => {
    const allowedFields = [
      'title', 'description', 'start_date', 'end_date', 'start_time',
      'end_time', 'location_id', 'custom_location', 'price', 'currency', 
      'status', 'external_reference_id', 'notes'
    ];
    
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    Object.keys(componentData).forEach(key => {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = $${paramIndex}`);
        values.push(componentData[key]);
        paramIndex++;
      }
    });
    
    if (updates.length === 0) return null;
    
    values.push(id);
    const result = await query(
      `UPDATE trip_components SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    
    return result.rows[0];
  },
  
  /**
   * Delete a trip component
   * @param {number} id - Trip component ID
   * @returns {Promise} - Success status
   */
  delete: async (id) => {
    const result = await query('DELETE FROM trip_components WHERE id = $1 RETURNING id', [id]);
    return result.rows[0] || null;
  },

  /**
   * Delete all trip components for a given trip ID
   * @param {number} tripId - Trip ID
   * @returns {Promise} - Number of deleted components
   */
  deleteByTripId: async (tripId) => {
    const result = await query('DELETE FROM trip_components WHERE trip_id = $1 RETURNING id', [tripId]);
    return result.rowCount;
  },
  
  /**
   * Get components by type for a trip
   * @param {number} tripId - Trip ID
   * @param {string} componentType - Component type
   * @returns {Promise} - Array of trip components
   */
  getByType: async (tripId, componentType) => {
    const result = await query(
      `SELECT tc.*, 
        l.name as location_name,
        l.city as location_city,
        l.country as location_country
       FROM trip_components tc
       LEFT JOIN locations l ON tc.location_id = l.id
       WHERE tc.trip_id = $1 AND tc.component_type = $2
       ORDER BY tc.start_date ASC, tc.start_time ASC, tc.id ASC`,
      [tripId, componentType]
    );
    
    return result.rows;
  }
};

// ====================================
// AI Trip Suggestion Models
// ====================================

const aiTripSuggestionModel = {
  /**
   * Create an AI trip suggestion
   * @param {Object} suggestionData - AI trip suggestion data
   * @returns {Promise} - New AI trip suggestion object
   */
  create: async (suggestionData) => {
    const { 
      user_id, image_url, suggested_destinations, suggested_activities,
      suggested_example_trips, processing_status
    } = suggestionData;
    
    const result = await query(
      `INSERT INTO ai_trip_suggestions 
        (user_id, image_url, suggested_destinations, suggested_activities,
         suggested_example_trips, processing_status) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [
        user_id, image_url, suggested_destinations || {}, suggested_activities || {},
        suggested_example_trips || {}, processing_status || 'pending'
      ]
    );
    
    return result.rows[0];
  },
  
  /**
   * Find an AI trip suggestion by ID
   * @param {number} id - AI trip suggestion ID
   * @returns {Promise} - AI trip suggestion object or null
   */
  findById: async (id) => {
    const result = await query('SELECT * FROM ai_trip_suggestions WHERE id = $1', [id]);
    return result.rows[0] || null;
  },
  
  /**
   * Get AI trip suggestions by user ID
   * @param {number} userId - User ID
   * @param {number} limit - Number of suggestions to return
   * @returns {Promise} - Array of AI trip suggestions
   */
  getByUserId: async (userId, limit = 10) => {
    const result = await query(
      'SELECT * FROM ai_trip_suggestions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );
    
    return result.rows;
  },
  
  /**
   * Update an AI trip suggestion
   * @param {number} id - AI trip suggestion ID
   * @param {Object} suggestionData - AI trip suggestion data to update
   * @returns {Promise} - Updated AI trip suggestion object
   */
  update: async (id, suggestionData) => {
    const allowedFields = [
      'suggested_destinations', 'suggested_activities',
      'suggested_example_trips', 'processing_status'
    ];
    
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    Object.keys(suggestionData).forEach(key => {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = $${paramIndex}`);
        values.push(suggestionData[key]);
        paramIndex++;
      }
    });
    
    if (updates.length === 0) return null;
    
    values.push(id);
    const result = await query(
      `UPDATE ai_trip_suggestions SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    
    return result.rows[0];
  },
  
  /**
   * Delete an AI trip suggestion
   * @param {number} id - AI trip suggestion ID
   * @returns {Promise} - Success status
   */
  delete: async (id) => {
    const result = await query('DELETE FROM ai_trip_suggestions WHERE id = $1 RETURNING id', [id]);
    return result.rows[0] || null;
  }
};

// ====================================
// Booking Models
// ====================================

const bookingModel = {
  /**
   * Create a booking
   * @param {Object} bookingData - Booking data
   * @returns {Promise} - New booking object
   */
  create: async (bookingData) => {
    const { 
      booking_reference, traveler_id, custom_trip_id, listing_id, start_date, end_date,
      number_of_travelers, total_price, currency, status, special_requests, traveler_contact_info
    } = bookingData;
    
    const result = await query(
      `INSERT INTO bookings 
        (booking_reference, traveler_id, custom_trip_id, listing_id, start_date, end_date,
         number_of_travelers, total_price, currency, status, special_requests, traveler_contact_info) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
       RETURNING *`,
      [
        booking_reference, traveler_id, custom_trip_id, listing_id, start_date, end_date,
        number_of_travelers, total_price, currency, status || 'pending', special_requests, traveler_contact_info || {}
      ]
    );
    
    return result.rows[0];
  },
  
  /**
   * Find a booking by ID
   * @param {number} id - Booking ID
   * @returns {Promise} - Booking object or null
   */
  findById: async (id) => {
    const result = await query('SELECT * FROM bookings WHERE id = $1', [id]);
    return result.rows[0] || null;
  },
  
  /**
   * Find a booking by reference
   * @param {string} reference - Booking reference
   * @returns {Promise} - Booking object or null
   */
  findByReference: async (reference) => {
    const result = await query('SELECT * FROM bookings WHERE booking_reference = $1', [reference]);
    return result.rows[0] || null;
  },
  
  /**
   * Get bookings by traveler ID
   * @param {number} travelerId - Traveler ID
   * @param {string} status - Booking status filter
   * @returns {Promise} - Array of bookings
   */
  getByTravelerId: async (travelerId, status = null) => {
    let queryString = `
      SELECT b.*, 
        CASE
          WHEN b.listing_id IS NOT NULL THEN sl.title
          WHEN b.custom_trip_id IS NOT NULL THEN ct.title
          ELSE NULL
        END as trip_title
      FROM bookings b
      LEFT JOIN service_listings sl ON b.listing_id = sl.id
      LEFT JOIN custom_trips ct ON b.custom_trip_id = ct.id
      WHERE b.traveler_id = $1
    `;
    
    const values = [travelerId];
    
    if (status) {
      queryString += ' AND b.status = $2';
      values.push(status);
    }
    
    queryString += ' ORDER BY b.start_date DESC, b.created_at DESC';
    
    const result = await query(queryString, values);
    return result.rows;
  },
  
  /**
   * Get bookings by listing ID
   * @param {number} listingId - Listing ID
   * @param {string} status - Booking status filter
   * @returns {Promise} - Array of bookings
   */
  getByListingId: async (listingId, status = null) => {
    let queryString = `
      SELECT b.*, u.first_name, u.last_name, u.email
      FROM bookings b
      JOIN users u ON b.traveler_id = u.id
      WHERE b.listing_id = $1
    `;
    
    const values = [listingId];
    
    if (status) {
      queryString += ' AND b.status = $2';
      values.push(status);
    }
    
    queryString += ' ORDER BY b.start_date ASC, b.created_at DESC';
    
    const result = await query(queryString, values);
    return result.rows;
  },
  
  /**
   * Get bookings by provider ID (for their direct listings or components they own in custom trips)
   * @param {number} providerId - Provider ID
   * @param {string} status - Booking status filter
   * @returns {Promise} - Array of bookings
   */
  getByProviderId: async (providerId, status = null) => {
    let queryString = `
      SELECT DISTINCT b.*, 
        CASE
          WHEN b.listing_id IS NOT NULL THEN sl.title
          WHEN b.custom_trip_id IS NOT NULL THEN ct.title
          ELSE NULL
        END as trip_title,
        u.first_name as traveler_first_name, 
        u.last_name as traveler_last_name, 
        u.email as traveler_email
      FROM bookings b
      LEFT JOIN service_listings sl ON b.listing_id = sl.id
      LEFT JOIN custom_trips ct ON b.custom_trip_id = ct.id
      LEFT JOIN booking_components bc ON b.id = bc.booking_id
      JOIN users u ON b.traveler_id = u.id
      WHERE (sl.provider_id = $1 OR bc.provider_id = $1)
    `;
    
    const values = [providerId];
    let paramIndex = 2;
    
    if (status) {
      queryString += ` AND b.status = $${paramIndex}`;
      values.push(status);
      paramIndex++;
    }
    
    queryString += ' ORDER BY b.start_date ASC, b.created_at DESC';
    
    const result = await query(queryString, values);
    return result.rows;
  },

  /**
   * Count bookings by provider ID
   * @param {number} providerId - Provider ID
   * @returns {Promise<Object>} - Object with count
   */
  countByProviderId: async (providerId) => {
    const result = await query(
      `SELECT COUNT(DISTINCT b.id) as count
       FROM bookings b
       LEFT JOIN service_listings sl ON b.listing_id = sl.id
       LEFT JOIN booking_components bc ON b.id = bc.booking_id
       WHERE (sl.provider_id = $1 OR bc.provider_id = $1)`,
      [providerId]
    );
    return result.rows[0] || { count: 0 };
  },

  /**
   * Count bookings by provider ID and status, optionally for future dates
   * @param {number} providerId - Provider ID
   * @param {string} status - Booking status
   * @param {Date} [futureDateThreshold] - Optional date to filter for upcoming bookings
   * @returns {Promise<Object>} - Object with count
   */
  countByProviderIdAndStatus: async (providerId, status, futureDateThreshold = null) => {
    let queryString = `
      SELECT COUNT(DISTINCT b.id) as count
      FROM bookings b
      LEFT JOIN service_listings sl ON b.listing_id = sl.id
      LEFT JOIN booking_components bc ON b.id = bc.booking_id
      WHERE (sl.provider_id = $1 OR bc.provider_id = $1) AND b.status = $2
    `;
    const values = [providerId, status];
    let paramIndex = 3;

    if (futureDateThreshold) {
      queryString += ` AND b.start_date >= $${paramIndex}`;
      values.push(futureDateThreshold);
      paramIndex++;
    }
    const result = await query(queryString, values);
    return result.rows[0] || { count: 0 };
  },
  
  /**
   * Update a booking
   * @param {number} id - Booking ID
   * @param {Object} bookingData - Booking data to update
   * @returns {Promise} - Updated booking object
   */
  update: async (id, bookingData) => {
    const allowedFields = [
      'start_date', 'end_date', 'number_of_travelers', 'total_price', 
      'currency', 'status', 'special_requests', 'traveler_contact_info'
    ];
    
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    Object.keys(bookingData).forEach(key => {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = $${paramIndex}`);
        values.push(bookingData[key]);
        paramIndex++;
      }
    });
    
    if (updates.length === 0) return null;
    
    values.push(id);
    const result = await query(
      `UPDATE bookings SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    
    return result.rows[0];
  },
  
  /**
   * Delete a booking
   * @param {number} id - Booking ID
   * @returns {Promise} - Success status
   */
  delete: async (id) => {
    const result = await query('DELETE FROM bookings WHERE id = $1 RETURNING id', [id]);
    return result.rows[0] || null;
  },
  
  /**
   * Get a booking with all components
   * @param {number} id - Booking ID
   * @returns {Promise} - Booking object with components
   */
  getWithComponents: async (id) => {
    const bookingResult = await query(
      `SELECT b.*, 
        CASE
          WHEN b.listing_id IS NOT NULL THEN sl.title
          WHEN b.custom_trip_id IS NOT NULL THEN ct.title
          ELSE NULL
        END as trip_title,
        u.first_name, u.last_name, u.email
      FROM bookings b
      LEFT JOIN service_listings sl ON b.listing_id = sl.id
      LEFT JOIN custom_trips ct ON b.custom_trip_id = ct.id
      LEFT JOIN users u ON b.traveler_id = u.id
      WHERE b.id = $1`,
      [id]
    );
    
    const booking = bookingResult.rows[0];
    
    if (!booking) return null;
    
    // Fetch booking components regardless of whether it's custom_trip or listing_id based
    // This assumes booking_components are created for both types.
    // If booking_components are only for custom_trips, this needs adjustment.
    const componentsResult = await query(
      `SELECT bc.*, 
        tc.title as trip_component_title, tc.description as trip_component_description, tc.component_type, 
        tc.start_date as trip_component_start_date, tc.end_date as trip_component_end_date,
        tc.start_time as trip_component_start_time, tc.end_time as trip_component_end_time,
        pp.business_name as provider_business_name,
        prov_user.first_name as provider_first_name, prov_user.last_name as provider_last_name
       FROM booking_components bc
       LEFT JOIN trip_components tc ON bc.component_id = tc.id -- For custom trips
       -- If direct listing booking, component_id might be null or link to service_components
       LEFT JOIN provider_profiles pp ON bc.provider_id = pp.id
       LEFT JOIN users prov_user ON pp.user_id = prov_user.id
       WHERE bc.booking_id = $1
       ORDER BY tc.start_date ASC NULLS LAST, tc.start_time ASC NULLS LAST, bc.id ASC`,
      [id]
    );
    
    booking.components = componentsResult.rows;
    
    return booking;
  }
};

// ====================================
// Booking Component Models
// ====================================

const bookingComponentModel = {
  /**
   * Create a booking component
   * @param {Object} componentData - Booking component data
   * @returns {Promise} - New booking component object
   */
  create: async (componentData) => {
    const { 
      booking_id, component_id, provider_id, status, provider_confirmation_reference,
      confirmation_date, price, currency, notes
    } = componentData;
    
    const result = await query(
      `INSERT INTO booking_components 
        (booking_id, component_id, provider_id, status, provider_confirmation_reference,
         confirmation_date, price, currency, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [
        booking_id, component_id, provider_id, status || 'pending', provider_confirmation_reference,
        confirmation_date, price, currency, notes
      ]
    );
    
    return result.rows[0];
  },
  
  /**
   * Create multiple booking components
   * @param {Array} components - Array of booking component data
   * @returns {Promise} - Success status
   */
  createBulk: async (components) => {
    if (!components || components.length === 0) {
      return [];
    }
    
    const client = await beginTransaction();
    try {
      const createdComponents = [];
      for (const component of components) {
        const { 
          booking_id, component_id, provider_id, status, provider_confirmation_reference,
          confirmation_date, price, currency, notes
        } = component;
        
        const result = await client.query(
          `INSERT INTO booking_components 
            (booking_id, component_id, provider_id, status, provider_confirmation_reference,
             confirmation_date, price, currency, notes) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
           RETURNING *`,
          [
            booking_id, component_id, provider_id, status || 'pending', provider_confirmation_reference,
            confirmation_date, price, currency, notes
          ]
        );
        
        createdComponents.push(result.rows[0]);
      }
      
      await client.commit();
      return createdComponents;
    } catch (err) {
      await client.rollback();
      throw err;
    }
  },
  
  /**
   * Find a booking component by ID
   * @param {number} id - Booking component ID
   * @returns {Promise} - Booking component object or null
   */
  findById: async (id) => {
    const result = await query('SELECT * FROM booking_components WHERE id = $1', [id]);
    return result.rows[0] || null;
  },
  
  /**
   * Get components by booking ID
   * @param {number} bookingId - Booking ID
   * @returns {Promise} - Array of booking components
   */
  getByBookingId: async (bookingId) => {
    const result = await query(
      `SELECT bc.*, 
        tc.title as trip_component_title, tc.description as trip_component_description, tc.component_type, 
        tc.start_date as trip_component_start_date, tc.end_date as trip_component_end_date,
        tc.start_time as trip_component_start_time, tc.end_time as trip_component_end_time,
        pp.business_name as provider_business_name,
        prov_user.first_name as provider_first_name, prov_user.last_name as provider_last_name
       FROM booking_components bc
       LEFT JOIN trip_components tc ON bc.component_id = tc.id
       LEFT JOIN provider_profiles pp ON bc.provider_id = pp.id
       LEFT JOIN users prov_user ON pp.user_id = prov_user.id
       WHERE bc.booking_id = $1
       ORDER BY tc.start_date ASC NULLS LAST, tc.start_time ASC NULLS LAST, bc.id ASC`,
      [bookingId]
    );
    
    return result.rows;
  },
  
  /**
   * Get components by provider ID for a specific booking
   * @param {number} bookingId - Booking ID
   * @param {number} providerId - Provider ID
   * @returns {Promise} - Array of booking components
   */
  getByBookingIdAndProviderId: async (bookingId, providerId) => {
    const result = await query(
      `SELECT bc.*, tc.title as trip_component_title, tc.component_type
       FROM booking_components bc
       LEFT JOIN trip_components tc ON bc.component_id = tc.id
       WHERE bc.booking_id = $1 AND bc.provider_id = $2
       ORDER BY tc.start_date ASC NULLS LAST, tc.start_time ASC NULLS LAST, bc.id ASC`,
      [bookingId, providerId]
    );
    return result.rows;
  },

  /**
   * Get components by provider ID (across all bookings)
   * @param {number} providerId - Provider ID
   * @param {string} status - Component status filter
   * @returns {Promise} - Array of booking components
   */
  getByProviderId: async (providerId, status = null) => {
    let queryString = `
      SELECT bc.*, b.booking_reference, 
        tc.title as trip_component_title, tc.component_type,
        u.first_name as traveler_first_name, u.last_name as traveler_last_name
      FROM booking_components bc
      JOIN bookings b ON bc.booking_id = b.id
      JOIN users u ON b.traveler_id = u.id
      LEFT JOIN trip_components tc ON bc.component_id = tc.id
      WHERE bc.provider_id = $1
    `;
    const values = [providerId];
    let paramIndex = 2;

    if (status) {
      queryString += ` AND bc.status = $${paramIndex}`;
      values.push(status);
      paramIndex++;
    }
    queryString += ' ORDER BY b.start_date ASC, bc.id ASC';
    const result = await query(queryString, values);
    return result.rows;
  }
};

// ====================================
// Location Models (Basic Example)
// ====================================
const locationModel = {
    findById: async (id) => {
        const result = await query('SELECT * FROM locations WHERE id = $1', [id]);
        return result.rows[0] || null;
    },
    findByIataCode: async (iataCode) => {
        const result = await query('SELECT * FROM locations WHERE iata_code = $1', [iataCode.toUpperCase()]);
        return result.rows[0] || null;
    },
    searchByNameOrIata: async (searchTerm, limit = 10) => {
        const result = await query(
            `SELECT id, name, city, country, iata_code, location_type 
             FROM locations 
             WHERE name ILIKE $1 OR city ILIKE $1 OR iata_code ILIKE $2
             LIMIT $3`,
            [`%${searchTerm}%`, `${searchTerm.toUpperCase()}%`, limit]
        );
        return result.rows;
    },
    // Add more location functions as needed (create, update, delete, search by city/country etc.)
};


// ====================================
// Payment Models (Placeholders)
// ====================================
const paymentModel = {
    // Example:
    // createPayment: async (paymentData) => { ... },
    // findByBookingId: async (bookingId) => { ... },
    // updateStatus: async (paymentId, status) => { ... },
    // getTotalRevenueForProvider: async (providerId) => { ... count from provider_payouts ... },
    // getPayoutsForProvider: async (providerId, startDate, endDate) => { ... from provider_payouts ... },
    // getEarningsBreakdownForProvider: async (providerId, period) => { ... }
};

// ====================================
// Review Models (Placeholders)
// ====================================
const reviewModel = {
    // Example:
    // createReview: async (reviewData) => { ... },
    // getByListingId: async (listingId) => { ... },
    // getByProviderId: async (providerId) => { ... },
    // calculateAverageRatingForListing: async (listingId) => { ... },
    // calculateAverageRatingForProvider: async (providerId) => { ... }
};

// ====================================
// Wishlist Models (Placeholders)
// ====================================
const wishlistModel = {
    // Example:
    // createWishlist: async (userId, name) => { ... },
    // addItemToWishlist: async (wishlistId, listingId) => { ... },
    // getWishlistsByUserId: async (userId) => { ... },
    // getWishlistItems: async (wishlistId) => { ... }
};

// ====================================
// Notification Models (Placeholders)
// ====================================
const notificationModel = {
    // Example:
    // createNotification: async (notificationData) => { ... },
    // getNotificationsByUserId: async (userId, isRead) => { ... },
    // markAsRead: async (notificationId) => { ... }
};

// ====================================
// Messaging Models (Placeholders)
// ====================================
const messageModel = {
    // Example:
    // createConversation: async (participantIds) => { ... },
    // sendMessage: async (conversationId, senderId, text) => { ... },
    // getMessagesByConversationId: async (conversationId) => { ... },
    // getConversationsByUserId: async (userId) => { ... }
};


module.exports = {
  query,
  beginTransaction,
  pool, // Export pool for direct use if necessary (e.g., for specific libraries)
  connectRedis, // Export connectRedis function
  get redisClient() { return redisClient; }, // Export redisClient instance (getter for dynamic assignment)
  userModel,
  tokenModel,
  providerProfileModel,
  categoryModel,
  listingModel,
  componentModel,
  availabilityModel,
  mediaModel,
  customTripModel,
  tripComponentModel,
  aiTripSuggestionModel,
  bookingModel,
  bookingComponentModel,
  locationModel,
  paymentModel, // Export placeholder
  reviewModel,  // Export placeholder
  wishlistModel, // Export placeholder
  notificationModel, // Export placeholder
  messageModel // Export placeholder
};

#!/usr/bin/env node

/**
 * Database Initialization Script
 * Runs the database schema and sets up all required tables
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://tour_operator:secure_password@postgres:5432/tour_operator_db',
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

async function initializeDatabase() {
  try {
    console.log('🚀 Starting database initialization...');

    // Read the schema file
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('📖 Reading schema file...');

    // Execute the schema
    await pool.query(schema);

    console.log('✅ Database schema created successfully!');
    console.log('📊 Tables created:');
    console.log('   - users');
    console.log('   - search_history');
    console.log('   - bookings');
    console.log('   - flight_cache');
    console.log('   - hotel_cache');
    console.log('   - locations');
    console.log('   - pricing_rules');
    console.log('   - user_favorites');
    console.log('   - custom_trips');
    console.log('   - notifications');

    // Verify tables were created
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log('\n📋 Verified tables in database:');
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });

    // Check if sample data was inserted
    const locationCount = await pool.query('SELECT COUNT(*) FROM locations');
    const ruleCount = await pool.query('SELECT COUNT(*) FROM pricing_rules');

    console.log('\n📈 Sample data:');
    console.log(`   - ${locationCount.rows[0].count} locations (airports)`);
    console.log(`   - ${ruleCount.rows[0].count} pricing rules`);

    console.log('\n🎉 Database initialization completed successfully!');

  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase();
}

module.exports = { initializeDatabase }; 
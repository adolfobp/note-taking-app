/**
 * ============================================================================
 * DB.JS - MongoDB Database Connection
 * ============================================================================
 *
 * This module establishes the connection to MongoDB using Mongoose ODM.
 * It's called once during server startup and maintains a persistent connection.
 *
 * CONNECTION FLOW:
 * ----------------
 * 1. server.js calls connectDB()
 * 2. Mongoose attempts to connect to MONGODB_URI
 * 3. On success: logs connection host, returns connection object
 * 4. On failure: logs error, exits process (prevents running without DB)
 *
 * ENVIRONMENT VARIABLES:
 * - MONGODB_URI: Full MongoDB connection string
 *   Examples:
 *   - Local: mongodb://localhost:27017/note_taking_app
 *   - Atlas: mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<dbname>
 *
 * RELATED FILES:
 * - ../server.js → Calls connectDB() on startup
 * - ../models/*  → Define Mongoose schemas that use this connection
 *
 * @module config/db
 */

const mongoose = require('mongoose');

/**
 * Establishes connection to MongoDB database.
 *
 * This function is async but typically called without await in server.js.
 * Mongoose buffers operations until connected, so the server can start
 * accepting requests immediately.
 *
 * @async
 * @function connectDB
 * @returns {Promise<void>} Resolves when connected, exits process on failure
 *
 * @example
 * // In server.js
 * const connectDB = require('./config/db');
 * connectDB(); // Connection established in background
 */
const connectDB = async () => {
  try {
    // Mongoose.connect returns a connection object on success
    // The connection string comes from environment variables
    const conn = await mongoose.connect(process.env.MONGODB_URI);

    // Log successful connection with host info (useful for debugging)
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    // Log the error for debugging
    console.error(`Error connecting to MongoDB: ${error.message}`);

    // Exit with failure code - the app cannot function without database
    // Code 1 indicates an error (vs 0 for success)
    process.exit(1);
  }
};

module.exports = connectDB;

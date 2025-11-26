const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI is not set in environment variables');
      process.exit(1);
    }

    console.log('🔌 Connecting to MongoDB...');
    console.log(`   URI: ${process.env.MONGODB_URI ? process.env.MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') : 'NOT SET'}`);
    
    // Validate MONGODB_URI format
    if (!process.env.MONGODB_URI || process.env.MONGODB_URI.includes('localhost') || process.env.MONGODB_URI.includes('127.0.0.1')) {
      console.error('❌ Invalid MONGODB_URI:');
      console.error('   MONGODB_URI appears to be pointing to localhost');
      console.error('   For Render deployment, use MongoDB Atlas connection string');
      console.error('   Format: mongodb+srv://username:password@cluster.mongodb.net/database');
      process.exit(1);
    }
    
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000, // 30 seconds timeout (increased for Render)
      socketTimeoutMS: 45000, // 45 seconds socket timeout
    });
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`   Database: ${conn.connection.name}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });
    
  } catch (error) {
    console.error('❌ MongoDB Connection Failed:');
    console.error(`   Error: ${error.message}`);
    
    // Provide helpful error messages
    if (error.message.includes('authentication failed')) {
      console.error('   💡 Check your MongoDB username and password');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.error('   💡 Check your MongoDB connection string format');
      console.error('   💡 Verify network access in MongoDB Atlas');
    } else if (error.message.includes('timeout')) {
      console.error('   💡 Check MongoDB Atlas IP whitelist');
      console.error('   💡 For Render, allow 0.0.0.0/0 or specific Render IPs');
    } else if (error.message.includes('bad auth')) {
      console.error('   💡 Authentication failed - check username/password');
    }
    
    process.exit(1);
  }
};

module.exports = connectDB;


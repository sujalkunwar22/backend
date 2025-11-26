// Test script to verify backend and database connection
require('dotenv').config();
const mongoose = require('mongoose');

async function testConnection() {
  console.log('🔍 Testing Backend Configuration...\n');
  
  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'NOT SET'}`);
  console.log(`  PORT: ${process.env.PORT || 'NOT SET'}`);
  console.log(`  MONGODB_URI: ${process.env.MONGODB_URI ? 'SET (hidden)' : 'NOT SET ❌'}`);
  console.log(`  JWT_SECRET: ${process.env.JWT_SECRET ? 'SET (hidden)' : 'NOT SET ❌'}`);
  console.log(`  CORS_ORIGIN: ${process.env.CORS_ORIGIN || 'NOT SET (defaults to *)'}`);
  console.log('');
  
  // Test MongoDB connection
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set!');
    process.exit(1);
  }
  
  console.log('🔌 Testing MongoDB Connection...');
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`   Database: ${conn.connection.name}`);
    
    // Test a simple query
    const collections = await conn.connection.db.listCollections().toArray();
    console.log(`   Collections: ${collections.length} found`);
    
    await mongoose.disconnect();
    console.log('✅ MongoDB connection test passed!\n');
  } catch (error) {
    console.error('❌ MongoDB Connection Failed:');
    console.error(`   Error: ${error.message}`);
    if (error.message.includes('authentication')) {
      console.error('   💡 Check your MongoDB username and password');
    }
    if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.error('   💡 Check your MongoDB connection string and network access');
    }
    if (error.message.includes('timeout')) {
      console.error('   💡 Check MongoDB Atlas IP whitelist (should allow 0.0.0.0/0 or Render IPs)');
    }
    process.exit(1);
  }
  
  console.log('✅ All tests passed! Backend is ready.');
}

testConnection().catch(console.error);


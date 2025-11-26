require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const connectDB = require('../config/database');

// Connect to database
connectDB();

async function createAdmin() {
  try {
    const email = process.argv[2] || 'admin@nepaladvocate.com';
    const password = process.argv[3] || 'admin123';
    const firstName = process.argv[4] || 'Admin';
    const lastName = process.argv[5] || 'User';

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email, role: 'ADMIN' });
    if (existingAdmin) {
      console.log('❌ Admin user already exists with this email:', email);
      console.log('   Please use a different email or login with existing credentials.');
      process.exit(1);
    }

    // Create admin user
    const admin = await User.create({
      email,
      password,
      role: 'ADMIN',
      firstName,
      lastName,
      isActive: true,
    });

    console.log('✅ Admin user created successfully!');
    console.log('');
    console.log('Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Email:    ', email);
    console.log('Password: ', password);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('⚠️  IMPORTANT: Change the password after first login!');
    console.log('');
    console.log('Access the admin panel at: http://localhost:3000/admin');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    process.exit(1);
  }
}

// Run the script
createAdmin();


#!/bin/bash
# Bash script to start the backend server
# Usage: ./start-backend.sh

echo "Starting NepalAdvocate Backend Server..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Warning: .env file not found!"
    echo "Creating .env file from template..."
    
    cat > .env << EOF
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/nepaladvocate

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production-please-use-a-strong-random-string
JWT_EXPIRES_IN=7d

# File Upload Configuration
UPLOAD_DIR=./uploads

# CORS Configuration
CORS_ORIGIN=*
EOF
    
    echo ".env file created! Please update MONGODB_URI and JWT_SECRET if needed."
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

echo ""
echo "Starting server..."
echo "Make sure MongoDB is running!"
echo ""

# Start the server
npm run dev


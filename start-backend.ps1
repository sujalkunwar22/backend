# PowerShell script to start the backend server
# Usage: .\start-backend.ps1

Write-Host "Starting NepalAdvocate Backend Server..." -ForegroundColor Green

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "Warning: .env file not found!" -ForegroundColor Yellow
    Write-Host "Please create a .env file based on .env.example" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Creating .env file from template..." -ForegroundColor Cyan
    
    $envContent = @"
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
"@
    
    $envContent | Out-File -FilePath ".env" -Encoding utf8
    Write-Host ".env file created! Please update MONGODB_URI and JWT_SECRET if needed." -ForegroundColor Green
}

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Cyan
    npm install
}

# Check if MongoDB is accessible (optional check)
Write-Host ""
Write-Host "Starting server..." -ForegroundColor Cyan
Write-Host "Make sure MongoDB is running!" -ForegroundColor Yellow
Write-Host ""

# Start the server
npm run dev


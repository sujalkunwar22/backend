// Quick script to check if backend is properly configured
require('dotenv').config();

console.log('🔍 Checking Backend Deployment Configuration...\n');

const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET',
  'NODE_ENV',
];

let allSet = true;

console.log('📋 Environment Variables:');
requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`  ✅ ${varName}: SET`);
    if (varName === 'MONGODB_URI') {
      // Check if it includes database name
      if (value.includes('/nepaladvocate')) {
        console.log(`     ✓ Includes database name`);
      } else {
        console.log(`     ⚠️  Missing database name (should end with /nepaladvocate)`);
      }
      // Check if it includes query params
      if (value.includes('retryWrites')) {
        console.log(`     ✓ Includes query parameters`);
      } else {
        console.log(`     ⚠️  Missing query parameters (?retryWrites=true&w=majority)`);
      }
    }
  } else {
    console.log(`  ❌ ${varName}: NOT SET`);
    allSet = false;
  }
});

console.log('\n📊 Optional Variables:');
const optionalVars = ['CORS_ORIGIN', 'JWT_EXPIRES_IN', 'UPLOAD_DIR', 'PORT'];
optionalVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`  ✅ ${varName}: ${value}`);
  } else {
    console.log(`  ⚠️  ${varName}: Not set (using default)`);
  }
});

if (!allSet) {
  console.log('\n❌ Missing required environment variables!');
  console.log('💡 Set these in Render Dashboard → Environment tab');
  process.exit(1);
} else {
  console.log('\n✅ All required environment variables are set!');
  console.log('\n💡 If backend still shows 502 error:');
  console.log('   1. Check Render logs for startup errors');
  console.log('   2. Verify MongoDB Atlas Network Access allows Render IPs');
  console.log('   3. Wait 30-60 seconds (Render free tier spins up slowly)');
  console.log('   4. Check if service is suspended in Render dashboard');
}


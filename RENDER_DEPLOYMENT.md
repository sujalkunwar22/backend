# Render Deployment Guide

This guide will help you deploy the NepalAdvocate backend to Render.

## Prerequisites

1. A [Render](https://render.com) account
2. A MongoDB database (MongoDB Atlas recommended for production)
3. Your backend code pushed to a Git repository (GitHub, GitLab, or Bitbucket)

## Step 1: Prepare MongoDB Database

1. Create a MongoDB Atlas account at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster (free tier available)
3. Create a database user and note the credentials
4. Whitelist IP addresses (use `0.0.0.0/0` to allow all IPs, or Render's IP ranges)
5. Get your connection string (format: `mongodb+srv://username:password@cluster.mongodb.net/nepaladvocate?retryWrites=true&w=majority`)

## Step 2: Deploy to Render

### Option A: Using render.yaml (Recommended)

1. Push your code to GitHub/GitLab/Bitbucket
2. In Render dashboard, go to "New" → "Blueprint"
3. Connect your repository
4. Render will automatically detect `render.yaml` and configure the service
5. Add environment variables in the Render dashboard (see Step 3)

### Option B: Manual Setup

1. In Render dashboard, go to "New" → "Web Service"
2. Connect your repository
3. Configure the service:
   - **Name**: `nepaladvocate-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Root Directory**: `backend` (if your repo root is the project root)

## Step 3: Configure Environment Variables

In the Render dashboard, go to your service → Environment tab and add:

| Key | Value | Description |
|-----|-------|-------------|
| `NODE_ENV` | `production` | Environment mode |
| `MONGODB_URI` | `mongodb+srv://...` | Your MongoDB connection string (see [MONGODB_CONNECTION.md](./MONGODB_CONNECTION.md)) |
| `JWT_SECRET` | `your-secret-key` | Strong random string for JWT signing |
| `JWT_EXPIRES_IN` | `7d` | JWT token expiration time |
| `CORS_ORIGIN` | `https://your-frontend.com` | Your frontend URL(s), comma-separated for multiple |
| `UPLOAD_DIR` | `./uploads` | Directory for file uploads |

**Important Notes:**
- **PORT**: Render sets this automatically - do NOT set it manually
- **MONGODB_URI**: See [MONGODB_CONNECTION.md](./MONGODB_CONNECTION.md) for your connection string
- Generate a strong `JWT_SECRET` (use a random string generator)
- For `CORS_ORIGIN`, use your production frontend URL(s). For multiple origins, separate with commas: `https://app1.com,https://app2.com`
- Render provides ephemeral filesystem, so uploaded files will be lost on restart. Consider using cloud storage (AWS S3, Cloudinary, etc.) for production.

## Step 4: Deploy

1. Click "Create Web Service" (or "Save Changes" if updating)
2. Render will build and deploy your application
3. Wait for deployment to complete (usually 2-5 minutes)
4. Your API will be available at: `https://your-service-name.onrender.com`

## Step 5: Verify Deployment

1. Check the health endpoint: `https://your-service-name.onrender.com/health`
2. You should see: `{"status":"OK","message":"NepalAdvocate API is running"}`

## Step 6: Update Frontend Configuration

Update your Flutter app's API base URL to point to your Render service:

```dart
// In lib/core/constants/api_constants.dart
const String baseUrl = 'https://your-service-name.onrender.com';
```

## Important Considerations

### File Uploads
Render uses an ephemeral filesystem, meaning uploaded files are lost when the service restarts. For production, consider:
- Using cloud storage (AWS S3, Google Cloud Storage, Cloudinary)
- Storing file metadata in MongoDB and serving from cloud storage

### WebSocket/Socket.IO
Socket.IO should work on Render, but ensure:
- Your frontend connects to the correct WebSocket URL
- CORS is properly configured

### Database Connection
- Use MongoDB Atlas for production (free tier available)
- Ensure your MongoDB cluster allows connections from Render's IP addresses

### Environment Variables
- Never commit `.env` file to Git
- Always set sensitive values in Render dashboard
- Use strong, unique secrets for production

### Monitoring
- Monitor your service in Render dashboard
- Set up alerts for service downtime
- Check logs regularly for errors

## Troubleshooting

### Service won't start
- Check logs in Render dashboard
- Verify all environment variables are set
- Ensure MongoDB connection string is correct
- Check that PORT is set correctly

### Database connection errors
- Verify MongoDB Atlas IP whitelist includes Render IPs
- Check MongoDB connection string format
- Ensure database user has correct permissions

### CORS errors
- Verify `CORS_ORIGIN` includes your frontend URL
- Check that URL format is correct (no trailing slash)

### File upload issues
- Remember that Render's filesystem is ephemeral
- Consider migrating to cloud storage for production

## Support

For issues specific to:
- **Render**: Check [Render Documentation](https://render.com/docs)
- **MongoDB Atlas**: Check [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com)
- **This Backend**: Check `backend/README.md`


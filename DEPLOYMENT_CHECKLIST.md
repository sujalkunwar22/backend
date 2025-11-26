# Render Deployment Checklist

Use this checklist to ensure your backend is ready for Render deployment.

## Pre-Deployment Checklist

- [x] Server listens on `0.0.0.0` (updated in `server.js`)
- [x] Node.js version specified in `package.json` (engines field)
- [x] `render.yaml` configuration file created
- [x] Environment variables documented in `env.example`
- [x] Start command configured (`npm start`)

## Deployment Steps

1. [ ] Push code to GitHub/GitLab/Bitbucket
2. [ ] Create MongoDB Atlas database (if not already done)
3. [ ] Get MongoDB connection string
4. [ ] Create Render account (if not already done)
5. [ ] In Render dashboard: New → Web Service (or Blueprint)
6. [ ] Connect your repository
7. [ ] Set root directory to `backend` (if repo root is project root)
8. [ ] Configure environment variables:
   - [ ] `NODE_ENV` = `production`
   - [ ] `MONGODB_URI` = see [MONGODB_CONNECTION.md](./MONGODB_CONNECTION.md) for your connection string
   - [ ] `JWT_SECRET` = strong random string
   - [ ] `JWT_EXPIRES_IN` = `7d` (or your preference)
   - [ ] `CORS_ORIGIN` = your frontend URL(s)
   - [ ] `UPLOAD_DIR` = `./uploads` (optional)
   - [ ] **DO NOT SET PORT** - Render sets this automatically
9. [ ] Deploy and wait for build to complete
10. [ ] Test health endpoint: `https://your-service.onrender.com/health`
11. [ ] Update frontend API base URL

## Post-Deployment

- [ ] Verify API endpoints are accessible
- [ ] Test authentication flow
- [ ] Test file uploads (remember: ephemeral filesystem)
- [ ] Test Socket.IO connections
- [ ] Monitor logs for errors
- [ ] Set up alerts (optional)

## Important Notes

⚠️ **File Storage**: Render uses an ephemeral filesystem. Uploaded files will be lost on restart. Consider migrating to cloud storage (AWS S3, Cloudinary) for production.

⚠️ **MongoDB**: Ensure your MongoDB Atlas cluster allows connections from Render's IP addresses (use `0.0.0.0/0` for testing, restrict for production).

⚠️ **CORS**: Set `CORS_ORIGIN` to your production frontend URL. Multiple origins can be comma-separated.

## Need Help?

- See [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md) for detailed instructions
- Check [README.md](./README.md) for API documentation
- Render Docs: https://render.com/docs


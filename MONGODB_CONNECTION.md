# MongoDB Connection String

## Your MongoDB Atlas Connection String

**Complete connection string (with database name):**
```
mongodb+srv://sujalkunwar_db_user:SyGo6Czt6he5Ib1n@cluster0.gsilwxh.mongodb.net/nepaladvocate?retryWrites=true&w=majority
```

## For Render Deployment

When setting up your Render service, add this as the `MONGODB_URI` environment variable:

**Key:** `MONGODB_URI`  
**Value:** `mongodb+srv://sujalkunwar_db_user:SyGo6Czt6he5Ib1n@cluster0.gsilwxh.mongodb.net/nepaladvocate?retryWrites=true&w=majority`

## For Local Development (.env file)

Add this to your `backend/.env` file:
```
MONGODB_URI=mongodb+srv://sujalkunwar_db_user:SyGo6Czt6he5Ib1n@cluster0.gsilwxh.mongodb.net/nepaladvocate?retryWrites=true&w=majority
```

## Important Security Notes

⚠️ **IMPORTANT:** Since these credentials have been shared, consider:
1. Creating a new database user with a stronger password
2. Rotating the password in MongoDB Atlas
3. Restricting IP access in MongoDB Atlas Network Access settings
4. Using environment variables (never commit credentials to Git)

## MongoDB Atlas Configuration Checklist

- [ ] Database user created: `sujalkunwar_db_user` ✓
- [ ] Network Access configured (allow Render IPs or `0.0.0.0/0` for testing)
- [ ] Database name: `nepaladvocate` (will be created automatically on first connection)
- [ ] Connection string format verified

## Testing the Connection

You can test the connection locally by:
1. Adding the connection string to your `.env` file
2. Running `npm run dev` in the backend directory
3. Checking the console for: `MongoDB Connected: cluster0-shard-00-XX.gsilwxh.mongodb.net`


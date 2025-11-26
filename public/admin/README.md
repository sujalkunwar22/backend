# NepalAdvocate Admin Panel

A web-based admin panel for managing lawyers, clients, and verifying lawyer profiles.

## Access

Once the backend server is running, access the admin panel at:
- **URL**: `http://localhost:3000/admin`
- **Port**: Same as your backend server (default: 3000)

## Features

### 1. **Dashboard**
- View statistics: Total users, lawyers, clients, and pending verifications
- Real-time data updates

### 2. **Verify Lawyers**
- View all lawyers with their profiles
- Filter to show only unverified lawyers
- Set hourly rate during verification
- Verify lawyer profiles with one click

### 3. **Manage Users**
- View all users (Clients, Lawyers, Admins)
- Filter by role
- Activate/Deactivate user accounts
- View user details

### 4. **Statistics**
- View comprehensive platform statistics
- Monitor platform growth

## Authentication

- Login with admin credentials (email and password)
- Only users with `ADMIN` role can access the panel
- Session is stored in browser localStorage
- Automatic logout on session expiry

## API Integration

The admin panel uses the existing backend API endpoints:
- `/api/auth/login` - Admin login
- `/api/auth/me` - Get current user
- `/api/admin/stats` - Get dashboard statistics
- `/api/admin/users` - Get all users
- `/api/admin/users/:id/status` - Update user status
- `/api/admin/lawyers/:id/verify` - Verify lawyer
- `/api/lawyers` - Get all lawyers

## Usage

1. Start the backend server:
   ```bash
   cd backend
   npm run dev
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000/admin
   ```

3. Login with admin credentials

4. Use the sidebar to navigate between different sections

## Notes

- The admin panel runs on the same server as the backend API
- No additional port or server configuration needed
- All API calls are authenticated using JWT tokens
- The panel is a Single Page Application (SPA) built with vanilla JavaScript


# NepalAdvocate Backend API

Backend API for NepalAdvocate - Lawyer Booking & Counseling App built with Node.js, Express, MongoDB, and Socket.IO.

## Features

- JWT-based authentication
- Role-based access control (Client, Lawyer, Admin)
- Appointment scheduling with mutual confirmation
- Real-time chat using Socket.IO
- Document upload and management
- Legal template management
- Notification system
- Admin panel APIs

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file from `env.example`:
```bash
cp env.example .env
```

3. Update `.env` with your configuration:
```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/nepaladvocate
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
NODE_ENV=development
UPLOAD_DIR=./uploads
CORS_ORIGIN=http://localhost:3000
```

4. Start MongoDB (if running locally)

5. Run the server:
```bash
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user profile

### Appointments
- `POST /api/appointments` - Create appointment request
- `PATCH /api/appointments/:id/propose` - Propose new time
- `PATCH /api/appointments/:id/confirm` - Confirm appointment
- `GET /api/appointments/mine` - Get user's appointments
- `GET /api/appointments/:id` - Get single appointment

### Chat
- `GET /api/chat/conversations` - Get user's conversations
- `GET /api/chat/conversations/:conversationId/messages` - Get messages

### Documents
- `POST /api/documents/upload` - Upload document
- `GET /api/documents/mine` - Get user's documents
- `GET /api/documents/:id` - Get single document
- `GET /api/documents/:id/download` - Download document
- `DELETE /api/documents/:id` - Delete document

### Lawyers
- `GET /api/lawyers` - Get all lawyers
- `GET /api/lawyers/:id` - Get lawyer by ID
- `PATCH /api/lawyers/profile` - Update lawyer profile

### Templates
- `GET /api/templates` - Get all templates
- `GET /api/templates/:id` - Get template by ID
- `POST /api/templates` - Create template (Admin)
- `PATCH /api/templates/:id` - Update template (Admin)
- `DELETE /api/templates/:id` - Delete template (Admin)

### Notifications
- `GET /api/notifications` - Get user's notifications
- `PATCH /api/notifications/:id/read` - Mark as read
- `PATCH /api/notifications/read-all` - Mark all as read

### Admin
- `GET /api/admin/stats` - Get dashboard statistics
- `GET /api/admin/users` - Get all users
- `PATCH /api/admin/users/:id/status` - Update user status
- `PATCH /api/admin/lawyers/:id/verify` - Verify lawyer

## Socket.IO Events

### Client → Server
- `joinConversation` - Join a conversation room
- `leaveConversation` - Leave a conversation room
- `sendMessage` - Send a message
- `typing` - Typing indicator

### Server → Client
- `newMessage` - New message received
- `notification` - New notification
- `appointment:{userId}` - Appointment update
- `document:{userId}` - Document update
- `userTyping` - User typing indicator

## Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <token>
```

For Socket.IO, pass the token in the connection handshake:
```javascript
socket.connect('http://localhost:3000', {
  auth: { token: 'your-jwt-token' }
});
```

## Deployment

### Deploy to Render

This backend is ready for deployment to Render. See [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md) for detailed deployment instructions.

Quick steps:
1. Push your code to GitHub/GitLab/Bitbucket
2. Create a new Web Service in Render
3. Connect your repository
4. Set environment variables (see `env.example` for reference)
5. Deploy!

**Note**: For production deployments, consider using cloud storage (AWS S3, Cloudinary) for file uploads as Render uses an ephemeral filesystem.


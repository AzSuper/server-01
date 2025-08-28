# API Endpoints Documentation

## Base URL
```
https://server-final-2olj.onrender.com
```

## Authentication
Most endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Public Endpoints (No Authentication Required)

### Health Check
- `GET /health` - Server health status

### Dashboard Statistics
- `GET /api/dashboard/stats` - Get overview statistics for dashboard

### Users
- `GET /api/users` - Get all users (public dashboard view)

### Posts
- `GET /api/posts` - Get all posts
- `GET /api/posts/:id` - Get specific post details
- `GET /api/posts/:id/engagement` - Get post engagement metrics
- `GET /api/posts/advertiser/:advertiser_id` - Get posts by specific advertiser

### Comments
- `GET /api/comments/post/:post_id` - Get comments for a specific post

## Protected Endpoints (Authentication Required)

### User Management
- `POST /api/users/send-otp` - Send OTP for registration
- `POST /api/users/verify-otp` - Verify OTP and create account
- `POST /api/users/login` - User login
- `POST /api/users/forgot-password` - Request password reset
- `POST /api/users/reset-password` - Reset password
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/:id` - Get user by ID

### Post Management
- `POST /api/posts` - Create new post (advertisers only)
- `POST /api/posts/save` - Save a post
- `GET /api/posts/saved/:client_id` - Get saved posts for a user
- `POST /api/posts/:post_id/like` - Toggle post like
- `GET /api/posts/:post_id/like-status` - Check if user liked a post
- `GET /api/posts/liked/:user_id` - Get liked posts for a user

### Reservation Management
- `POST /api/reservations` - Create new reservation
- `GET /api/reservations/client/:client_id` - Get reservations for a client
- `GET /api/reservations/post/:post_id` - Get reservations for a post
- `GET /api/reservations/availability/:post_id` - Check post availability
- `GET /api/reservations/stats/:advertiser_id` - Get reservation stats for advertiser
- `DELETE /api/reservations/:reservation_id` - Cancel a reservation

### Comment Management
- `POST /api/comments` - Create new comment
- `DELETE /api/comments/:comment_id` - Delete a comment

## Admin Endpoints (Authentication Required)

### User Management
- `GET /api/users/admin/users` - Get all users (admin view)
- `GET /api/users/admin/advertisers` - Get all advertisers (admin view)
- `GET /api/users/admin/users/combined` - Get all users and advertisers combined
- `PUT /api/users/admin/users/:id/verification` - Update user verification status
- `DELETE /api/users/admin/users/:id` - Delete a user

### Post Management
- `GET /api/posts/admin/all` - Get all posts with admin details
- `GET /api/posts/admin/stats` - Get post statistics

### Reservation Management
- `GET /api/reservations/admin/all` - Get all reservations with admin details
- `GET /api/reservations/admin/stats` - Get reservation statistics

### Comment Management
- `GET /api/comments/admin/all` - Get all comments with admin details
- `GET /api/comments/admin/stats` - Get comment statistics

## Dashboard Endpoints (Organized)

### Overview
- `GET /api/dashboard/stats` - General dashboard statistics

### User Management
- `GET /api/dashboard/users` - All users
- `GET /api/dashboard/users/advertisers` - All advertisers
- `GET /api/dashboard/users/combined` - Combined user data
- `PUT /api/dashboard/users/:id/verification` - Update verification status
- `DELETE /api/dashboard/users/:id` - Delete user

### Content Management
- `GET /api/dashboard/posts` - All posts
- `GET /api/dashboard/posts/stats` - Post statistics
- `GET /api/dashboard/reservations` - All reservations
- `GET /api/dashboard/reservations/stats` - Reservation statistics
- `GET /api/dashboard/comments` - All comments
- `GET /api/dashboard/comments/stats` - Comment statistics

## Query Parameters

### Pagination
Most list endpoints support pagination:
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)

### Filtering
Various endpoints support filtering:
- `search` - Search term for text fields
- `verified` - Filter by verification status (true/false)
- `type` - Filter by type (e.g., 'reel', 'post')
- `status` - Filter by status (e.g., 'active', 'cancelled')
- `user_type` - Filter by user type ('user', 'advertiser')
- `category_id` - Filter by category
- `post_id` - Filter by specific post

## Response Format

### Success Response
```json
{
  "status": "success",
  "message": "Operation completed successfully",
  "data": {...},
  "pagination": {...}
}
```

### Error Response
```json
{
  "status": "fail",
  "message": "Error description"
}
```

## Development Endpoints

### OTP Testing (Development Only)
- `GET /api/users/otp/:phone/:type/:userType` - Get latest OTP for testing

### Utility
- `POST /api/users/cleanup-otps` - Clean up expired OTPs

## Notes

1. **Authentication**: Most endpoints require a valid JWT token in the Authorization header
2. **User Types**: The system supports two user types: 'user' and 'advertiser'
3. **Permissions**: Some endpoints are restricted to specific user types (e.g., only advertisers can create posts)
4. **Rate Limiting**: API endpoints are rate-limited to 100 requests per 15 minutes per IP
5. **File Uploads**: Post creation supports media file uploads (images/videos)
6. **Pagination**: List endpoints return paginated results with metadata
7. **Search**: Many endpoints support text search across relevant fields
8. **Statistics**: Dashboard endpoints provide comprehensive analytics and metrics

## Testing the Endpoints

You can test these endpoints using:
- Postman collection (included in the project)
- cURL commands
- Any HTTP client

### Example: Get All Users
```bash
curl -X GET "https://server-final-2olj.onrender.com/api/users" \
  -H "Content-Type: application/json"
```

### Example: Get Dashboard Stats
```bash
curl -X GET "https://server-final-2olj.onrender.com/api/dashboard/stats" \
  -H "Content-Type: application/json"
```

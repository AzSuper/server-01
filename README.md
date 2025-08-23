# Flutter Backend API

A comprehensive backend API for Flutter applications with separate authentication flows for users and advertisers.

## 🚀 Features

- **Dual User System**: Separate authentication for regular users and advertisers
- **OTP Verification**: Phone-based verification with OTP codes
- **JWT Authentication**: Secure token-based authentication
- **Post Management**: Create and manage posts (reels and regular posts)
- **Reservation System**: Book and manage reservations
- **File Upload**: Cloudinary integration for media uploads
- **Rate Limiting**: API protection against abuse
- **Comprehensive Logging**: Detailed logging for debugging

## 🏗️ Architecture

### User Types

1. **Users (Regular Customers)**
   - Browse posts
   - Make reservations
   - Save posts
   - Like and comment on posts

2. **Advertisers (Business Owners)**
   - Create posts and reels
   - Manage business profile
   - View analytics and reservations

### Database Schema

- `users` - Regular customer accounts
- `advertisers` - Business owner accounts
- `posts` - Content created by advertisers
- `reservations` - Booking system
- `otp_codes` - Phone verification system
- `user_profiles` / `advertiser_profiles` - Extended profile information

## 🔐 Authentication Flow

### New User Registration

1. **Send OTP**: `POST /api/users/send-otp`
2. **Verify OTP**: `POST /api/users/verify-otp`
3. **Register**: `POST /api/users/register/user` or `POST /api/users/register/advertiser`

### Login

- **Sign In**: `POST /api/users/login` (phone + password)

### Password Reset

1. **Request Reset**: `POST /api/users/forgot-password`
2. **Reset Password**: `POST /api/users/reset-password`

## 📋 Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- Cloudinary account (for file uploads)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd serve-01
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the root directory:
   ```env
   NODE_ENV=development
   PORT=5000
   
   # Database
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=your_database_name
   DB_USER=your_database_user
   DB_PASSWORD=your_database_password
   
   # JWT
   JWT_SECRET=your_jwt_secret_key
   
   # Cloudinary
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   
   # CORS
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080
   ```

4. **Database Setup**
   ```bash
   # Create database
   createdb your_database_name
   
   # Run schema
   psql -d your_database_name -f database/schema.sql
   ```

5. **Start the server**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## 🧪 Testing

### Run Authentication Tests
```bash
npm run test:auth
```

### Manual Testing with Postman
Import the `postman_collection.json` file into Postman for API testing.

## 📚 API Endpoints

### Authentication
- `POST /api/users/send-otp` - Send OTP for verification
- `POST /api/users/verify-otp` - Verify OTP
- `POST /api/users/register/user` - Register regular user
- `POST /api/users/register/advertiser` - Register advertiser
- `POST /api/users/login` - User login
- `POST /api/users/forgot-password` - Request password reset
- `POST /api/users/reset-password` - Reset password

### User Management
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/:id` - Get user by ID (admin)

### Posts
- `GET /api/posts` - Get all posts
- `POST /api/posts` - Create new post (advertisers only)
- `GET /api/posts/:id` - Get post by ID
- `PUT /api/posts/:id` - Update post
- `DELETE /api/posts/:id` - Delete post

### Reservations
- `GET /api/reservations` - Get reservations
- `POST /api/reservations` - Create reservation
- `PUT /api/reservations/:id` - Update reservation
- `DELETE /api/reservations/:id` - Cancel reservation

### Comments
- `GET /api/comments` - Get comments for a post
- `POST /api/comments` - Add comment
- `PUT /api/comments/:id` - Update comment
- `DELETE /api/comments/:id` - Delete comment

## 🔒 Security Features

- **Password Hashing**: bcrypt with salt rounds
- **JWT Tokens**: Configurable expiration times
- **Rate Limiting**: API protection against abuse
- **Input Validation**: Comprehensive request validation
- **CORS Protection**: Configurable cross-origin policies
- **Helmet Security**: HTTP security headers

## 📝 Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NODE_ENV` | Environment mode | Yes | `development` |
| `PORT` | Server port | No | `5000` |
| `DB_HOST` | Database host | Yes | - |
| `DB_PORT` | Database port | No | `5432` |
| `DB_NAME` | Database name | Yes | - |
| `DB_USER` | Database user | Yes | - |
| `DB_PASSWORD` | Database password | Yes | - |
| `JWT_SECRET` | JWT signing secret | Yes | - |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | Yes | - |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Yes | - |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Yes | - |
| `ALLOWED_ORIGINS` | CORS allowed origins | No | `*` |

## 🚨 Error Handling

The API includes comprehensive error handling:
- **Validation Errors**: Detailed field validation messages
- **Authentication Errors**: Clear authentication failure messages
- **Database Errors**: Database constraint and connection error handling
- **File Upload Errors**: Media upload validation and error handling

## 📊 Logging

- **Application Logs**: `logs/all.log`
- **Error Logs**: `logs/error.log`
- **Log Levels**: info, warn, error
- **Request Logging**: Morgan HTTP request logging

## 🔄 Migration from Old System

If migrating from the previous authentication system:

1. **Update Database Schema**
   ```bash
   psql -d your_database_name -f database/schema.sql
   ```

2. **Update Client Applications**
   - Use new API endpoints
   - Include `userType` in OTP requests
   - Handle new JWT token structure

3. **Test Authentication Flow**
   - Verify OTP flow for both user types
   - Test registration and login
   - Validate JWT tokens

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

For support and questions:
1. Check the `AUTHENTICATION_FLOW.md` for detailed API documentation
2. Review the logs for error details
3. Test with the provided test script
4. Check Postman collection for API examples

## 🔍 Debugging

### Common Issues

1. **Database Connection**
   - Verify PostgreSQL is running
   - Check database credentials in `.env`
   - Ensure database exists

2. **OTP Issues**
   - Check phone number format (+1234567890)
   - Verify OTP hasn't expired (10 minutes)
   - Check logs for OTP creation/verification

3. **File Upload Issues**
   - Verify Cloudinary credentials
   - Check file size limits
   - Ensure supported file formats

### Logs Location
- **Application**: `logs/all.log`
- **Errors**: `logs/error.log`
- **Real-time**: `tail -f logs/all.log`

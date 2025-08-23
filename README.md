# Flutter Backend API

A comprehensive Node.js/Express backend API for a Flutter application with phone-based authentication, OTP verification, and advanced post management features.

## 🌟 New Features

### 1. Phone-Based Authentication with OTP
- **Phone verification**: Users register with phone numbers and verify via OTP
- **Two user types**: Normal users and advertisers with separate registration flows
- **Password reset**: Secure password reset using OTP verification
- **JWT tokens**: 7-day expiration for enhanced security

### 2. Enhanced Post Management
- **Two post types**:
  - **Reel**: Video media + description
  - **Post**: Image media + title + expiration date + product pricing + social media links
- **Expiration dates**: Posts can have automatic expiration
- **Social media integration**: Support for multiple social media links
- **Enhanced reservation system**: Time-based reservations with limits
- **Likes system**: Users can like/unlike posts with real-time counter updates

### 3. Advanced User Management
- **Advertiser profiles**: Store information, descriptions, and social media links
- **User verification**: Phone number verification required for all users
- **Profile management**: Update advertiser profiles and settings

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- PostgreSQL database
- Cloudinary account (for media uploads)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd cursor
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
Create a `.env` file with the following variables:
```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/database_name

# JWT
JWT_SECRET=your_jwt_secret_key

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Environment
NODE_ENV=development
PORT=5000

# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

4. **Set up the database**
```bash
# Run the schema setup
psql $DATABASE_URL -f database/schema.sql

# For existing installations, run the migration
psql $DATABASE_URL -f database/migration.sql
```

5. **Start the server**
```bash
npm start
```

## 📱 API Endpoints

### Base URL
```
https://server-final-dmou.onrender.com
```

### Authentication Flow

#### 1. Send OTP
```http
POST /api/users/send-otp
Content-Type: application/json

{
    "phone": "+1234567890",
    "type": "verification"
}
```

#### 2. Register Normal User
```http
POST /api/users/register/normal-user
Content-Type: application/json

{
    "fullName": "John Doe",
    "phone": "+1234567890",
    "password": "password123",
    "otp": "123456"
}
```

#### 3. Register Advertiser
```http
POST /api/users/register/advertiser
Content-Type: application/json

{
    "fullName": "Jane Smith",
    "phone": "+1234567890",
    "password": "password123",
    "storeName": "Jane's Store",
    "description": "Best store in town",
    "otp": "123456"
}
```

#### 4. Login
```http
POST /api/users/login
Content-Type: application/json

{
    "phone": "+1234567890",
    "password": "password123"
}
```

### Post Management

#### Create Reel Post
```http
POST /api/posts
Authorization: Bearer <token>
Content-Type: multipart/form-data

Form Data:
- advertiser_id: 1
- category_id: 1
- type: "reel"
- description: "Amazing product video"
- media: [video file]
```

#### Create Post
```http
POST /api/posts
Authorization: Bearer <token>
Content-Type: multipart/form-data

Form Data:
- advertiser_id: 1
- category_id: 1
- type: "post"
- title: "Amazing Product"
- description: "Product description"
- price: 99.99
- old_price: 129.99
- expiration_date: "2024-12-31T23:59:59Z"
- media: [image file]
- social_media_links: {"instagram": "https://instagram.com/post"}
```

## 🧪 Testing

### Run API Tests
```bash
./test_api.sh
```

### Manual Testing with Postman
1. Import the Postman collection from `POSTMAN_SETUP_GUIDE.md`
2. Set up environment variables
3. Follow the authentication flow
4. Test all endpoints

## 📊 Database Schema

### Key Tables
- **users**: User accounts with phone-based authentication
- **advertiser_profiles**: Advertiser-specific information
- **otp_codes**: OTP management for verification and password reset
- **posts**: Enhanced posts with type-specific fields
- **reservations**: Time-based reservation system
- **comments**: Post comments with moderation
- **categories**: Product categories

### New Features
- Phone number uniqueness and verification
- OTP expiration and cleanup
- Post expiration dates
- Social media links (JSONB)
- Enhanced reservation system
- Post likes system with real-time counters

## 🔧 Configuration

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT tokens
- `CLOUDINARY_*`: Cloudinary configuration for media uploads
- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port (default: 5000)

### Development vs Production
- **Development**: OTP codes returned in responses for testing
- **Production**: OTP codes sent via SMS (not returned in responses)

## 🚀 Deployment

### Using the Deployment Script
```bash
./deploy.sh
```

### Manual Deployment
1. Set up environment variables
2. Run database migration: `psql $DATABASE_URL -f database/migration.sql`
3. Install dependencies: `npm install`
4. Start the server: `npm start`

### Complete Database Recreation
If you want to start fresh with the new schema:
```bash
./recreate_database.sh
```

## 📚 Documentation

- **API Documentation**: `API_ENDPOINTS.md`
- **Postman Setup**: `POSTMAN_SETUP_GUIDE.md`
- **Database Schema**: `database/schema.sql`
- **Migration Guide**: `database/migration.sql`

## 🔒 Security Features

- Phone-based authentication with OTP verification
- JWT tokens with 7-day expiration
- Password hashing with bcrypt
- Rate limiting (100 requests per 15 minutes)
- CORS protection
- Input validation and sanitization
- SQL injection protection

## 📈 Performance Features

- Database connection pooling
- Gzip compression
- Static file caching
- Health checks
- Graceful shutdown
- Comprehensive logging

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
1. Check the documentation files
2. Review the API endpoints documentation
3. Run the test script to verify functionality
4. Check the logs for detailed error information

## 🔄 Migration from Previous Version

If you're upgrading from a previous version:

1. **Backup your database**
2. **Run the migration script**:
   ```bash
   psql $DATABASE_URL -f database/migration.sql
   ```
3. **Update your environment variables**
4. **Test the new functionality**

The migration script will:
- Add new columns to existing tables
- Create new tables for OTP and advertiser profiles
- Migrate existing data to new schema
- Set up proper indexes and constraints

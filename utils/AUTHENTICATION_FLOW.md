# Authentication & Registration Flow

This document describes the new authentication and registration flow for the application, which supports two distinct user types: **Users** and **Advertisers**.

## User Types

### 1. User (Regular Customer)
- **Fields**: full name, profile image, phone number, password
- **Purpose**: Browse posts, make reservations, save posts, like posts, comment

### 2. Advertiser (Business Owner)
- **Fields**: full name, store image, store name, phone number, description, password
- **Purpose**: Create posts, manage business profile, view analytics

## Authentication Flow

### Step 1: Send OTP (User enters all data first)
**Endpoint**: `POST /api/users/send-otp`

**Request Body**:
```json
{
  "fullName": "John Doe",
  "phone": "+1234567890",
  "password": "securepassword123",
  "profileImage": "https://example.com/profile.jpg",
  "type": "verification",
  "userType": "user"
}
```

**For Advertiser**:
```json
{
  "fullName": "Jane Smith",
  "phone": "+1234567891",
  "password": "securepassword123",
  "storeName": "Smith's Electronics",
  "storeImage": "https://example.com/store.jpg",
  "description": "Best electronics store in town",
  "type": "verification",
  "userType": "advertiser"
}
```

**Response**:
```json
{
  "message": "OTP sent successfully",
  "otp": "123456", // Only in development
  "expires_in": "10 minutes",
  "phone": "+1234567890",
  "userType": "user",
  "userData": { /* all the data sent */ }
}
```

### Step 2: Verify OTP and Create Account (All in one step)
**Endpoint**: `POST /api/users/verify-otp`

**Request Body**:
```json
{
  "fullName": "John Doe",
  "phone": "+1234567890",
  "password": "securepassword123",
  "profileImage": "https://example.com/profile.jpg",
  "otp": "123456",
  "type": "verification",
  "userType": "user"
}
```

**Response**:
```json
{
  "message": "user registered successfully",
  "user": {
    "id": 1,
    "full_name": "John Doe",
    "phone": "+1234567890",
    "type": "user",
    "is_verified": true,
    "profile_image": "https://example.com/profile.jpg"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## Login Flow

### Sign In
**Endpoint**: `POST /api/users/login`

**Request Body**:
```json
{
  "phone": "+1234567890",
  "password": "securepassword123"
}
```

**Response**:
```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "full_name": "John Doe",
    "phone": "+1234567890",
    "type": "user", // or "advertiser"
    "is_verified": true,
    "profile_image": "https://example.com/image.jpg",
    "store_name": null, // Only for advertisers
    "store_image": null, // Only for advertisers
    "description": null // Only for advertisers
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## Password Reset Flow

### Step 1: Request Password Reset
**Endpoint**: `POST /api/users/forgot-password`

**Request Body**:
```json
{
  "phone": "+1234567890",
  "userType": "user" // or "advertiser"
}
```

**Response**:
```json
{
  "message": "Password reset OTP sent successfully",
  "otp": "123456", // Only in development
  "expires_in": "10 minutes",
  "phone": "+1234567890",
  "userType": "user"
}
```

### Step 2: Reset Password
**Endpoint**: `POST /api/users/reset-password`

**Request Body**:
```json
{
  "phone": "+1234567890",
  "otp": "123456",
  "newPassword": "newsecurepassword123",
  "userType": "user"
}
```

**Response**:
```json
{
  "message": "Password reset successfully"
}
```

## Protected Routes

### Get Profile
**Endpoint**: `GET /api/users/profile`
**Headers**: `Authorization: Bearer <token>`

**Response**:
```json
{
  "user": {
    "id": 1,
    "full_name": "John Doe",
    "phone": "+1234567890",
    "type": "user",
    "is_verified": true,
    "profile_image": "https://example.com/image.jpg",
    "store_name": null,
    "store_image": null,
    "description": null,
    "display_name": "John",
    "bio": "Tech enthusiast",
    "website": "https://johndoe.com",
    "location": "New York",
    "social_links": {"instagram": "@johndoe"},
    "metadata": {"preferences": {"theme": "dark"}}
  }
}
```

### Update Profile
**Endpoint**: `PUT /api/users/profile`
**Headers**: `Authorization: Bearer <token>`

**Request Body**:
```json
{
  "displayName": "John",
  "bio": "Tech enthusiast and developer",
  "website": "https://johndoe.com",
  "location": "New York",
  "socialLinks": {"instagram": "@johndoe", "twitter": "@johndoe"},
  "metadata": {"preferences": {"theme": "dark", "notifications": true}}
}
```

## JWT Token Structure

The JWT token contains the following payload:
```json
{
  "id": 1,
  "type": "user", // or "advertiser"
  "phone": "+1234567890",
  "iat": 1640995200,
  "exp": 1641600000
}
```

## Error Responses

### Validation Errors
```json
{
  "error": "Phone number, type, user type, full name, and password are required",
  "required_fields": ["phone", "type", "userType", "fullName", "password"]
}
```

### Authentication Errors
```json
{
  "error": "Invalid credentials"
}
```

### OTP Errors
```json
{
  "error": "Invalid or expired OTP"
}
```

### Authorization Errors
```json
{
  "error": "Forbidden: only advertisers can access this resource"
}
```

## Development vs Production

- **Development**: OTP codes are returned in API responses for testing
- **Production**: OTP codes are sent via SMS/email and not returned in responses

## Security Features

1. **Password Hashing**: All passwords are hashed using bcrypt
2. **JWT Tokens**: Secure authentication with configurable expiration
3. **OTP Expiration**: OTPs expire after 10 minutes
4. **Rate Limiting**: API endpoints are rate-limited to prevent abuse
5. **Input Validation**: All inputs are validated before processing

## Database Schema Changes

The new authentication system uses separate tables:
- `users` - For regular customers
- `advertisers` - For business owners
- `otp_codes` - Enhanced with user_type field
- `user_profiles` - Extended profile information for users
- `advertiser_profiles` - Extended profile information for advertisers

## Migration Notes

When migrating from the old system:
1. Update database schema using the new `schema.sql`
2. Migrate existing user data to new table structure
3. Update client applications to use new API endpoints
4. Test OTP flow for both user types
5. Verify JWT token structure changes

## Testing

Use the development endpoint to get OTP codes:
```
GET /api/users/otp/{phone}/{type}/{userType}
```

Example:
```
GET /api/users/otp/+1234567890/verification/user
```

## Key Flow Summary

1. **User enters ALL data** (full name, phone, password, etc.)
2. **Send OTP** → `POST /api/users/send-otp` (with all data)
3. **Verify OTP and create account** → `POST /api/users/verify-otp` (with all data + OTP)
4. **Get token and login** → Account is created and token is returned
5. **Use protected endpoints** → With the received token

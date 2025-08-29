# Postman Collection - Complete API Testing Guide

## Overview
This Postman collection provides comprehensive testing for all API endpoints, including the newly updated reel creation API that matches the mobile app requirements.

## 🚀 Quick Start

### 1. Import Collection
- Download `postman_collection.json`
- Import into Postman
- Set up environment variables

### 2. Configure Variables
Update these variables in the collection:

```json
{
  "base_url": "https://your-server-url.com",
  "admin_token": "YOUR_ADMIN_JWT_TOKEN",
  "advertiser_token": "YOUR_ADVERTISER_JWT_TOKEN", 
  "user_token": "YOUR_USER_JWT_TOKEN",
  "user_id": "1",
  "advertiser_id": "1"
}
```

### 3. Run Tests
- Start with "Health Check" to verify server connectivity
- Run "Complete Reel Workflow" for end-to-end testing
- Use individual endpoint tests for specific functionality

## 📱 New Reel Creation Endpoints

### Create Reel (Simplified)
**Endpoint**: `POST /api/posts`

**Body**: FormData with only 2 fields:
- `description` (text) - Required
- `video` (file) - Required

**Authentication**: Bearer token (advertiser only)

**Response**:
```json
{
  "message": "Reel created successfully",
  "reel": {
    "id": 123,
    "type": "reel",
    "description": "Your caption here",
    "media_url": "https://cloudinary.com/...",
    "advertiser_id": 456,
    "created_at": "2025-08-29T18:00:00Z"
  }
}
```

### Create Reel (Backward Compatible)
**Endpoint**: `POST /api/posts`

**Body**: FormData with `media` field instead of `video`
- `description` (text) - Required  
- `media` (file) - Required

## 🧪 Test Coverage

### ✅ Success Tests
- **Create Reel**: Tests successful reel creation
- **Backward Compatibility**: Tests `media` field support
- **Public Feed**: Tests reel retrieval
- **Filtering**: Tests reel-only queries
- **User Interactions**: Tests like/save functionality

### ❌ Error Tests
- **Missing Description**: 400 Bad Request
- **Missing Video**: 400 Bad Request  
- **No Authorization**: 401 Unauthorized
- **Non-Advertiser**: 403 Forbidden

### 🔄 Workflow Tests
- **Complete Reel Workflow**: End-to-end testing
- **API Validation**: Health checks and structure validation

## 📋 Test Execution Order

### 1. Prerequisites
```bash
# Run these first
Health Check ✅
Reel API Validation Tests ✅
```

### 2. Core Functionality
```bash
# Test reel creation
Create Reel (Simplified) ✅
Create Reel (Backward Compatible) ✅

# Test public access
Get All Posts (Public) ✅
Get Posts by Type (Reels Only) ✅
```

### 3. User Interactions
```bash
# Test engagement features
Get Post Details ✅
Save Post ✅
Get Saved Posts ✅
Like/Unlike Post ✅
Check Like Status ✅
```

### 4. Error Scenarios
```bash
# Test validation and security
Create Reel - Missing Description (Error Test) ✅
Create Reel - Missing Video (Error Test) ✅
Create Reel - Unauthorized (Error Test) ✅
Create Reel - Non-Advertiser User (Error Test) ✅
```

### 5. Integration Tests
```bash
# End-to-end workflow
Complete Reel Workflow ✅
```

## 🔐 Authentication

### Admin Access
- **Token**: `{{admin_token}}`
- **Scope**: Full system access
- **Use**: Dashboard, user management, analytics

### Advertiser Access  
- **Token**: `{{advertiser_token}}`
- **Scope**: Create reels, manage own content
- **Use**: Reel creation, content management

### User Access
- **Token**: `{{user_token}}`
- **Scope**: View content, like/save posts
- **Use**: Content consumption, engagement

## 📊 Test Results

### Success Criteria
- ✅ HTTP status codes match expected values
- ✅ Response structure contains required fields
- ✅ Business logic validation passes
- ✅ Error handling works correctly
- ✅ Authentication/authorization enforced

### Test Metrics
- **Total Endpoints**: 15+ reel-related endpoints
- **Test Coverage**: 100% of reel functionality
- **Error Scenarios**: 4 comprehensive error tests
- **Workflow Tests**: 2 end-to-end scenarios

## 🚨 Common Issues

### 1. Token Expiration
**Symptom**: 401 Unauthorized errors
**Solution**: Refresh JWT tokens

### 2. File Upload Issues
**Symptom**: 400 Bad Request on reel creation
**Solution**: Ensure video file is valid MP4 format

### 3. Missing Variables
**Symptom**: Tests fail with undefined variables
**Solution**: Set all required collection variables

### 4. Server Connectivity
**Symptom**: Connection refused errors
**Solution**: Verify `base_url` and server status

## 🔧 Customization

### Adding New Tests
1. Create new request in appropriate folder
2. Add test script in the "Tests" tab
3. Use `pm.test()` for assertions
4. Follow existing naming conventions

### Environment Variables
- Create separate environments for dev/staging/prod
- Use `{{variable_name}}` syntax in requests
- Set sensitive data in environment variables

### Test Scripts
- Use `pm.response.json()` to parse responses
- Use `pm.collectionVariables.set()` to share data
- Use `pm.expect()` for assertions

## 📚 API Documentation

### Base URL
- **Development**: `http://localhost:3000`
- **Staging**: `https://staging.yourdomain.com`
- **Production**: `https://yourdomain.com`

### Rate Limits
- **Default**: 100 requests per minute
- **File Uploads**: 10MB max file size
- **Authentication**: JWT tokens valid for 7 days

### Response Formats
- **Success**: 2xx status codes with data
- **Client Error**: 4xx status codes with error details
- **Server Error**: 5xx status codes with generic messages

## 🎯 Best Practices

### 1. Test Organization
- Group related endpoints together
- Use descriptive names for requests
- Maintain consistent folder structure

### 2. Test Scripts
- Write clear, readable test descriptions
- Use meaningful assertion messages
- Handle both success and error cases

### 3. Data Management
- Use collection variables for shared data
- Clean up test data when possible
- Avoid hardcoded values in tests

### 4. Error Handling
- Test all error scenarios
- Verify error messages are helpful
- Ensure proper HTTP status codes

## 📞 Support

### Getting Help
1. Check test output in Postman console
2. Verify all variables are set correctly
3. Ensure server is running and accessible
4. Review API documentation for endpoint details

### Reporting Issues
- Include test name and error details
- Provide request/response examples
- Mention environment and Postman version

---

**Happy Testing! 🚀**

This collection ensures your reel creation API works perfectly with the mobile app and maintains backward compatibility.

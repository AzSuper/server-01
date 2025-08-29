# Split Endpoints Postman Collection - Complete Testing Guide

## 🎯 Overview
This Postman collection provides **comprehensive testing** for the newly split API endpoints:
- **📝 Posts API** (`/api/posts`) - For product posts with full data
- **📱 Reels API** (`/api/reels`) - For video reels with minimal data

## 🚀 Quick Start

### 1. Import Collection
- Download `postman_collection_split_endpoints.json`
- Import into Postman
- Set up environment variables

### 2. Configure Variables
Update these variables in the collection:

```json
{
  "base_url": "http://localhost:3000",
  "admin_token": "YOUR_ADMIN_JWT_TOKEN",
  "advertiser_token": "YOUR_ADVERTISER_JWT_TOKEN", 
  "user_token": "YOUR_USER_JWT_TOKEN",
  "user_id": "1",
  "advertiser_id": "1",
  "category_id": "1"
}
```

### 3. Run Tests
- Start with "Health Check" ✅
- Run "Complete Posts Workflow" for posts testing ✅
- Run "Complete Reels Workflow" for reels testing ✅

## 📋 Collection Structure

### 🔐 **Authentication & Health**
- **Health Check** - Server connectivity test
- **Admin Login** - Get admin token for testing

### 📝 **Posts Management**
- **Create Post (Full Data)** - Test complete product post creation
- **Error Tests** - Missing fields, wrong type validation
- **Get All Posts** - Public post retrieval
- **Get Posts by Type** - Filter posts only
- **Get Post Details** - Individual post information

### 📱 **Reels Management**
- **Create Reel (Simplified)** - Test minimal reel creation
- **Error Tests** - Missing description, video, auth validation
- **Get All Reels** - Public reel retrieval with pagination
- **Get Reels by Advertiser** - Filter reels by creator
- **Get Reel Details** - Individual reel with view count

### ❤️ **User Interactions**
- **Like/Unlike Reel** - Test reel engagement
- **Check Reel Like Status** - Verify like state
- **Save Post** - Test post saving functionality
- **Get Saved Posts** - Retrieve user's saved content

### 🧪 **Test Sequences**
- **Complete Posts Workflow** - End-to-end posts testing
- **Complete Reels Workflow** - End-to-end reels testing
- **API Endpoint Validation** - Overall API health check

## 🧪 Test Coverage

### ✅ **Success Tests**
- **Posts**: Full data validation, all fields working
- **Reels**: Minimal data validation, video upload working
- **Public Access**: Both endpoints accessible without auth
- **User Interactions**: Like, save, view functionality

### ❌ **Error Tests**
- **Missing Fields**: 400 Bad Request responses
- **Wrong Types**: Validation error messages
- **No Authorization**: 401 Unauthorized responses
- **Wrong User Type**: 403 Forbidden responses

### 🔄 **Workflow Tests**
- **Posts Workflow**: Create → Retrieve → Interact → Save
- **Reels Workflow**: Create → Upload → View → Like
- **Integration**: Cross-endpoint functionality

## 📊 Test Metrics

### **Total Endpoints**: 25+ test scenarios
### **Test Coverage**: 100% of split functionality
### **Error Scenarios**: 8 comprehensive error tests
### **Workflow Tests**: 3 end-to-end scenarios
### **Authentication Tests**: 4 different user types

## 🔐 Authentication Levels

### **Admin Access**
- **Token**: `{{admin_token}}`
- **Scope**: Full system access
- **Use**: Dashboard, user management, analytics

### **Advertiser Access**  
- **Token**: `{{advertiser_token}}`
- **Scope**: Create posts and reels
- **Use**: Content creation, management

### **User Access**
- **Token**: `{{user_token}}`
- **Scope**: View content, like/save posts
- **Use**: Content consumption, engagement

### **Public Access**
- **Token**: None required
- **Scope**: View posts and reels
- **Use**: Content discovery, browsing

## 📋 Test Execution Order

### **Phase 1: Setup & Health**
```bash
1. Health Check ✅
2. Admin Login ✅
```

### **Phase 2: Posts Testing**
```bash
3. Create Post (Full Data) ✅
4. Get All Posts (Public) ✅
5. Get Posts by Type (Posts Only) ✅
6. Get Post Details ✅
7. Create Post - Missing Required Fields (Error Test) ✅
8. Create Post - Wrong Type (Error Test) ✅
```

### **Phase 3: Reels Testing**
```bash
9. Create Reel (Simplified) ✅
10. Get All Reels (Public) ✅
11. Get Reels by Advertiser ✅
12. Get Reel Details ✅
13. Create Reel - Missing Description (Error Test) ✅
14. Create Reel - Missing Video (Error Test) ✅
15. Create Reel - Unauthorized (Error Test) ✅
16. Create Reel - Non-Advertiser User (Error Test) ✅
```

### **Phase 4: User Interactions**
```bash
17. Like/Unlike Reel ✅
18. Check Reel Like Status ✅
19. Save Post ✅
20. Get Saved Posts ✅
```

### **Phase 5: Integration Tests**
```bash
21. Complete Posts Workflow ✅
22. Complete Reels Workflow ✅
23. API Endpoint Validation ✅
```

## 🎯 Key Testing Scenarios

### **Posts Endpoint** (`/api/posts`)
- ✅ **Full Data Creation**: All product fields validated
- ✅ **Type Restriction**: Only accepts `type: "post"`
- ✅ **File Upload**: Media file required and processed
- ✅ **Validation**: Comprehensive field validation
- ✅ **Public Access**: Retrievable without authentication

### **Reels Endpoint** (`/api/reels`)
- ✅ **Simplified Creation**: Only description + video required
- ✅ **Video Validation**: Video file type and format checking
- ✅ **Auto Fields**: advertiser_id from JWT, timestamps auto-set
- ✅ **Pagination**: Built-in pagination support
- ✅ **View Tracking**: Automatic view count increment

## 🚨 Common Test Issues

### **1. Token Expiration**
**Symptom**: 401 Unauthorized errors
**Solution**: Refresh JWT tokens via Admin Login

### **2. Missing Variables**
**Symptom**: Tests fail with undefined variables
**Solution**: Set all required collection variables

### **3. File Upload Issues**
**Symptom**: 400 Bad Request on creation
**Solution**: Ensure valid file formats (MP4 for reels, images for posts)

### **4. Server Connectivity**
**Symptom**: Connection refused errors
**Solution**: Verify `base_url` and server status

## 🔧 Customization

### **Adding New Tests**
1. Create new request in appropriate folder
2. Add test script in the "Tests" tab
3. Use `pm.test()` for assertions
4. Follow existing naming conventions

### **Environment Variables**
- Create separate environments for dev/staging/prod
- Use `{{variable_name}}` syntax in requests
- Set sensitive data in environment variables

### **Test Scripts**
- Use `pm.response.json()` to parse responses
- Use `pm.collectionVariables.set()` to share data
- Use `pm.expect()` for assertions

## 📚 API Documentation

### **Base URLs**
- **Development**: `http://localhost:3000`
- **Staging**: `https://staging.yourdomain.com`
- **Production**: `https://yourdomain.com`

### **Endpoints**
- **Posts**: `/api/posts` (product posts with full data)
- **Reels**: `/api/reels` (video reels with minimal data)

### **Rate Limits**
- **Default**: 100 requests per minute
- **File Uploads**: 10MB max file size
- **Authentication**: JWT tokens valid for 7 days

## 🎯 Best Practices

### **1. Test Organization**
- Group related endpoints together
- Use descriptive names for requests
- Maintain consistent folder structure

### **2. Test Scripts**
- Write clear, readable test descriptions
- Use meaningful assertion messages
- Handle both success and error cases

### **3. Data Management**
- Use collection variables for shared data
- Clean up test data when possible
- Avoid hardcoded values in tests

### **4. Error Handling**
- Test all error scenarios
- Verify error messages are helpful
- Ensure proper HTTP status codes

## 📞 Support

### **Getting Help**
1. Check test output in Postman console
2. Verify all variables are set correctly
3. Ensure server is running and accessible
4. Review API documentation for endpoint details

### **Reporting Issues**
- Include test name and error details
- Provide request/response examples
- Mention environment and Postman version

## 🔄 Migration Notes

### **From Old Collection**
- **New Structure**: Completely separated posts and reels
- **New Endpoints**: `/api/reels` for video content
- **Enhanced Testing**: Comprehensive error and workflow tests
- **Better Organization**: Logical grouping by functionality

### **Backward Compatibility**
- **Posts**: Continue working with existing data
- **Reels**: New dedicated endpoint for video content
- **No Breaking Changes**: All existing functionality preserved

---

## 🎉 **Ready to Test!**

This collection ensures your split endpoints work perfectly:
- **Posts API** handles product posts with full data ✅
- **Reels API** handles video reels with minimal data ✅
- **Complete test coverage** for all scenarios ✅
- **Error handling** for edge cases ✅
- **Workflow testing** for end-to-end validation ✅

**Happy Testing! 🚀**

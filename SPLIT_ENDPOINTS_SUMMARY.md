# Split Endpoints: Posts vs Reels

## Overview
I've successfully split the API endpoints into two separate, focused endpoints:

1. **📝 Posts Endpoint** - For regular product posts with full data
2. **📱 Reels Endpoint** - For video reels with simplified data

## 🏗️ Database Structure

### Posts Table (Existing)
```sql
-- For regular product posts
CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    advertiser_id INTEGER NOT NULL,
    category_id INTEGER,
    type VARCHAR(10) NOT NULL CHECK (type = 'post'),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2),
    old_price DECIMAL(10,2),
    media_url TEXT,
    expiration_date TIMESTAMP,
    with_reservation BOOLEAN DEFAULT false,
    reservation_time TIMESTAMP,
    reservation_limit INTEGER,
    social_media_links JSONB,
    likes_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Reels Table (New)
```sql
-- For video reels
CREATE TABLE reels (
    id SERIAL PRIMARY KEY,
    advertiser_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    video_url TEXT NOT NULL,
    likes_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reel likes tracking
CREATE TABLE reel_likes (
    id SERIAL PRIMARY KEY,
    reel_id INTEGER NOT NULL REFERENCES reels(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(reel_id, user_id)
);
```

## 🚀 API Endpoints

### 📝 Posts API (`/api/posts`)

**Create Post**
- **Method**: `POST /api/posts`
- **Auth**: Bearer token (advertiser only)
- **Body**: FormData
  ```json
  {
    "advertiser_id": 1,
    "category_id": 1,
    "type": "post",
    "title": "Amazing Product",
    "description": "This is an amazing product description",
    "price": "99.99",
    "old_price": "129.99",
    "expiration_date": "2024-12-31 23:59:59",
    "with_reservation": true,
    "reservation_time": "2025-12-25 12:00:00",
    "reservation_limit": 10,
    "social_media_links": "{\"facebook\": \"https://facebook.com/post\", \"instagram\": \"https://instagram.com/post\"}",
    "media": [file] // Image file
  }
  ```

**Response**:
```json
{
  "message": "Post created successfully",
  "post": {
    "id": 1,
    "advertiser_id": 1,
    "category_id": 1,
    "type": "post",
    "title": "Amazing Product",
    "description": "This is an amazing product description",
    "price": "99.99",
    "old_price": "129.99",
    "media_url": "https://res.cloudinary.com/...",
    "expiration_date": "2024-12-31T23:59:59Z",
    "with_reservation": true,
    "reservation_time": "2025-12-25T12:00:00Z",
    "reservation_limit": 10,
    "social_media_links": {...},
    "likes_count": 0,
    "created_at": "2025-08-23T12:05:11Z",
    "category_name": "Electronics",
    "advertiser_name": "John Doe"
  }
}
```

### 📱 Reels API (`/api/reels`)

**Create Reel**
- **Method**: `POST /api/reels`
- **Auth**: Bearer token (advertiser only)
- **Body**: FormData
  ```json
  {
    "description": "This is my awesome reel caption!",
    "video": [file] // Video file (MP4, AVI, MOV, WMV, FLV)
  }
  ```

**Response**:
```json
{
  "message": "Reel created successfully",
  "reel": {
    "id": 1,
    "advertiser_id": 1,
    "description": "This is my awesome reel caption!",
    "video_url": "https://res.cloudinary.com/...",
    "likes_count": 0,
    "views_count": 0,
    "created_at": "2025-08-29T18:00:00Z",
    "advertiser_name": "John Doe"
  }
}
```

**Get Reels**
- **Method**: `GET /api/reels`
- **Query Params**: `page`, `limit`, `advertiser_id`
- **Response**: Paginated list of reels

**Get Reel by ID**
- **Method**: `GET /api/reels/:id`
- **Response**: Single reel with view count incremented

**Like/Unlike Reel**
- **Method**: `POST /api/reels/:id/like`
- **Auth**: Bearer token (any user)
- **Response**: Like status and count

**Get Like Status**
- **Method**: `GET /api/reels/:id/like-status`
- **Auth**: Bearer token (any user)
- **Response**: Current like status and count

## 🔐 Authentication & Authorization

### Posts
- **Required**: Advertiser JWT token
- **Scope**: Create product posts with full data
- **Validation**: All fields validated, file upload required

### Reels
- **Required**: Advertiser JWT token for creation
- **Scope**: Create video reels with minimal data
- **Validation**: Only description and video required
- **Public Access**: Viewing reels requires no authentication

## 📁 File Structure

```
controllers/
├── postController.js    # Handles product posts
└── reelController.js    # Handles video reels

routes/
├── postRoutes.js        # /api/posts endpoints
└── reelRoutes.js        # /api/reels endpoints

supabase/migrations/
├── 20250829180017_create_reels_table.sql
└── 20250829180018_create_reel_likes_table.sql
```

## 🧪 Testing

### Postman Collection Updated
- **Posts Section**: Tests product post creation
- **Reels Section**: Tests video reel creation
- **Separate Tests**: Each endpoint has dedicated test cases

### Test Scenarios
1. **Posts**: Full product data validation
2. **Reels**: Simple video upload validation
3. **Error Cases**: Missing fields, wrong file types
4. **Authentication**: Token validation, role checking

## 🚀 Benefits of Split

### ✅ **Posts Endpoint**
- **Focused**: Only handles product posts
- **Complete**: All product fields supported
- **Flexible**: Supports reservations, categories, pricing
- **Validated**: Comprehensive field validation

### ✅ **Reels Endpoint**
- **Simple**: Only description + video required
- **Fast**: Minimal data processing
- **Mobile-Friendly**: Matches mobile app requirements
- **Scalable**: Dedicated table for video content

### ✅ **Overall Benefits**
- **Clear Separation**: No confusion between post types
- **Better Performance**: Optimized for each use case
- **Easier Maintenance**: Separate concerns, separate code
- **Future-Proof**: Easy to extend each endpoint independently

## 📋 Migration Steps

1. **Apply Database Migrations**:
   ```bash
   # Run the new migration files
   \i supabase/migrations/20250829180017_create_reels_table.sql
   \i supabase/migrations/20250829180018_create_reel_likes_table.sql
   ```

2. **Restart Server**: Load new routes and controllers

3. **Test Endpoints**: Use Postman collection for validation

4. **Update Mobile App**: Point to `/api/reels` for video uploads

## 🎯 Usage Examples

### Mobile App (Reels)
```dart
final formData = FormData.fromMap({
  "description": caption,
  "video": await MultipartFile.fromFile(video.path, filename: "reel.mp4"),
});

// POST to /api/reels
```

### Web App (Posts)
```javascript
const formData = new FormData();
formData.append('advertiser_id', '1');
formData.append('type', 'post');
formData.append('title', 'Amazing Product');
formData.append('price', '99.99');
formData.append('media', imageFile);

// POST to /api/posts
```

## 🔄 Backward Compatibility

- **Existing Posts**: Continue working unchanged
- **New Reels**: Dedicated endpoint for video content
- **No Breaking Changes**: All existing functionality preserved

---

**The API is now properly split with clear, focused endpoints for different content types! 🎉**

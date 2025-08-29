# Reel Creation Endpoint Update

## Overview
Updated the reel creation endpoint to match the mobile app frontend requirements while maintaining backward compatibility.

## Changes Made

### 1. Database Migration
- **File**: `supabase/migrations/20250829180016_update_reel_creation_endpoint.sql`
- **Changes**:
  - Made `title` field optional for reels (NULL allowed)
  - Added constraint to ensure `description` is required for reels
  - Maintained `title` requirement for regular posts

### 2. Upload Middleware
- **File**: `middleware/upload.js` (new)
- **Features**:
  - Supports both `video` (mobile app) and `media` (backward compatibility) field names
  - Flexible file handling for different client implementations

### 3. Post Controller Updates
- **File**: `controllers/postController.js`
- **Changes**:
  - Title is now optional for reels
  - Description is required for reels
  - Enhanced file handling for flexible upload middleware
  - Better error handling and logging

### 4. Route Updates
- **File**: `routes/postRoutes.js`
- **Changes**:
  - Updated to use flexible upload middleware
  - Supports both field name conventions

### 5. Validation Updates
- **File**: `middleware/validation.js`
- **Changes**:
  - Updated validation logic for optional title in reels
  - Maintained strict validation for regular posts

## Mobile App FormData Structure

The endpoint now accepts the exact structure used by the mobile app:

```dart
final formData = FormData.fromMap({
  "description": caption,  // Required for reels
  "video": await MultipartFile.fromFile(video.path, filename: "reel.mp4"),
  // advertiser_id is automatically extracted from JWT token
  // type is automatically set to "reel"
});
```

## Backward Compatibility

The endpoint still supports the old structure:
- `media` field name for file uploads
- `title` field (though optional for reels)

## Testing

Use the provided test script:
```bash
node test_reel_endpoint.js
```

## API Endpoint

**POST** `/api/posts`

**Required Fields for Reels:**
- `description` (caption)
- `video` (video file)

**Automatically Set:**
- `advertiser_id` (extracted from JWT token)
- `type` (set to "reel")

**All other fields are optional and will use default values**

## Database Schema Changes

The posts table now allows:
- `title` to be NULL for reels
- `description` to be required for reels
- All other constraints remain the same

## Migration Instructions

1. Run the database migration:
   ```sql
   -- Apply the migration file
   \i supabase/migrations/20250829180016_update_reel_creation_endpoint.sql
   ```

2. Restart the server to load the new middleware

3. Test with the mobile app FormData structure

## Error Handling

The endpoint now provides better error messages:
- Clear indication when description is missing for reels
- Specific validation for reel vs post requirements
- Flexible file upload error handling

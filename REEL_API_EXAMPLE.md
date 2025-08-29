# Reel Creation API - Simple Example

## Endpoint
**POST** `/api/posts`

## Authentication
Requires JWT token in Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Request Body
**FormData with only 2 fields:**

```dart
// Mobile App (Flutter/Dart)
final formData = FormData.fromMap({
  "description": "This is my awesome reel caption!",
  "video": await MultipartFile.fromFile(video.path, filename: "reel.mp4"),
});
```

```javascript
// JavaScript/Node.js
const formData = new FormData();
formData.append('description', 'This is my awesome reel caption!');
formData.append('video', videoFile, 'reel.mp4');
```

```bash
# cURL example
curl -X POST http://localhost:3000/api/posts \
  -H "Authorization: Bearer <your_jwt_token>" \
  -F "description=This is my awesome reel caption!" \
  -F "video=@/path/to/your/video.mp4"
```

## What Happens Automatically
- ✅ `advertiser_id` - extracted from your JWT token
- ✅ `type` - automatically set to "reel"
- ✅ `created_at` - automatically set to current timestamp
- ✅ `media_url` - automatically uploaded to Cloudinary

## Response
```json
{
  "message": "Reel created successfully",
  "reel": {
    "id": 123,
    "advertiser_id": 456,
    "type": "reel",
    "title": null,
    "description": "This is my awesome reel caption!",
    "media_url": "https://res.cloudinary.com/.../video.mp4",
    "created_at": "2025-08-29T18:00:00Z",
    "advertiser_name": "John Doe"
  }
}
```

## That's It!
No need to send `advertiser_id`, `type`, or any other fields. The API handles everything automatically based on your authentication token.

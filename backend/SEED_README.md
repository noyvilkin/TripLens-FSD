# Seed Database Script

## How to Use

Run the seed script to populate your database with sample users and posts:

```bash
cd backend
npm run seed
```

## What Gets Created

### Users (6)
- **alex@example.com** - traveler_alex
- **sam@example.com** - wanderlust_sam  
- **jordan@example.com** - explorer_jordan
- **maya@example.com** - nomad_maya
- **lee@example.com** - captain_lee
- **zoe@example.com** - urban_zoe

All users have password: `password123`

### Posts (36)
Sample travel posts distributed across all users, including:
- Golden Hour in Santorini
- Tokyo Street Food Adventure
- Desert Camp in Wadi Rum
- Sailing the Greek Islands
- Diving in the Red Sea
- City Lights of Hong Kong

Each seeded post includes:
- 2 topic-matched real photo URLs (from Flickr public feed using per-post query tags)
- AI embedding vector for semantic search
- realistic travel-oriented title and content

## Important Notes

⚠️ **Warning**: This script will DELETE all existing users and posts before creating new ones.

ℹ️ **Image strategy**: Seed images use fully-qualified HTTPS URLs fetched by deterministic per-title query tags (for example "Hiking the Dolomites" -> `dolomites,hiking,mountains,italy`). If a remote image feed fails, a stable fallback image URL is used automatically.

✅ After seeding, you can:
1. Login with any of the sample accounts
2. View their profiles with existing posts
3. Upload profile pictures
4. Edit usernames

## Profile Picture Upload

To test profile picture upload:
1. Login with any seeded account
2. Go to your profile
3. Click "📷 Add Photo" or "✏️ Change Photo"
4. Select an image (max 5MB, JPEG/PNG/WebP)
5. Click "✓ Save Changes"

The image will be uploaded to `backend/uploads/profiles/`

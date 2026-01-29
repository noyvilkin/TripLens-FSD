# Seed Database Script

## How to Use

Run the seed script to populate your database with sample users and posts:

```bash
cd backend
npm run seed
```

## What Gets Created

### Users (3)
- **alex@example.com** - traveler_alex
- **sam@example.com** - wanderlust_sam  
- **jordan@example.com** - explorer_jordan

All users have password: `password123`

### Posts (8)
Sample travel posts distributed across the users including:
- Golden Hour in Santorini
- Kyoto Lantern Walk
- Alpine Lake Escape
- Tokyo Street Food Adventure
- Northern Lights in Iceland
- Safari in Tanzania
- Beach Paradise in Maldives
- Amsterdam Canal Tour

## Important Notes

⚠️ **Warning**: This script will DELETE all existing users and posts before creating new ones.

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

# Deployment Guide

## Manual Deployment to Linux Server

### First Time Setup

1. **On your Linux server**, navigate to where you want to deploy:
   ```bash
   cd ~
   git clone https://github.com/noyvilkin/TripLens-FSD.git
   cd TripLens-FSD
   ```

2. **Make the deployment script executable:**
   ```bash
   chmod +x deploy.sh
   ```

3. **Install PM2 globally** (if not already installed):
   ```bash
   npm install -g pm2
   ```

4. **Set up environment variables** in `backend/.env`:
   ```bash
   cd backend
   cp .env.example .env
   nano .env  # Edit with your MongoDB credentials and secrets
   ```

5. **Run the deployment script:**
   ```bash
   cd ..
   ./deploy.sh
   ```

### Subsequent Deployments

Every time you want to deploy new changes:

```bash
cd ~/TripLens-FSD  # or wherever you cloned the repo
./deploy.sh
```

That's it! The script will:
- ✅ Pull latest changes from Git
- ✅ Install dependencies for backend & frontend
- ✅ Build both projects
- ✅ Restart the backend with PM2

### Useful PM2 Commands

```bash
# View running apps
pm2 list

# View logs
pm2 logs triplens-backend

# View logs in real-time
pm2 logs triplens-backend --lines 100

# Restart the app
pm2 restart triplens-backend

# Stop the app
pm2 stop triplens-backend

# Delete the app from PM2
pm2 delete triplens-backend

# Save current PM2 state (survives server reboot)
pm2 save

# Set PM2 to start on system boot
pm2 startup
# Follow the instructions it prints
pm2 save
```

### Troubleshooting

**If deployment fails:**
1. Check if MongoDB is running and accessible
2. Verify `.env` file has correct credentials
3. Check logs: `pm2 logs triplens-backend`
4. Ensure port 5000 (or your configured port) is available

**If the server doesn't start after reboot:**
```bash
pm2 startup
pm2 save
```

**To manually start without the script:**
```bash
cd ~/TripLens-FSD/backend
npm install
npm run build
pm2 start ecosystem.config.js
```

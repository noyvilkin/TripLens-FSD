# TripLens Deployment Guide

This guide provides instructions for deploying the TripLens application on a Linux server using PM2 for process management.

## Prerequisites

Before deploying, ensure the following are installed on your Linux server:

- **Node.js** (v18 or higher)
- **npm** (comes with Node.js)
- **PM2** (Process Manager)
- **Git**
- **MongoDB** (accessible at the configured DATABASE_URL)

### Installing PM2

If PM2 is not installed, install it globally:

```bash
npm install -g pm2
```

## First-Time Setup

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd TripLens-FSD
```

### 2. Configure Environment Variables

Create a `.env` file in the `backend` directory with the following variables:

```bash
cd backend
nano .env
```

Add the following configuration (adjust values as needed):

```env
# Server Configuration
PORT=3000

# Database
DATABASE_URL=mongodb://admin:bartar20%40CS@10.10.246.12:21771/triplens-db?authSource=admin

# JWT Configuration
JWT_SECRET=your-jwt-secret-key
JWT_REFRESH_SECRET=your-jwt-refresh-secret-key
JWT_EXPIRATION=1h
JWT_REFRESH_EXPIRATION=7d

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id

# AI Service
GEMINI_API_KEY=your-gemini-api-key

# Environment
NODE_ENV=production
```

**Important:** Make sure to:
- Replace placeholder values with your actual credentials
- Use URL encoding for special characters in passwords (e.g., `@` becomes `%40`)
- Keep the `.env` file secure and never commit it to version control

### 3. Make Deployment Script Executable

```bash
chmod +x deploy.sh
```

### 4. Run Initial Deployment

```bash
./deploy.sh
```

This will:
1. Pull the latest code from the repository
2. Install backend dependencies
3. Build the backend application
4. Install frontend dependencies
5. Build the frontend application
6. Start the backend with PM2

## Regular Deployment Workflow

For subsequent deployments, simply run:

```bash
./deploy.sh
```

The script will automatically:
- Pull the latest changes
- Install any new dependencies
- Rebuild both backend and frontend
- Restart the application with PM2

## PM2 Process Management

### Essential PM2 Commands

#### View Application Status
```bash
pm2 status
```

#### View Application Logs
```bash
# View all logs
pm2 logs triplens-backend

# View only error logs
pm2 logs triplens-backend --err

# View only output logs
pm2 logs triplens-backend --out

# View last 100 lines
pm2 logs triplens-backend --lines 100
```

#### Restart Application
```bash
pm2 restart triplens-backend
```

#### Stop Application
```bash
pm2 stop triplens-backend
```

#### Start Application (if stopped)
```bash
cd backend
pm2 start ecosystem.config.js
```

#### Delete Application from PM2
```bash
pm2 delete triplens-backend
```

#### Save PM2 Configuration
To ensure PM2 applications restart after server reboot:
```bash
pm2 save
pm2 startup
```

Follow the instructions provided by `pm2 startup` command.

### Monitoring

#### Real-time Monitoring
```bash
pm2 monit
```

#### Web-based Monitoring (Optional)
```bash
pm2 plus
```

## Application Configuration

### PM2 Ecosystem Configuration

The application uses the `backend/ecosystem.config.js` file for PM2 configuration:

- **Cluster Mode:** Runs multiple instances (one per CPU core)
- **Auto-restart:** Automatically restarts on crashes (max 10 restarts)
- **Memory Limit:** 500MB per instance
- **Log Files:** Stored in `backend/logs/`

### Ports

- **Backend API:** Port 3000 (configurable in `.env`)
- **Frontend:** Serves static files (typically via Nginx or reverse proxy)

## Troubleshooting

### Application Won't Start

1. Check PM2 logs:
   ```bash
   pm2 logs triplens-backend --err
   ```

2. Verify environment variables:
   ```bash
   cd backend
   cat .env
   ```

3. Check MongoDB connectivity:
   ```bash
   # Test MongoDB connection
   mongosh "mongodb://admin:bartar20@CS@10.10.246.12:21771/triplens-db?authSource=admin"
   ```

### Port Already in Use

If port 3000 is already in use:

1. Check what's using the port:
   ```bash
   lsof -i :3000
   ```

2. Either:
   - Stop the conflicting application
   - Change the PORT in `backend/.env`

### Out of Memory Errors

If the application crashes due to memory issues:

1. Increase memory limit in `backend/ecosystem.config.js`:
   ```javascript
   max_memory_restart: '1G',  // Increase from 500M to 1G
   ```

2. Restart the application:
   ```bash
   ./deploy.sh
   ```

### Build Failures

If the build fails:

1. Clear node_modules and rebuild:
   ```bash
   cd backend
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   ```

2. Check for TypeScript errors:
   ```bash
   npm run build
   ```

### Git Pull Conflicts

If git pull fails due to conflicts:

1. Stash local changes:
   ```bash
   git stash
   git pull origin main
   git stash pop
   ```

2. Or reset to remote:
   ```bash
   git fetch origin
   git reset --hard origin/main
   ```

## File Upload Directories

Ensure the following directories exist and have proper permissions:

```bash
mkdir -p backend/uploads/posts
mkdir -p backend/uploads/profiles
chmod -R 755 backend/uploads
```

## Security Considerations

1. **Environment Variables:** Never commit `.env` files to version control
2. **File Permissions:** Restrict access to sensitive files:
   ```bash
   chmod 600 backend/.env
   ```
3. **Firewall:** Ensure only necessary ports are open
4. **Updates:** Regularly update dependencies:
   ```bash
   npm audit fix
   ```

## Backup Recommendations

### Database Backups

Create regular MongoDB backups:

```bash
mongodump --uri="mongodb://admin:bartar20@CS@10.10.246.12:21771/triplens-db?authSource=admin" --out=/path/to/backup
```

### Application Backups

Consider backing up:
- `.env` files
- Uploaded files (`backend/uploads/`)
- PM2 configuration

## Additional Resources

- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

## Support

For issues or questions, refer to:
- Application logs: `pm2 logs triplens-backend`
- MongoDB logs: Check MongoDB server logs
- System logs: `journalctl -xe`

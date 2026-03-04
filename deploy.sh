#!/bin/bash

# TripLens Deployment Script
# Run this on your Linux server to deploy the latest changes

set -e  # Exit on any error

echo "=========================================="
echo "  TripLens Deployment Script"
echo "=========================================="
echo ""

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "📁 Working directory: $SCRIPT_DIR"
echo ""

# Step 1: Pull latest changes
echo "🔄 Step 1: Pulling latest changes from Git..."
git pull origin main
if [ $? -ne 0 ]; then
    echo "❌ Git pull failed!"
    exit 1
fi
echo "✅ Git pull successful"
echo ""

# Step 2: Backend deployment
echo "🚀 Step 2: Deploying Backend..."
cd backend

echo "  📦 Installing backend dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Backend npm install failed!"
    exit 1
fi

echo "  🔨 Building backend..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Backend build failed!"
    exit 1
fi

echo "  🔄 Restarting backend with PM2..."
pm2 restart triplens-backend 2>/dev/null || pm2 start ecosystem.config.js
if [ $? -ne 0 ]; then
    echo "❌ PM2 restart failed!"
    exit 1
fi

echo "✅ Backend deployed successfully"
echo ""

# Step 3: Frontend deployment
echo "🎨 Step 3: Deploying Frontend..."
cd ../frontend

echo "  📦 Installing frontend dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Frontend npm install failed!"
    exit 1
fi

echo "  🔨 Building frontend..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Frontend build failed!"
    exit 1
fi

echo "✅ Frontend built successfully"
echo ""

# Step 4: Show PM2 status
echo "📊 PM2 Status:"
pm2 list

echo ""
echo "=========================================="
echo "  ✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "🔗 Backend should be running on your configured port"
echo "📝 Check logs with: pm2 logs triplens-backend"
echo "🔄 Restart with: pm2 restart triplens-backend"
echo "🛑 Stop with: pm2 stop triplens-backend"
echo ""

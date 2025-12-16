#!/bin/bash

# Deployment Script for Telegram Finance Bot using Railway
# This script handles login, project creation, and deployment.

echo "🚀 Starting automated deployment..."

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed."
    exit 1
fi

echo "📦 Installing/Using Railway CLI..."

# 1. Login
echo "🔑 Step 1: Authentication"
echo "A browser window will open. Please confirm the login."
npx -y @railway/cli login

# 2. Initialize Project (if not exists)
echo "🛠️ Step 2: Project Setup"
# Try to link or init
if [ ! -f .railway/config.json ]; then
    echo "Creating new Railway project..."
    npx -y @railway/cli init
fi

# 3. Deploy
echo "🚀 Step 3: Deploying to the cloud..."
echo "Uploading Docker image..."
npx -y @railway/cli up --detach

echo "✅ Deployment initiated!"
echo "⚠️ IMPORTANT: Go to https://railway.app/dashboard to set your Environment Variables (TELEGRAM_BOT_TOKEN, etc)."

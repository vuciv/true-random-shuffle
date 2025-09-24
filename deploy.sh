#!/bin/bash

# True Shuffle - Rebuild and Deploy Script
# This script cleans, rebuilds, and deploys the app to Netlify

set -e  # Exit on any error

echo "🚀 Starting True Shuffle rebuild and deploy process..."
echo ""

# Clean existing build artifacts
echo "🧹 Cleaning build artifacts..."
rm -rf dist
rm -rf .expo
echo "✅ Cleaned dist and .expo directories"
echo ""

# Rebuild for web
echo "🔨 Building for web..."
npm run build:web
echo "✅ Build completed successfully"
echo ""

# Deploy to Netlify
echo "🌐 Deploying to Netlify..."
npx netlify deploy --prod --dir=dist
echo ""

echo "🎉 Deployment complete!"
echo "Your app should be live at your configured Netlify URL"

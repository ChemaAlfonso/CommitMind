#!/bin/bash

# Build script for production deployment
# Creates a dist directory with only production-ready files

set -e

echo "🏗️  Building Lean Dev Metrics for production..."

# Clean previous build
echo "📦 Cleaning previous build..."
rm -rf dist
rm -rf collector/dist
rm -rf bot/dist

# Create dist directory structure
echo "📁 Creating directory structure..."
mkdir -p dist

# Build collector TypeScript
echo "🔨 Building collector..."
cd collector
npm run build
cd ..

# Build bot TypeScript
echo "🔨 Building bot..."
cd bot
npm run build
cd ..

# Create production collector directory
echo "📋 Creating collector production files..."
mkdir -p dist/collector
cp -r collector/dist/* dist/collector/
cp collector/package*.json dist/collector/
cp collector/Dockerfile dist/collector/
cp collector/.dockerignore dist/collector/ 2>/dev/null || true
# Remove any TypeScript declaration files
find dist/collector -name "*.d.ts" -delete
find dist/collector -name "*.d.ts.map" -delete
find dist/collector -name "*.js.map" -delete

# Create production bot directory
echo "📋 Creating bot production files..."
mkdir -p dist/bot
cp -r bot/dist/* dist/bot/
cp bot/package*.json dist/bot/
cp bot/Dockerfile dist/bot/

# Copy Grafana (no build needed)
echo "📋 Copying Grafana configuration..."
mkdir -p dist/grafana
cp -r grafana/* dist/grafana/

# Copy only necessary root files
echo "🐳 Copying Docker configuration..."
cp docker-compose.yaml dist/
cp .env dist/

# Create minimal data directory
mkdir -p dist/data

# Clean up individual project dist directories to prevent confusion
echo "🧹 Cleaning up individual project dist directories..."
rm -rf collector/dist
rm -rf bot/dist

echo "✅ Build complete!"
echo ""
echo "📦 Production files are in the 'dist' directory"
echo ""
echo "🚀 To deploy:"
echo "1. Upload the entire 'dist' directory to your server"
echo "2. Run: cd dist && docker compose up -d"
echo ""
echo "✨ That's it! No additional configuration needed."
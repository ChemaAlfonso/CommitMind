#!/bin/bash

# Development start script for CommitMind
# Usage: ./start.sh

# Create .env.local with development defaults if it doesn't exist
if [ ! -f ".env.local" ]; then
    echo "Creating .env.local with development defaults..."
    cat > .env.local << EOF
API_TOKEN=dev-token-123
GITHUB_WEBHOOK_SECRET=dev-secret
GITLAB_WEBHOOK_TOKEN=dev-token
GF_SECURITY_ADMIN_PASSWORD=admin
EOF
fi

# Load environment
set -a
source .env.local
set +a

echo "🚀 Starting CommitMind development environment..."

# Set development environment
export NODE_ENV=development
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
export SQLITE_PATH=$PROJECT_ROOT/data/metrics.db

# Ensure database exists
mkdir -p data

# Install dependencies if needed
if [ ! -d "collector/node_modules" ]; then
    echo "Installing collector dependencies..."
    cd collector && npm install && cd ..
fi

if [ ! -d "bot/node_modules" ]; then
    echo "Installing bot dependencies..."
    cd bot && npm install && cd ..
fi

# Stop any existing containers
docker stop grafana-dev 2>/dev/null
docker rm grafana-dev 2>/dev/null

# Start collector
echo "Starting collector on http://localhost:3000"
cd collector
npm run dev &
COLLECTOR_PID=$!
cd ..

# Start Grafana
echo "Starting Grafana on http://localhost:3001"
docker run -d --name grafana-dev \
    -p 3001:3000 \
    -v $PROJECT_ROOT/grafana/provisioning:/etc/grafana/provisioning \
    -v $PROJECT_ROOT/data:/data:ro \
    -e GF_INSTALL_PLUGINS=frser-sqlite-datasource \
    -e GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_PATH=/etc/grafana/provisioning/dashboards/commitmind-metrics.json \
    grafana/grafana:10.0.0 > /dev/null

# Cleanup on exit
trap "kill $COLLECTOR_PID; docker stop grafana-dev; docker rm grafana-dev" EXIT

echo "
✅ Development services started!
   
   Collector API: http://localhost:3000
   Grafana:       http://localhost:3001 (admin/admin)
   
   Test commit webhook:
   curl -X POST http://localhost:3000/api/webhook/github \\
     -H 'Authorization: Bearer $API_TOKEN' \\
     -H 'Content-Type: application/json' \\
     -d '{\"ref\":\"refs/heads/main\",\"commits\":[{\"id\":\"abc123\",\"message\":\"Test commit\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"author\":{\"email\":\"test@example.com\"}}]}'
"

# Keep running
wait
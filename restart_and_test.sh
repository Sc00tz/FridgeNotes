#!/bin/bash
echo "🔄 Restarting Docker container with label fixes..."
echo "================================================"

cd "/Users/travis/Documents/Development/Google Keep Clone/Google_Keep_Clone"

# Stop container
echo "🛑 Stopping container..."
docker-compose down

# Start container
echo "🚀 Starting container..."
docker-compose up -d

# Wait a moment for startup
sleep 5

# Show recent logs
echo "📋 Recent startup logs:"
docker-compose logs --tail=30

echo ""
echo "✅ Container restarted! Check https://notes.scootz.net"
echo "🧪 Try the Test Labels button again"

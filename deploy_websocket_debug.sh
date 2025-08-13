#!/bin/bash

echo "🚀 Deploying WebSocket Debug Fix"
echo "================================="

cd "/Users/travis/Documents/Development/Google Keep Clone/Google_Keep_Clone"

# Stop and rebuild
echo "🛑 Stopping container..."
docker-compose down

echo "🔨 Building and starting..."
docker-compose up -d --build

# Wait a moment for startup
sleep 3

echo "📋 Checking if container is running..."
docker-compose ps

echo ""
echo "📊 Recent logs:"
docker-compose logs --tail=20 fridge-notes

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🧪 Test Steps:"
echo "1. Open 2 browser tabs with your app"
echo "2. Open console in both tabs (F12)"
echo "3. Drag a note in tab 1"
echo "4. Watch for these logs:"
echo "   - Frontend: '📤 Emitting notes reordered with payload:'"
echo "   - Backend: '📋 Received notes_reordered event with data:'"
echo "   - Tab 2: '🔄 Received notes reordered:'"
echo ""
echo "🔍 Monitor server logs:"
echo "   docker-compose logs -f fridge-notes | grep reorder"

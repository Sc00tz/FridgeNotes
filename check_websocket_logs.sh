#!/bin/bash

echo "🔍 Checking WebSocket Events in Server Logs"
echo "============================================"

cd "/Users/travis/Documents/Development/Google Keep Clone/Google_Keep_Clone"

echo "📋 Recent server logs (last 50 lines):"
docker-compose logs --tail=50 fridge-notes

echo ""
echo "🔍 Looking for reorder events specifically:"
docker-compose logs fridge-notes | grep -i reorder

echo ""
echo "🔍 Looking for WebSocket events:"
docker-compose logs fridge-notes | grep -E "(User.*reordered|Client.*connected|Client.*disconnected)"

echo ""
echo "✅ Log check complete!"
echo ""
echo "💡 To monitor real-time:"
echo "   docker-compose logs -f fridge-notes"

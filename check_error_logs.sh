#!/bin/bash
echo "🔍 Checking recent Docker logs for errors..."
echo "================================================"

# Show recent logs with errors highlighted
docker-compose logs --tail=50 | grep -i "error\|exception\|traceback\|500" -A 3 -B 1

echo ""
echo "🔍 Checking for Python traceback in logs..."
echo "================================================"

# Get more detailed Python errors
docker-compose logs --tail=100 | grep -A 20 "Traceback"

echo ""
echo "🔍 Recent backend activity..."
echo "================================================"

# Show recent backend activity
docker-compose logs --tail=30 fridgenotes

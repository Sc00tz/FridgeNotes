#!/bin/bash
# Quick fix script for the FridgeNotes database issue

echo "🔧 FridgeNotes Database Repair Script"
echo "====================================="

# Change to the correct directory
cd "/Users/travis/Documents/Development/Google Keep Clone/Google_Keep_Clone"

# Stop the Docker container
echo "🛑 Stopping Docker container..."
docker-compose down

# Run the comprehensive database repair script
echo "🔧 Running database repair..."
python3 comprehensive_db_fix.py

# Check if the repair was successful
if [ $? -eq 0 ]; then
    echo "✅ Database repair completed successfully!"
    
    # Restart the Docker container
    echo "🚀 Restarting Docker container..."
    docker-compose up -d
    
    echo "✅ Repair complete! Check the logs with: docker-compose logs -f"
    echo "🌐 Your app should be available at: https://notes.scootz.net"
else
    echo "❌ Database repair failed! Check the error messages above."
    exit 1
fi

#!/bin/bash
echo "🔧 Running Database Migration for Drag & Drop Feature"
echo "======================================================"

cd "/Users/travis/Documents/Development/Google Keep Clone/Google_Keep_Clone"

# Stop the Docker container first
echo "🛑 Stopping Docker container..."
docker-compose down

# Run the position field migration
echo "🔧 Running position field migration..."
python3 add_position_migration.py

# Check if migration was successful
if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully!"
    
    # Restart the Docker container
    echo "🚀 Restarting Docker container..."
    docker-compose up -d
    
    echo "✅ Setup complete!"
    echo "🌐 Your app should be available at: https://notes.scootz.net"
    echo "🧪 Test drag & drop by creating multiple notes and dragging them around"
else
    echo "❌ Migration failed! Check the error messages above."
    exit 1
fi

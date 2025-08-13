#!/bin/bash
# Script to clean up debug files from the FridgeNotes project
# Run this script to remove temporary debugging files

echo "🧹 Cleaning up debug files from FridgeNotes..."

# Debug files to remove
DEBUG_FILES=(
    "debug_db_state.py"
    "debug_definitive.py" 
    "debug_frontend_data.js"
    "debug_label_deletion.py"
    "debug_label_frontend.js"
    "debug_labels.py"
    "test_api_direct.sh"
    "test_fix_verification.js"
    "test_label_removal.js"
    "browser_label_test.js"
    "TEST_LABELS.js"
)

# Remove debug files
for file in "${DEBUG_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "🗑️  Removing $file"
        rm "$file"
    else
        echo "⚠️  File $file not found (already removed?)"
    fi
done

echo "✅ Debug cleanup complete!"
echo ""
echo "📋 Remaining files are production-ready:"
echo "   - Core application code (src/, fridgenotes-frontend/)"  
echo "   - Docker configuration (docker-compose.yml, Dockerfile)"
echo "   - Documentation (README.md, FEATURES.md, etc.)"
echo "   - Migration scripts (for database management)"
echo ""
echo "🎉 Your FridgeNotes application is now clean and production-ready!"

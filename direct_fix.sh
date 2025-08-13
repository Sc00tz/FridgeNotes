#!/bin/bash

echo "🔧 Direct Database Fix for Drag & Drop"
echo "======================================"

cd "/Users/travis/Documents/Development/Jules/Google_Keep_Clone"

# Stop Docker first
echo "🛑 Stopping Docker..."
docker-compose down

# Run direct SQLite commands
echo "🔧 Adding position column directly..."
sqlite3 data/app.db "ALTER TABLE notes ADD COLUMN position INTEGER NOT NULL DEFAULT 0;"
sqlite3 data/app.db "UPDATE notes SET position = (SELECT COUNT(*) FROM notes n2 WHERE n2.user_id = notes.user_id AND n2.created_at >= notes.created_at);"
sqlite3 data/app.db "CREATE INDEX IF NOT EXISTS idx_notes_user_position ON notes(user_id, position);"

# Verify
echo "🔍 Verifying..."
sqlite3 data/app.db "PRAGMA table_info(notes);" | grep position

if [ $? -eq 0 ]; then
    echo "✅ Position column added successfully!"
    echo "🚀 Restarting Docker..."
    docker-compose up -d
    echo "✅ Done! Test drag & drop at https://notes.scootz.net"
else
    echo "❌ Something went wrong"
fi

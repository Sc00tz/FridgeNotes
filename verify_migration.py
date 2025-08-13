#!/usr/bin/env python3

import sqlite3
import os

# Change to project directory
os.chdir('/Users/travis/Documents/Development/Google Keep Clone/Google_Keep_Clone')

db_path = 'data/app.db'

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check if position column exists
    cursor.execute("PRAGMA table_info(notes)")
    columns = cursor.fetchall()
    column_names = [col[1] for col in columns]
    
    print(f"Position column exists: {'position' in column_names}")
    
    if 'position' in column_names:
        # Show sample data
        cursor.execute("SELECT id, title, position FROM notes ORDER BY position LIMIT 5")
        notes = cursor.fetchall()
        
        print("\nSample notes with positions:")
        for note in notes:
            title = note[1][:30] if note[1] else "(no title)"
            print(f"  Note {note[0]}: position={note[2]}, title='{title}'")
        
        print("\n✅ Migration successful! Restart Docker now:")
        print("docker-compose down && docker-compose up -d")
    else:
        print("❌ Position column still missing")
    
    conn.close()

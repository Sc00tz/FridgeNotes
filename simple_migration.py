#!/usr/bin/env python3

import sqlite3
import os

# Change to project directory
os.chdir('/Users/travis/Documents/Development/Google Keep Clone/Google_Keep_Clone')

db_path = 'data/app.db'
print(f"Checking database at: {db_path}")
print(f"Database exists: {os.path.exists(db_path)}")

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check current structure
    cursor.execute("PRAGMA table_info(notes)")
    columns = cursor.fetchall()
    
    column_names = [col[1] for col in columns]
    print(f"Current columns: {column_names}")
    
    if 'position' not in column_names:
        print("Adding position column...")
        try:
            cursor.execute("ALTER TABLE notes ADD COLUMN position INTEGER NOT NULL DEFAULT 0")
            cursor.execute("""
                UPDATE notes 
                SET position = (
                    SELECT COUNT(*) 
                    FROM notes n2 
                    WHERE n2.user_id = notes.user_id 
                    AND n2.created_at >= notes.created_at
                )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_notes_user_position ON notes(user_id, position)")
            conn.commit()
            print("✅ Position column added successfully!")
        except Exception as e:
            print(f"❌ Error: {e}")
    else:
        print("✅ Position column already exists")
    
    conn.close()

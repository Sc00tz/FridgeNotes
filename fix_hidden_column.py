#!/usr/bin/env python3
"""
Manual script to fix the missing hidden_by_recipient column in shared_notes table
"""

import sqlite3
import os

def get_db_path():
    """Find the database file"""
    possible_paths = [
        'src/database/app.db',
        'database/app.db', 
        'data/app.db',
        '../data/app.db',
        '/app/data/app.db',
        '/app/src/database/app.db'
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            print(f"Found database at: {path}")
            return path
    
    print("Database not found! Tried these paths:")
    for path in possible_paths:
        print(f"  - {path}")
    
    return None

def check_column_exists(cursor, table_name, column_name):
    """Check if a column exists in a table"""
    try:
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = [column[1] for column in cursor.fetchall()]
        return column_name in columns
    except sqlite3.Error:
        return False

def fix_database():
    """Fix the missing hidden_by_recipient column"""
    db_path = get_db_path()
    if not db_path:
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("📋 Checking current database structure...")
        
        # Check if shared_notes table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='shared_notes'")
        if not cursor.fetchone():
            print("❌ shared_notes table does not exist!")
            return False
        
        print("✅ shared_notes table exists")
        
        # Show current structure
        cursor.execute("PRAGMA table_info(shared_notes)")
        current_columns = cursor.fetchall()
        print("Current columns in shared_notes:")
        for col in current_columns:
            print(f"  - {col[1]} ({col[2]})")
        
        # Check if the column already exists
        if check_column_exists(cursor, 'shared_notes', 'hidden_by_recipient'):
            print("✅ hidden_by_recipient column already exists!")
            return True
        
        print("❌ hidden_by_recipient column is missing")
        print("🔧 Adding hidden_by_recipient column...")
        
        # Add the missing column
        cursor.execute('''
            ALTER TABLE shared_notes 
            ADD COLUMN hidden_by_recipient BOOLEAN NOT NULL DEFAULT FALSE
        ''')
        
        conn.commit()
        print("✅ Successfully added hidden_by_recipient column!")
        
        # Verify the column was added
        cursor.execute("PRAGMA table_info(shared_notes)")
        new_columns = cursor.fetchall()
        print("New columns in shared_notes:")
        for col in new_columns:
            print(f"  - {col[1]} ({col[2]})")
        
        # Create/update migration history
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS migration_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                migration_name TEXT UNIQUE NOT NULL,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor.execute('''
            INSERT OR IGNORE INTO migration_history (migration_name) 
            VALUES ('001_add_hidden_by_recipient')
        ''')
        
        conn.commit()
        print("✅ Updated migration history")
        
        return True
        
    except sqlite3.Error as e:
        print(f"❌ Database error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    print("🔧 FridgeNotes Database Repair Tool")
    print("=" * 50)
    
    if fix_database():
        print("🎉 Database repair completed successfully!")
        print("You can now restart your Docker container.")
    else:
        print("💥 Database repair failed!")
        print("Please check the errors above and try again.")

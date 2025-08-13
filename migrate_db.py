#!/usr/bin/env python3
"""
Database migration to add hidden_by_recipient field to shared_notes table
Run this script to update your existing database
"""

import sqlite3
import os
import sys

def run_migration():
    # Get the database path
    db_path = 'data/app.db'  # Adjust if your database is in a different location
    
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        print("Please update the db_path variable in this script to match your database location")
        return False
    
    try:
        # Connect to database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if the column already exists
        cursor.execute("PRAGMA table_info(shared_notes)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'hidden_by_recipient' in columns:
            print("✅ Migration already applied - hidden_by_recipient column exists")
            return True
        
        # Add the new column
        print("📝 Adding hidden_by_recipient column to shared_notes table...")
        cursor.execute('''
            ALTER TABLE shared_notes 
            ADD COLUMN hidden_by_recipient BOOLEAN NOT NULL DEFAULT FALSE
        ''')
        
        # Commit the changes
        conn.commit()
        print("✅ Migration completed successfully!")
        
        # Verify the column was added
        cursor.execute("PRAGMA table_info(shared_notes)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'hidden_by_recipient' in columns:
            print("✅ Verification passed - column added successfully")
            return True
        else:
            print("❌ Verification failed - column not found after migration")
            return False
            
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
    print("🚀 Starting database migration...")
    success = run_migration()
    
    if success:
        print("\n🎉 Migration completed successfully!")
        print("You can now use the hide/unhide shared notes feature.")
        sys.exit(0)
    else:
        print("\n💥 Migration failed!")
        print("Please check the error messages above and try again.")
        sys.exit(1)

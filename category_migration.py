#!/usr/bin/env python3
"""
Database migration to add category field to checklist_items table.

This migration adds a category column to support store section organization
for shopping lists (Produce, Dairy, Meat, etc.).
"""

import sqlite3
import sys
import os

def migrate_database(db_path='fridgenotes.db'):
    """Add category column to checklist_items table."""
    
    print(f"Starting migration to add category column to {db_path}")
    
    try:
        # Connect to database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if category column already exists
        cursor.execute("PRAGMA table_info(checklist_items)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'category' in columns:
            print("Category column already exists. Migration not needed.")
            return True
        
        # Add category column
        print("Adding category column to checklist_items table...")
        cursor.execute("""
            ALTER TABLE checklist_items 
            ADD COLUMN category VARCHAR(50) NULL
        """)
        
        # Commit changes
        conn.commit()
        print("Migration completed successfully!")
        
        # Verify the column was added
        cursor.execute("PRAGMA table_info(checklist_items)")
        columns = [row[1] for row in cursor.fetchall()]
        print(f"Updated columns: {columns}")
        
        return True
        
    except sqlite3.Error as e:
        print(f"Database error during migration: {e}")
        return False
    except Exception as e:
        print(f"Unexpected error during migration: {e}")
        return False
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    # Check if custom database path provided
    db_path = sys.argv[1] if len(sys.argv) > 1 else 'fridgenotes.db'
    
    # Check if database file exists
    if not os.path.exists(db_path):
        print(f"Database file {db_path} not found. Please check the path.")
        sys.exit(1)
    
    # Run migration
    success = migrate_database(db_path)
    sys.exit(0 if success else 1)
#!/usr/bin/env python3
"""
Enhanced Database Migration: Add position field to notes table for drag & drop reordering
"""

import sqlite3
import os
import sys
from datetime import datetime

def check_database_structure():
    """Check current database structure"""
    db_path = 'data/app.db'
    
    if not os.path.exists(db_path):
        print(f"❌ Database file not found at: {db_path}")
        return False
    
    print(f"📍 Found database at: {db_path}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check notes table structure
        print("\n📋 Current notes table structure:")
        cursor.execute("PRAGMA table_info(notes)")
        columns = cursor.fetchall()
        
        for col in columns:
            print(f"   - {col[1]} ({col[2]}) {'NOT NULL' if col[3] else 'NULL'} {'DEFAULT ' + str(col[4]) if col[4] else ''}")
        
        # Check if position column exists
        column_names = [col[1] for col in columns]
        position_exists = 'position' in column_names
        
        print(f"\n📊 Position column exists: {'✅ YES' if position_exists else '❌ NO'}")
        
        # Count existing notes
        cursor.execute("SELECT COUNT(*) FROM notes")
        note_count = cursor.fetchone()[0]
        print(f"📝 Total notes in database: {note_count}")
        
        return True, position_exists, note_count
        
    except sqlite3.Error as e:
        print(f"❌ Database error: {e}")
        return False, False, 0
    
    finally:
        if conn:
            conn.close()

def add_position_field():
    """Add position field to notes table and set default positions"""
    
    db_path = 'data/app.db'
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("\n🔧 Adding position column to notes table...")
        
        # Add the position column with default value 0
        cursor.execute("""
            ALTER TABLE notes 
            ADD COLUMN position INTEGER NOT NULL DEFAULT 0
        """)
        
        print("✅ Position column added successfully!")
        
        # Set initial positions based on created_at (newest first, like current behavior)
        print("🔧 Setting initial position values...")
        cursor.execute("""
            UPDATE notes 
            SET position = (
                SELECT COUNT(*) 
                FROM notes n2 
                WHERE n2.user_id = notes.user_id 
                AND n2.created_at >= notes.created_at
            )
        """)
        
        # Get how many notes were updated
        updated_count = cursor.rowcount
        print(f"✅ Updated {updated_count} notes with position values")
        
        # Create index for better performance
        print("🔧 Creating index on position column...")
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_notes_user_position 
            ON notes(user_id, position)
        """)
        
        conn.commit()
        print("✅ Position field migration completed successfully!")
        
        return True
        
    except sqlite3.Error as e:
        print(f"❌ Database error during migration: {e}")
        return False
    
    finally:
        if conn:
            conn.close()

def verify_migration():
    """Verify the migration was successful"""
    
    db_path = 'data/app.db'
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("\n🔍 Verifying migration...")
        
        # Check if position column exists and has data
        cursor.execute("PRAGMA table_info(notes)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'position' not in columns:
            print("❌ Position column not found after migration!")
            return False
        
        # Check that notes have position values
        cursor.execute("SELECT COUNT(*) FROM notes WHERE position IS NOT NULL")
        count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM notes")
        total = cursor.fetchone()[0]
        
        print(f"✅ Position column exists! {count}/{total} notes have position values")
        
        # Show sample data
        if total > 0:
            print("\n📝 Sample notes with positions:")
            cursor.execute("SELECT id, title, position, created_at FROM notes ORDER BY position LIMIT 5")
            samples = cursor.fetchall()
            for sample in samples:
                title = sample[1][:30] + "..." if sample[1] and len(sample[1]) > 30 else sample[1] or "(no title)"
                print(f"   Note {sample[0]}: pos={sample[2]}, title='{title}'")
        
        return True
        
    except sqlite3.Error as e:
        print(f"❌ Verification error: {e}")
        return False
    
    finally:
        if conn:
            conn.close()

def main():
    print("🚀 Enhanced Position Field Migration")
    print("=" * 50)
    
    # Change to the correct directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    print(f"📂 Working directory: {os.getcwd()}")
    
    # Check current database structure
    result = check_database_structure()
    if not result:
        print("\n❌ Cannot proceed without database access")
        sys.exit(1)
    
    db_accessible, position_exists, note_count = result
    
    if position_exists:
        print("\n✅ Position column already exists! No migration needed.")
        verify_migration()
        return
    
    # Confirm before making changes
    print(f"\n⚠️  About to add 'position' column to notes table ({note_count} notes)")
    response = input("Continue? (y/N): ").strip().lower()
    
    if response != 'y':
        print("❌ Migration cancelled by user")
        sys.exit(1)
    
    # Run migration
    success = add_position_field()
    
    if success:
        verify_migration()
        print("\n🎉 Migration completed successfully!")
        print("\n📝 Next steps:")
        print("   1. Restart your Docker container: docker-compose down && docker-compose up -d")
        print("   2. Test drag & drop at: https://notes.scootz.net")
    else:
        print("\n❌ Migration failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()

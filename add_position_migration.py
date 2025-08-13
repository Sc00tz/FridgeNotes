#!/usr/bin/env python3
"""
Database Migration: Add position field to notes table for drag & drop reordering
"""

import sqlite3
import os
from datetime import datetime

def add_position_field():
    """Add position field to notes table and set default positions"""
    
    # Find the database file
    possible_paths = [
        'data/app.db',
        'src/database/app.db',
        '/app/data/app.db'
    ]
    
    db_path = None
    for path in possible_paths:
        if os.path.exists(path):
            db_path = path
            break
    
    if not db_path:
        print("❌ Database file not found!")
        return False
    
    print(f"📍 Found database at: {db_path}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if position column already exists
        cursor.execute("PRAGMA table_info(notes)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'position' in columns:
            print("✅ Position column already exists!")
            return True
        
        print("🔧 Adding position column to notes table...")
        
        # Add the position column with default value 0
        cursor.execute("""
            ALTER TABLE notes 
            ADD COLUMN position INTEGER NOT NULL DEFAULT 0
        """)
        
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
        
        # Create index for better performance
        print("🔧 Creating index on position column...")
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_notes_user_position 
            ON notes(user_id, position)
        """)
        
        conn.commit()
        print("✅ Position field added successfully!")
        
        # Record this migration
        try:
            cursor.execute("""
                INSERT OR IGNORE INTO migration_history (migration_name, applied_at)
                VALUES (?, ?)
            """, ('003_add_position_field', datetime.utcnow().isoformat()))
            conn.commit()
            print("✅ Migration recorded in history")
        except sqlite3.OperationalError:
            # Migration history table might not exist yet
            print("⚠️  Could not record migration (migration_history table missing)")
        
        return True
        
    except sqlite3.Error as e:
        print(f"❌ Database error: {e}")
        return False
    
    finally:
        if conn:
            conn.close()

def verify_migration():
    """Verify the migration was successful"""
    
    possible_paths = [
        'data/app.db',
        'src/database/app.db',
        '/app/data/app.db'
    ]
    
    db_path = None
    for path in possible_paths:
        if os.path.exists(path):
            db_path = path
            break
    
    if not db_path:
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if position column exists and has data
        cursor.execute("PRAGMA table_info(notes)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'position' not in columns:
            print("❌ Position column not found!")
            return False
        
        # Check that notes have position values
        cursor.execute("SELECT COUNT(*) FROM notes WHERE position IS NOT NULL")
        count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM notes")
        total = cursor.fetchone()[0]
        
        print(f"✅ Position column exists! {count}/{total} notes have position values")
        
        return True
        
    except sqlite3.Error as e:
        print(f"❌ Verification error: {e}")
        return False
    
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    print("🚀 Starting Position Field Migration...")
    print("=" * 50)
    
    success = add_position_field()
    
    if success:
        print("\n🔍 Verifying migration...")
        verify_migration()
        print("\n🎉 Migration completed successfully!")
        print("\n📝 Next steps:")
        print("   1. Update your Note model to include the position field")
        print("   2. Update API endpoints to handle position updates")
        print("   3. Implement drag & drop in the frontend")
    else:
        print("\n❌ Migration failed!")

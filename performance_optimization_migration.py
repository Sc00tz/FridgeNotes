#!/usr/bin/env python3
"""
Performance Optimization Migration for FridgeNotes

This script creates database indexes to improve query performance.
Run this after deploying the performance optimizations.

Usage: python performance_optimization_migration.py
"""

import os
import sys
import sqlite3

# Add the src directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

def create_performance_indexes():
    """Create database indexes to improve query performance."""
    
    # Database path
    db_path = os.path.join(os.path.dirname(__file__), 'src', 'database', 'app.db')
    
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        print("Please run the application first to create the database.")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🔧 Creating performance indexes...")
        
        # Index for notes queries by user_id (most common query)
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_notes_user_id_pinned_position 
            ON notes(user_id, pinned DESC, position ASC)
        ''')
        print("✅ Created index on notes(user_id, pinned, position)")
        
        # Index for shared notes queries
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_shared_notes_user_id_hidden 
            ON shared_notes(user_id, hidden_by_recipient)
        ''')
        print("✅ Created index on shared_notes(user_id, hidden_by_recipient)")
        
        # Index for shared notes by note_id (for joins)
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_shared_notes_note_id 
            ON shared_notes(note_id)
        ''')
        print("✅ Created index on shared_notes(note_id)")
        
        # Index for checklist items by note_id
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_checklist_items_note_id_order 
            ON checklist_items(note_id, `order`)
        ''')
        print("✅ Created index on checklist_items(note_id, order)")
        
        # Index for note-label associations
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_note_labels_note_id 
            ON note_labels(note_id)
        ''')
        print("✅ Created index on note_labels(note_id)")
        
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_note_labels_label_id 
            ON note_labels(label_id)
        ''')
        print("✅ Created index on note_labels(label_id)")
        
        # Index for labels by user_id
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_labels_user_id 
            ON labels(user_id)
        ''')
        print("✅ Created index on labels(user_id)")
        
        # Index for reminder queries
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_notes_reminder_datetime 
            ON notes(reminder_datetime) 
            WHERE reminder_datetime IS NOT NULL
        ''')
        print("✅ Created index on notes(reminder_datetime)")
        
        conn.commit()
        conn.close()
        
        print("\n🎉 Performance optimization migration completed successfully!")
        print("📈 Database queries should now be significantly faster.")
        
        return True
        
    except Exception as e:
        print(f"❌ Error creating indexes: {e}")
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return False

def check_existing_indexes():
    """Check what indexes already exist."""
    
    db_path = os.path.join(os.path.dirname(__file__), 'src', 'database', 'app.db')
    
    if not os.path.exists(db_path):
        print("Database not found. Run the application first.")
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("📋 Existing indexes:")
        cursor.execute('''
            SELECT name, sql FROM sqlite_master 
            WHERE type = 'index' AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        ''')
        
        indexes = cursor.fetchall()
        if indexes:
            for name, sql in indexes:
                print(f"  - {name}")
        else:
            print("  No custom indexes found.")
        
        conn.close()
        
    except Exception as e:
        print(f"Error checking indexes: {e}")

if __name__ == "__main__":
    print("🚀 FridgeNotes Performance Optimization Migration")
    print("=" * 50)
    
    if len(sys.argv) > 1 and sys.argv[1] == "--check":
        check_existing_indexes()
    else:
        success = create_performance_indexes()
        
        if success:
            print("\n💡 Tip: Restart your FridgeNotes application to ensure")
            print("   optimal performance with the new indexes.")
        else:
            sys.exit(1)
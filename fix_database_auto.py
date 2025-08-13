#!/usr/bin/env python3
"""
Database cleanup and migration script for FridgeNotes (Non-interactive)
This script automatically fixes database schema issues
"""

import sqlite3
import os
import sys

def get_database_path():
    """Find the database file"""
    possible_paths = [
        'data/app.db',
        'src/database/app.db',
        '../data/app.db',
        '/app/data/app.db',
        '/app/src/database/app.db'
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            print(f"✅ Found database at: {path}")
            return path
    
    print("❌ Database not found!")
    print(f"Searched in: {possible_paths}")
    return None

def backup_database(db_path):
    """Create a backup of the database"""
    backup_path = f"{db_path}.backup"
    try:
        import shutil
        shutil.copy2(db_path, backup_path)
        print(f"✅ Database backed up to: {backup_path}")
        return True
    except Exception as e:
        print(f"❌ Failed to backup database: {e}")
        return False

def check_table_structure(cursor):
    """Check the current table structure"""
    print("\n🔍 Checking current table structure...")
    
    # Get all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]
    
    print(f"Tables found: {tables}")
    
    # Check for duplicates
    duplicates = []
    for table in tables:
        if table.endswith('s') and table[:-1] in tables:
            duplicates.append({'old': table[:-1], 'new': table})
    
    if duplicates:
        print(f"⚠️  Duplicate tables found: {duplicates}")
    
    # Check shared_notes structure
    if 'shared_notes' in tables:
        cursor.execute("PRAGMA table_info(shared_notes)")
        columns = [row[1] for row in cursor.fetchall()]
        print(f"shared_notes columns: {columns}")
        
        if 'hidden_by_recipient' in columns:
            print("✅ hidden_by_recipient column exists")
        else:
            print("❌ hidden_by_recipient column missing")
    
    return duplicates

def cleanup_duplicate_tables(cursor):
    """Remove duplicate tables"""
    print("\n🧹 Cleaning up duplicate tables...")
    
    # Drop old singular tables if plural versions exist
    old_tables = ['user', 'note', 'checklist_item', 'shared_note']
    
    for table in old_tables:
        try:
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
            if cursor.fetchone():
                print(f"   - Dropping old table: {table}")
                cursor.execute(f"DROP TABLE {table}")
        except sqlite3.Error as e:
            print(f"   - Warning: Could not drop {table}: {e}")
    
    print("✅ Duplicate table cleanup completed")

def ensure_hidden_column(cursor):
    """Ensure the hidden_by_recipient column exists"""
    print("\n📝 Checking hidden_by_recipient column...")
    
    try:
        # Check if column exists
        cursor.execute("PRAGMA table_info(shared_notes)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'hidden_by_recipient' not in columns:
            print("   - Adding hidden_by_recipient column...")
            cursor.execute('''
                ALTER TABLE shared_notes 
                ADD COLUMN hidden_by_recipient BOOLEAN NOT NULL DEFAULT FALSE
            ''')
            print("✅ hidden_by_recipient column added")
        else:
            print("✅ hidden_by_recipient column already exists")
    except sqlite3.Error as e:
        print(f"❌ Failed to add hidden_by_recipient column: {e}")

def create_migration_tracking(cursor):
    """Create migration tracking table"""
    print("\n📊 Setting up migration tracking...")
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS migration_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            migration_name TEXT UNIQUE NOT NULL,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Mark our cleanup migrations as applied
    migrations = [
        '000_cleanup_duplicate_tables',
        '001_add_hidden_by_recipient'
    ]
    
    for migration in migrations:
        cursor.execute('''
            INSERT OR IGNORE INTO migration_history (migration_name) 
            VALUES (?)
        ''', (migration,))
    
    print("✅ Migration tracking setup completed")

def main():
    """Main cleanup function"""
    print("🔧 FridgeNotes Database Cleanup Tool (Auto Mode)")
    print("=" * 50)
    
    # Find database
    db_path = get_database_path()
    if not db_path:
        sys.exit(1)
    
    # Create backup
    if not backup_database(db_path):
        print("⚠️  Backup failed but continuing...")
    
    try:
        # Connect to database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check current structure
        duplicates = check_table_structure(cursor)
        
        # Cleanup duplicate tables automatically
        if duplicates:
            cleanup_duplicate_tables(cursor)
        
        # Ensure hidden column exists
        ensure_hidden_column(cursor)
        
        # Create migration tracking
        create_migration_tracking(cursor)
        
        # Commit changes
        conn.commit()
        
        print("\n🎉 Database cleanup completed successfully!")
        print("You can now restart your Docker container.")
        
    except sqlite3.Error as e:
        print(f"❌ Database error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        sys.exit(1)
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    main()

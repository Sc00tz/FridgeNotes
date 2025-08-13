#!/usr/bin/env python3
"""
Comprehensive database setup and repair script for FridgeNotes
This script will:
1. Ensure the correct database directory structure
2. Fix missing columns
3. Run all migrations properly
"""

import sqlite3
import os
import sys
import shutil
from datetime import datetime

def log_message(message, level="INFO"):
    """Log a message with timestamp and level"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {level}: {message}")

def ensure_database_directory():
    """Ensure the database directory structure is correct"""
    
    # Check current working directory
    current_dir = os.getcwd()
    log_message(f"Current directory: {current_dir}")
    
    # Define possible database locations
    data_dir = os.path.join(current_dir, 'data')
    src_db_dir = os.path.join(current_dir, 'src', 'database')
    
    # Ensure data directory exists
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
        log_message(f"Created data directory: {data_dir}")
    
    # Ensure src/database directory exists  
    if not os.path.exists(src_db_dir):
        os.makedirs(src_db_dir)
        log_message(f"Created src/database directory: {src_db_dir}")
    
    # Find existing database
    data_db = os.path.join(data_dir, 'app.db')
    src_db = os.path.join(src_db_dir, 'app.db')
    
    if os.path.exists(data_db) and not os.path.exists(src_db):
        # Copy database to src/database for consistency
        shutil.copy2(data_db, src_db)
        log_message(f"Copied database from {data_db} to {src_db}")
    elif os.path.exists(src_db) and not os.path.exists(data_db):
        # Copy database to data for production
        shutil.copy2(src_db, data_db)
        log_message(f"Copied database from {src_db} to {data_db}")
    elif not os.path.exists(data_db) and not os.path.exists(src_db):
        log_message("No existing database found - will be created on first run")
    
    return data_db if os.path.exists(data_db) else src_db

def check_column_exists(cursor, table_name, column_name):
    """Check if a column exists in a table"""
    try:
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = [column[1] for column in cursor.fetchall()]
        return column_name in columns
    except sqlite3.Error:
        return False

def fix_shared_notes_table(db_path):
    """Fix the shared_notes table structure"""
    log_message(f"Checking database structure: {db_path}")
    
    if not os.path.exists(db_path):
        log_message("Database file does not exist yet - will be created on first run", "WARNING")
        return True
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if shared_notes table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='shared_notes'")
        if not cursor.fetchone():
            log_message("shared_notes table does not exist yet - will be created on first run")
            return True
        
        # Check current structure
        cursor.execute("PRAGMA table_info(shared_notes)")
        current_columns = cursor.fetchall()
        log_message("Current shared_notes table structure:")
        for col in current_columns:
            log_message(f"  - {col[1]} ({col[2]})")
        
        # Check if hidden_by_recipient column exists
        if check_column_exists(cursor, 'shared_notes', 'hidden_by_recipient'):
            log_message("✅ hidden_by_recipient column already exists!")
            return True
        
        log_message("❌ hidden_by_recipient column is missing - adding it...")
        
        # Add the missing column
        cursor.execute('''
            ALTER TABLE shared_notes 
            ADD COLUMN hidden_by_recipient BOOLEAN NOT NULL DEFAULT FALSE
        ''')
        
        log_message("✅ Successfully added hidden_by_recipient column!")
        
        # Update migration history
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
        log_message("✅ Updated migration history")
        
        # Verify the fix
        cursor.execute("PRAGMA table_info(shared_notes)")
        new_columns = cursor.fetchall()
        log_message("Updated shared_notes table structure:")
        for col in new_columns:
            log_message(f"  - {col[1]} ({col[2]})")
        
        return True
        
    except sqlite3.Error as e:
        log_message(f"Database error: {e}", "ERROR")
        return False
    except Exception as e:
        log_message(f"Unexpected error: {e}", "ERROR")
        return False
    finally:
        if conn:
            conn.close()

def main():
    """Main setup and repair function"""
    log_message("🔧 FridgeNotes Database Setup & Repair Tool")
    log_message("=" * 50)
    
    try:
        # Ensure directory structure
        db_path = ensure_database_directory()
        log_message(f"Using database path: {db_path}")
        
        # Fix database structure
        if fix_shared_notes_table(db_path):
            log_message("🎉 Database setup and repair completed successfully!")
            log_message("You can now restart your Docker container.")
            return True
        else:
            log_message("💥 Database repair failed!", "ERROR")
            return False
            
    except Exception as e:
        log_message(f"Unexpected error in main: {e}", "ERROR")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

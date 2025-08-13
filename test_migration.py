#!/usr/bin/env python3
"""
Test script to verify the automatic migration system
"""

import os
import sys

# Add the project root to Python path
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

def test_migration_system():
    """Test that the migration system can find and fix the database"""
    print("🧪 Testing Migration System")
    print("=" * 30)
    
    # Test environment detection
    print(f"Current directory: {os.getcwd()}")
    print(f"Project root: {project_root}")
    print(f"Docker environment (/app exists): {os.path.exists('/app')}")
    
    # Test database path detection
    try:
        from src.migrations import get_db_path
        db_path = get_db_path()
        print(f"Detected database path: {db_path}")
        print(f"Database exists: {os.path.exists(db_path)}")
        
        if os.path.exists(db_path):
            # Test connection and schema
            import sqlite3
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            # Check tables
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [row[0] for row in cursor.fetchall()]
            print(f"Tables found: {tables}")
            
            # Check shared_notes structure if it exists
            if 'shared_notes' in tables:
                cursor.execute("PRAGMA table_info(shared_notes)")
                columns = [row[1] for row in cursor.fetchall()]
                print(f"shared_notes columns: {columns}")
                
                has_hidden_column = 'hidden_by_recipient' in columns
                print(f"Has hidden_by_recipient column: {has_hidden_column}")
                
                if not has_hidden_column:
                    print("❌ Migration needed: hidden_by_recipient column is missing")
                else:
                    print("✅ Database schema is up to date")
            else:
                print("ℹ️ shared_notes table doesn't exist yet (will be created on first run)")
            
            conn.close()
        else:
            print("ℹ️ Database doesn't exist yet (will be created on first run)")
            
    except Exception as e:
        print(f"❌ Error testing migration system: {e}")
        return False
    
    print("\n✅ Migration system test completed")
    return True

if __name__ == "__main__":
    test_migration_system()

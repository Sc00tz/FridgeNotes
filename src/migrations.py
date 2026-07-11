"""
Automatic database migration system
Runs migrations automatically when the app starts
"""

import sqlite3
import os
from flask import current_app

def get_db_path():
    """Get the database path from the app configuration or use default"""
    try:
        # Try to get from Flask config if available
        if current_app:
            db_uri = current_app.config.get('SQLALCHEMY_DATABASE_URI', '')
            if 'sqlite:///' in db_uri:
                config_path = db_uri.replace('sqlite:///', '')
                print(f"Flask config database path: {config_path}")
                return config_path
    except:
        pass
    
    # Check if we're in Docker (look for Docker-specific paths first)
    docker_paths = [
        '/app/src/database/app.db',  # Docker mount point
        '/app/data/app.db',          # Alternative Docker location
    ]
    
    # Check if we're in Docker environment
    for path in docker_paths:
        if os.path.exists(path):
            print(f"Found database in Docker at: {path}")
            return path
    
    # Local development paths
    local_paths = [
        'data/app.db',               # Most common production location
        'src/database/app.db',       # Development config location
        'database/app.db',           # Alternative
        '../data/app.db',            # Relative alternative
    ]
    
    for path in local_paths:
        if os.path.exists(path):
            print(f"Found database locally at: {path}")
            return path
    
    # If no database exists, determine where it should be created
    if os.path.exists('/app'):
        # We're in Docker
        default_path = '/app/src/database/app.db'
        print(f"Docker environment detected, using: {default_path}")
        return default_path
    else:
        # Local development
        default_path = 'data/app.db'
        print(f"Local environment detected, using: {default_path}")
        return default_path

def check_table_exists(cursor, table_name):
    """Check if a table exists in the database"""
    cursor.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name=?
    """, (table_name,))
    return cursor.fetchone() is not None

def create_migration_table(cursor):
    """Create the migration tracking table if it doesn't exist"""
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS migration_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            migration_name TEXT UNIQUE NOT NULL,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

def is_migration_applied(cursor, migration_name):
    """Check if a migration has already been applied"""
    cursor.execute('''
        SELECT COUNT(*) FROM migration_history 
        WHERE migration_name = ?
    ''', (migration_name,))
    return cursor.fetchone()[0] > 0

def mark_migration_applied(cursor, migration_name):
    """Mark a migration as applied"""
    cursor.execute('''
        INSERT OR IGNORE INTO migration_history (migration_name) 
        VALUES (?)
    ''', (migration_name,))

def check_column_exists(cursor, table_name, column_name):
    """Check if a column exists in a table"""
    try:
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = [column[1] for column in cursor.fetchall()]
        return column_name in columns
    except sqlite3.Error:
        return False

def run_migration_000_cleanup_duplicate_tables():
    """Migration 000: Clean up duplicate table structure from earlier versions"""
    migration_name = "000_cleanup_duplicate_tables"
    db_path = get_db_path()
    
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}, skipping migration")
        return True
    
    conn = None
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Create migration tracking table
        create_migration_table(cursor)
        
        # Check if this migration has already been applied
        if is_migration_applied(cursor, migration_name):
            print(f"✅ Migration {migration_name} already applied")
            return True
        
        # Check for duplicate tables and clean them up
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        all_tables = [row[0] for row in cursor.fetchall()]
        
        tables_to_drop = []
        
        # Look for old singular table names that have newer plural versions
        for table in all_tables:
            if table in ['user', 'note', 'checklist_item', 'shared_note'] and f"{table}s" in all_tables:
                tables_to_drop.append(table)
        
        if tables_to_drop:
            print(f"📝 Running Migration {migration_name}: Cleaning up duplicate tables...")
            for table in tables_to_drop:
                print(f"   - Dropping old table: {table}")
                cursor.execute(f"DROP TABLE IF EXISTS {table}")
            
            # Mark migration as applied
            mark_migration_applied(cursor, migration_name)
            conn.commit()
            print(f"✅ Migration {migration_name} completed successfully!")
        else:
            print(f"✅ No duplicate tables found, marking {migration_name} as applied")
            mark_migration_applied(cursor, migration_name)
            conn.commit()
        
        return True
        
    except sqlite3.Error as e:
        print(f"❌ Migration {migration_name} failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error in Migration {migration_name}: {e}")
        return False
    finally:
        if conn:
            conn.close()

def run_migration_001_add_hidden_by_recipient():
    """Migration 001: Add hidden_by_recipient column to shared_notes table"""
    migration_name = "001_add_hidden_by_recipient"
    db_path = get_db_path()
    
    # Ensure the database directory exists
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        try:
            os.makedirs(db_dir, exist_ok=True)
            print(f"Created database directory: {db_dir}")
        except Exception as e:
            print(f"Warning: Could not create database directory {db_dir}: {e}")
    
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}, will be created when app starts")
        return True
    
    conn = None
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Create migration tracking table
        create_migration_table(cursor)
        
        # Check if this migration has already been applied
        if is_migration_applied(cursor, migration_name):
            print(f"✅ Migration {migration_name} already applied")
            return True
        
        # Check if shared_notes table exists
        if not check_table_exists(cursor, 'shared_notes'):
            print("shared_notes table doesn't exist yet, skipping migration")
            return True
        
        # Check if the column already exists (double-check)
        if check_column_exists(cursor, 'shared_notes', 'hidden_by_recipient'):
            print("✅ hidden_by_recipient column already exists, marking as applied")
            mark_migration_applied(cursor, migration_name)
            conn.commit()
            return True
        
        # Add the new column
        print(f"📝 Running Migration {migration_name}: Adding hidden_by_recipient column...")
        cursor.execute('''
            ALTER TABLE shared_notes 
            ADD COLUMN hidden_by_recipient BOOLEAN NOT NULL DEFAULT FALSE
        ''')
        
        # Mark migration as applied
        mark_migration_applied(cursor, migration_name)
        
        conn.commit()
        print(f"✅ Migration {migration_name} completed successfully!")
        return True
        
    except sqlite3.Error as e:
        print(f"❌ Migration {migration_name} failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error in Migration {migration_name}: {e}")
        return False
    finally:
        if conn:
            conn.close()

def run_migration_002_add_color_field():
    """Migration 002: Add color field to notes table"""
    migration_name = "002_add_color_field"
    db_path = get_db_path()
    
    # Ensure the database directory exists
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        try:
            os.makedirs(db_dir, exist_ok=True)
            print(f"Created database directory: {db_dir}")
        except Exception as e:
            print(f"Warning: Could not create database directory {db_dir}: {e}")
    
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}, will be created when app starts")
        return True
    
    conn = None
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Create migration tracking table
        create_migration_table(cursor)
        
        # Check if this migration has already been applied
        if is_migration_applied(cursor, migration_name):
            print(f"✅ Migration {migration_name} already applied")
            return True
        
        # Check if notes table exists
        if not check_table_exists(cursor, 'notes'):
            print("notes table doesn't exist yet, skipping migration")
            return True
        
        # Check if the color column already exists
        if check_column_exists(cursor, 'notes', 'color'):
            print("✅ color column already exists, marking as applied")
            mark_migration_applied(cursor, migration_name)
            conn.commit()
            return True
        
        # Add the new column
        print(f"📝 Running Migration {migration_name}: Adding color column...")
        cursor.execute('''
            ALTER TABLE notes 
            ADD COLUMN color VARCHAR(20) NOT NULL DEFAULT 'default'
        ''')
        
        # Mark migration as applied
        mark_migration_applied(cursor, migration_name)
        
        conn.commit()
        print(f"✅ Migration {migration_name} completed successfully!")
        return True
        
    except sqlite3.Error as e:
        print(f"❌ Migration {migration_name} failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error in Migration {migration_name}: {e}")
        return False
    finally:
        if conn:
            conn.close()

def run_migration_003_create_labels_system():
    """Migration 003: Create labels and note_labels tables"""
    migration_name = "003_create_labels_system"
    db_path = get_db_path()
    
    # Ensure the database directory exists
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        try:
            os.makedirs(db_dir, exist_ok=True)
            print(f"Created database directory: {db_dir}")
        except Exception as e:
            print(f"Warning: Could not create database directory {db_dir}: {e}")
    
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}, will be created when app starts")
        return True
    
    conn = None
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Create migration tracking table
        create_migration_table(cursor)
        
        # Check if this migration has already been applied
        if is_migration_applied(cursor, migration_name):
            print(f"✅ Migration {migration_name} already applied")
            return True
        
        print(f"📝 Running Migration {migration_name}: Creating labels system...")
        
        # Create labels table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS labels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(100) NOT NULL,
                color VARCHAR(20) NOT NULL DEFAULT '#3b82f6',
                parent_id INTEGER NULL,
                user_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (parent_id) REFERENCES labels (id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        ''')
        
        # Create note_labels junction table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS note_labels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                note_id INTEGER NOT NULL,
                label_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (note_id) REFERENCES notes (id) ON DELETE CASCADE,
                FOREIGN KEY (label_id) REFERENCES labels (id) ON DELETE CASCADE,
                UNIQUE(note_id, label_id)
            )
        ''')
        
        # Create indexes for better performance
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_labels_user_id ON labels (user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_labels_parent_id ON labels (parent_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_note_labels_note_id ON note_labels (note_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_note_labels_label_id ON note_labels (label_id)')
        
        # Mark migration as applied
        mark_migration_applied(cursor, migration_name)
        
        conn.commit()
        print(f"✅ Migration {migration_name} completed successfully!")
        print("   - Created labels table with hierarchical support")
        print("   - Created note_labels junction table")
        print("   - Added performance indexes")
        return True
        
    except sqlite3.Error as e:
        print(f"❌ Migration {migration_name} failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error in Migration {migration_name}: {e}")
        return False
    finally:
        if conn:
            conn.close()

def run_migration_004_add_position_field():
    """Migration 004: Add position field to notes table for drag & drop reordering"""
    migration_name = "004_add_position_field"
    db_path = get_db_path()
    
    # Ensure the database directory exists
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        try:
            os.makedirs(db_dir, exist_ok=True)
            print(f"Created database directory: {db_dir}")
        except Exception as e:
            print(f"Warning: Could not create database directory {db_dir}: {e}")
    
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}, will be created when app starts")
        return True
    
    conn = None
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Create migration tracking table
        create_migration_table(cursor)
        
        # Check if this migration has already been applied
        if is_migration_applied(cursor, migration_name):
            print(f"✅ Migration {migration_name} already applied")
            return True
        
        # Check if notes table exists
        if not check_table_exists(cursor, 'notes'):
            print("notes table doesn't exist yet, skipping migration")
            return True
        
        # Check if the position column already exists
        if check_column_exists(cursor, 'notes', 'position'):
            print("✅ position column already exists, marking as applied")
            mark_migration_applied(cursor, migration_name)
            conn.commit()
            return True
        
        print(f"📝 Running Migration {migration_name}: Adding position column for drag & drop...")
        
        # Add the position column
        cursor.execute('''
            ALTER TABLE notes 
            ADD COLUMN position INTEGER NOT NULL DEFAULT 0
        ''')
        
        # Set initial positions based on created_at (newest first, maintaining current order)
        print("   - Setting initial position values based on creation date...")
        cursor.execute('''
            UPDATE notes 
            SET position = (
                SELECT COUNT(*) 
                FROM notes n2 
                WHERE n2.user_id = notes.user_id 
                AND n2.created_at >= notes.created_at
            )
        ''')
        
        # Create index for better performance
        print("   - Creating performance index...")
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_notes_user_position 
            ON notes(user_id, position)
        ''')
        
        # Get count of updated notes for confirmation
        cursor.execute("SELECT COUNT(*) FROM notes WHERE position IS NOT NULL")
        updated_count = cursor.fetchone()[0]
        
        # Mark migration as applied
        mark_migration_applied(cursor, migration_name)
        
        conn.commit()
        print(f"✅ Migration {migration_name} completed successfully!")
        print(f"   - Added position column to notes table")
        print(f"   - Set positions for {updated_count} existing notes")
        print(f"   - Created performance index")
        print(f"   - Drag & drop reordering is now ready!")
        return True
        
    except sqlite3.Error as e:
        print(f"❌ Migration {migration_name} failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error in Migration {migration_name}: {e}")
        return False
    finally:
        if conn:
            conn.close()

def run_migration_005_add_pinned_field():
    """Migration 005: Add pinned field to notes table for pinning important notes"""
    migration_name = "005_add_pinned_field"
    db_path = get_db_path()
    
    # Ensure the database directory exists
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        try:
            os.makedirs(db_dir, exist_ok=True)
            print(f"Created database directory: {db_dir}")
        except Exception as e:
            print(f"Warning: Could not create database directory {db_dir}: {e}")
    
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}, will be created when app starts")
        return True
    
    conn = None
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Create migration tracking table
        create_migration_table(cursor)
        
        # Check if this migration has already been applied
        if is_migration_applied(cursor, migration_name):
            print(f"✅ Migration {migration_name} already applied")
            return True
        
        # Check if notes table exists
        if not check_table_exists(cursor, 'notes'):
            print("notes table doesn't exist yet, skipping migration")
            return True
        
        # Check if the pinned column already exists
        if check_column_exists(cursor, 'notes', 'pinned'):
            print("✅ pinned column already exists, marking as applied")
            mark_migration_applied(cursor, migration_name)
            conn.commit()
            return True
        
        print(f"📝 Running Migration {migration_name}: Adding pinned column for note pinning...")
        
        # Add the pinned column
        cursor.execute('''
            ALTER TABLE notes 
            ADD COLUMN pinned BOOLEAN NOT NULL DEFAULT FALSE
        ''')
        
        # Create index for better performance (pinned notes will be sorted first)
        print("   - Creating performance index...")
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_notes_user_pinned 
            ON notes(user_id, pinned, position)
        ''')
        
        # Get count of notes for confirmation
        cursor.execute("SELECT COUNT(*) FROM notes")
        total_notes = cursor.fetchone()[0]
        
        # Mark migration as applied
        mark_migration_applied(cursor, migration_name)
        
        conn.commit()
        print(f"✅ Migration {migration_name} completed successfully!")
        print(f"   - Added pinned column to notes table")
        print(f"   - {total_notes} notes are ready for pinning")
        print(f"   - Created performance index for sorting")
        print(f"   - Pin/unpin functionality is now ready!")
        return True
        
    except sqlite3.Error as e:
        print(f"❌ Migration {migration_name} failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error in Migration {migration_name}: {e}")
        return False
    finally:
        if conn:
            conn.close()

def run_migration_006_add_reminder_fields():
    """Migration 006: Add reminder fields to notes table for date/time reminders"""
    migration_name = "006_add_reminder_fields"
    db_path = get_db_path()
    
    # Ensure the database directory exists
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        try:
            os.makedirs(db_dir, exist_ok=True)
            print(f"Created database directory: {db_dir}")
        except Exception as e:
            print(f"Warning: Could not create database directory {db_dir}: {e}")
    
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}, will be created when app starts")
        return True
    
    conn = None
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Create migration tracking table
        create_migration_table(cursor)
        
        # Check if this migration has already been applied
        if is_migration_applied(cursor, migration_name):
            print(f"✅ Migration {migration_name} already applied, skipping")
            return True
        
        # Check if notes table exists
        if not check_table_exists(cursor, 'notes'):
            print("notes table doesn't exist yet, skipping migration")
            return True
        
        print(f"🔄 Applying migration {migration_name}...")
        
        # Add reminder_datetime column for when to remind user
        if not check_column_exists(cursor, 'notes', 'reminder_datetime'):
            print("   - Adding reminder_datetime column...")
            cursor.execute('''
                ALTER TABLE notes 
                ADD COLUMN reminder_datetime DATETIME NULL
            ''')
        else:
            print("   - reminder_datetime column already exists")
        
        # Add reminder_completed column for whether reminder was acknowledged
        if not check_column_exists(cursor, 'notes', 'reminder_completed'):
            print("   - Adding reminder_completed column...")
            cursor.execute('''
                ALTER TABLE notes 
                ADD COLUMN reminder_completed BOOLEAN NOT NULL DEFAULT FALSE
            ''')
        else:
            print("   - reminder_completed column already exists")
        
        # Add reminder_snoozed_until column for snooze functionality
        if not check_column_exists(cursor, 'notes', 'reminder_snoozed_until'):
            print("   - Adding reminder_snoozed_until column...")
            cursor.execute('''
                ALTER TABLE notes 
                ADD COLUMN reminder_snoozed_until DATETIME NULL
            ''')
        else:
            print("   - reminder_snoozed_until column already exists")
        
        # Create index for better performance when querying active reminders
        print("   - Creating performance index for reminders...")
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_notes_reminders 
            ON notes(reminder_datetime, reminder_completed, user_id)
        ''')
        
        # Get count of notes for confirmation
        cursor.execute("SELECT COUNT(*) FROM notes")
        total_notes = cursor.fetchone()[0]
        
        # Mark migration as applied
        mark_migration_applied(cursor, migration_name)
        
        conn.commit()
        print(f"✅ Migration {migration_name} completed successfully!")
        print(f"   - Added reminder_datetime column to notes table")
        print(f"   - Added reminder_completed column to notes table")
        print(f"   - Added reminder_snoozed_until column to notes table")
        print(f"   - {total_notes} notes are ready for reminders")
        print(f"   - Created performance index for reminder queries")
        print(f"   - Date/time reminder functionality is now ready!")
        return True
        
    except sqlite3.Error as e:
        print(f"❌ Migration {migration_name} failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error in Migration {migration_name}: {e}")
        return False
    finally:
        if conn:
            conn.close()

def run_migration_007_create_performance_indexes():
    """Migration 007: Create performance indexes for better query performance"""
    migration_name = "007_create_performance_indexes"
    db_path = get_db_path()
    
    # Ensure the database directory exists
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        try:
            os.makedirs(db_dir, exist_ok=True)
            print(f"Created database directory: {db_dir}")
        except Exception as e:
            print(f"Warning: Could not create database directory {db_dir}: {e}")
    
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}, will be created when app starts")
        return True
    
    conn = None
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Create migration tracking table
        create_migration_table(cursor)
        
        # Check if this migration has already been applied
        if is_migration_applied(cursor, migration_name):
            print(f"✅ Migration {migration_name} already applied")
            return True
        
        print(f"📝 Running Migration {migration_name}: Creating performance indexes...")
        
        # Index for notes queries by user_id (most common query)
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_notes_user_id_pinned_position 
            ON notes(user_id, pinned DESC, position ASC)
        ''')
        print("   - Created index on notes(user_id, pinned, position)")
        
        # Index for shared notes queries
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_shared_notes_user_id_hidden 
            ON shared_notes(user_id, hidden_by_recipient)
        ''')
        print("   - Created index on shared_notes(user_id, hidden_by_recipient)")
        
        # Index for shared notes by note_id (for joins)
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_shared_notes_note_id 
            ON shared_notes(note_id)
        ''')
        print("   - Created index on shared_notes(note_id)")
        
        # Index for checklist items by note_id
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_checklist_items_note_id_order 
            ON checklist_items(note_id, `order`)
        ''')
        print("   - Created index on checklist_items(note_id, order)")
        
        # Index for note-label associations
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_note_labels_note_id 
            ON note_labels(note_id)
        ''')
        print("   - Created index on note_labels(note_id)")
        
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_note_labels_label_id 
            ON note_labels(label_id)
        ''')
        print("   - Created index on note_labels(label_id)")
        
        # Index for labels by user_id
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_labels_user_id 
            ON labels(user_id)
        ''')
        print("   - Created index on labels(user_id)")
        
        # Index for reminder queries
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_notes_reminder_datetime 
            ON notes(reminder_datetime) 
            WHERE reminder_datetime IS NOT NULL
        ''')
        print("   - Created index on notes(reminder_datetime)")
        
        # Mark migration as applied
        mark_migration_applied(cursor, migration_name)
        
        conn.commit()
        print(f"✅ Migration {migration_name} completed successfully!")
        print(f"   - Created 8 performance indexes")
        print(f"   - Database queries should now be significantly faster")
        return True
        
    except sqlite3.Error as e:
        print(f"❌ Migration {migration_name} failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error in Migration {migration_name}: {e}")
        return False
    finally:
        if conn:
            conn.close()

def run_migration_008_make_label_color_nullable():
    """Migration 008: Make labels.color nullable so NULL means 'inherit from parent'.

    Migration 003 created labels.color as NOT NULL DEFAULT '#3b82f6'. The model now
    treats NULL as "inherit", so inserting a label without a color must be allowed.
    SQLite can't ALTER a column's nullability, so the table is rebuilt.
    """
    migration_name = "008_make_label_color_nullable"
    db_path = get_db_path()

    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        try:
            os.makedirs(db_dir, exist_ok=True)
            print(f"Created database directory: {db_dir}")
        except Exception as e:
            print(f"Warning: Could not create database directory {db_dir}: {e}")

    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}, will be created when app starts")
        return True

    conn = None
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Explicitly disable FK enforcement during the rebuild. DROP TABLE labels
        # would otherwise ON DELETE CASCADE and wipe every note_labels association.
        # sqlite3 defaults this OFF, but we set it explicitly so correctness does
        # not silently depend on that default.
        cursor.execute("PRAGMA foreign_keys=OFF")

        create_migration_table(cursor)

        if is_migration_applied(cursor, migration_name):
            print(f"✅ Migration {migration_name} already applied")
            return True

        # If labels doesn't exist yet, the model/migration 003 will create it
        # correctly (model is now nullable); nothing to rebuild.
        if not check_table_exists(cursor, 'labels'):
            print("labels table doesn't exist yet, marking migration as applied")
            mark_migration_applied(cursor, migration_name)
            conn.commit()
            return True

        # Detect whether color is already nullable; if so, skip the rebuild.
        cursor.execute("PRAGMA table_info(labels)")
        color_notnull = None
        for row in cursor.fetchall():
            # row: (cid, name, type, notnull, dflt_value, pk)
            if row[1] == 'color':
                color_notnull = row[3]
                break

        if color_notnull == 0:
            print("✅ labels.color is already nullable, marking as applied")
            mark_migration_applied(cursor, migration_name)
            conn.commit()
            return True

        print(f"📝 Running Migration {migration_name}: Rebuilding labels table with nullable color...")

        # Rebuild the table (SQLite cannot drop a NOT NULL constraint in place).
        # Foreign keys are off by default per-connection, so a straight rename/copy is safe here.
        cursor.execute('''
            CREATE TABLE labels_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(100) NOT NULL,
                color VARCHAR(20) NULL,
                parent_id INTEGER NULL,
                user_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (parent_id) REFERENCES labels (id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        ''')
        cursor.execute('''
            INSERT INTO labels_new (id, name, color, parent_id, user_id, created_at, updated_at)
            SELECT id, name, color, parent_id, user_id, created_at, updated_at FROM labels
        ''')
        cursor.execute("DROP TABLE labels")
        cursor.execute("ALTER TABLE labels_new RENAME TO labels")

        # Recreate the indexes that lived on the old table (from migration 003).
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_labels_user_id ON labels (user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_labels_parent_id ON labels (parent_id)')

        mark_migration_applied(cursor, migration_name)
        conn.commit()
        print(f"✅ Migration {migration_name} completed successfully!")
        print("   - labels.color is now nullable (NULL = inherit from parent)")
        return True

    except sqlite3.Error as e:
        print(f"❌ Migration {migration_name} failed: {e}")
        if conn:
            conn.rollback()
        return False
    except Exception as e:
        print(f"❌ Unexpected error in Migration {migration_name}: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()


def run_migration_009_add_location_reminder_fields():
    """Migration 009: Add location-based reminder fields to the notes table."""
    migration_name = "009_add_location_reminder_fields"
    db_path = get_db_path()

    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        try:
            os.makedirs(db_dir, exist_ok=True)
            print(f"Created database directory: {db_dir}")
        except Exception as e:
            print(f"Warning: Could not create database directory {db_dir}: {e}")

    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}, will be created when app starts")
        return True

    conn = None
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        create_migration_table(cursor)

        if is_migration_applied(cursor, migration_name):
            print(f"✅ Migration {migration_name} already applied")
            return True

        if not check_table_exists(cursor, 'notes'):
            print("notes table doesn't exist yet, skipping migration")
            return True

        print(f"📝 Running Migration {migration_name}: Adding location reminder fields...")

        columns = [
            ('reminder_latitude', 'FLOAT NULL'),
            ('reminder_longitude', 'FLOAT NULL'),
            ('reminder_radius', 'INTEGER NULL'),
            ('reminder_location_name', 'VARCHAR(200) NULL'),
        ]
        for name, ddl in columns:
            if not check_column_exists(cursor, 'notes', name):
                print(f"   - Adding {name} column...")
                cursor.execute(f"ALTER TABLE notes ADD COLUMN {name} {ddl}")
            else:
                print(f"   - {name} column already exists")

        mark_migration_applied(cursor, migration_name)
        conn.commit()
        print(f"✅ Migration {migration_name} completed successfully!")
        print("   - Location-based reminders are now ready!")
        return True

    except sqlite3.Error as e:
        print(f"❌ Migration {migration_name} failed: {e}")
        if conn:
            conn.rollback()
        return False
    except Exception as e:
        print(f"❌ Unexpected error in Migration {migration_name}: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()


def run_migration_010_create_attachments_table():
    """Migration 010: Create the attachments table for note file attachments."""
    migration_name = "010_create_attachments_table"
    db_path = get_db_path()

    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        try:
            os.makedirs(db_dir, exist_ok=True)
            print(f"Created database directory: {db_dir}")
        except Exception as e:
            print(f"Warning: Could not create database directory {db_dir}: {e}")

    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}, will be created when app starts")
        return True

    conn = None
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        create_migration_table(cursor)

        if is_migration_applied(cursor, migration_name):
            print(f"✅ Migration {migration_name} already applied")
            return True

        print(f"📝 Running Migration {migration_name}: Creating attachments table...")

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS attachments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                note_id INTEGER NOT NULL,
                uploader_id INTEGER NOT NULL,
                filename VARCHAR(255) NOT NULL,
                original_filename VARCHAR(255) NULL,
                mime_type VARCHAR(100) NOT NULL,
                file_size INTEGER NOT NULL DEFAULT 0,
                attachment_type VARCHAR(10) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (note_id) REFERENCES notes (id) ON DELETE CASCADE,
                FOREIGN KEY (uploader_id) REFERENCES users (id) ON DELETE CASCADE
            )
        ''')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_attachments_note_id ON attachments (note_id)')

        mark_migration_applied(cursor, migration_name)
        conn.commit()
        print(f"✅ Migration {migration_name} completed successfully!")
        print("   - File attachments (images/audio) are now ready!")
        return True

    except sqlite3.Error as e:
        print(f"❌ Migration {migration_name} failed: {e}")
        if conn:
            conn.rollback()
        return False
    except Exception as e:
        print(f"❌ Unexpected error in Migration {migration_name}: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()


def run_migration_011_add_note_client_id():
    """Migration 011: Add client_id to notes for idempotent offline creation."""
    migration_name = "011_add_note_client_id"
    db_path = get_db_path()

    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        try:
            os.makedirs(db_dir, exist_ok=True)
            print(f"Created database directory: {db_dir}")
        except Exception as e:
            print(f"Warning: Could not create database directory {db_dir}: {e}")

    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}, will be created when app starts")
        return True

    conn = None
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        create_migration_table(cursor)

        if is_migration_applied(cursor, migration_name):
            print(f"✅ Migration {migration_name} already applied")
            return True

        if not check_table_exists(cursor, 'notes'):
            print("notes table doesn't exist yet, skipping migration")
            return True

        if not check_column_exists(cursor, 'notes', 'client_id'):
            print(f"📝 Running Migration {migration_name}: Adding client_id column...")
            cursor.execute("ALTER TABLE notes ADD COLUMN client_id VARCHAR(64) NULL")
        else:
            print("   - client_id column already exists")

        # Partial unique index enforces idempotency per user without constraining
        # the many existing rows that have a NULL client_id.
        cursor.execute('''
            CREATE UNIQUE INDEX IF NOT EXISTS idx_notes_user_client_id
            ON notes (user_id, client_id)
            WHERE client_id IS NOT NULL
        ''')

        mark_migration_applied(cursor, migration_name)
        conn.commit()
        print(f"✅ Migration {migration_name} completed successfully!")
        print("   - Idempotent offline note creation is now supported!")
        return True

    except sqlite3.Error as e:
        print(f"❌ Migration {migration_name} failed: {e}")
        if conn:
            conn.rollback()
        return False
    except Exception as e:
        print(f"❌ Unexpected error in Migration {migration_name}: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()


def run_migration_012_create_deleted_notes_table():
    """Migration 012: Create the deleted_notes tombstone table for delta-sync."""
    migration_name = "012_create_deleted_notes_table"
    db_path = get_db_path()

    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        try:
            os.makedirs(db_dir, exist_ok=True)
            print(f"Created database directory: {db_dir}")
        except Exception as e:
            print(f"Warning: Could not create database directory {db_dir}: {e}")

    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}, will be created when app starts")
        return True

    conn = None
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        create_migration_table(cursor)

        if is_migration_applied(cursor, migration_name):
            print(f"✅ Migration {migration_name} already applied")
            return True

        print(f"📝 Running Migration {migration_name}: Creating deleted_notes table...")

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS deleted_notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                note_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        ''')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_deleted_notes_user_deleted ON deleted_notes (user_id, deleted_at)')

        mark_migration_applied(cursor, migration_name)
        conn.commit()
        print(f"✅ Migration {migration_name} completed successfully!")
        print("   - Delta-sync tombstones are now supported!")
        return True

    except sqlite3.Error as e:
        print(f"❌ Migration {migration_name} failed: {e}")
        if conn:
            conn.rollback()
        return False
    except Exception as e:
        print(f"❌ Unexpected error in Migration {migration_name}: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()


def run_migration_013_add_private_notes():
    """Migration 013: Add notes.is_private and users.private_pin_hash for PIN-gated notes."""
    migration_name = "013_add_private_notes"
    db_path = get_db_path()

    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        try:
            os.makedirs(db_dir, exist_ok=True)
            print(f"Created database directory: {db_dir}")
        except Exception as e:
            print(f"Warning: Could not create database directory {db_dir}: {e}")

    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}, will be created when app starts")
        return True

    conn = None
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        create_migration_table(cursor)

        if is_migration_applied(cursor, migration_name):
            print(f"✅ Migration {migration_name} already applied")
            return True

        print(f"📝 Running Migration {migration_name}: Adding private-notes fields...")

        if check_table_exists(cursor, 'notes') and not check_column_exists(cursor, 'notes', 'is_private'):
            cursor.execute("ALTER TABLE notes ADD COLUMN is_private BOOLEAN NOT NULL DEFAULT 0")
            print("   - Added notes.is_private")
        if check_table_exists(cursor, 'users') and not check_column_exists(cursor, 'users', 'private_pin_hash'):
            cursor.execute("ALTER TABLE users ADD COLUMN private_pin_hash VARCHAR(255) NULL")
            print("   - Added users.private_pin_hash")

        mark_migration_applied(cursor, migration_name)
        conn.commit()
        print(f"✅ Migration {migration_name} completed successfully!")
        print("   - PIN-gated private notes are now supported!")
        return True

    except sqlite3.Error as e:
        print(f"❌ Migration {migration_name} failed: {e}")
        if conn:
            conn.rollback()
        return False
    except Exception as e:
        print(f"❌ Unexpected error in Migration {migration_name}: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()


def run_all_migrations():
    """Run all pending migrations"""
    print("🚀 Starting automatic database migrations...")
    print(f"Current working directory: {os.getcwd()}")
    print(f"Environment check - /app exists: {os.path.exists('/app')}")
    
    # Debug: Print what we can see in the file system
    if os.path.exists('/app'):
        print("Docker environment detected")
        try:
            print(f"Contents of /app: {os.listdir('/app')}")
            if os.path.exists('/app/src'):
                print(f"Contents of /app/src: {os.listdir('/app/src')}")
            if os.path.exists('/app/src/database'):
                print(f"Contents of /app/src/database: {os.listdir('/app/src/database')}")
        except Exception as e:
            print(f"Error listing directories: {e}")
    
    migrations = [
        run_migration_000_cleanup_duplicate_tables,
        run_migration_001_add_hidden_by_recipient,
        run_migration_002_add_color_field,
        run_migration_003_create_labels_system,
        run_migration_004_add_position_field,  # NEW: Add position field for drag & drop
        run_migration_005_add_pinned_field,    # NEW: Add pinned field for note pinning
        run_migration_006_add_reminder_fields, # NEW: Add reminder fields for date/time reminders
        run_migration_007_create_performance_indexes, # NEW: Create performance indexes
        run_migration_008_make_label_color_nullable, # NEW: Make labels.color nullable (NULL = inherit)
        run_migration_009_add_location_reminder_fields, # NEW: Add location-based reminder fields
        run_migration_010_create_attachments_table, # NEW: Create attachments table for file uploads
        run_migration_011_add_note_client_id, # NEW: Add client_id for idempotent offline creation
        run_migration_012_create_deleted_notes_table, # NEW: Tombstones for delta-sync
        run_migration_013_add_private_notes, # NEW: PIN-gated private notes
        # Add future migrations here
    ]
    
    success_count = 0
    for i, migration in enumerate(migrations):
        try:
            print(f"\n📋 Checking migration {i:03d}...")
            if migration():
                success_count += 1
            else:
                print(f"❌ Migration {i:03d} failed!")
                break
        except Exception as e:
            print(f"❌ Migration {i:03d} crashed: {e}")
            import traceback
            traceback.print_exc()
            break
    
    if success_count == len(migrations):
        print(f"\n🎉 All {len(migrations)} migrations completed successfully!")
        return True
    else:
        print(f"\n💥 {len(migrations) - success_count} migrations failed!")
        return False

if __name__ == "__main__":
    # Can be run standalone
    run_all_migrations()

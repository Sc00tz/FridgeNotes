# Automatic Database Migrations

## ✅ What's Been Implemented

FridgeNotes now has a **fully automatic migration system** that runs every time the app starts.

## 🔄 How It Works

### 1. **Automatic Execution**
- Migrations run automatically when the Docker container starts
- No manual intervention required
- Runs during app initialization in `src/main.py`

### 2. **Migration Tracking**
- Creates a `migration_history` table to track applied migrations
- Prevents running the same migration multiple times
- Each migration has a unique name and timestamp

### 3. **Safe Execution**
- Database path auto-detection for different environments
- Graceful fallback if migrations fail
- Comprehensive error handling
- App continues to work even if migrations fail

### 4. **Smart Path Detection**
The system automatically finds your database in these locations:
```
data/app.db                 # Production Docker location
src/database/app.db         # Development location  
../data/app.db             # Alternative location
/app/data/app.db           # Docker absolute path
```

## 📋 Current Migrations

### Migration 001: `add_hidden_by_recipient`
- **Purpose**: Adds the `hidden_by_recipient` column to `shared_notes` table
- **Status**: ✅ Implemented and automatic
- **Safe**: Can run multiple times without issues

## 🚀 Usage

### For Development
```bash
# Migrations run automatically when you start the app
docker-compose up -d
```

### For Production
```bash
# Migrations run automatically on container startup
docker run your-image
```

### Manual Execution (Optional)
```bash
# You can still run migrations manually if needed
python3 src/migrations.py
```

## 📝 Adding New Migrations

To add a new migration, simply:

1. **Create the migration function** in `src/migrations.py`:
```python
def run_migration_002_your_migration_name():
    """Migration 002: Description of what this does"""
    migration_name = "002_your_migration_name"
    db_path = get_db_path()
    
    # Your migration logic here
    # Use the helper functions for safety
```

2. **Add it to the migrations list**:
```python
def run_all_migrations():
    migrations = [
        run_migration_001_add_hidden_by_recipient,
        run_migration_002_your_migration_name,  # Add here
    ]
```

3. **Test it**: Start the app and it will run automatically!

## 🛡️ Safety Features

### ✅ **Safe to Run Multiple Times**
- Migration tracking prevents duplicate execution
- Column existence checks before adding
- Table existence checks before modifying

### ✅ **Backward Compatible**
- App works before migrations run
- Graceful fallbacks in code
- Error handling prevents crashes

### ✅ **Development & Production Ready**
- Works in Docker containers
- Works in local development
- Auto-detects database location

## 🔍 Monitoring

### **View Migration Status in Logs**
```bash
# Check Docker logs to see migration status
docker-compose logs app

# Look for these messages:
# 🔄 Running database migrations...
# ✅ Migration 001_add_hidden_by_recipient already applied
# 🎉 All 1 migrations completed successfully!
```

### **Check Migration History in Database**
```sql
-- Connect to your database and run:
SELECT * FROM migration_history;
```

## 🎯 Benefits

1. **Zero Maintenance**: Migrations happen automatically
2. **No Downtime**: App continues to work during migrations  
3. **Version Safe**: New deployments automatically get latest schema
4. **Developer Friendly**: No manual steps required
5. **Production Ready**: Handles all edge cases safely

## 🔮 Future Enhancements

The system is designed to easily support:
- **Data migrations** (not just schema changes)
- **Rollback capabilities** 
- **Migration dependencies**
- **Environment-specific migrations**

---

**Your database migrations are now fully automated!** 🎉

Every time you start the app, it will automatically:
1. ✅ Check for pending migrations
2. ✅ Run any new migrations safely  
3. ✅ Track what's been applied
4. ✅ Continue running normally

No more manual migration steps required!

# Database Issue Fix Instructions

## Problem
Your FridgeNotes application is showing database errors related to a missing `hidden_by_recipient` column in the `shared_notes` table. This is causing errors when trying to:
- Load notes
- Update notes  
- Delete notes
- Access the debug schema endpoint

## Quick Fix

### Method 1: Comprehensive Database Repair (Recommended)

1. **Stop your Docker container:**
   ```bash
   cd "/Users/travis/Documents/Development/Jules/Google_Keep_Clone"
   docker-compose down
   ```

2. **Run the comprehensive database repair script:**
   ```bash
   python3 comprehensive_db_fix.py
   ```

3. **Restart your Docker container:**
   ```bash
   docker-compose up -d
   ```

4. **Check the logs to verify the fix:**
   ```bash
   docker-compose logs -f
   ```

### Method 2: Simple Column Fix

If you prefer the simpler approach:

1. **Stop Docker container:**
   ```bash
   docker-compose down
   ```

2. **Run the simple fix:**
   ```bash
   python3 fix_hidden_column.py
   ```

3. **Restart Docker:**
   ```bash
   docker-compose up -d
   ```

### Method 3: One-Line Fix Script

For the fastest approach:

```bash
chmod +x quick_fix.sh && ./quick_fix.sh
```

## What These Scripts Do

1. **Locate your database** - Finds the database file (usually in `data/app.db`)
2. **Check table structure** - Examines the `shared_notes` table
3. **Add missing column** - Adds the `hidden_by_recipient BOOLEAN NOT NULL DEFAULT FALSE` column
4. **Update migration history** - Records that the migration was applied
5. **Verify the fix** - Confirms the column was added successfully

## After the Fix

Once you run the repair script and restart Docker, you should see:
- No more database column errors in the logs
- The debug schema endpoint at `https://notes.scootz.net/api/debug/schema` working properly
- Normal note operations (create, read, update, delete) working without errors

## Verification

To verify the fix worked:

1. **Check logs for errors:**
   ```bash
   docker-compose logs -f | grep -i error
   ```

2. **Test the debug endpoint:**
   Visit: `https://notes.scootz.net/api/debug/schema`

3. **Try using the application:**
   - Create a note
   - Edit a note
   - Delete a note
   - Share a note

## Root Cause

The issue occurred because:
1. The application code was updated to include a new `hidden_by_recipient` column
2. The database migration system didn't properly detect or apply this change
3. There was a path mismatch between where the migration system looked for the database vs. where Docker was storing it

The repair scripts fix both the missing column and the path detection issues.

## Prevention

This comprehensive fix also:
- Ensures both `data/` and `src/database/` directories exist
- Syncs databases between both locations if needed
- Improves the migration system's database detection
- Updates the debug endpoint to handle the Flask context properly

Your FridgeNotes application should now work perfectly!

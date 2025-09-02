# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Frontend Development (React + Vite)
```bash
# Navigate to frontend directory
cd fridgenotes-frontend

# Install dependencies
npm install

# Start development server (serves on http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Backend Development (Flask)
```bash
# Install Python dependencies
pip install -r requirements.txt

# Run backend development server (serves on http://localhost:5009)
python src/main.py

# Run in production mode with Docker
docker-compose up -d

# View Docker logs for admin credentials
docker-compose logs fridgenotes | grep "Password:"
```

### Database Operations
```bash
# Run database migrations
python src/migrations.py

# Fix database schema issues
python fix_database.py

# Comprehensive database repair
python comprehensive_db_fix.py
```

## Project Architecture

### Full-Stack Structure
This is a note-taking application called "FridgeNotes" with a **separated frontend/backend architecture**:

**Active Architecture:**
- **Backend** (`src/` directory) - Flask application with RESTful API and WebSocket support
- **Frontend** (`fridgenotes-frontend/`) - React Progressive Web App with modern UI components

### Backend Architecture (`src/`)
- **Main Entry**: `src/main.py` - Flask app with SQLAlchemy, WebSocket support, and automatic admin user creation
- **Models**: User, Note, ChecklistItem, SharedNote, Label system with full relationships
- **Routes**: Modular blueprint structure for API endpoints
  - `auth.py` - Authentication and session management
  - `user.py` - User management and admin operations
  - `note.py` - Note CRUD, sharing, and real-time operations
  - `label.py` - Label system and note-label associations
- **Features**: Authentication, note CRUD, real-time collaboration, note sharing, reminder system
- **Database**: SQLite with automatic migrations and schema updates
- **WebSocket**: Real-time collaboration via Flask-SocketIO

### Frontend Architecture (`fridgenotes-frontend/`)

#### Modern React Architecture (Post-Phase 4 Migration)
The frontend uses a **composite hook pattern** for clean separation of concerns:

**Business Logic Hooks:**
- `useAuth` - Authentication state and actions
- `useNoteLabels` - Composite hook managing notes + labels relationship
- `useNotes` - Core note operations and state management
- `useLabels` - Label system management
- `useAdmin` - Admin functionality (user management)
- `useShare` - Note sharing functionality
- `useAutocomplete` - Smart autocomplete for shopping items with learning
- `useTemplates` - List template management and usage tracking
- `useOfflineSync` - Enhanced offline support with operation queuing
- `useImportExport` - Data backup/restore functionality

**UI Components:**
- `App.jsx` - Main orchestrator (~270 lines, clean and well-documented)
- `AppHeader.jsx` - Navigation with search and user menu
- `NotesGrid.jsx` - Grid layout with drag & drop support
- `NoteCard.jsx` - Individual note editing and display
- `CreateNoteDialog.jsx` - Note creation modal
- `ReminderNotifications.jsx` - Real-time reminder system
- `LabelManagement.jsx` - Label creation and management
- `ColorPicker.jsx` - Note color customization
- `PWAInstallPrompt.jsx` - Progressive Web App installation
- `ThemeToggle.jsx` - Dark/light mode switching
- `ChecklistItemAutocomplete.jsx` - Smart autocomplete with 50+ common items
- `ListTemplatesDialog.jsx` - Template management with built-in templates
- `OfflineSyncStatus.jsx` - Offline sync status and manual controls
- `ImportExportDialog.jsx` - Comprehensive data import/export interface
- Component library using Radix UI + Tailwind CSS

#### Key Frontend Features
- **Real-time Collaboration**: WebSocket integration for live updates
- **Progressive Web App**: Installable app with offline support
- **Drag & Drop**: Note reordering with position persistence
- **Label System**: Color-coded labels with autocomplete
- **Reminder System**: Notifications with snooze functionality
- **Dark/Light Mode**: Theme switching with system preference
- **Color Customization**: Customizable note colors
- **Responsive Design**: Mobile-optimized interface
- **Search**: Real-time filtering with label support (`label:labelname`)
- **Smart Autocomplete**: Learning system with common items database
- **List Templates**: Built-in and custom templates with usage tracking
- **Enhanced Offline**: Operation queuing with background sync
- **Import/Export**: Full data backup/restore with JSON and CSV support
- **Memory Optimization**: Fixed WebSocket and note management memory leaks

### Core Features

#### Note System
- **Types**: Text notes and checkbox lists (perfect for shopping lists)
- **Real-time sync**: WebSocket-based collaboration
- **Sharing**: User-based sharing with read/edit permissions
- **Organization**: Labels, colors, archiving, search, pinning
- **Drag & Drop**: Reorderable notes with position persistence
- **Reminders**: Date/time reminders with snooze functionality
- **Color Themes**: Customizable note colors for visual organization

#### Authentication & Security
- **Auto Admin Creation**: Generates secure random admin password on first run
- **Session Management**: Flask-Login with secure cookies
- **User Management**: Admin panel for creating/managing users

#### Database Schema
- **Users**: Authentication and admin roles
- **Notes**: Title, content, type (text/checklist), color, position, pinned, archived, reminder fields
- **ChecklistItems**: Individual checkbox items with order and completion state
- **SharedNotes**: Note sharing with access levels and hide functionality
- **Labels**: Tag system with many-to-many relationship to notes

## Development Workflow

### Making Changes

1. **Backend Changes**: Modify models in `src/models/` or routes in `src/routes/`
2. **Frontend Changes**: Work in `fridgenotes-frontend/src/` with hot reload
3. **Database Changes**: Update models and run migration scripts
4. **WebSocket Events**: Modify `src/websocket_events.py` for real-time features

### Testing the Application

1. Start backend: `python src/main.py`
2. Start frontend: `cd fridgenotes-frontend && npm run dev`
3. Access app at http://localhost:5173 (frontend proxies API to backend)
4. Use admin credentials from backend startup logs

### Key Files to Know

- `src/main.py` - Main Flask application entry point
- `fridgenotes-frontend/src/App.jsx` - Main React component orchestrator
- `fridgenotes-frontend/src/hooks/useNoteLabels.js` - Core notes/labels business logic
- `fridgenotes-frontend/src/hooks/useAutocomplete.js` - Smart autocomplete system
- `fridgenotes-frontend/src/hooks/useTemplates.js` - Template management
- `fridgenotes-frontend/src/hooks/useOfflineSync.js` - Offline sync operations
- `fridgenotes-frontend/src/hooks/useImportExport.js` - Data import/export
- `fridgenotes-frontend/src/components/ChecklistItemAutocomplete.jsx` - Smart item input
- `fridgenotes-frontend/src/components/ListTemplatesDialog.jsx` - Template interface
- `fridgenotes-frontend/src/components/ImportExportDialog.jsx` - Backup/restore UI
- `src/models/note.py` - Note, ChecklistItem, SharedNote models
- `src/websocket_events.py` - Real-time collaboration events
- `docker-compose.yml` - Production deployment configuration

## Debugging Notes

- **Auth Issues**: Check `useAuth.js` hook
- **Notes Not Loading**: Check `useNoteLabels.js` composite hook
- **Real-time Sync**: Check WebSocket connection in browser DevTools
- **Database Issues**: Run migration scripts or check Docker logs
- **Label System**: Managed by `useNoteLabels.js` composite operations
- **Autocomplete Issues**: Check `useAutocomplete.js` hook and localStorage data
- **Template Problems**: Check `useTemplates.js` hook and local storage persistence
- **Offline Sync**: Check `useOfflineSync.js` hook and sync queue in localStorage
- **Import/Export Errors**: Check `useImportExport.js` validation and file handling
- **Memory Leaks**: Fixed in WebSocket and note management components
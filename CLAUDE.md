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
This is a note-taking application called "FridgeNotes" with a **dual architecture**:

1. **Legacy Flask App** (`src/` directory) - Original Flask application with integrated frontend
2. **Modern Separated Architecture** (`backend/` + `fridgenotes-frontend/`) - New structure with separate React frontend and Flask backend

### Backend Architecture

#### Legacy Backend (`src/`)
- **Main Entry**: `src/main.py` - Flask app with SQLAlchemy, WebSocket support, and automatic admin user creation
- **Models**: User, Note, ChecklistItem, SharedNote, Label system
- **Features**: Authentication, note CRUD, real-time collaboration, note sharing
- **Database**: SQLite with automatic migrations

#### Modern Backend (`backend/app/`)
- **Structured API**: Organized with separate API modules, services, schemas
- **Key Components**:
  - `api/` - REST endpoints (notes, auth, tags, sharing, etc.)
  - `models/` - SQLAlchemy models
  - `services/` - Business logic layer
  - `schemas/` - Pydantic validation schemas
  - `utils/` - Helper functions and validators

### Frontend Architecture (`fridgenotes-frontend/`)

#### Modern React Architecture (Post-Phase 4 Migration)
The frontend uses a **composite hook pattern** for clean separation of concerns:

**Business Logic Hooks:**
- `useAuth` - Authentication state and actions
- `useNoteLabels` - Composite hook managing notes + labels relationship
- `useAdmin` - Admin functionality (user management)
- `useShare` - Note sharing functionality

**UI Components:**
- `App.jsx` - Main orchestrator (~200 lines, down from 800+)
- `AppHeader.jsx` - Navigation with search and user menu
- `NotesGrid.jsx` - Grid layout for note display
- `NoteCard.jsx` - Individual note editing and display
- `CreateNoteDialog.jsx` - Note creation modal
- Component library using Radix UI + Tailwind CSS

#### Key Frontend Features
- **Real-time Collaboration**: WebSocket integration for live updates
- **Drag & Drop**: Note reordering with position persistence
- **Label System**: Tag notes with color-coded labels
- **Responsive Design**: Mobile-optimized interface
- **Search**: Real-time filtering with label support (`label:labelname`)

### Core Features

#### Note System
- **Types**: Text notes and checkbox lists (perfect for shopping lists)
- **Real-time sync**: WebSocket-based collaboration
- **Sharing**: User-based sharing with read/edit permissions
- **Organization**: Labels, colors, archiving, search
- **Drag & Drop**: Reorderable notes with position persistence

#### Authentication & Security
- **Auto Admin Creation**: Generates secure random admin password on first run
- **Session Management**: Flask-Login with secure cookies
- **User Management**: Admin panel for creating/managing users

#### Database Schema
- **Users**: Authentication and admin roles
- **Notes**: Title, content, type (text/checklist), color, position, archived
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
- `src/models/note.py` - Note, ChecklistItem, SharedNote models
- `src/websocket_events.py` - Real-time collaboration events
- `docker-compose.yml` - Production deployment configuration

## Debugging Notes

- **Auth Issues**: Check `useAuth.js` hook
- **Notes Not Loading**: Check `useNoteLabels.js` composite hook
- **Real-time Sync**: Check WebSocket connection in browser DevTools
- **Database Issues**: Run migration scripts or check Docker logs
- **Label System**: Managed by `useNoteLabels.js` composite operations
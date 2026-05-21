# FridgeNotes

A self-hosted, collaborative note-taking app built as a Progressive Web App. FridgeNotes is designed for households — shared shopping lists, family reminders, and personal notes, all in one place. Think of it as a self-hosted Google Keep with real-time collaboration and full control over your data.

## Features

**Notes & Lists**
- Text notes and interactive checklists (ideal for grocery and shopping lists)
- Pin important notes to the top
- Color-code notes with customizable themes
- Archive notes to declutter without deleting
- Drag and drop to reorder notes

**Collaboration**
- Share individual notes with other users (read or edit access)
- Real-time sync via WebSocket — changes appear instantly across all open sessions
- Per-user note ownership with admin-managed user accounts

**Organization**
- Color-coded labels with autocomplete suggestions
- Search notes by text content or filter by label using `label:name` syntax
- Smart autocomplete for checklist items — learns from your usage, ships with 50+ common grocery items
- Built-in and custom list templates for quick checklist creation

**Reminders**
- Set date/time reminders on any note
- Snooze reminders from the notification prompt

**Offline & PWA**
- Installable on Android, iOS, and desktop as a Progressive Web App
- Full offline support with an operation queue — edits made offline sync automatically when reconnected

**Data Management**
- Export all notes to JSON (full backup) or CSV (spreadsheet use)
- Import from a previous JSON backup to restore data

**Other**
- Dark and light themes with automatic system preference detection
- Responsive layout optimized for mobile and desktop
- Self-hosted — your data never leaves your server

## Screenshots

### Main Interface
![Main Screen](screenshots/main-screen.png)
*The main FridgeNotes interface showing notes in an organized grid layout*

### Creating Notes
![Create Note](screenshots/create-note.png)
*Note creation dialog with support for text notes and interactive checklists*

### Label System
![Labels](screenshots/labels.png)
*Color-coded labels for organizing notes*

![Create Label](screenshots/create-label.png)
*Create custom labels*

![Manage Labels](screenshots/manage-labels.png)
*Label management with editing tools*

### User Management
![User Profile](screenshots/user-profile.png)
*User profile and admin controls*

---

## Installation

### Docker (Recommended)

The simplest way to run FridgeNotes. The image is built automatically from the `main` branch and published to the GitHub Container Registry.

**Prerequisites:** Docker and Docker Compose

**1. Create a directory and a `.env` file:**

```bash
mkdir fridgenotes && cd fridgenotes
```

Create `.env`:

```env
SECRET_KEY=<generate with: python3 -c "import secrets; print(secrets.token_hex(32))">
FLASK_ENV=production

# Set this to the URL your browser uses to reach the app.
# Used to restrict CORS and WebSocket connections to your own origin.
# Local network example:  http://192.168.1.100:5009
# Domain example:         https://notes.yourdomain.com
ALLOWED_ORIGIN=http://YOUR_IP_OR_DOMAIN:5009
```

**2. Create `docker-compose.local.yml`:**

```yaml
services:
  fridgenotes:
    image: ghcr.io/sc00tz/fridgenotes:latest
    ports:
      - "5009:5009"
    volumes:
      - ./data:/app/src/database
    env_file:
      - .env
    restart: unless-stopped
```

**3. Pull and start:**

```bash
docker-compose -f docker-compose.local.yml pull
docker-compose -f docker-compose.local.yml up -d
```

**4. Get the admin password:**

On first startup, FridgeNotes creates an admin user with a randomly generated password and prints it to the logs:

```
FridgeNotes - INITIAL ADMIN ACCOUNT CREATED
Username: admin
Password: Abc123XyZ9
IMPORTANT: Save this password! It will not be shown again.
```

```bash
docker-compose -f docker-compose.local.yml logs fridgenotes | grep "Password:"
```

**Changing the exposed port:**

Edit the `ports` mapping in your compose file:

```yaml
ports:
  - "8080:5009"   # app now accessible at http://YOUR_IP:8080
```

Also update `ALLOWED_ORIGIN` in `.env` to match.

---

### Behind a Reverse Proxy (Nginx / Caddy)

To expose FridgeNotes on a domain name or over HTTPS, place a reverse proxy in front of it. FridgeNotes uses WebSockets (Socket.IO), so the proxy must be configured to pass WebSocket upgrade headers.

#### Nginx

```nginx
server {
    listen 80;
    server_name notes.yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name notes.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/notes.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/notes.yourdomain.com/privkey.pem;

    location / {
        proxy_pass         http://127.0.0.1:5009;
        proxy_http_version 1.1;

        # Required for WebSocket (Socket.IO) support
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 86400;   # keep WebSocket connections alive
    }
}
```

Set `ALLOWED_ORIGIN=https://notes.yourdomain.com` in `.env`.

#### Caddy

```caddyfile
notes.yourdomain.com {
    reverse_proxy localhost:5009 {
        header_up Upgrade {http.upgrade}
        header_up Connection {http.connection}
    }
}
```

Caddy handles HTTPS and certificate renewal automatically. Set `ALLOWED_ORIGIN=https://notes.yourdomain.com` in `.env`.

#### Docker Compose with proxy in the same stack

If you run Nginx or Caddy in Docker alongside FridgeNotes, connect them on a shared network and use the service name as the upstream:

```yaml
services:
  fridgenotes:
    image: ghcr.io/sc00tz/fridgenotes:latest
    expose:
      - "5009"          # internal only — not published to host
    volumes:
      - ./data:/app/src/database
    env_file:
      - .env
    restart: unless-stopped
    networks:
      - proxy

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./certs:/etc/letsencrypt:ro
    restart: unless-stopped
    networks:
      - proxy

networks:
  proxy:
```

Use `proxy_pass http://fridgenotes:5009;` in your Nginx config.

---

### Local Development

**Prerequisites:** Python 3.10+, Node.js 18+

**Backend:**

```bash
pip install -r requirements.txt
python src/main.py          # runs on http://localhost:5009
```

**Frontend:**

```bash
cd fridgenotes-frontend
npm install
npm run dev                 # runs on http://localhost:5173
```

The Vite dev server proxies all `/api` and WebSocket requests to the Flask backend on port 5009. Both processes must be running simultaneously.

For local development, leave `SECRET_KEY` unset (a dev fallback is used automatically) and `ALLOWED_ORIGIN` can be omitted — CORS is unrestricted when not set.

---

## First-Time Setup

1. Start the application.
2. Retrieve the admin password from the startup logs (see above).
3. Open the app and sign in as `admin`.
4. Change your password via the user profile menu.
5. Create accounts for other household members: profile menu → **Admin Panel** → **Users** → **Create User**.

**If you lose the admin password** and the logs have rotated, reset by removing the database volume. This deletes all data:

```bash
docker-compose -f docker-compose.local.yml down
rm -rf ./data
docker-compose -f docker-compose.local.yml up -d   # new password printed to logs
```

---

## Usage

### Creating Notes

Click the compose area at the top of the main screen. Choose between a **text note** (freeform content) or a **checklist** (interactive list with checkboxes). Give the note a title and content, then click away to save.

### Sharing Notes

Open a note's options menu and select **Share**. Enter the username of the person you want to share with and choose either read or edit access. Shared notes appear in the recipient's note grid. The note owner can revoke access at any time.

Real-time collaboration is active on shared notes — if two people have the same checklist open, checking off an item is immediately visible to both.

### Labels

Create labels from the Labels section in the sidebar or from within a note. Labels have a name and a color. Apply one or more labels to any note.

To filter notes by label, type `label:labelname` in the search bar. Regular text search and label filters can be combined.

### Reminders

Open a note and set a reminder date and time via the reminder option. When the reminder fires, a notification appears in the app with options to dismiss or snooze.

### Drag and Drop

On the main grid, drag any note to a new position. The order is persisted to the server.

### Import / Export

Access import/export from the profile menu → **Import/Export**.

- **Export JSON** — full backup of all notes, checklists, and labels
- **Export CSV** — flat spreadsheet-friendly format
- **Import JSON** — restore from a previous JSON export

### Installing as a Mobile/Desktop App

FridgeNotes is a Progressive Web App and can be installed as a native-feeling app on any platform.

**Android (Chrome)**
1. Open FridgeNotes in Chrome
2. Tap the install prompt or the install icon in the address bar
3. Tap "Install" — the app is added to your home screen and app drawer

**iPhone / iPad (Safari)**
1. Open FridgeNotes in Safari
2. Tap the Share button (the box with an arrow)
3. Tap "Add to Home Screen"
4. Tap "Add"

**Desktop (Chrome / Edge)**
1. Open FridgeNotes in Chrome or Edge
2. Click the install icon in the address bar
3. Click "Install FridgeNotes"
4. The app appears in your Start Menu or Applications folder

Installed apps load faster, work fully offline, run without browser chrome, and update automatically.

---

## Architecture

FridgeNotes uses a separated frontend/backend architecture. In production, the React app is built to static files and served by the Flask backend. In development, the Vite dev server handles the frontend and proxies API calls to Flask.

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 18 + Vite |
| Frontend styling | Tailwind CSS + Radix UI |
| Frontend state | Composite hook pattern (custom hooks) |
| Backend framework | Flask + SQLAlchemy |
| Real-time | Flask-SocketIO (Socket.IO) |
| Database | SQLite |
| Deployment | Docker + Docker Compose |
| Offline support | Workbox service worker |

### Directory Structure

```
FridgeNotes/
├── src/                          # Flask backend
│   ├── main.py                   # App entry point, admin auto-creation
│   ├── models/                   # SQLAlchemy models (User, Note, Label, etc.)
│   ├── routes/                   # API blueprints (auth, note, label, user)
│   └── websocket_events.py       # Socket.IO event handlers
├── fridgenotes-frontend/         # React PWA
│   └── src/
│       ├── App.jsx               # Main orchestrator component
│       ├── components/           # UI components
│       └── hooks/                # Business logic hooks
├── docker-compose.local.yml
├── requirements.txt
└── Dockerfile
```

---

## API Reference

All endpoints are prefixed with `/api`. Requests and responses use JSON. Authentication is session-based (cookie).

### Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Log in with username and password |
| POST | `/api/auth/logout` | End the current session |
| GET | `/api/auth/check` | Check current authentication state |
| POST | `/api/auth/register` | Register a new user (admin only) |

### Notes

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/notes` | List all notes for the current user |
| POST | `/api/notes` | Create a new note |
| PUT | `/api/notes/:id` | Update a note |
| DELETE | `/api/notes/:id` | Delete a note |
| PUT | `/api/notes/reorder` | Persist a new note order |
| PUT | `/api/notes/:id/pin` | Toggle pin state |

### Checklist

| Method | Endpoint | Description |
|---|---|---|
| PUT | `/api/notes/:id/checklist-items/:itemId` | Update a checklist item (e.g., toggle checked) |

### Sharing

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/notes/:id/share` | Share a note with another user |
| DELETE | `/api/notes/:id/shares/:shareId` | Revoke a share |

### Labels

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/labels` | List all labels for the current user |
| POST | `/api/labels` | Create a label |
| PUT | `/api/labels/:id` | Update a label |
| DELETE | `/api/labels/:id` | Delete a label |
| POST | `/api/notes/:id/labels` | Apply a label to a note |
| DELETE | `/api/notes/:id/labels/:labelId` | Remove a label from a note |

### Reminders

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/notes/:id/reminder/complete` | Dismiss a reminder |
| POST | `/api/notes/:id/reminder/snooze` | Snooze a reminder |

---

## WebSocket Events

FridgeNotes uses Socket.IO for real-time collaboration. Clients join a user-specific room on authentication.

### Client → Server

| Event | Description |
|---|---|
| `join_user` | Join the authenticated user's room |
| `note_updated` | Broadcast a note edit to other sessions |
| `checklist_item_toggled` | Broadcast a checklist item state change |
| `notes_reordered` | Broadcast a new note order |

### Server → Client

| Event | Description |
|---|---|
| `note_update_received` | A note was updated by another session |
| `checklist_item_toggle_received` | A checklist item was toggled by another session |
| `notes_reorder_received` | Note order was changed by another session |

---

## Configuration

All configuration is done via environment variables, typically in a `.env` file loaded by Docker Compose.

| Variable | Required | Description |
|---|---|---|
| `SECRET_KEY` | **Yes (production)** | Flask session signing key. The app will refuse to start in production if this is not set. Generate with: `python3 -c "import secrets; print(secrets.token_hex(32))"` |
| `FLASK_ENV` | No | Set to `production` (default) or `development`. Development mode enables auto-reload and skips the `SECRET_KEY` requirement. |
| `ALLOWED_ORIGIN` | **Yes (production)** | The URL your browser uses to reach the app (e.g. `https://notes.yourdomain.com` or `http://192.168.1.100:5009`). Restricts CORS and WebSocket connections to your origin only. If unset, CORS is unrestricted (safe for local development only). |

Example `.env` for a LAN deployment:

```env
SECRET_KEY=b73c7855306aaf80ea576eada4232ecf05c343c445b9011832f92bc4005a8468
FLASK_ENV=production
ALLOWED_ORIGIN=http://192.168.1.100:5009
```

Example `.env` behind a reverse proxy with a domain:

```env
SECRET_KEY=b73c7855306aaf80ea576eada4232ecf05c343c445b9011832f92bc4005a8468
FLASK_ENV=production
ALLOWED_ORIGIN=https://notes.yourdomain.com
```

---

## Contributing

See [CLAUDE.md](CLAUDE.md) for a detailed description of the codebase architecture, key files, hook patterns, and development workflow. That document is the primary reference for anyone working on the code.

For backend changes, work in `src/models/` and `src/routes/`. For frontend changes, work in `fridgenotes-frontend/src/` — the Vite dev server supports hot reload. Database schema changes require a corresponding migration in `src/migrations.py`.

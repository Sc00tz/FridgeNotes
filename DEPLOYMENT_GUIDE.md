# FridgeNotes - Complete Deployment Guide

## Overview

This is a complete self-hosted FridgeNotes application optimized for shopping lists and collaborative note-taking. The application features real-time updates, checkbox lists, note sharing, and a responsive design that works perfectly on both desktop and mobile devices.

## Quick Start (Recommended)

### Prerequisites
- Docker and Docker Compose installed on your server
- Port 5009 available (or modify the port in docker-compose.yml)

### 1. Deploy with Docker Compose

```bash
# Navigate to the application directory
cd FridgeNotesfridge-notes-deployment

# Start the application
docker-compose up -d

# Check if it's running
docker-compose ps
```

### 2. Access Your Application

Open your web browser and navigate to:
- **Local access**: http://localhost:5009
- **Network access**: http://YOUR_SERVER_IP:5009

### 3. Start Using

1. A default user will be created automatically on first access
2. Click "Create Note" to start
3. Choose "Checklist" for shopping lists
4. Add items and check them off as you shop
5. Share notes with family members using their username

## Features

### ✅ Perfect for Shopping Lists
- **Checkbox Lists**: Create interactive shopping lists with checkable items
- **Real-time Updates**: See changes instantly when family members add or check items
- **Mobile Friendly**: Works perfectly on phones for shopping on-the-go
- **Search**: Quickly find specific lists or items

### ✅ Collaboration Features
- **Note Sharing**: Share shopping lists with family members
- **Live Updates**: See changes in real-time as others edit
- **User Management**: Multiple users can access and collaborate
- **Access Levels**: Share with read-only or edit permissions

### ✅ Additional Features
- **Text Notes**: Support for regular notes alongside checklists
- **Archive**: Archive old lists to keep workspace clean
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Self-Hosted**: Complete control over your data

## Architecture

### Backend
- **Framework**: Flask with Flask-SocketIO for real-time features
- **Database**: SQLite (easily upgradeable to PostgreSQL)
- **API**: RESTful API with WebSocket support
- **Authentication**: User-based system with sharing capabilities

### Frontend
- **Framework**: React with modern hooks
- **Styling**: Tailwind CSS with shadcn/ui components
- **Real-time**: Socket.io client for live updates
- **Design**: Clean, intuitive interface

## Configuration Options

### Port Configuration

To change the default port (5009), edit `docker-compose.yml`:

```yaml
services:
  FridgeNotesfridge-notes:
    ports:
      - "8080:5009"  # Change 8080 to your desired port
```

### Database Upgrade

For production with many users, consider upgrading to PostgreSQL:

1. Add PostgreSQL service to docker-compose.yml
2. Update the database URL in src/main.py
3. Install psycopg2 in requirements.txt

### Environment Variables

Available environment variables:

- `FLASK_ENV`: Set to `production` for production deployment
- `PYTHONPATH`: Application path (set automatically in Docker)

## Data Management

### Backup Your Data

```bash
# Create a backup of your notes
docker-compose exec FridgeNotesfridge-notes cp /app/src/database/app.db /tmp/backup.db
docker cp $(docker-compose ps -q FridgeNotesfridge-notes):/tmp/backup.db ./notes-backup-$(date +%Y%m%d).db
```

### Restore Data

```bash
# Stop the application
docker-compose down

# Replace the database file
cp your-backup.db ./data/app.db

# Start the application
docker-compose up -d
```

## Troubleshooting

### Common Issues

**1. Port Already in Use**
```bash
# Check what's using port 5009
sudo lsof -i :5009

# Either stop the conflicting service or change the port in docker-compose.yml
```

**2. Permission Issues**
```bash
# Fix data directory permissions
sudo chown -R $USER:$USER ./data
```

**3. Application Won't Start**
```bash
# Check logs
docker-compose logs -f FridgeNotesfridge-notes

# Rebuild if needed
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

**4. WebSocket Connection Issues**
- Ensure your firewall allows the configured port
- Check that your reverse proxy (if used) supports WebSocket upgrades

### Logs and Monitoring

```bash
# View application logs
docker-compose logs -f FridgeNotesfridge-notes

# Monitor resource usage
docker stats $(docker-compose ps -q FridgeNotesfridge-notes)
```

## Security Considerations

### For Production Deployment

1. **Use HTTPS**: Set up SSL/TLS with a reverse proxy (nginx/Apache)
2. **Firewall**: Only expose necessary ports
3. **Updates**: Regularly update the Docker images
4. **Backups**: Implement automated backup strategy
5. **Access Control**: Consider adding authentication if needed

### Reverse Proxy Example (nginx)

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:5009;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Advanced Usage

### Multiple Instances

To run multiple instances (e.g., for different families):

```bash
# Copy the deployment directory
cp -r FridgeNotesfridge-notes-deployment family2-notes

# Edit docker-compose.yml to use different ports
# Start the second instance
cd family2-notes
docker-compose up -d
```

### Custom Styling

To customize the appearance:

1. Modify the CSS in `src/static/assets/`
2. Rebuild the Docker image
3. Restart the application

## Support and Maintenance

### Regular Maintenance

```bash
# Update and restart (preserves data)
docker-compose pull
docker-compose up -d

# Clean up old images
docker image prune
```

### Performance Optimization

For better performance with many users:

1. Upgrade to PostgreSQL database
2. Use a production WSGI server (gunicorn)
3. Implement Redis for session management
4. Add nginx for static file serving

## API Documentation

The application provides a REST API for integration:

### User Management
- `GET /api/users` - List users
- `POST /api/users` - Create user

### Notes Management
- `GET /api/notes?user_id={id}` - Get user's notes
- `POST /api/notes` - Create note
- `PUT /api/notes/{id}` - Update note
- `DELETE /api/notes/{id}` - Delete note

### Sharing
- `POST /api/notes/{id}/share` - Share note with user

### WebSocket Events
- `join_note` - Join note for real-time updates
- `leave_note` - Leave note room
- `note_updated` - Note change broadcast
- `checklist_item_toggled` - Checkbox change broadcast

## Conclusion

Your FridgeNotes is now ready for production use! This self-hosted solution gives you complete control over your family's shopping lists and notes while providing convenience and powerful collaboration features.

For questions or issues, refer to the troubleshooting section or check the application logs for detailed error information.


## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Port 5009 available (or modify in docker-compose.yml)

### 1. Deploy with Docker Compose

```bash
# Clone or navigate to your project directory
cd FridgeNotesfridge-notes

# Start the application
docker-compose up -d

# Check the logs for admin credentials
docker-compose logs FridgeNotesfridge-notes
```

### 2. Get Your Admin Credentials

On first startup, the application will create an admin user with a randomly generated secure password. Look for this in the Docker logs:

```
🔐 FridgeNotes - INITIAL ADMIN ACCOUNT CREATED
📧 Username: admin
🔑 Password: Abc123XyZ9
⚠️  IMPORTANT: Save this password! It will not be shown again.
```

**Important**: Copy this password immediately - it will only be displayed once!

### 3. Access Your Application

1. Open your browser and go to: `http://localhost:5009`
2. Click "Sign In" 
3. Use username: `admin` and the generated password from the logs
4. Change your password in the user profile settings
5. Create additional users through the admin panel

### 4. Create Additional Users

As the admin user:
1. Click on your profile menu
2. Select "Admin Panel"
3. Go to the "Users" tab
4. Click "Create User" to add family members or additional users

## 🔒 Security Features

### First-Time Setup Security
- **No default passwords** - Each installation gets a unique admin password
- **Secure password generation** - 10-character random passwords with mixed case and numbers
- **One-time display** - Admin password shown only once in startup logs
- **Immediate password change** - Admin can change password after first login

### User Management
- **Admin-controlled user creation** - Only admins can create new users
- **Secure password requirements** - Minimum 6 characters for user passwords
- **Session management** - Secure login sessions with configurable duration
- **Account deactivation** - Admins can deactivate users without deleting data

## 📋 Getting Your Admin Password

If you missed the admin password in the logs, you can retrieve it by checking the Docker logs:

```bash
# View recent logs
docker-compose logs FridgeNotesfridge-notes | grep "Password:"

# Or view all startup logs
docker-compose logs FridgeNotesfridge-notes
```

If you've lost the admin password completely, you can reset the database (⚠️ this will delete all data):

```bash
# Stop the container
docker-compose down

# Remove the database volume (WARNING: deletes all data!)
docker volume rm FridgeNotesfridge-notes_app-data

# Start again (will create new admin with new password)
docker-compose up -d
```
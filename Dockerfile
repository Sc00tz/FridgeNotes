# Multi-stage build: Frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app

# Copy frontend package files
COPY fridgenotes-frontend/package*.json ./fridgenotes-frontend/
RUN cd fridgenotes-frontend && npm ci

# Copy frontend source and build
COPY fridgenotes-frontend/ ./fridgenotes-frontend/
COPY src/ ./src/
RUN cd fridgenotes-frontend && npm run build

# Backend Dockerfile
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
# - gcc: build native Python deps
# - curl: used by the container HEALTHCHECK
# - gosu: drop from root to the app user in the entrypoint after fixing volume perms
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    gosu \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY src/ ./src/

# Copy built frontend from frontend-builder stage
COPY --from=frontend-builder /app/src/static/ ./src/static/

# Create a non-root user to run the application and the database directory it owns
RUN useradd --create-home --uid 1000 appuser \
    && mkdir -p src/database \
    && chown -R appuser:appuser /app

# Entrypoint fixes ownership of the (possibly bind-mounted) database volume,
# then drops privileges to appuser before exec'ing the app.
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose port
EXPOSE 5009

# Set environment variables for better logging
ENV FLASK_APP=src/main.py
ENV FLASK_ENV=production
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV PYTHONIOENCODING=UTF-8
# Use the system DNS resolver instead of eventlet's green resolver, which can
# time out under the gunicorn eventlet worker and break outbound calls (e.g. the
# Nominatim geocoding proxy). Must be set before eventlet monkey-patches.
ENV EVENTLET_NO_GREENDNS=yes

# Verify the app is serving before marking the container healthy
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:5009/api/health || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]

# Serve with gunicorn's eventlet worker (required for Flask-SocketIO). A single
# worker is used because real-time broadcasts share in-process state; scaling out
# would require a message queue (e.g. Redis) configured in websocket_events.py.
CMD ["gunicorn", "--worker-class", "eventlet", "--workers", "1", \
     "--bind", "0.0.0.0:5009", "--access-logfile", "-", "src.main:app"]
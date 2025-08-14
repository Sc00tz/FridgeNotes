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
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY src/ ./src/

# Copy built frontend from frontend-builder stage  
COPY --from=frontend-builder /app/src/static/ ./src/static/

# Create database directory
RUN mkdir -p src/database

# Expose port
EXPOSE 5009

# Set environment variables for better logging
ENV FLASK_APP=src/main.py
ENV FLASK_ENV=production
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV PYTHONIOENCODING=UTF-8

# Run the application
CMD ["python", "-u", "src/main.py"]
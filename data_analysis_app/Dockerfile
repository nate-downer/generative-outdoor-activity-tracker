# Multi-stage Dockerfile for Generative Outdoor Activity Tracker
# Stage 1: Build frontend with Node.js
# Stage 2: Run backend with Python and serve built frontend

# ============================================================================
# Stage 1: Frontend Build
# ============================================================================
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files for dependency installation
COPY frontend/package.json frontend/package-lock.json ./

# Install dependencies
# Note: Using 'npm install' instead of 'npm ci' because package-lock.json
# may be out of sync after manual package.json edits
RUN npm install

# Copy frontend source code
COPY frontend/ ./

# Build frontend with production API URL (relative path for same-origin)
ENV VITE_API_BASE_URL=/api
RUN npm run build

# Output is in /app/frontend/dist

# ============================================================================
# Stage 2: Python Backend + Static Frontend
# ============================================================================
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies needed for building Python packages
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements
COPY backend/requirements.txt /app/backend/requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy backend source code
COPY backend/ /app/backend/

# Copy built frontend from Stage 1
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Create mount point for persistent data (database + model traces)
RUN mkdir -p /data

# Set working directory to backend for uvicorn
WORKDIR /app/backend

# Expose port 8000 for the FastAPI application
EXPOSE 8000

# Health check (optional but recommended)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health')" || exit 1

# Run the FastAPI application
# --host 0.0.0.0 makes it accessible from outside the container
# --port 8000 matches the EXPOSE directive
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

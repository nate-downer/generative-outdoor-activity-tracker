"""Main FastAPI application."""
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.middleware.sessions import SessionMiddleware
from .database import engine, Base
from .api import activities, auth, gpx, points, segments, model_fitting, predictions

# Create database tables
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(
    title="Garmin Data Analysis API",
    description="API for analyzing GPS trace data from Garmin activities",
    version="0.1.0"
)

# Configure CORS for frontend access
# In development: localhost origins
# In production: can be same origin (single service) or configured via env var
allowed_origins = os.environ.get(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Signed httpOnly session cookie (Milestone 1.0 phase 2 - admin login). SECRET_KEY
# should be set via the environment in any real deployment; the fallback here is
# only for local dev convenience.
app.add_middleware(
    SessionMiddleware,
    secret_key=os.environ.get("SECRET_KEY", "dev-only-insecure-secret-key"),
    same_site="lax",
)

# Include routers
app.include_router(activities.router, prefix="/api", tags=["activities"])
app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(gpx.router, prefix="/api/gpx", tags=["gpx"])
app.include_router(points.router, prefix="/api", tags=["points"])
app.include_router(segments.router, prefix="/api", tags=["segments"])
app.include_router(model_fitting.router, prefix="/api", tags=["models"])
app.include_router(predictions.router, prefix="/api", tags=["predictions"])


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


# Serve frontend static files (production only)
# In production, the frontend dist/ is copied into the container at build time
# In development, the frontend runs separately on Vite dev server
frontend_dist = Path(__file__).parent.parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    # Mount static assets (JS, CSS, images) at their original paths
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")

    # Serve demo images (landing page screenshots)
    demo_images_dir = frontend_dist / "demo_images"
    if demo_images_dir.exists():
        app.mount("/demo_images", StaticFiles(directory=str(demo_images_dir)), name="demo_images")

    # Catch-all: serve index.html for any non-API route (enables SPA routing)
    # This must be defined LAST so it doesn't override other routes
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve the React SPA for all non-API routes."""
        # Don't serve index.html for API routes or static assets
        if full_path.startswith("api/") or full_path.startswith("assets/") or full_path.startswith("demo_images/"):
            raise HTTPException(status_code=404)

        # For health check, let the explicit route above handle it
        if full_path == "health":
            raise HTTPException(status_code=404)

        index_file = frontend_dist / "index.html"
        if not index_file.exists():
            raise HTTPException(status_code=404)

        return FileResponse(str(index_file))

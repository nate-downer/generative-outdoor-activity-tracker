# Generative Outdoor Activity Tracker

A full-stack web application for analyzing GPS activity data and predicting completion times for future routes using hierarchical Bayesian models.

## What It Does

This app helps outdoor enthusiasts understand their performance and plan future activities by:

1. **Importing & Cleaning GPS Data** - Upload GPX files, manually edit GPS traces to remove errors, and add detailed metadata
2. **Automated Segmentation** - Automatically identifies rest periods and activity segments, with tools to refine segments manually
3. **Comparative Analysis** - Visualize patterns across all your activities: elevation profiles, speed distributions, power output, and more
4. **Predictive Modeling** - Fits hierarchical Bayesian models (using PyMC/numpyro) to predict completion times for new routes based on terrain, elevation, pack weight, experience level, and other factors
5. **Route Planning** - Upload planned routes and get time predictions with confidence intervals, accounting for cumulative fatigue and rest needs

## Key Features

### Activity Management
- GPS trace editing with interactive map interface
- Timezone-aware activity times
- Public/private activity visibility controls
- Support for both completed activities and planned routes

### Intelligent Segmentation
- Automated detection of rest periods and active segments
- Manual segment splitting, merging, and boundary adjustment
- Technical vs. non-technical terrain classification
- Pandolf equation integration for energy expenditure calculations

### Analysis & Visualization
- Activity-level and segment-level comparative analysis
- Elevation profiles, power output, and speed distributions
- Top performers by distance, elevation gain, and climb rate
- Interactive plots with dynamic scaling

### Predictive Modeling
- Hierarchical Bayesian models with separate components for:
  - Technical climbing segments
  - Non-technical climbs
  - Flat terrain
  - Descents
  - Rest time prediction
- Accounts for:
  - Pack weight and body weight
  - Terrain type and grade
  - Party size
  - Route familiarity
  - Time of day effects
  - Cumulative distance and elevation
- Model diagnostics and variance explained visualizations

### Multi-User Architecture
- **Viewer Mode** - Public read-only access to shared activities and live route predictions
- **Admin Mode** - Full editing, model fitting, and data management (password-protected)
- Foundation for future client-level user accounts

## Tech Stack

**Backend:**
- FastAPI (Python)
- SQLAlchemy with SQLite
- PyMC/numpyro for Bayesian modeling
- JAX for numerical computation
- GPX parsing and timezone handling

**Frontend:**
- React + TypeScript
- Vite build system
- Leaflet for interactive mapping
- Recharts for data visualization
- React Router for navigation

**Deployment:**
- Single-service architecture (FastAPI serves both API and static frontend)
- Designed for Render.com or similar PaaS hosting
- Persistent volume for SQLite database and model traces

## Local Development Setup

### Prerequisites
- Python 3.9+ (with pip and venv)
- Node.js 16+ and npm
- Git

### Backend Setup

```bash
cd data_analysis_app/backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Seed the database (first time only)
python seed_data.py

# Set up admin user (first time only)
python seed_admin_user.py your-email@example.com
python set_admin_password.py your-password

# Run the development server
uvicorn app.main:app --reload
```

Backend will be available at `http://localhost:8000`

### Frontend Setup

```bash
cd data_analysis_app/frontend

# Install dependencies
npm install

# Run the development server
npm run dev
```

Frontend will be available at `http://localhost:5173`

### Project Structure

```
data_analysis_app/
├── backend/
│   ├── app/
│   │   ├── api/              # API route handlers
│   │   ├── modeling/         # Bayesian models and predictions
│   │   ├── services/         # Business logic (GPS parsing, calculations)
│   │   ├── auth.py           # Authentication middleware
│   │   ├── database.py       # SQLAlchemy configuration
│   │   ├── models.py         # Database models
│   │   ├── schemas.py        # Pydantic schemas
│   │   └── main.py           # FastAPI app entry point
│   ├── requirements.txt
│   └── seed_*.py             # Database seeding scripts
├── frontend/
│   ├── src/
│   │   ├── components/       # Reusable React components
│   │   ├── pages/            # Page-level components
│   │   ├── contexts/         # React context providers
│   │   └── App.tsx           # Main app component
│   ├── package.json
│   └── vite.config.ts
└── project_files/            # Planning and documentation
    ├── to_do_list.md
    ├── hosting_plan.md
    └── deployment_process.md
```

## Deployment

See [deployment_process.md](data_analysis_app/project_files/deployment_process.md) for detailed deployment instructions, including:
- Dockerfile configuration
- Render.com setup
- Persistent volume configuration
- Database migration
- Environment variables

## Data Model

The app uses a relational structure with:
- **Users** - Authentication and role-based access
- **Activities** - Top-level GPS traces (completed or planned routes)
- **Points** - Individual GPS coordinates with timestamp, elevation, speed
- **Segments** - Classified portions of activities (climbs, descents, rests) with calculated metrics
- **Model traces** - Stored PyMC inference results for time predictions

## Current Status

**Version:** 0.9 (pre-release)

The app is feature-complete for personal use with admin login and public viewer mode. Next milestone (1.1) will add support for multiple client-level user accounts with individual data and personalized models.

See [to_do_list.md](data_analysis_app/project_files/to_do_list.md) for detailed roadmap and completed milestones.

## License

This project is licensed under the PolyForm Noncommercial License 1.0.0 - see the [LICENSE](LICENSE) file for details.

**Copyright © 2026 Nate Downer**

## Acknowledgments

- Built with Claude Code (Anthropic)
- Map data © OpenStreetMap contributors
- GPX parsing powered by gpxpy
- Bayesian modeling using PyMC and numpyro

---

**Note:** This is a personal project for outdoor activity analysis. GPS data shown in public viewer mode represents real personal activity data. If deploying your own instance, review privacy settings and ensure appropriate data handling for your use case.

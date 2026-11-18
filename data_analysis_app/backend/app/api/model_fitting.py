"""Endpoints for fitting and reading the hierarchical time-prediction models."""
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from pydantic import BaseModel

from .. import models
from ..auth import require_admin
from ..database import SessionLocal
from ..modeling.fit_runner import (
    get_fit_status,
    list_runs,
    load_run_diagnostics,
    run_fit,
    archive_run,
    unarchive_run,
)

router = APIRouter()


class FitRequest(BaseModel):
    # Optional nickname for this model run
    model_nickname: Optional[str] = None

    # Transfer learning: use a previous run's posterior as this run's prior
    prior_run_id: Optional[str] = None
    prior_strength: Optional[float] = None

    # Explicit activity selection for training and validation
    training_activity_ids: List[str] = []
    validation_activity_ids: List[str] = []

    # Legacy parameter (deprecated, use training_activity_ids instead)
    n_recent_activities: Optional[int] = None


@router.post("/models/fit")
def fit_models(
    background_tasks: BackgroundTasks,
    request: FitRequest = FitRequest(),
    _admin: models.User = Depends(require_admin),
):
    """Kick off fitting in the background. Only one fit runs at a time."""
    status = get_fit_status()
    if status["state"] == "running":
        return {"status": "already_running"}

    background_tasks.add_task(
        run_fit,
        SessionLocal,
        model_nickname=request.model_nickname,
        prior_run_id=request.prior_run_id,
        prior_strength=request.prior_strength,
        training_activity_ids=request.training_activity_ids,
        validation_activity_ids=request.validation_activity_ids,
        n_recent_activities=request.n_recent_activities,  # Legacy support
    )
    return {"status": "started"}


@router.get("/models/fit-status")
def fit_status():
    """Current fit progress, polled by the frontend to drive the progress bar."""
    return get_fit_status()


@router.get("/models/runs")
def model_runs(include_archived: bool = False):
    """
    Historical fit runs (run_id, created_at, n_activities_total, rmse_pct per model), newest first.

    Args:
        include_archived: If True, include archived runs. Default False.
    """
    return list_runs(include_archived=include_archived)


@router.get("/models/runs/{run_id}/diagnostics")
def model_run_diagnostics(run_id: str):
    """Variance-explained and predicted-vs-actual data for each of the 6 model groups, for one run."""
    diagnostics = load_run_diagnostics(run_id)
    if diagnostics is None:
        raise HTTPException(status_code=404, detail="Run not found.")
    return diagnostics


@router.patch("/models/runs/{run_id}/archive")
def archive_model_run(run_id: str, _admin: models.User = Depends(require_admin)):
    """Archive a model run (hides it from default list view)."""
    if not archive_run(run_id):
        raise HTTPException(status_code=404, detail="Run not found.")
    return {"status": "archived"}


@router.patch("/models/runs/{run_id}/unarchive")
def unarchive_model_run(run_id: str, _admin: models.User = Depends(require_admin)):
    """Unarchive a model run (makes it visible again)."""
    if not unarchive_run(run_id):
        raise HTTPException(status_code=404, detail="Run not found.")
    return {"status": "unarchived"}

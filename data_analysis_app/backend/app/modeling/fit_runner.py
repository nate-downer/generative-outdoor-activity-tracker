"""Orchestrates fitting all time-prediction models as a background task with progress
reporting, and persists each fit as a distinct historical run so past fits can be
browsed and compared rather than overwritten.
"""
import json
import os
import threading
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import arviz as az
import numpy as np
import pandas as pd

from .data import extract_locomotion_dataframe, extract_rest_dataframe
from .locomotion_model import SEGMENT_TYPES, EFFORT_SEGMENT_TYPES, build_and_fit_pooled_model
from .rest_model import build_and_fit_rest_model
from .diagnostics import pooled_diagnostics, rest_diagnostics
from .diagnostics_parameters import locomotion_parameter_diagnostics, rest_parameter_diagnostics

# Configurable trace directory for persistent storage on mounted volumes
# In production: set TRACE_DIR=/data/traces to use persistent disk
# In development: defaults to local traces/ directory
TRACE_DIR = Path(os.environ.get("TRACE_DIR", str(Path(__file__).resolve().parent / "traces")))
TRACE_DIR.mkdir(exist_ok=True, parents=True)

RUNS_DIR = TRACE_DIR / "runs"
RUNS_DIR.mkdir(exist_ok=True)

# Empirically-fitted Lorentz curve parameters for slope-speed relationship
# Fitted from GPS segment speed data using fit_lorentz_params.py
# See: Campbell et al. research on hiking speed vs. slope
LORENTZ_PARAMS = {
    "A": 1.0479,      # Peak speed at optimal slope (m/s)
    "slope0": -1.308,  # Optimal slope angle (degrees) - slight downhill
    "gamma": 11.806    # Sensitivity parameter (degrees) - curve width
}

RUNS_INDEX_PATH = TRACE_DIR / "runs_index.json"

MODEL_GROUPS = SEGMENT_TYPES + ["rest"]

FIT_STEPS = [
    "Extracting segment data",
    "Fitting pooled locomotion model",
    "Fitting rest-time model",
    "Computing diagnostics",
    "Saving results",
]

_status_lock = threading.Lock()
_status = {
    "state": "idle",  # idle | running | done | error
    "step_index": -1,
    "step_label": None,
    "total_steps": len(FIT_STEPS),
    "error": None,
    "updated_at": None,
    "run_id": None,
}


def get_fit_status() -> dict:
    with _status_lock:
        return dict(_status)


def _set_status(**kwargs) -> None:
    with _status_lock:
        _status.update(kwargs)
        _status["updated_at"] = datetime.utcnow().isoformat()


def _set_step(step_index: int) -> None:
    _set_status(state="running", step_index=step_index, step_label=FIT_STEPS[step_index])


def _new_run_id() -> str:
    base = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    run_id = base
    suffix = 1
    while (RUNS_DIR / run_id).exists():
        suffix += 1
        run_id = f"{base}_{suffix}"
    return run_id


def _run_dir(run_id: str) -> Path:
    return RUNS_DIR / run_id


def _read_runs_index() -> List[dict]:
    if not RUNS_INDEX_PATH.exists():
        return []
    return json.loads(RUNS_INDEX_PATH.read_text())


def _append_run_index_entry(entry: dict) -> None:
    runs = _read_runs_index()
    runs.append(entry)
    RUNS_INDEX_PATH.write_text(json.dumps(runs))


def list_runs(include_archived: bool = False) -> List[dict]:
    """
    Run summaries (run_id, created_at, n_activities_total, rmse_pct per model), newest first.

    Args:
        include_archived: If True, include archived runs. If False, exclude them.
    """
    runs = _read_runs_index()
    for run in runs:
        run["is_predictable"] = (_run_dir(run["run_id"]) / "metadata.json").exists()
        # Ensure is_archived field exists (default to False for old runs)
        if "is_archived" not in run:
            run["is_archived"] = False

    # Filter out archived runs unless requested
    if not include_archived:
        runs = [r for r in runs if not r.get("is_archived", False)]

    return sorted(runs, key=lambda r: r["created_at"], reverse=True)


def archive_run(run_id: str) -> bool:
    """
    Archive a model run. Archived runs are hidden by default in list_runs().

    Returns:
        True if the run was archived, False if not found.
    """
    runs = _read_runs_index()
    for run in runs:
        if run["run_id"] == run_id:
            run["is_archived"] = True
            RUNS_INDEX_PATH.write_text(json.dumps(runs))
            return True
    return False


def unarchive_run(run_id: str) -> bool:
    """
    Unarchive a model run, making it visible again in list_runs().

    Returns:
        True if the run was unarchived, False if not found.
    """
    runs = _read_runs_index()
    for run in runs:
        if run["run_id"] == run_id:
            run["is_archived"] = False
            RUNS_INDEX_PATH.write_text(json.dumps(runs))
            return True
    return False


def load_run_diagnostics(run_id: str) -> Optional[dict]:
    path = _run_dir(run_id) / "diagnostics.json"
    if not path.exists():
        return None
    return json.loads(path.read_text())


def load_run_metadata(run_id: str) -> Optional[dict]:
    path = _run_dir(run_id) / "metadata.json"
    if not path.exists():
        return None
    return json.loads(path.read_text())


def run_dir(run_id: str) -> Path:
    """Public accessor for a run's directory (traces live here)."""
    return _run_dir(run_id)


def run_fit(
    db_session_factory,
    model_nickname: Optional[str] = None,
    prior_run_id: Optional[str] = None,
    prior_strength: Optional[float] = None,
    training_activity_ids: Optional[List[str]] = None,
    validation_activity_ids: Optional[List[str]] = None,
    n_recent_activities: Optional[int] = None,  # Legacy parameter
) -> None:
    """
    Fit all time-prediction models and persist results as a new historical run.

    The 5 locomotion segment types are fit together in one pooled hierarchical model
    (see locomotion_model.py) - this is safe to pool now that "effort" is a
    deterministic feature rather than a latent variable, which is what caused the
    earlier pooled attempt's hard-to-sample funnel.

    Runs inside a FastAPI background task, so it takes a session factory (not a live
    Session) since the request that triggered it may have already returned.

    Parameters:
    - `model_nickname`: Optional name for this model run
    - `prior_run_id`: Use posterior from this run as priors (transfer learning)
    - `prior_strength`: How much weight to give priors (0=ignore, 1=one observation, 2+=strong)
    - `training_activity_ids`: Explicit list of activity IDs to train on
    - `validation_activity_ids`: Activity IDs to hold out for validation
    - `n_recent_activities`: (Legacy) Restrict to N most recent activities
    """
    with _status_lock:
        if _status["state"] == "running":
            return
    run_id = _new_run_id()
    _set_status(state="running", step_index=-1, step_label=None, error=None, run_id=run_id)

    db = db_session_factory()
    try:
        _set_step(0)
        # Extract data for BOTH training and validation activities
        # (validation activities are included in diagnostics but excluded from fitting)
        all_activity_ids = None
        if training_activity_ids or validation_activity_ids:
            training_set = set(training_activity_ids) if training_activity_ids else set()
            validation_set = set(validation_activity_ids) if validation_activity_ids else set()
            all_activity_ids = list(training_set | validation_set)

        loco_df = extract_locomotion_dataframe(
            db,
            n_recent_activities=n_recent_activities,
            activity_ids=all_activity_ids,
            lorentz_params=LORENTZ_PARAMS
        )
        rest_df = extract_rest_dataframe(db, n_recent_activities=n_recent_activities, activity_ids=all_activity_ids)

        if loco_df.empty or rest_df.empty:
            raise ValueError("Not enough segment data to fit models.")

        activity_ids = set(loco_df["activity_id"]) | set(rest_df["activity_id"])

        # Slope-based features (log_distance, slope_squared) are now computed in
        # extract_locomotion_dataframe() - no calibration step needed

        _set_step(1)
        # Filter to training data only for model fitting
        # Validation data will be appended for diagnostics
        validation_ids_set = set(validation_activity_ids) if validation_activity_ids else set()

        if validation_ids_set:
            # Fit on training data only (true out-of-sample)
            loco_train = loco_df[~loco_df["activity_id"].isin(validation_ids_set)].copy().reset_index(drop=True)
        else:
            loco_train = loco_df.copy()

        # Use 4 chains for better convergence diagnostics (rhat)
        # Memory usage is fine (~80%), so we can use the full configuration
        loco_fit = build_and_fit_pooled_model(
            loco_train,
            draws=1000,
            tune=1000,
            chains=4,
            lorentz_params=LORENTZ_PARAMS
        )

        # For diagnostics: append validation data to compute out-of-sample predictions
        # The standardization params from training will be used for validation too
        if validation_ids_set and not loco_df[loco_df["activity_id"].isin(validation_ids_set)].empty:
            loco_fit["df"] = pd.concat([loco_train, loco_df[loco_df["activity_id"].isin(validation_ids_set)]], ignore_index=True)

            # Recompute index arrays for the combined training+validation DataFrame
            # (SEGMENT_TYPES and EFFORT_SEGMENT_TYPES are already imported at module level)
            type_to_idx = {t: i for i, t in enumerate(SEGMENT_TYPES)}
            loco_fit["type_idx"] = loco_fit["df"]["segment_type_5"].map(type_to_idx).to_numpy()
            loco_fit["is_effort_eligible"] = loco_fit["df"]["segment_type_5"].isin(EFFORT_SEGMENT_TYPES).to_numpy().astype(float)

            # Keep the original training activity_index_map - don't create new indices
            # Validation activities should ideally be from the same activities seen in training
            # If a validation activity wasn't in training, fill with 0 (uses population mean)
            loco_fit["activity_idx"] = loco_fit["df"]["activity_id"].map(loco_fit["activity_index_map"]).fillna(0).astype(int).to_numpy()

            # Recompute covariate_matrix using training standardization stats
            # (apply training stats to validation data - no data leakage)
            covariate_cols = []
            for cov in loco_fit["used_covariates"]:
                std_vals = loco_fit["covariate_stats"][cov].transform(loco_fit["df"][cov].to_numpy())
                covariate_cols.append(std_vals)
            loco_fit["covariate_matrix"] = np.column_stack(covariate_cols) if covariate_cols else np.zeros((len(loco_fit["df"]), 0))

        # Pass validation IDs to mark validation points
        diagnostics = pooled_diagnostics(loco_fit, validation_ids_set)

        _set_step(2)
        # Fit rest model on training data only
        if validation_ids_set:
            rest_train = rest_df[~rest_df["activity_id"].isin(validation_ids_set)].copy().reset_index(drop=True)
        else:
            rest_train = rest_df.copy()

        rest_fit = build_and_fit_rest_model(rest_train, draws=1000, tune=1000, chains=4)

        # Append validation data for diagnostics
        if validation_ids_set and not rest_df[rest_df["activity_id"].isin(validation_ids_set)].empty:
            rest_fit["df"] = pd.concat([rest_train, rest_df[rest_df["activity_id"].isin(validation_ids_set)]], ignore_index=True)

            # Recompute covariate_matrix using training standardization stats
            covariate_cols = []
            for cov in rest_fit["used_covariates"]:
                std_vals = rest_fit["covariate_stats"][cov].transform(rest_fit["df"][cov].to_numpy())
                covariate_cols.append(std_vals)
            rest_fit["covariate_matrix"] = np.column_stack(covariate_cols) if covariate_cols else np.zeros((len(rest_fit["df"]), 0))

        _set_step(3)
        diagnostics.update(rest_diagnostics(rest_fit, validation_ids_set))

        # Extract parameter summaries and convergence diagnostics
        loco_params = locomotion_parameter_diagnostics(loco_fit["idata"])
        rest_params = rest_parameter_diagnostics(rest_fit["idata"])

        # Add parameter diagnostics to each model group
        diagnostics["_locomotion_parameters"] = loco_params
        diagnostics["_rest_parameters"] = rest_params

        _set_step(4)
        run_dir = _run_dir(run_id)
        run_dir.mkdir(parents=True, exist_ok=True)
        az.to_netcdf(loco_fit["idata"], str(run_dir / "locomotion_trace.nc"))
        az.to_netcdf(rest_fit["idata"], str(run_dir / "rest_trace.nc"))
        (run_dir / "diagnostics.json").write_text(json.dumps(diagnostics))

        # Standardization stats + covariate bookkeeping needed to score NEW (unseen)
        # data later - these only exist in-memory during a fit otherwise, and
        # predicting against a historical run requires them in a later session.
        metadata = {
            "locomotion": {
                "segment_types": SEGMENT_TYPES,
                "distance_slope_segment_types": EFFORT_SEGMENT_TYPES,  # Keep same 3 types, renamed
                "used_covariates": loco_fit["used_covariates"],
                "log_distance_stats": vars(loco_fit["log_distance_stats"]),
                "lorentz_stats": vars(loco_fit["lorentz_stats"]),
                "lorentz_params": loco_fit["lorentz_params"],
                "covariate_stats": {cov: vars(stats) for cov, stats in loco_fit["covariate_stats"].items()},
            },
            "rest": {
                "used_covariates": rest_fit["used_covariates"],
                "distance_stats": vars(rest_fit["distance_stats"]),
                "elevation_stats": vars(rest_fit["elevation_stats"]),
                "covariate_stats": {cov: vars(stats) for cov, stats in rest_fit["covariate_stats"].items()},
            },
        }
        (run_dir / "metadata.json").write_text(json.dumps(metadata))

        rmse_pct = {
            group: diagnostics[group]["rmse_pct_of_mean"]
            for group in MODEL_GROUPS
            if group in diagnostics
        }
        _append_run_index_entry({
            "run_id": run_id,
            "created_at": datetime.utcnow().isoformat(),
            "model_nickname": model_nickname,
            "n_activities_total": len(activity_ids),
            "n_recent_activities_filter": n_recent_activities,
            "prior_run_id": prior_run_id,
            "prior_strength": prior_strength,
            "n_training_activities": len(training_activity_ids) if training_activity_ids else len(activity_ids),
            "n_validation_activities": len(validation_activity_ids) if validation_activity_ids else 0,
            "rmse_pct": rmse_pct,
            "is_archived": False,
        })

        _set_status(state="done", step_index=len(FIT_STEPS), step_label="Done")
    except Exception as exc:  # noqa: BLE001 - surface any fitting error to the UI
        _set_status(state="error", error=str(exc))
    finally:
        db.close()

"""Extract parameter summaries and convergence diagnostics from PyMC traces."""
import arviz as az
import numpy as np


def extract_parameter_summary(idata, param_name: str, description: str = None) -> dict:
    """
    Extract summary statistics and convergence diagnostics for a single parameter.

    Returns a dictionary with mean, median, HDI, ESS, and R-hat.
    """
    if param_name not in idata.posterior:
        return None

    # Get ArviZ summary for this parameter (include all stats and diagnostics)
    summary = az.summary(
        idata.posterior[[param_name]],
        hdi_prob=0.9
    )

    # Handle multi-dimensional parameters by averaging or taking first element
    if len(summary) > 1:
        # For arrays like alpha_type, beta_type, etc., return summary for each element
        rows = []
        for idx in range(len(summary)):
            row = summary.iloc[idx]
            rows.append({
                "index": idx,
                "mean": float(row["mean"]),
                "sd": float(row["sd"]),
                "hdi_5": float(row["hdi_5%"]),
                "hdi_95": float(row["hdi_95%"]),
                "ess_bulk": float(row["ess_bulk"]),
                "ess_tail": float(row["ess_tail"]),
                "r_hat": float(row["r_hat"]),
            })
        return {
            "parameter": param_name,
            "description": description or param_name,
            "is_array": True,
            "elements": rows,
        }
    else:
        # Scalar parameter
        row = summary.iloc[0]
        return {
            "parameter": param_name,
            "description": description or param_name,
            "is_array": False,
            "mean": float(row["mean"]),
            "sd": float(row["sd"]),
            "hdi_5": float(row["hdi_5%"]),
            "hdi_95": float(row["hdi_95%"]),
            "ess_bulk": float(row["ess_bulk"]),
            "ess_tail": float(row["ess_tail"]),
            "r_hat": float(row["r_hat"]),
        }


def locomotion_parameter_diagnostics(idata) -> dict:
    """
    Extract parameter summaries for the pooled locomotion model.

    Returns summaries for key parameters: hyperpriors, segment-type parameters,
    and convergence statistics.
    """
    parameters = []

    # Hyperpriors (priors on priors)
    hyperpriors = [
        ("mu_alpha", "Hyperprior: mean baseline pace"),
        ("sigma_alpha", "Hyperprior: variance in baseline pace across types"),
        ("mu_beta", "Hyperprior: mean effort elasticity"),
        ("sigma_beta", "Hyperprior: variance in effort elasticity across types"),
    ]

    for param_name, description in hyperpriors:
        summary = extract_parameter_summary(idata, param_name, description)
        if summary:
            parameters.append(summary)

    # Segment-type intercepts and slopes
    type_params = [
        ("alpha_type", "Baseline pace by segment type"),
        ("beta_type", "Effort elasticity by segment type"),
    ]

    for param_name, description in type_params:
        summary = extract_parameter_summary(idata, param_name, description)
        if summary:
            parameters.append(summary)

    # Variance parameters
    variance_params = [
        ("sigma_activity", "Activity-level random effect variance"),
        ("sigma_duration", "Residual variance (unexplained variation)"),
    ]

    for param_name, description in variance_params:
        summary = extract_parameter_summary(idata, param_name, description)
        if summary:
            parameters.append(summary)

    # Time-of-day harmonics
    tod_params = [
        ("tod_a1", "Time of day: 1st harmonic amplitude (sine)"),
        ("tod_b1", "Time of day: 1st harmonic amplitude (cosine)"),
        ("tod_a2", "Time of day: 2nd harmonic amplitude (sine)"),
        ("tod_b2", "Time of day: 2nd harmonic amplitude (cosine)"),
    ]

    for param_name, description in tod_params:
        summary = extract_parameter_summary(idata, param_name, description)
        if summary:
            parameters.append(summary)

    # Convergence summary - collect R-hat and ESS from all parameters (scalar and array)
    all_r_hats = []
    all_ess_bulks = []

    for p in parameters:
        if p.get("is_array"):
            # For array parameters, get worst R-hat and lowest ESS across elements
            if p.get("elements"):
                all_r_hats.extend([el["r_hat"] for el in p["elements"]])
                all_ess_bulks.extend([el["ess_bulk"] for el in p["elements"]])
        else:
            # Scalar parameter
            if "r_hat" in p:
                all_r_hats.append(p["r_hat"])
            if "ess_bulk" in p:
                all_ess_bulks.append(p["ess_bulk"])

    convergence = {
        "n_divergences": int(idata.sample_stats["diverging"].sum().values),
        "max_r_hat": float(max(all_r_hats)) if all_r_hats else 1.0,
        "min_ess_bulk": float(min(all_ess_bulks)) if all_ess_bulks else 0.0,
    }

    return {
        "parameters": parameters,
        "convergence": convergence,
    }


def rest_parameter_diagnostics(idata) -> dict:
    """Extract parameter summaries for the rest time model."""
    parameters = []

    rest_params = [
        ("alpha", "Intercept (baseline rest time)"),
        ("beta_distance", "Distance coefficient"),
        ("beta_elevation", "Elevation gain coefficient"),
        ("sigma", "Residual variance"),
    ]

    for param_name, description in rest_params:
        summary = extract_parameter_summary(idata, param_name, description)
        if summary:
            parameters.append(summary)

    # Handle gamma if it exists (covariates)
    if "gamma" in idata.posterior:
        summary = extract_parameter_summary(idata, "gamma", "Covariate coefficients")
        if summary:
            parameters.append(summary)

    # Convergence summary - collect R-hat and ESS from all parameters (scalar and array)
    all_r_hats = []
    all_ess_bulks = []

    for p in parameters:
        if p.get("is_array"):
            # For array parameters, get worst R-hat and lowest ESS across elements
            if p.get("elements"):
                all_r_hats.extend([el["r_hat"] for el in p["elements"]])
                all_ess_bulks.extend([el["ess_bulk"] for el in p["elements"]])
        else:
            # Scalar parameter
            if "r_hat" in p:
                all_r_hats.append(p["r_hat"])
            if "ess_bulk" in p:
                all_ess_bulks.append(p["ess_bulk"])

    convergence = {
        "n_divergences": int(idata.sample_stats["diverging"].sum().values),
        "max_r_hat": float(max(all_r_hats)) if all_r_hats else 1.0,
        "min_ess_bulk": float(min(all_ess_bulks)) if all_ess_bulks else 0.0,
    }

    return {
        "parameters": parameters,
        "convergence": convergence,
    }

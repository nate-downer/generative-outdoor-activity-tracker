"""Slope-based features for locomotion time prediction.

Replaces the old "effort" power-law approach with a physically-motivated
distance × f(slope) formulation inspired by Tobler's hiking function.

Tobler's function: speed = 6 * exp(-3.5 * |slope + 0.05|)

Our approach: Learn the slope response from data rather than hardcoding Tobler's
constants. This allows the model to discover the actual slope-time relationship
in the user's GPS data, which may differ from Tobler's average hiker due to
individual fitness, terrain type, or other factors.
"""
import numpy as np


def compute_slope(elevation_gain_ft, distance_mi):
    """Compute slope (grade) as elevation_gain / distance.

    Returns dimensionless slope (ft/mi). For typical hiking grades this ranges
    from about -1000 (steep descent) to +1000 (steep climb), with flat terrain
    near 0.

    Args:
        elevation_gain_ft: Elevation gain in feet (can be negative for descents)
        distance_mi: Horizontal distance in miles

    Returns:
        Slope as ft/mi (dimensionless ratio)
    """
    distance_mi = np.asarray(distance_mi, dtype=float)
    elevation_gain_ft = np.asarray(elevation_gain_ft, dtype=float)

    # Avoid division by zero for near-vertical segments (though technical
    # verticals don't use this formula anyway - they have their own
    # elevation_change_tech_* covariates)
    safe_distance = np.where(distance_mi > 1e-6, distance_mi, 1e-6)
    return elevation_gain_ft / safe_distance


def slope_squared(elevation_gain_ft, distance_mi):
    """Quadratic slope term: slope^2.

    Symmetric (uphill = downhill), simple to fit, good starting point.
    This models the intuition that steeper slopes (in either direction)
    slow you down more than proportionally to the grade itself.

    Args:
        elevation_gain_ft: Elevation gain in feet
        distance_mi: Horizontal distance in miles

    Returns:
        Squared slope (ft/mi)^2
    """
    slope = compute_slope(elevation_gain_ft, distance_mi)
    return slope ** 2


def slope_to_degrees(elevation_gain_ft, distance_mi):
    """Convert slope from ft/mi to degrees.

    Converts the slope (rise/run ratio) to an angle in degrees, which is more
    intuitive and matches the units used in hiking literature (e.g., Campbell et al.).

    Args:
        elevation_gain_ft: Elevation gain in feet (can be negative for descents)
        distance_mi: Horizontal distance in miles

    Returns:
        Slope in degrees (typically -20° to +20° for hiking terrain)
        Negative values indicate descent, positive indicate climb
    """
    slope_ft_mi = compute_slope(elevation_gain_ft, distance_mi)
    # Convert ft/mi to dimensionless rise/run (5280 ft per mile)
    rise_over_run = slope_ft_mi / 5280.0
    # Convert to degrees using arctangent
    return np.degrees(np.arctan(rise_over_run))


def lorentz_curve_term(elevation_gain_ft, distance_mi, A, slope0, gamma):
    """Compute Lorentz curve term for slope-speed relationship.

    Based on research by Campbell et al. showing that hiking speed follows a
    Lorentzian (Cauchy) distribution with respect to slope angle:

        speed = A / (1 + ((slope - slope0) / γ)²)

    Where:
        - A: Peak speed at optimal slope (m/s)
        - slope0: Optimal slope angle where speed is maximized (degrees)
        - γ: Sensitivity parameter controlling curve width (degrees)

    Since the model predicts time and time = distance / speed, we return the
    log of the denominator: log(1 + ((slope - slope0) / γ)²)

    This term represents the slowdown factor relative to optimal slope speed.
    When slope = slope0 (optimal), the term is log(1) = 0 (no slowdown).
    As slope deviates from optimal (steeper uphill or downhill), the term
    increases (more slowdown).

    Args:
        elevation_gain_ft: Elevation gain in feet (can be negative)
        distance_mi: Horizontal distance in miles
        A: Peak speed parameter (m/s), from empirical fit
        slope0: Optimal slope (degrees), from empirical fit
        gamma: Sensitivity parameter (degrees), from empirical fit

    Returns:
        Log of Lorentz denominator (dimensionless, log-space)
        Range: [0, ∞), with 0 at optimal slope, increasing for deviations
    """
    slope_deg = slope_to_degrees(elevation_gain_ft, distance_mi)
    lorentz_raw = 1.0 + ((slope_deg - slope0) / gamma) ** 2
    return np.log(lorentz_raw)

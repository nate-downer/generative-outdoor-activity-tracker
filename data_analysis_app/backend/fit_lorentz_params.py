#!/usr/bin/env python3
"""
Fit empirical Lorentz curve parameters from GPS segment speed data.

This script extracts all historical GPS segments, computes slope (degrees) and speed (m/s),
then fits the Lorentz curve: speed = A / (1 + ((slope - slope0) / gamma)²)

The fitted parameters (A, slope0, gamma) will be used in the Bayesian models.

Usage:
    python fit_lorentz_params.py
"""
import sys
import numpy as np
from pathlib import Path
from scipy.optimize import curve_fit
import matplotlib.pyplot as plt

# Add app directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from app.database import SessionLocal
from app import models


def lorentz_speed_function(slope_degrees, A, slope0, gamma):
    """Lorentz curve: speed = A / (1 + ((slope - slope0) / gamma)²)"""
    return A / (1 + ((slope_degrees - slope0) / gamma) ** 2)


def extract_segment_data(db):
    """Extract slope (degrees) and speed (m/s) from all GPS segments."""

    # Query all user segments with their activity data
    segments = db.query(models.UserSegment, models.Activity).join(
        models.Activity, models.UserSegment.activity_id == models.Activity.activity_id
    ).filter(
        models.Activity.is_planned == False,  # Only real GPS data
        models.UserSegment.is_technical == False,  # Only non-technical segments
    ).all()

    slopes_deg = []
    speeds_m_s = []

    for segment, activity in segments:
        # Get segment metrics
        points = db.query(models.Point).filter(
            models.Point.activity_id == activity.activity_id,
            models.Point.is_removed == False,
            models.Point.time >= segment.start_time,
            models.Point.time <= segment.end_time
        ).order_by(models.Point.time).all()

        if len(points) < 2:
            continue

        # Compute distance and net elevation change
        total_distance_m = 0
        net_elevation_change_m = 0  # Can be positive (uphill) or negative (downhill)

        for i in range(len(points) - 1):
            p1, p2 = points[i], points[i + 1]

            # Horizontal distance (Haversine)
            from math import radians, sin, cos, sqrt, atan2
            lat1, lon1 = radians(p1.lat), radians(p1.lon)
            lat2, lon2 = radians(p2.lat), radians(p2.lon)
            dlat = lat2 - lat1
            dlon = lon2 - lon1
            a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
            c = 2 * atan2(sqrt(a), sqrt(1-a))
            dist_m = 6371000 * c  # Earth radius in meters
            total_distance_m += dist_m

            # Net elevation change (can be negative for descents)
            elev_change = p2.elevation_m - p1.elevation_m
            net_elevation_change_m += elev_change

        duration_sec = (segment.end_time - segment.start_time).total_seconds()

        # Filter out invalid segments
        if total_distance_m < 10 or duration_sec < 10:  # At least 10m and 10s
            continue

        # Compute slope in degrees (can be negative for descents)
        # slope_deg = atan(elevation_change / distance) * 180/π
        slope_rad = np.arctan(net_elevation_change_m / total_distance_m)
        slope_deg = np.degrees(slope_rad)

        # Compute speed in m/s
        speed_m_s = total_distance_m / duration_sec

        # Filter outliers (very slow or very fast)
        if 0.1 < speed_m_s < 5.0:  # Realistic hiking speeds
            slopes_deg.append(slope_deg)
            speeds_m_s.append(speed_m_s)

    return np.array(slopes_deg), np.array(speeds_m_s)


def fit_lorentz_curve(slopes_deg, speeds_m_s):
    """Fit Lorentz curve to slope-speed data."""

    # Initial guess: A=1.3 m/s, slope0=-5°, gamma=7°
    p0 = [1.3, -5.0, 7.0]

    # Bounds: A in [0.5, 3.0], slope0 in [-15, 5], gamma in [1, 20]
    bounds = ([0.5, -15.0, 1.0], [3.0, 5.0, 20.0])

    try:
        params, covariance = curve_fit(
            lorentz_speed_function,
            slopes_deg,
            speeds_m_s,
            p0=p0,
            bounds=bounds,
            maxfev=10000
        )

        A_fit, slope0_fit, gamma_fit = params

        # Compute R²
        y_pred = lorentz_speed_function(slopes_deg, *params)
        ss_res = np.sum((speeds_m_s - y_pred) ** 2)
        ss_tot = np.sum((speeds_m_s - np.mean(speeds_m_s)) ** 2)
        r_squared = 1 - (ss_res / ss_tot)

        # Compute standard errors
        param_errors = np.sqrt(np.diag(covariance))

        return {
            'A': float(A_fit),
            'slope0': float(slope0_fit),
            'gamma': float(gamma_fit),
            'A_stderr': float(param_errors[0]),
            'slope0_stderr': float(param_errors[1]),
            'gamma_stderr': float(param_errors[2]),
            'r_squared': float(r_squared),
            'n_segments': len(slopes_deg)
        }
    except Exception as e:
        print(f"Error fitting Lorentz curve: {e}")
        return None


def plot_fit(slopes_deg, speeds_m_s, fit_params):
    """Create visualization of the fitted Lorentz curve."""

    # Generate smooth curve for plotting
    slope_range = np.linspace(-20, 20, 200)
    speed_fit = lorentz_speed_function(
        slope_range,
        fit_params['A'],
        fit_params['slope0'],
        fit_params['gamma']
    )

    plt.figure(figsize=(10, 6))

    # Scatter plot of data
    plt.scatter(slopes_deg, speeds_m_s, alpha=0.3, s=20, label='GPS Segments')

    # Fitted curve
    plt.plot(slope_range, speed_fit, 'r-', linewidth=2, label='Lorentz Fit')

    # Mark optimal slope
    plt.axvline(fit_params['slope0'], color='green', linestyle='--',
                label=f"Optimal Slope = {fit_params['slope0']:.1f}°")

    plt.xlabel('Slope (degrees)', fontsize=12)
    plt.ylabel('Speed (m/s)', fontsize=12)
    plt.title(f"Lorentz Curve Fit to GPS Speed Data (R² = {fit_params['r_squared']:.3f})",
              fontsize=14)
    plt.legend()
    plt.grid(True, alpha=0.3)

    # Add parameter text
    param_text = (
        f"A = {fit_params['A']:.3f} ± {fit_params['A_stderr']:.3f} m/s\n"
        f"slope₀ = {fit_params['slope0']:.2f} ± {fit_params['slope0_stderr']:.2f}°\n"
        f"γ = {fit_params['gamma']:.2f} ± {fit_params['gamma_stderr']:.2f}°\n"
        f"n = {fit_params['n_segments']} segments"
    )
    plt.text(0.02, 0.98, param_text, transform=plt.gca().transAxes,
             verticalalignment='top', bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))

    plt.tight_layout()
    plt.savefig('lorentz_fit.png', dpi=150)
    print("\nPlot saved to: lorentz_fit.png")


def main():
    """Main execution."""
    print("=" * 60)
    print("Fitting Lorentz Curve to GPS Segment Speed Data")
    print("=" * 60)

    # Connect to database
    db = SessionLocal()

    try:
        # Extract data
        print("\nExtracting GPS segment data...")
        slopes_deg, speeds_m_s = extract_segment_data(db)
        print(f"Extracted {len(slopes_deg)} valid segments")

        if len(slopes_deg) < 10:
            print("ERROR: Not enough segments for fitting (need at least 10)")
            return

        # Print data summary
        print(f"\nData Summary:")
        print(f"  Slope range: {slopes_deg.min():.1f}° to {slopes_deg.max():.1f}°")
        print(f"  Speed range: {speeds_m_s.min():.2f} to {speeds_m_s.max():.2f} m/s")
        print(f"  Mean speed: {speeds_m_s.mean():.2f} m/s")

        # Fit Lorentz curve
        print("\nFitting Lorentz curve...")
        fit_params = fit_lorentz_curve(slopes_deg, speeds_m_s)

        if fit_params is None:
            print("ERROR: Fitting failed")
            return

        # Print results
        print("\n" + "=" * 60)
        print("FITTED LORENTZ PARAMETERS")
        print("=" * 60)
        print(f"Peak Speed (A):       {fit_params['A']:.4f} ± {fit_params['A_stderr']:.4f} m/s")
        print(f"Optimal Slope (x₀):   {fit_params['slope0']:.3f} ± {fit_params['slope0_stderr']:.3f} degrees")
        print(f"Width (γ):            {fit_params['gamma']:.3f} ± {fit_params['gamma_stderr']:.3f} degrees")
        print(f"\nGoodness of Fit:")
        print(f"  R² = {fit_params['r_squared']:.4f}")
        print(f"  n = {fit_params['n_segments']} segments")
        print("=" * 60)

        # Validate parameters
        print("\nValidation:")
        if fit_params['r_squared'] < 0.6:
            print("  ⚠️  WARNING: R² < 0.6 (fit quality is poor)")
        else:
            print(f"  ✓ R² = {fit_params['r_squared']:.3f} (good fit)")

        if not (-15 <= fit_params['slope0'] <= 0):
            print(f"  ⚠️  WARNING: Optimal slope {fit_params['slope0']:.1f}° outside expected range [-15°, 0°]")
        else:
            print(f"  ✓ Optimal slope {fit_params['slope0']:.1f}° is physically reasonable")

        if not (0.8 <= fit_params['A'] <= 2.5):
            print(f"  ⚠️  WARNING: Peak speed {fit_params['A']:.2f} m/s outside typical hiking range [0.8, 2.5]")
        else:
            print(f"  ✓ Peak speed {fit_params['A']:.2f} m/s is realistic for hiking")

        # Create visualization
        print("\nGenerating plot...")
        plot_fit(slopes_deg, speeds_m_s, fit_params)

        # Print usage instructions
        print("\n" + "=" * 60)
        print("NEXT STEPS")
        print("=" * 60)
        print("Use these parameters in the model code:")
        print(f"""
In data.py and prediction.py, use:
    lorentz_params = {{
        "A": {fit_params['A']:.4f},
        "slope0": {fit_params['slope0']:.3f},
        "gamma": {fit_params['gamma']:.3f}
    }}
""")

    finally:
        db.close()


if __name__ == "__main__":
    main()

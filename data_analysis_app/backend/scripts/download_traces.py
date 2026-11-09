#!/usr/bin/env python3
"""
Download and install model traces from transfer.sh to production Render instance.
This script automates extracting traces and updating the runs index.

Usage:
    python3 download_traces.py '<TRANSFER_URL>' '<RUN_ID>'

Example:
    python3 download_traces.py 'https://transfer.sh/abc123/traces.zip' '20261108_043342'
"""
import json
import os
import sys
import urllib.request
import zipfile
from datetime import datetime
from pathlib import Path


def main():
    if len(sys.argv) != 3:
        print("❌ Usage: python3 download_traces.py '<URL>' '<RUN_ID>'")
        sys.exit(1)

    download_url = sys.argv[1]
    run_id = sys.argv[2]

    # Determine trace directory from environment or use default
    trace_dir = Path(os.environ.get("TRACE_DIR", "/data/traces"))
    runs_dir = trace_dir / "runs"
    runs_index_path = trace_dir / "runs_index.json"

    print(f"📁 Trace directory: {trace_dir}")

    # Ensure directories exist
    runs_dir.mkdir(parents=True, exist_ok=True)

    # Download zip file
    zip_path = runs_dir / "temp_download.zip"
    print(f"⬇️  Downloading from {download_url}...")

    try:
        urllib.request.urlretrieve(download_url, zip_path)
        print(f"✅ Download complete ({zip_path.stat().st_size / 1024 / 1024:.1f} MB)")
    except Exception as e:
        print(f"❌ Download failed: {e}")
        sys.exit(1)

    # Extract zip file
    print(f"📦 Extracting...")
    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(runs_dir)
        print("✅ Extraction complete")
    except Exception as e:
        print(f"❌ Extraction failed: {e}")
        zip_path.unlink()
        sys.exit(1)

    # Clean up zip
    zip_path.unlink()

    # Verify extracted run directory and files
    run_dir = runs_dir / run_id
    if not run_dir.exists():
        print(f"❌ Run directory {run_dir} not found after extraction")
        sys.exit(1)

    required_files = [
        "locomotion_trace.nc",
        "rest_trace.nc",
        "diagnostics.json",
        "metadata.json"
    ]

    missing_files = [f for f in required_files if not (run_dir / f).exists()]
    if missing_files:
        print(f"❌ Missing required files: {', '.join(missing_files)}")
        sys.exit(1)

    print(f"✅ All required files present in {run_dir}")

    # Read diagnostics to get rmse_pct and n_activities
    print("📊 Reading diagnostics...")
    diagnostics_path = run_dir / "diagnostics.json"

    try:
        with open(diagnostics_path) as f:
            diagnostics = json.load(f)
    except Exception as e:
        print(f"⚠️  Could not read diagnostics: {e}")
        diagnostics = {}

    # Extract rmse_pct values from diagnostics
    # The diagnostics structure has each model group with an rmse_pct_of_mean field
    rmse_pct = {}
    n_segments_total = 0

    for group_name, group_data in diagnostics.items():
        if isinstance(group_data, dict):
            if "rmse_pct_of_mean" in group_data:
                rmse_pct[group_name] = group_data["rmse_pct_of_mean"]
            if "n_segments" in group_data:
                n_segments_total += group_data["n_segments"]

    # Create or update runs index
    print("📝 Updating runs index...")

    if runs_index_path.exists():
        with open(runs_index_path) as f:
            runs_index = json.load(f)
    else:
        runs_index = []

    # Check if this run already exists
    existing_run = next((r for r in runs_index if r["run_id"] == run_id), None)

    if existing_run:
        print(f"⚠️  Run {run_id} already exists in index, updating...")
        runs_index = [r for r in runs_index if r["run_id"] != run_id]

    # Add new run entry
    new_entry = {
        "run_id": run_id,
        "created_at": datetime.utcnow().isoformat(),
        "n_activities_total": n_segments_total,  # Approximation from segments
        "n_recent_activities_filter": None,
        "rmse_pct": rmse_pct
    }

    runs_index.append(new_entry)

    # Write updated index
    with open(runs_index_path, 'w') as f:
        json.dump(runs_index, f, indent=2)

    print(f"✅ Updated {runs_index_path}")

    # Summary
    print("")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("✅ INSTALLATION COMPLETE")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"📁 Run directory: {run_dir}")
    print(f"📊 RMSE values: {rmse_pct}")
    print("")
    print("🔄 Next steps:")
    print("1. Restart Render service to pick up new traces")
    print("2. Visit Build Models page to verify run appears")
    print("3. Test predictions on Plan Routes page")
    print("")


if __name__ == "__main__":
    main()

#!/bin/bash
# Upload locally-fitted model traces for production deployment
# This script automates the process of packaging and uploading traces

set -e  # Exit on error

echo "🔍 Finding latest model run..."
cd "$(dirname "$0")/../backend/app/modeling/traces/runs"

# Get the most recent run directory
LATEST_RUN=$(ls -t | head -1)

if [ -z "$LATEST_RUN" ]; then
    echo "❌ No model runs found in traces/runs/"
    exit 1
fi

echo "📦 Latest run: $LATEST_RUN"

# Verify it has all required files
if [ ! -f "$LATEST_RUN/locomotion_trace.nc" ] || \
   [ ! -f "$LATEST_RUN/rest_trace.nc" ] || \
   [ ! -f "$LATEST_RUN/diagnostics.json" ] || \
   [ ! -f "$LATEST_RUN/metadata.json" ]; then
    echo "❌ Run $LATEST_RUN is missing required files"
    exit 1
fi

echo "✅ All required files present"
echo ""

# Create zip file
ZIP_NAME="model_traces_${LATEST_RUN}.zip"
echo "📦 Creating $ZIP_NAME..."
zip -q -r "$ZIP_NAME" "$LATEST_RUN/"

# Get file size
SIZE=$(ls -lh "$ZIP_NAME" | awk '{print $5}')
echo "✅ Created archive ($SIZE)"
echo ""

# Upload to transfer.sh
echo "☁️  Uploading to transfer.sh..."
UPLOAD_URL=$(curl --upload-file "$ZIP_NAME" "https://transfer.sh/$ZIP_NAME" 2>/dev/null)

if [ -z "$UPLOAD_URL" ]; then
    echo "❌ Upload failed"
    rm "$ZIP_NAME"
    exit 1
fi

echo "✅ Upload complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 COPY AND RUN THIS IN RENDER SHELL:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "python3 /app/backend/scripts/download_traces.py '$UPLOAD_URL' '$LATEST_RUN'"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  Note: transfer.sh links expire after 14 days"
echo "📁 Local archive saved as: $ZIP_NAME"
echo ""

# Clean up
rm "$ZIP_NAME"

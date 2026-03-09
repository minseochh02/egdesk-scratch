#!/bin/bash

# Run dev-only migration to fix date column types
# This script sets the DEV_MIGRATION environment variable and rebuilds the app

echo "🔧 Running dev-only migration 012: Fix date column types"
echo ""
echo "This will:"
echo "  1. Find user data tables with '일자' column as TEXT"
echo "  2. Convert them to DATE type"
echo "  3. Preserve all existing data"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Migration cancelled."
    exit 1
fi

echo ""
echo "Setting DEV_MIGRATION=true and rebuilding..."
export DEV_MIGRATION=true
npm run build

echo ""
echo "✅ Build complete. Now restart the app to run the migration."
echo "   The migration will run automatically on next app start."

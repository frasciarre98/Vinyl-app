#!/bin/zsh
set -e # Exit on error

echo "🚀 Starting Magic Publish..."

# 1. Export data from NAS
export VITE_PB_URL="http://192.168.0.250:8090"
echo "📦 Exporting static data from $VITE_PB_URL..."
node scripts/export-static.js

# 2. Sync with Remote (Pull first to avoid conflicts)
echo "🔄 Syncing with GitHub..."
git add .
# Commit if there are changes, otherwise move on
git commit -m "🚀 Auto-publish NAS Collection ($(date +'%Y-%m-%d %H:%M'))" || echo "No changes to commit"

echo "📥 Pulling latest changes from remote..."
git pull --rebase --autostash

# 3. Push to GitHub (Triggers Vercel)
echo "📤 Pushing to GitHub..."
git config http.postBuffer 524288000
git push

echo "✨ DONE! The site should be updated on Vercel in a few minutes."

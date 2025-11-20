#!/usr/bin/env bash
# deploy.sh - build & deploy frontend + backend, restart backend under PM2
# Usage: sudo -u admin ./deploy.sh [branch]
# Requirements on server (Debian 12 + VestaCP): git, rsync, node (LTS) and npm or yarn, pm2 (global)
set -euo pipefail

REPO_URL="https://github.com/btnnc31-rgb/mem1.git"
BRANCH="${1:-main}"
TMP_DIR="$(mktemp -d)"
FRONTEND_BUILD_DIR="frontend/build"
DEPLOY_DIR="/home/admin/web/mem.modernoa.com/public_html"
BACKEND_DIR="/home/admin/web/mem.modernoa.com/backend"
OWNER="admin"
GROUP="admin"
KEEP_TMP=false

echo "Deploying branch '$BRANCH' from $REPO_URL"
echo "Temporary workspace: $TMP_DIR"

cleanup() {
  if [ "$KEEP_TMP" = false ]; then
    rm -rf "$TMP_DIR"
  else
    echo "Keeping temp dir: $TMP_DIR"
  fi
}
trap cleanup EXIT

# Ensure required commands exist
for cmd in git rsync; do
  if ! command -v $cmd >/dev/null 2>&1; then
    echo "ERROR: required command '$cmd' not found. Install it and re-run." >&2
    exit 1
  fi
done

# Clone repo
git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$TMP_DIR"
cd "$TMP_DIR"

# ------------------------
# Build Frontend
# ------------------------
if [ -d frontend ]; then
  echo "Building frontend..."
  cd frontend
  if [ -f package.json ]; then
    if command -v npm >/dev/null 2>&1; then
      npm ci
      if jq -e '.scripts.build' package.json >/dev/null 2>&1; then
        npm run build
      else
        echo "No build script in frontend/package.json; skipping build."
      fi
    elif command -v yarn >/dev/null 2>&1; then
      yarn install --frozen-lockfile
      yarn build || true
    else
      echo "ERROR: npm or yarn not found for frontend build." >&2
      exit 1
    fi
  fi
  cd ..
else
  echo "No frontend dir found; skipping frontend build."
fi

# ------------------------
# Deploy Frontend (static)
# ------------------------
if [ -d "$FRONTEND_BUILD_DIR" ] || [ -f index.html ]; then
  echo "Deploying frontend to $DEPLOY_DIR"
  mkdir -p "$DEPLOY_DIR"
  # prefer the build dir; fallback to repo root/public
  if [ -d "$FRONTEND_BUILD_DIR" ]; then
    SRC="$TMP_DIR/$FRONTEND_BUILD_DIR/"
  elif [ -d public ]; then
    SRC="$TMP_DIR/public/"
  elif [ -f index.html ]; then
    SRC="$TMP_DIR/"
  else
    echo "No frontend build found to deploy."
    SRC=""
  fi

  if [ -n "$SRC" ]; then
    rsync -av --delete --exclude='.git' --chmod=Du=rwx,Dg=rx,Do=rx,Fu=rw,Fg=r,Fo=r "$SRC" "$DEPLOY_DIR"/
    chown -R "$OWNER":"$GROUP" "$DEPLOY_DIR" || true
    find "$DEPLOY_DIR" -type d -exec chmod 2755 {} \; || true
    find "$DEPLOY_DIR" -type f -exec chmod 0644 {} \; || true
  fi
else
  echo "No frontend artifacts to deploy; skipping frontend sync."
fi

# ------------------------
# Deploy Backend
# ------------------------
if [ -d backend ]; then
  echo "Deploying backend to $BACKEND_DIR"
  mkdir -p "$BACKEND_DIR"
  # Copy backend files
  rsync -av --delete --exclude='.git' "$TMP_DIR/backend/" "$BACKEND_DIR"/
  chown -R "$OWNER":"$GROUP" "$BACKEND_DIR" || true

  # Install backend dependencies
  if command -v npm >/dev/null 2>&1; then
    (
      cd "$BACKEND_DIR"
      npm ci --production
    )
  fi

  # Ensure PM2 is installed
  if ! command -v pm2 >/dev/null 2>&1; then
    echo "WARNING: pm2 not found. Install globally: npm i -g pm2"
  else
    echo "Reloading/starting app with PM2 using ecosystem file if present..."
    if [ -f "$BACKEND_DIR/ecosystem.config.js" ]; then
      pm2 startOrReload "$BACKEND_DIR/ecosystem.config.js" --env production || true
      pm2 save || true
    else
      echo "No ecosystem.config.js found in backend directory; you may start manually with: pm2 start index.js --name memegrave-backend"
    fi
  fi
else
  echo "No backend directory present; skipped backend deployment."
fi

echo "Deployment finished."
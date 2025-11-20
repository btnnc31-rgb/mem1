#!/usr/bin/env bash
#
# Automated deploy script for MemeGrave on a VestaCP VPS.
# Edit variables at the top before running.
#
set -euo pipefail

DOMAIN="${DOMAIN:-}"
V_USER="${V_USER:-}"
REPO_URL="${REPO_URL:-}"
APP_DIR="${APP_DIR:-/opt/memegrave}"
FRONTEND_DIR_REL="${FRONTEND_DIR_REL:-frontend}"
FRONTEND_BUILD_REL="${FRONTEND_BUILD_REL:-frontend/build}"
BACKEND_DIR_REL="${BACKEND_DIR_REL:-backend}"
BACKEND_PORT="${BACKEND_PORT:-4000}"
DB_NAME="${DB_NAME:-memegrave}"
DB_USER="${DB_USER:-memegrave_user}"
DB_PASSWORD="${DB_PASSWORD:-}"
MEMEGRAVE_ADDRESS="${MEMEGRAVE_ADDRESS:-}"
RPC_URL="${RPC_URL:-https://bsc-dataseed.binance.org/}"
ADMIN_PRIVATE_KEY="${ADMIN_PRIVATE_KEY:-}"
NODE_VERSION="${NODE_VERSION:-20}"
FORCE="${FORCE:-false}"

prompt_if_empty() {
  local varname="$1"
  local prompt="$2"
  local is_secret="${3:-false}"
  local cur
  cur="$(eval "printf '%s' \"\${${varname}:-}\"")"
  if [ -z "$cur" ]; then
    if [ "$is_secret" = true ]; then
      read -rs -p "$prompt: " val
      echo
    else
      read -p "$prompt: " val
    fi
    eval "$varname=\"\$val\""
  fi
}

echo
prompt_if_empty DOMAIN "Domain managed by Vesta (e.g. app.yourdomain.com)"
prompt_if_empty V_USER "Vesta username that owns the domain"
prompt_if_empty REPO_URL "Git repo URL (HTTPS recommended)"
prompt_if_empty DB_PASSWORD "Postgres password for ${DB_USER}" true
prompt_if_empty MEMEGRAVE_ADDRESS "Deployed MemeGrave contract address (or leave blank and set later)"

echo "Proceed? (y/N)"
read -r proceed
if [[ ! "$proceed" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 1
fi

run_sudo() {
  if [ "$(id -u)" -eq 0 ]; then
    bash -c "$*"
  else
    sudo bash -c "$*"
  fi
}

echo "Installing packages..."
run_sudo "apt-get update -y"
run_sudo "apt-get install -y git build-essential ca-certificates curl jq rsync"

if ! node -v >/dev/null 2>&1 || [[ "$(node -v)" != "v$NODE_VERSION."* ]]; then
  run_sudo "curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -"
  run_sudo "apt-get install -y nodejs"
fi
run_sudo "apt-get install -y nginx certbot python3-certbot-nginx"
run_sudo "apt-get install -y postgresql postgresql-contrib"

echo "Cloning repo..."
run_sudo "mkdir -p $APP_DIR"
run_sudo "chown -R $(whoami):$(whoami) $APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --rebase || true
else
  git clone "$REPO_URL" "$APP_DIR"
fi

echo "Build frontend..."
cd "$APP_DIR/frontend"
npm ci --no-audit --no-fund
npm run build

echo "Deploy frontend to Vesta webroot..."
VESTA_WEBROOT="/home/$V_USER/web/$DOMAIN/public_html"
run_sudo "mkdir -p $VESTA_WEBROOT"
rsync -a --delete "$APP_DIR/$FRONTEND_BUILD_REL/" "$VESTA_WEBROOT/"
run_sudo "chown -R $V_USER:$V_USER $VESTA_WEBROOT"
run_sudo "chmod -R 755 $VESTA_WEBROOT"

echo "Prepare backend env..."
BACKEND_DIR="$APP_DIR/$BACKEND_DIR_REL"
BACKEND_ENV_FILE="$BACKEND_DIR/.env"
if [ -f "$BACKEND_ENV_FILE" ] && [ "$FORCE" != "true" ]; then
  echo "Backend .env exists, preserved."
else
  cat > "$BACKEND_ENV_FILE" <<EOF
NODE_ENV=production
PORT=${BACKEND_PORT}
RPC_URL=${RPC_URL}
CHAIN_ID=56
MEMEGRAVE_ADDRESS=${MEMEGRAVE_ADDRESS}
MEMEGRAVE_ABI_PATH=./contract/abi.json
ADMIN_PRIVATE_KEY=${ADMIN_PRIVATE_KEY}
PG_HOST=127.0.0.1
PG_PORT=5432
PG_DATABASE=${DB_NAME}
PG_USER=${DB_USER}
PG_PASSWORD=${DB_PASSWORD}
VRF_SUBSCRIPTION_ID=0
LOG_LEVEL=info
FRONTEND_ORIGIN=https://${DOMAIN}
EOF
  chmod 600 "$BACKEND_ENV_FILE"
fi

echo "Install backend deps..."
cd "$BACKEND_DIR"
npm ci --no-audit --no-fund

echo "Postgres setup..."
run_sudo "sudo -u postgres psql -v ON_ERROR_STOP=1 <<-SQL
DO
\$do\$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
      CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';
   END IF;
END
\$do\$;
SQL"
run_sudo "sudo -u postgres psql -v ON_ERROR_STOP=1 <<-SQL
SELECT 'CREATE DATABASE' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}');
CREATE DATABASE ${DB_NAME} WITH OWNER=${DB_USER};
SQL"

if [ -f "$BACKEND_DIR/schema.sql" ]; then
  run_sudo "sudo -u postgres psql -d $DB_NAME -f $BACKEND_DIR/schema.sql"
fi

echo "Try to extract ABI from Hardhat artifacts..."
ABI_DEST="$BACKEND_DIR/contract/abi.json"
mkdir -p "$(dirname "$ABI_DEST")"
if [ -f "$APP_DIR/artifacts/contracts/MemeGrave.sol/MemeGrave.json" ]; then
  jq '.abi' "$APP_DIR/artifacts/contracts/MemeGrave.sol/MemeGrave.json" > "$ABI_DEST"
  echo "ABI copied to $ABI_DEST"
else
  echo "No artifact found; copy ABI manually to $ABI_DEST"
fi

echo "Install systemd service..."
SYSTEMD_PATH="/etc/systemd/system/memegrave.service"
run_sudo "cat > $SYSTEMD_PATH <<SERVICE
[Unit]
Description=MemeGrave Backend
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=$BACKEND_DIR
EnvironmentFile=$BACKEND_ENV_FILE
ExecStart=/usr/bin/node index.js
Restart=on-failure
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
SERVICE"
run_sudo "systemctl daemon-reload"
run_sudo "systemctl enable --now memegrave.service"

echo "Write Vesta nginx include..."
VESTA_INCLUDE_DIR="/home/$V_USER/conf/web"
VESTA_INCLUDE_FILE="$VESTA_INCLUDE_DIR/nginx.conf"
run_sudo "mkdir -p $VESTA_INCLUDE_DIR"
cat > "$VESTA_INCLUDE_FILE" <<NGINX_INC
location /api/ {
    proxy_pass http://127.0.0.1:${BACKEND_PORT}/api/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 120s;
    proxy_connect_timeout 5s;
}
NGINX_INC
run_sudo "chown $V_USER:$V_USER $VESTA_INCLUDE_FILE || true"

echo "Reload nginx..."
run_sudo "nginx -t"
run_sudo "systemctl reload nginx"

echo "Attempt certbot (dry-run then real). If domain not pointed at this server, this will fail."
if command -v certbot >/dev/null 2>&1; then
  if certbot certonly --nginx --non-interactive --agree-tos --email admin@$DOMAIN -d $DOMAIN --dry-run >/dev/null 2>&1; then
    run_sudo "certbot --nginx --non-interactive --agree-tos --email admin@$DOMAIN -d $DOMAIN || true"
    run_sudo "systemctl reload nginx || true"
  else
    echo "Certbot dry-run failed; run certbot manually once DNS is in place."
  fi
fi

echo "Done. Check backend: sudo journalctl -u memegrave.service -f"
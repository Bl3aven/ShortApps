#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${SHORTAPPS_DOMAIN:-shortapps.tournayre.ovh}"
LE_EMAIL="${LETSENCRYPT_EMAIL:-}"
REGISTRATION_SECRET="${SHORTAPPS_HUB_REGISTRATION_SECRET:-}"
HUB_PORT="${SHORTAPPS_HUB_PORT:-8080}"
SSH_SERVICE_PORT="${SSH_PORT:-22}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="/opt/shortapps-hub"
APP_USER="shortapps-hub"
ENV_FILE="/etc/shortapps-hub.env"
NGINX_SITE="/etc/nginx/sites-available/shortapps-hub"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script as root." >&2
  exit 1
fi

if [[ -z "${LE_EMAIL}" ]]; then
  echo "LETSENCRYPT_EMAIL is required." >&2
  echo "Example: LETSENCRYPT_EMAIL=admin@example.com SHORTAPPS_HUB_REGISTRATION_SECRET='long-random-secret' bash hub/setup-debian.sh" >&2
  exit 1
fi

if [[ "${#REGISTRATION_SECRET}" -lt 32 ]]; then
  echo "SHORTAPPS_HUB_REGISTRATION_SECRET must contain at least 32 characters." >&2
  exit 1
fi

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ca-certificates \
  curl \
  fail2ban \
  nginx \
  certbot \
  nodejs \
  npm \
  ufw \
  unattended-upgrades

if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "${APP_DIR}" --shell /usr/sbin/nologin "${APP_USER}"
fi

install -d -m 0755 /var/www/letsencrypt
install -d -m 0750 -o "${APP_USER}" -g "${APP_USER}" "${APP_DIR}"
install -m 0644 -o "${APP_USER}" -g "${APP_USER}" "${SCRIPT_DIR}/server.js" "${APP_DIR}/server.js"
install -m 0644 -o "${APP_USER}" -g "${APP_USER}" "${SCRIPT_DIR}/package.json" "${APP_DIR}/package.json"
if [[ -f "${SCRIPT_DIR}/package-lock.json" ]]; then
  install -m 0644 -o "${APP_USER}" -g "${APP_USER}" "${SCRIPT_DIR}/package-lock.json" "${APP_DIR}/package-lock.json"
fi

cat >"${ENV_FILE}" <<EOF
SHORTAPPS_HUB_HOST=127.0.0.1
SHORTAPPS_HUB_PORT=${HUB_PORT}
SHORTAPPS_HUB_DOMAIN=${DOMAIN}
SHORTAPPS_HUB_COOKIE_SECURE=1
SHORTAPPS_HUB_SESSION_TTL_SECONDS=2592000
SHORTAPPS_HUB_REGISTRATION_SECRET=${REGISTRATION_SECRET}
EOF
chmod 0600 "${ENV_FILE}"
chown root:root "${ENV_FILE}"

install -d -m 0755 /etc/fail2ban/jail.d
cat >/etc/fail2ban/jail.d/shortapps-sshd.local <<EOF
[sshd]
enabled = true
backend = systemd
maxretry = 5
findtime = 10m
bantime = 1h
EOF

install -d -m 0755 /etc/ssh/sshd_config.d
cat >/etc/ssh/sshd_config.d/99-shortapps-hardening.conf <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
X11Forwarding no
AllowTcpForwarding no
AllowAgentForwarding no
MaxAuthTries 3
LoginGraceTime 20
EOF

install -d -m 0755 /etc/systemd/resolved.conf.d
cat >/etc/systemd/resolved.conf.d/99-shortapps-no-llmnr.conf <<'EOF'
[Resolve]
LLMNR=no
MulticastDNS=no
EOF

cat >"${NGINX_SITE}" <<EOF
map \$http_upgrade \$connection_upgrade {
  default upgrade;
  '' close;
}

limit_req_zone \$binary_remote_addr zone=shortapps_login:10m rate=10r/m;

upstream shortapps_hub_backend {
  server 127.0.0.1:${HUB_PORT};
  keepalive 32;
}

server {
  listen 80 default_server;
  listen [::]:80 default_server;
  server_name _;
  return 444;
}

server {
  listen 80;
  listen [::]:80;
  server_name ${DOMAIN};

  location /.well-known/acme-challenge/ {
    root /var/www/letsencrypt;
  }

  location / {
    return 301 https://\$host\$request_uri;
  }
}
EOF

ln -sf "${NGINX_SITE}" /etc/nginx/sites-enabled/shortapps-hub
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

if [[ ! -d "/etc/letsencrypt/live/${DOMAIN}" ]]; then
  certbot certonly \
    --webroot \
    --webroot-path /var/www/letsencrypt \
    --domain "${DOMAIN}" \
    --email "${LE_EMAIL}" \
    --agree-tos \
    --non-interactive \
    --rsa-key-size 4096
fi

install -d -m 0755 /etc/letsencrypt/renewal-hooks/deploy
cat >/etc/letsencrypt/renewal-hooks/deploy/reload-shortapps-nginx.sh <<'EOF'
#!/usr/bin/env bash
systemctl reload nginx
EOF
chmod 0755 /etc/letsencrypt/renewal-hooks/deploy/reload-shortapps-nginx.sh

cat >"${NGINX_SITE}" <<EOF
map \$http_upgrade \$connection_upgrade {
  default upgrade;
  '' close;
}

limit_req_zone \$binary_remote_addr zone=shortapps_login:10m rate=10r/m;

upstream shortapps_hub_backend {
  server 127.0.0.1:${HUB_PORT};
  keepalive 32;
}

server {
  listen 80 default_server;
  listen [::]:80 default_server;
  server_name _;
  return 444;
}

server {
  listen 80;
  listen [::]:80;
  server_name ${DOMAIN};

  location /.well-known/acme-challenge/ {
    root /var/www/letsencrypt;
  }

  location / {
    return 301 https://\$host\$request_uri;
  }
}

server {
  listen 443 ssl http2 default_server;
  listen [::]:443 ssl http2 default_server;
  server_name _;

  ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
  ssl_protocols TLSv1.2 TLSv1.3;

  return 444;
}

server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name ${DOMAIN};

  ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
  ssl_session_timeout 1d;
  ssl_session_cache shared:ShortAppsTLS:10m;
  ssl_session_tickets off;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_prefer_server_ciphers off;

  client_max_body_size 24m;
  client_body_timeout 12s;
  client_header_timeout 12s;
  keepalive_timeout 20s;
  large_client_header_buffers 2 8k;
  server_tokens off;

  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Content-Type-Options nosniff always;
  add_header Referrer-Policy no-referrer always;
  add_header X-Frame-Options DENY always;
  add_header X-Permitted-Cross-Domain-Policies none always;

  proxy_http_version 1.1;
  proxy_set_header Host \$host;
  proxy_set_header X-Real-IP \$remote_addr;
  proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Host \$host;
  proxy_set_header X-Forwarded-Proto https;
  proxy_hide_header X-Powered-By;

  location /hub/login {
    limit_req zone=shortapps_login burst=8 nodelay;
    proxy_pass http://shortapps_hub_backend;
  }

  location = /tunnel/pc {
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$connection_upgrade;
    proxy_read_timeout 86400;
    proxy_send_timeout 86400;
    proxy_pass http://shortapps_hub_backend;
  }

  location = / { proxy_pass http://shortapps_hub_backend; }
  location = /mobile { proxy_pass http://shortapps_hub_backend; }
  location ^~ /mobile/ { proxy_pass http://shortapps_hub_backend; }
  location ^~ /assets/ { proxy_pass http://shortapps_hub_backend; }
  location = /favicon.svg { proxy_pass http://shortapps_hub_backend; }
  location = /icons.svg { proxy_pass http://shortapps_hub_backend; }
  location = /manifest.webmanifest { proxy_pass http://shortapps_hub_backend; }
  location = /robots.txt { proxy_pass http://shortapps_hub_backend; }
  location = /hub/health { proxy_pass http://shortapps_hub_backend; }
  location = /hub/status { proxy_pass http://shortapps_hub_backend; }
  location = /hub/logout { proxy_pass http://shortapps_hub_backend; }
  location = /api/status { proxy_pass http://shortapps_hub_backend; }
  location = /api/config { proxy_pass http://shortapps_hub_backend; }
  location = /api/auth/status { proxy_pass http://shortapps_hub_backend; }
  location = /api/auth/logout { proxy_pass http://shortapps_hub_backend; }
  location = /api/apps/launch { proxy_pass http://shortapps_hub_backend; }
  location = /api/keyboard { proxy_pass http://shortapps_hub_backend; }

  location / {
    return 404;
  }
}
EOF

cat >/etc/systemd/system/shortapps-hub.service <<EOF
[Unit]
Description=ShortApps HTTPS hub
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/node ${APP_DIR}/server.js
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
PrivateDevices=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
RestrictRealtime=true
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
SystemCallArchitectures=native
UMask=0077
CapabilityBoundingSet=
LockPersonality=true

[Install]
WantedBy=multi-user.target
EOF

cd "${APP_DIR}"
if [[ -f package-lock.json ]]; then
  npm ci --omit=dev
else
  npm install --omit=dev
fi
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

systemctl daemon-reload
if command -v sshd >/dev/null 2>&1; then
  sshd -t
fi
systemctl reload ssh || systemctl reload sshd || true
systemctl restart systemd-resolved || true
systemctl enable --now shortapps-hub
systemctl enable --now nginx
systemctl enable --now certbot.timer
systemctl enable --now fail2ban
dpkg-reconfigure -f noninteractive unattended-upgrades || true

ufw default deny incoming
ufw default allow outgoing
ufw allow "${SSH_SERVICE_PORT}/tcp"
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

nginx -t
systemctl reload nginx
systemctl restart shortapps-hub

echo "ShortApps hub installed."
echo "URL: https://${DOMAIN}"
echo "Machine registration secret is stored in ${ENV_FILE}."

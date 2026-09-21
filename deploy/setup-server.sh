#!/usr/bin/env bash
# One-time origin setup. Run on the Ubuntu droplet as root.
# Does not touch other nginx vhosts (ige-vision, sandbox, etc.).
set -euo pipefail

SITE_NAME=fanta
WEB_ROOT=/var/www/fanta
SITE_SRC="${1:-/tmp/fanta-nginx.conf}"

echo "==> Installing nginx if needed"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y nginx rsync

echo "==> Origin certificate"
CERT_DIR=/home
if [[ -f /home/ingameglobal.pem && -f /home/ingameglobal.key ]]; then
  echo "    using /home/ingameglobal.{pem,key}"
elif [[ -f /etc/ssl/ingameglobal/ingameglobal.pem && -f /etc/ssl/ingameglobal/ingameglobal.key ]]; then
  CERT_DIR=/etc/ssl/ingameglobal
  echo "    using existing ${CERT_DIR}"
elif [[ -f /etc/nginx/ssl/ingameglobal.pem && -f /etc/nginx/ssl/ingameglobal.key ]]; then
  CERT_DIR=/etc/nginx/ssl
  echo "    using existing ${CERT_DIR}"
else
  echo "Missing Origin certs. Expected /home/ingameglobal.pem and /home/ingameglobal.key"
  exit 1
fi

echo "==> Web root ${WEB_ROOT}"
mkdir -p "${WEB_ROOT}"

echo "==> nginx site"
install -m 644 "${SITE_SRC}" "/etc/nginx/sites-available/${SITE_NAME}"
if [[ "${CERT_DIR}" != /home ]]; then
  sed -i "s|/home/ingameglobal.pem|${CERT_DIR}/ingameglobal.pem|" "/etc/nginx/sites-available/${SITE_NAME}"
  sed -i "s|/home/ingameglobal.key|${CERT_DIR}/ingameglobal.key|" "/etc/nginx/sites-available/${SITE_NAME}"
fi
ln -sfn "/etc/nginx/sites-available/${SITE_NAME}" "/etc/nginx/sites-enabled/${SITE_NAME}"
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl enable --now nginx
systemctl reload nginx
echo "==> nginx ready. Publish dist/ into ${WEB_ROOT}"

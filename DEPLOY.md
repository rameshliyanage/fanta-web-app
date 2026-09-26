# Fantastic — DigitalOcean + Cloudflare Origin TLS

Public URL: **https://fanta-dmasl26-421419912123poc.ingame.global**

This app is a **static Vite/React SPA**. Production does **not** run Node. nginx on the DigitalOcean origin serves `dist/`. Cloudflare holds visitor TLS and talks to the origin with the Cloudflare Origin CA cert (`*.ingame.global` + `ingame.global`, valid through 2036). Live camera on phones needs this **https** URL.

Do **not** commit `ingameglobal.key`.

DNS for this hostname already resolves through Cloudflare (same edge IPs as Core). The origin nginx vhost is what you still add.

---

## 1. Requisites

| Need | Why |
|------|-----|
| Ubuntu 22.04/24.04 droplet | Reuse the existing IGE origin if this hostname already points there. 1 vCPU / 1 GB is enough. |
| SSH as `root` (key login) | Same pattern as IGE Vision. |
| Cloudflare zone `ingame.global` | Orange-cloud proxy on. SSL/TLS mode **Full (strict)** — not Flexible. |
| Origin cert pair | Already on the droplet at `/home/ingameglobal.pem` and `/home/ingameglobal.key`. |
| Node 20+ **on this PC only** | `npm run build`. Not needed on the droplet. |
| OpenSSH (`ssh`, `scp`) | Built into Windows 10/11. |
| DigitalOcean firewall | Inbound **22 / 80 / 443**. |

No Postgres, Redis, Docker, or PM2.

---

## 2. Cloudflare (once)

1. DNS → A record:
   - Name: `fanta-dmasl26-421419912123poc`
   - IPv4: **droplet public IP**
   - Proxy: **on** (orange cloud)
2. SSL/TLS → Overview → **Full (strict)**.
3. SSL/TLS → Origin Server: cert must cover `*.ingame.global` (yours does).

If the A record is missing, Cloudflare returns **522** until the origin IP is set. If a wildcard already points at the same droplet, skip DNS and only add the nginx vhost.

---

## 3. Build on this PC

```powershell
cd "C:\Dev IGE\fanta-web-app"
npm install
npm run build
```

Output is `dist/` (`index.html`, `assets/`, `badges/`, `manifest.json`, `icon.svg`).

---

## 4. Origin certs (already on the droplet)

```
/home/ingameglobal.pem
/home/ingameglobal.key
```

Confirm they are readable by nginx (master process reads them as root):

```bash
ls -l /home/ingameglobal.pem /home/ingameglobal.key
chmod 644 /home/ingameglobal.pem
chmod 600 /home/ingameglobal.key
```

---

## 5. nginx vhost on the droplet

Install nginx if needed:

```bash
apt update && apt install -y nginx
```

Create `/etc/nginx/sites-available/fanta` with this exact config.

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name fanta-dmasl26-421419912123poc.ingame.global;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name fanta-dmasl26-421419912123poc.ingame.global;

    ssl_certificate     /home/ingameglobal.pem;
    ssl_certificate_key /home/ingameglobal.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;

    root /var/www/fanta;
    index index.html;

    # getUserMedia on phones requires a secure context (HTTPS).
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Permissions-Policy "camera=(self), microphone=()" always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;

    location /api/ {
        proxy_pass http://127.0.0.1:8787;
        proxy_read_timeout 10s;
        client_max_body_size 2m;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location = /index.html {
        add_header Cache-Control "no-cache";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header Permissions-Policy "camera=(self), microphone=()" always;
        add_header X-Content-Type-Options nosniff always;
        add_header Referrer-Policy strict-origin-when-cross-origin always;
    }

    location ~* \.(?:js|css|png|svg|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header Permissions-Policy "camera=(self), microphone=()" always;
        add_header X-Content-Type-Options nosniff always;
        add_header Referrer-Policy strict-origin-when-cross-origin always;
        try_files $uri =404;
    }
}
```

Enable it (does not replace other IGE vhosts):

```bash
ln -sfn /etc/nginx/sites-available/fanta /etc/nginx/sites-enabled/fanta
nginx -t && systemctl enable --now nginx && systemctl reload nginx
```

---

## 6. Publish `dist/` to the droplet

From Windows (after `npm run build`):

```powershell
cd "C:\Dev IGE\fanta-web-app"
tar -C dist -cf - . | ssh root@YOUR.DROPLET.IP "tar -C /var/www/fanta -xf -"
ssh root@YOUR.DROPLET.IP "chown -R www-data:www-data /var/www/fanta"
```

What lands on the server:

| Path | Role |
|------|------|
| `/etc/nginx/sites-available/fanta` | vhost |
| `/var/www/fanta` | static files |
| `/home/ingameglobal.pem` + `.key` | Origin TLS (already on the droplet) |

---

## 7. One-command alternative

Scripts under `deploy/` do steps 3–6 together:

```powershell
cd "C:\Dev IGE\fanta-web-app"
.\deploy\publish.ps1 -DropletHost YOUR.DROPLET.IP
```

Add `-IdentityFile C:\path\to\id_ed25519` if needed. Certs stay at `/home/` — do not re-upload them.

Later updates:

```powershell
.\deploy\publish.ps1 -DropletHost YOUR.DROPLET.IP
```

---

## 8. Verify

On the droplet:

```bash
curl -Ik --resolve fanta-dmasl26-421419912123poc.ingame.global:443:127.0.0.1 \
  https://fanta-dmasl26-421419912123poc.ingame.global/
```

From anywhere:

```bash
curl -I https://fanta-dmasl26-421419912123poc.ingame.global/
```

Expect `200` and HTML. Open **https://fanta-dmasl26-421419912123poc.ingame.global/** on a phone for camera.

---

## 9. Contact service

Name and company reads go through Node on the droplet, not through the static files. The phone posts two JPEG crops to `POST /api/contact`. nginx proxies `/api/` to `127.0.0.1:8787`.

Install Node 20 on the droplet once (`node` must be at `/usr/bin/node`). Create the key file once. It is not in git:

```bash
mkdir -p /etc/fanta
printf 'GEMINI_API_KEY=your-paid-key\n' > /etc/fanta/contact.env
chmod 600 /etc/fanta/contact.env
chown www-data:www-data /etc/fanta/contact.env
```

Use a paid Gemini key. The free tier is marked as used to improve Google’s products. `deploy/publish.ps1` copies `server/contact.mjs` to `/opt/fanta-contact` and restarts `fanta-contact`. Without the key, the service stays up and returns empty name and company. Scans still score from the QR.

Check:

```bash
curl -s http://127.0.0.1:8787/api/health
```

Expect `{"ok":true}`.

---

## 10. What not to do

- Do not use Cloudflare **Flexible**. Origin must be HTTPS; **Full (strict)** is required.
- Do not put `ingameglobal.key` in git.
- Do not run `npm run dev` / Vite on the droplet. Serve the built files.
- Do not expose extra ports. nginx on 80/443 is enough.

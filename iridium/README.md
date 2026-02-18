# Iridium Registry — Deployment Guide

## Requirements
- Node.js 18+ (`node --version`)
- nginx
- A DNS A record: `your.domain.com` → your server IP

---

## 1. Install Node.js (if needed)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

---

## 2. Deploy the app
```bash
sudo cp -r iridium/ /opt/iridium
cd /opt/iridium
sudo npm install --omit=dev
sudo mkdir -p data
sudo chown -R www-data:www-data /opt/iridium
```

---

## 3. Run setup (creates config.json with hashed password)
```bash
cd /opt/iridium
sudo -u www-data node setup.js
```
You'll be prompted for a port (default 3000) and your admin password.
The password is **bcrypt-hashed** — it is never stored in plain text.

---

## 4. Install and start the systemd service
```bash
sudo cp /opt/iridium/iridium.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable iridium
sudo systemctl start iridium
sudo systemctl status iridium   # should show "active (running)"
```

---

## 5. Configure nginx
```bash
sudo cp /opt/iridium/nginx-iridium.conf /etc/nginx/sites-available/iridium
sudo ln -s /etc/nginx/sites-available/iridium /etc/nginx/sites-enabled/iridium
sudo nginx -t          # test config
sudo systemctl reload nginx
```

---

## 6. (Recommended) Add HTTPS with Let's Encrypt
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your.domain.com
```
After certbot runs, uncomment the HTTPS block in `nginx-iridium.conf`
and also change this line in `server.js`:
```js
cookie: { ..., secure: true }
```
Then restart: `sudo systemctl restart iridium`

---

## Changing the admin password
```bash
cd /opt/iridium
sudo -u www-data node setup.js
sudo systemctl restart iridium
```

---

## Data location
Node data is stored at `/opt/iridium/data/nodes.json` — plain JSON,
easy to back up with a cron job or rsync.

---

## Useful commands
```bash
sudo systemctl status iridium        # check status
sudo journalctl -u iridium -f        # live logs
sudo systemctl restart iridium       # restart after config changes
```

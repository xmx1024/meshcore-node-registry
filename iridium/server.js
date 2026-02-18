'use strict';

const express        = require('express');
const session        = require('express-session');
const bcrypt         = require('bcrypt');
const fs             = require('fs');
const path           = require('path');
const crypto         = require('crypto');

// ── Config ────────────────────────────────────────────────────────────────────
// To change the password, run:  node hash-password.js <newpassword>
// Then paste the output into config.json as "passwordHash"
const CONFIG_FILE = path.join(__dirname, 'config.json');
const DATA_FILE   = path.join(__dirname, 'data', 'nodes.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    console.error('ERROR: config.json not found. Run setup.js first.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}

// ── Data helpers ──────────────────────────────────────────────────────────────
function readNodes() {
  if (!fs.existsSync(DATA_FILE)) return [];
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeNodes(nodes) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(nodes, null, 2));
}

// ── Rate limiting (login) ────────────────────────────────────────────────────
const loginAttempts = new Map();  // ip -> { count, resetAt }
const MAX_ATTEMPTS  = 4;
const LOCKOUT_MS    = 5 * 60 * 1000;  // 5 minutes

function getClientIp(req) {
  // Trust Cloudflare's CF-Connecting-IP header, fall back to X-Forwarded-For
  return req.headers['cf-connecting-ip']
      || (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      || req.ip;
}

function isRateLimited(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    loginAttempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailedAttempt(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry || Date.now() > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: Date.now() + LOCKOUT_MS });
  } else {
    entry.count++;
  }
}

function clearAttempts(ip) {
  loginAttempts.delete(ip);
}

// ── App ───────────────────────────────────────────────────────────────────────
const app    = express();
const config = loadConfig();

// Trust proxy (Cloudflare → nginx → app)
app.set('trust proxy', true);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(session({
  secret:            config.sessionSecret,
  resave:            false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure:   false,   // Set to true once behind Cloudflare SSL
    sameSite: 'lax',
    maxAge:   8 * 60 * 60 * 1000  // 8 hours
  }
}));

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// ── Auth middleware ───────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ── Auth routes ───────────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const ip = getClientIp(req);

  if (isRateLimited(ip)) {
    const entry = loginAttempts.get(ip);
    const secsLeft = Math.ceil((entry.resetAt - Date.now()) / 1000);
    return res.status(429).json({ error: `Too many attempts. Try again in ${secsLeft}s` });
  }

  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });

  const match = await bcrypt.compare(password, config.passwordHash);
  if (!match) {
    recordFailedAttempt(ip);
    const entry = loginAttempts.get(ip);
    const remaining = MAX_ATTEMPTS - entry.count;
    await new Promise(r => setTimeout(r, 500));
    if (remaining <= 0) {
      return res.status(429).json({ error: 'Too many attempts. Locked out for 5 minutes' });
    }
    return res.status(401).json({ error: `Incorrect password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining` });
  }

  clearAttempts(ip);
  req.session.authenticated = true;
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/auth-status', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.authenticated) });
});

// ── Node CRUD routes ──────────────────────────────────────────────────────────

// GET all nodes (public read)
app.get('/api/nodes', (req, res) => {
  res.json(readNodes());
});

// POST new node (auth required)
app.post('/api/nodes', requireAuth, (req, res) => {
  const { id, type, location, hardware, notes, image } = req.body;
  if (!id || !type) return res.status(400).json({ error: 'id and type are required' });

  const nodes = readNodes();
  if (nodes.find(n => n.id === id)) {
    return res.status(409).json({ error: 'Node ID already exists' });
  }

  const status = req.body.status || 'active';
  const lat = (req.body.lat !== undefined && req.body.lat !== null && req.body.lat !== '') ? parseFloat(req.body.lat) : null;
  const lon = (req.body.lon !== undefined && req.body.lon !== null && req.body.lon !== '') ? parseFloat(req.body.lon) : null;
  const node = { id, type, status, location: location || '', hardware: hardware || '', notes: notes || '', lat, lon, image: image || '' };
  nodes.push(node);
  writeNodes(nodes);
  res.status(201).json(node);
});

// PUT update node (auth required)
app.put('/api/nodes/:id', requireAuth, (req, res) => {
  const nodes = readNodes();
  const idx = nodes.findIndex(n => n.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Node not found' });

  const { type, location, hardware, notes, image } = req.body;
  const status = req.body.status || 'active';
  const lat = (req.body.lat !== undefined && req.body.lat !== null && req.body.lat !== '') ? parseFloat(req.body.lat) : null;
  const lon = (req.body.lon !== undefined && req.body.lon !== null && req.body.lon !== '') ? parseFloat(req.body.lon) : null;
  nodes[idx] = { id: req.params.id, type, status, location: location || '', hardware: hardware || '', notes: notes || '', lat, lon, image: image || '' };
  writeNodes(nodes);
  res.json(nodes[idx]);
});

// DELETE node (auth required)
app.delete('/api/nodes/:id', requireAuth, (req, res) => {
  let nodes = readNodes();
  const idx = nodes.findIndex(n => n.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Node not found' });

  nodes.splice(idx, 1);
  writeNodes(nodes);
  res.json({ ok: true });
});

// ── Catch-all: serve index.html for node sub-paths (SPA routing) ─────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = config.port || 3000;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Iridium Registry running on 127.0.0.1:${PORT}`);
});

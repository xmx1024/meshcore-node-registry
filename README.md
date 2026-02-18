# MeshCore Node Registry

A self-hosted node registry for [MeshCore](https://github.com/ripplebiz/MeshCore) LoRa mesh networks. Catalog and manage your radio nodes with a clean, dark terminal-aesthetic web interface.

![Stack](https://img.shields.io/badge/stack-Node.js%20%2B%20Express-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Public read** — anyone can browse, search, and filter nodes
- **Admin mode** — password-protected add / edit / delete (bcrypt, rate-limited)
- **Node types** — Room Server, Repeater, Client
- **Node status** — Active, Inactive, Planned
- **Search** — real-time filtering across all fields
- **Single-node view** — deep-link to `/<node-id>` for a focused card overlay
- **OSM map** — optional Leaflet/OpenStreetMap map pinned to approximate coordinates
- **Photo** — optional node photo via URL
- **No build step** — entire frontend is a single HTML file

## Stack

| Layer | Tech |
|---|---|
| Backend | Node.js 20 + Express |
| Auth | bcrypt (cost 12) + express-session |
| Storage | Flat JSON file |
| Frontend | Vanilla JS, single HTML file |
| Maps | Leaflet.js + OpenStreetMap |

## Quick Start

See **[iridium/README.md](iridium/README.md)** for full deployment instructions (systemd service, nginx reverse proxy, HTTPS with Let's Encrypt).

```bash
cd iridium
npm install
node setup.js        # set port + admin password, seeds example nodes
npm start
```

Then open `http://localhost:3000`.

The network name and branding in `public/index.html` can be customised to match your own mesh network.

## Node Fields

| Field | Required | Notes |
|---|---|---|
| ID / Name | Yes | Unique identifier, e.g. `NODE-03` |
| Type | Yes | `room-server`, `repeater`, or `client` |
| Status | Yes | `active`, `inactive`, or `planned` |
| Location | No | Human-readable description |
| Hardware | No | Device model / chipset |
| Notes / Function | No | Role in the mesh, any relevant info |
| Latitude / Longitude | No | Shows OSM map pin in expanded view |
| Photo URL | No | Shows image in expanded view |

## Security Notes

- Passwords are bcrypt-hashed (cost factor 12) — never stored in plaintext
- Sessions use a randomly generated 48-byte secret
- Login rate-limited: 4 failed attempts → 5-minute lockout per IP
- Cloudflare-aware IP resolution (`CF-Connecting-IP`)
- `config.json` and `data/nodes.json` are excluded from this repo — generate them with `setup.js`

## License

MIT

#!/usr/bin/env node
// Run once during setup:  node setup.js
// It will prompt for a password, hash it, and write config.json

'use strict';

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');
const readline = require('readline');

const CONFIG_FILE = path.join(__dirname, 'config.json');
const DATA_FILE   = path.join(__dirname, 'data', 'nodes.json');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question, hidden = false) {
  return new Promise(resolve => {
    if (hidden) process.stdout.write(question);
    rl.question(hidden ? '' : question, answer => resolve(answer.trim()));
  });
}

async function main() {
  console.log('\n=== Iridium Registry Setup ===\n');

  const port = await ask('Port to run on [3000]: ') || '3000';

  // Hidden password input
  process.stdout.write('Admin password: ');
  const password = await new Promise(resolve => {
    const stdin = process.openStdin();
    process.stdin.setRawMode(true);
    let pw = '';
    process.stdin.on('data', ch => {
      ch = ch.toString();
      if (ch === '\n' || ch === '\r' || ch === '\u0004') {
        process.stdin.setRawMode(false);
        process.stdout.write('\n');
        resolve(pw);
      } else if (ch === '\u007f') {
        pw = pw.slice(0, -1);
      } else {
        pw += ch;
        process.stdout.write('*');
      }
    });
  });

  if (!password || password.length < 6) {
    console.error('Password must be at least 6 characters.');
    process.exit(1);
  }

  console.log('Hashing password...');
  const hash = await bcrypt.hash(password, 12);
  const secret = crypto.randomBytes(48).toString('hex');

  const config = {
    port:           parseInt(port, 10),
    passwordHash:   hash,
    sessionSecret:  secret
  };

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
  console.log('  config.json written (mode 600)');

  // Seed data file if it doesn't exist
  if (!fs.existsSync(DATA_FILE)) {
    const seed = [
      { id: 'IRIDIUM-03', type: 'repeater', location: 'Ridge Line — Weatherproof Box',  hardware: 'RAK WisBlock RAK19007 + RAK4631 (nRF52840)',    notes: 'Long-range repeater on high ground. Power saving enabled. Solar + LiPo. ~3 mile coverage east.' },
      { id: 'IRIDIUM-04', type: 'repeater', location: 'Barn — South Wall',              hardware: 'LILYGO T-Beam Supreme (ESP32-S3 + SX1262)',     notes: 'Repeater with integrated GPS. 18650 battery. Bridges gap to eastern clients. LOS to IRIDIUM-01.' },
      { id: 'IRIDIUM-05', type: 'repeater', location: 'Water Tower — Pole Mount',       hardware: 'Heltec Wireless Tracker (ESP32-S3 + SX1262)',   notes: 'Elevated repeater. Compact form. GPS beacon enabled. Mains powered via weatherproof junction box.' },
      { id: 'IRIDIUM-06', type: 'client',   location: 'Residence — Desk',               hardware: 'LILYGO T-Deck (ESP32-S3 + SX1262)',             notes: 'Standalone client. QWERTY keyboard + 2.8" IPS screen. No phone app required. Primary comms terminal.' },
      { id: 'IRIDIUM-07', type: 'client',   location: 'Field Kit — Portable',           hardware: 'LILYGO T-Echo (nRF52840 + SX1262)',             notes: 'Handheld client. E-Ink display, GPS, NFC. Multi-day battery life. BLE pairing to MeshCore app.' },
      { id: 'IRIDIUM-08', type: 'client',   location: 'Vehicle — Dash Mount',           hardware: 'Seeed Studio T1000-E (nRF52840 + SX1262)',      notes: 'Compact tracker/client. Built-in GPS. Used for mobile node tracking. Rechargeable LiPo.' }
    ];
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
    console.log('  data/nodes.json seeded with example nodes');
  } else {
    console.log('  data/nodes.json already exists, skipping seed');
  }

  console.log('\n✓ Setup complete. Start the server with:  npm start\n');
  rl.close();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });

#!/usr/bin/env node
/**
 * CU Live - Keep connection open, interactive testing
 * Commands: s=start, e=esc, r=reset, q=quit
 */

import { ControlUnit } from '../src/services/controlUnit.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logFile = path.join(logsDir, `cu-live-${timestamp}.json`);

const log = { startTime: new Date().toISOString(), events: [] };
const startTime = Date.now();

function elapsed() { return Date.now() - startTime; }

const STATES = ['RACING', 'LIGHTS_1', 'LIGHTS_2', 'LIGHTS_3', 'LIGHTS_4', 'LIGHTS_5', 'FALSE_START', 'GO', '?', 'STOPPED'];

let lastStart = -1;

async function main() {
  console.log('🏎️  CU Live Test');
  console.log('================\n');

  const cu = new ControlUnit();

  cu.on('timer', (t) => {
    const e = { time: elapsed(), type: 'timer', ...t };
    log.events.push(e);
    console.log(`⏱️  [${elapsed()}ms] TIMER ctrl=${t.controller} ts=${t.timestamp} sector=${t.sector}`);
  });

  cu.on('status', (s) => {
    if (s.start !== lastStart) {
      const e = { time: elapsed(), type: 'status', start: s.start, stateName: STATES[s.start] };
      log.events.push(e);
      console.log(`📊 [${elapsed()}ms] STATUS: ${STATES[s.start]} (start=${s.start})`);
      lastStart = s.start;
    }
  });

  cu.on('error', (e) => console.log(`❌ Error: ${e.message}`));
  cu.on('disconnected', () => console.log('⚠️  Disconnected!'));

  try {
    console.log('🔗 Scanning...');
    const address = await cu.scan(15000);
    console.log(`📍 Found: ${address}`);

    await cu.connect(address);
    console.log('✅ Connected!\n');

    const version = await cu.version();
    console.log(`📦 Version: ${version}\n`);

    // Start polling
    const pollTimer = setInterval(async () => {
      try { await cu.poll(); } catch (e) {}
    }, 100);

    console.log('Commands:');
    console.log('  s = START (lights)');
    console.log('  e = ESC (pause/stop)');
    console.log('  r = RESET timer');
    console.log('  q = QUIT\n');
    console.log('Listening for events... (pass cars on track)\n');

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    rl.on('line', async (line) => {
      const cmd = line.trim().toLowerCase();
      try {
        if (cmd === 's') {
          console.log('▶️  START...');
          await cu.press(ControlUnit.START_ENTER_BUTTON_ID);
        } else if (cmd === 'e') {
          console.log('⏸️  ESC...');
          await cu.press(ControlUnit.PACE_CAR_ESC_BUTTON_ID);
        } else if (cmd === 'r') {
          console.log('🔄 RESET...');
          await cu.reset();
        } else if (cmd === 'q') {
          console.log('👋 Quitting...');
          clearInterval(pollTimer);
          await cu.disconnect();
          log.endTime = new Date().toISOString();
          fs.writeFileSync(logFile, JSON.stringify(log, null, 2));
          console.log(`📝 Log: ${logFile}`);
          process.exit(0);
        }
      } catch (err) {
        console.error('Cmd error:', err.message);
      }
    });

    // Keep alive
    process.on('SIGINT', async () => {
      console.log('\n👋 Interrupted...');
      clearInterval(pollTimer);
      await cu.disconnect();
      log.endTime = new Date().toISOString();
      fs.writeFileSync(logFile, JSON.stringify(log, null, 2));
      console.log(`📝 Log: ${logFile}`);
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  }
}

main();

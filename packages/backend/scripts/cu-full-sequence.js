#!/usr/bin/env node
/**
 * CU Full Sequence Test - Start, Pause, Resume, Stop
 * Usage: node cu-full-sequence.js
 */

import { ControlUnit } from '../src/services/controlUnit.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logFile = path.join(logsDir, `cu-full-sequence-${timestamp}.json`);

const STATES = ['RACING', 'LIGHTS_1', 'LIGHTS_2', 'LIGHTS_3', 'LIGHTS_4', 'LIGHTS_5', 'FALSE_START', 'GO', '?', 'STOPPED'];

const log = { startTime: new Date().toISOString(), sequence: [], events: [] };
const startTime = Date.now();
function elapsed() { return Date.now() - startTime; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function logEvent(type, data) {
  const e = { time: elapsed(), type, ...data };
  log.events.push(e);
  return e;
}

async function main() {
  console.log('🏎️  CU Full Sequence Test');
  console.log('=========================');
  console.log('Sequence: RESET → START → [race] → PAUSE → [wait] → RESUME → [race] → STOP\n');

  const cu = new ControlUnit();
  let lastStart = -1;
  let timerCount = 0;

  cu.on('timer', (t) => {
    timerCount++;
    logEvent('timer', { controller: t.controller, timestamp: t.timestamp, sector: t.sector });
    console.log(`  ⏱️  TIMER #${timerCount}: ctrl=${t.controller} ts=${t.timestamp} sector=${t.sector}`);
  });

  cu.on('status', (s) => {
    if (s.start !== lastStart) {
      logEvent('status', { start: s.start, state: STATES[s.start] });
      console.log(`  📊 STATUS: ${STATES[s.start]}`);
      lastStart = s.start;
    }
  });

  try {
    // Connect
    console.log('🔗 Scanning for Control Unit...');
    const address = await cu.scan(15000);
    console.log(`📍 Found: ${address}`);
    await cu.connect(address);
    console.log('✅ Connected!\n');

    const version = await cu.version();
    log.cuVersion = version;
    console.log(`📦 CU Version: ${version}\n`);

    // Start polling
    const poll = setInterval(async () => {
      try { await cu.poll(); } catch (e) {}
    }, 100);

    await sleep(500);

    // ========== SEQUENCE ==========

    // 1. RESET
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1️⃣  RESET');
    log.sequence.push({ step: 1, action: 'RESET', time: elapsed() });
    await cu.reset();
    await sleep(1500);

    // 2. START (lights sequence)
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('2️⃣  START (départ avec feux)');
    log.sequence.push({ step: 2, action: 'START', time: elapsed() });
    await cu.press(ControlUnit.START_ENTER_BUTTON_ID);

    console.log('   ⏳ Waiting 10s for lights + racing...');
    console.log('   👉 Pass cars over finish line!\n');
    await sleep(10000);

    // 3. PAUSE
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('3️⃣  PAUSE (ESC)');
    log.sequence.push({ step: 3, action: 'PAUSE', time: elapsed() });
    await cu.press(ControlUnit.PACE_CAR_ESC_BUTTON_ID);

    console.log('   ⏸️  Race paused - waiting 5s...\n');
    await sleep(5000);

    // 4. RESUME (START again)
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('4️⃣  RESUME (START)');
    log.sequence.push({ step: 4, action: 'RESUME', time: elapsed() });
    await cu.press(ControlUnit.START_ENTER_BUTTON_ID);

    console.log('   ▶️  Race resumed - waiting 10s...');
    console.log('   👉 Pass cars over finish line!\n');
    await sleep(10000);

    // 5. STOP
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('5️⃣  STOP (ESC)');
    log.sequence.push({ step: 5, action: 'STOP', time: elapsed() });
    await cu.press(ControlUnit.PACE_CAR_ESC_BUTTON_ID);

    console.log('   ⏹️  Race stopped\n');
    await sleep(1000);

    // ========== SUMMARY ==========
    clearInterval(poll);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total timer events: ${timerCount}`);

    const timerEvents = log.events.filter(e => e.type === 'timer');
    if (timerEvents.length > 0) {
      const byCtrl = {};
      timerEvents.forEach(t => byCtrl[t.controller] = (byCtrl[t.controller] || 0) + 1);
      console.log('By controller:', byCtrl);
    }

    const statusEvents = log.events.filter(e => e.type === 'status');
    const statesSeen = [...new Set(statusEvents.map(e => e.state))];
    console.log('States seen:', statesSeen.join(' → '));

    console.log('\nSequence executed:');
    log.sequence.forEach(s => console.log(`  ${s.step}. ${s.action} at ${s.time}ms`));

    // Keep connection alive - don't disconnect
    console.log('\n✅ Test complete (connection kept alive)');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    log.endTime = new Date().toISOString();
    log.summary = { timerCount, totalEvents: log.events.length };
    fs.writeFileSync(logFile, JSON.stringify(log, null, 2));
    console.log(`\n📝 Log saved: ${logFile}`);
  }
}

main();

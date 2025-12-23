#!/usr/bin/env node
/**
 * CU Sequence Test - Test start/pause/stop sequence
 */

import { ControlUnit } from '../src/services/controlUnit.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logsDir = path.join(__dirname, '../logs');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logFile = path.join(logsDir, `cu-sequence-${timestamp}.json`);

const log = {
  startTime: new Date().toISOString(),
  events: [],
};

function logEvent(type, data) {
  const elapsed = Date.now() - new Date(log.startTime).getTime();
  log.events.push({ elapsed, type, data });
  console.log(`[${elapsed}ms] ${type}:`, typeof data === 'object' ? JSON.stringify(data) : data);
}

function saveLog() {
  log.endTime = new Date().toISOString();
  fs.writeFileSync(logFile, JSON.stringify(log, null, 2));
  console.log(`\n📝 Log saved: ${logFile}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🏎️  CU Sequence Test');
  console.log('====================\n');

  const cu = new ControlUnit();
  let pollTimer = null;

  // Event listeners
  cu.on('timer', (t) => logEvent('TIMER', { ctrl: t.controller, ts: t.timestamp, sector: t.sector }));
  cu.on('status', (s) => logEvent('STATUS', { start: s.start, mode: s.mode, fuel: s.fuel }));
  cu.on('error', (e) => logEvent('ERROR', e.message));
  cu.on('disconnected', () => logEvent('DISCONNECTED', ''));

  try {
    // Connect
    console.log('🔗 Connecting...');
    const address = await cu.scan(10000);
    await cu.connect(address);
    await sleep(500);
    logEvent('CONNECTED', address);

    // Start polling in background
    pollTimer = setInterval(async () => {
      try { await cu.poll(); } catch (e) {}
    }, 200);

    // Get initial status
    console.log('\n📊 Initial status...');
    await sleep(1000);

    // SEQUENCE START
    console.log('\n🚦 === SEQUENCE START ===\n');

    // 1. START (press start button - begins lights sequence)
    console.log('1️⃣  START (lights sequence)...');
    logEvent('CMD', 'START');
    await cu.press(ControlUnit.START_ENTER_BUTTON_ID);
    await sleep(3000); // Wait for lights

    // 2. Wait and observe (race should be running after lights)
    console.log('2️⃣  Race running, waiting 5s for timer events...');
    logEvent('CMD', 'WAIT_FOR_TIMERS');
    await sleep(5000);

    // 3. PAUSE (press ESC)
    console.log('3️⃣  PAUSE (ESC)...');
    logEvent('CMD', 'PAUSE');
    await cu.press(ControlUnit.PACE_CAR_ESC_BUTTON_ID);
    await sleep(2000);

    // 4. RESUME (press START again)
    console.log('4️⃣  RESUME (START)...');
    logEvent('CMD', 'RESUME');
    await cu.press(ControlUnit.START_ENTER_BUTTON_ID);
    await sleep(3000);

    // 5. Wait for more timers
    console.log('5️⃣  Running again, waiting 5s...');
    logEvent('CMD', 'WAIT_FOR_TIMERS_2');
    await sleep(5000);

    // 6. STOP (press ESC twice = full stop)
    console.log('6️⃣  STOP (ESC x2)...');
    logEvent('CMD', 'STOP');
    await cu.press(ControlUnit.PACE_CAR_ESC_BUTTON_ID);
    await sleep(500);
    await cu.press(ControlUnit.PACE_CAR_ESC_BUTTON_ID);
    await sleep(1000);

    console.log('\n✅ === SEQUENCE COMPLETE ===\n');

    // Summary
    const timers = log.events.filter(e => e.type === 'TIMER');
    const statuses = log.events.filter(e => e.type === 'STATUS');

    console.log('📊 Summary:');
    console.log(`   Timer events: ${timers.length}`);
    console.log(`   Status events: ${statuses.length}`);

    if (timers.length > 0) {
      const byCtrl = {};
      timers.forEach(t => {
        byCtrl[t.data.ctrl] = (byCtrl[t.data.ctrl] || 0) + 1;
      });
      console.log('   Timers by controller:', byCtrl);
    }

    // Show status changes
    const startStates = ['RACING', 'LIGHTS_1', 'LIGHTS_2', 'LIGHTS_3', 'LIGHTS_4', 'LIGHTS_5', 'FALSE_START', 'GO', '?', 'STOPPED'];
    const uniqueStates = [...new Set(statuses.map(s => startStates[s.data.start] || s.data.start))];
    console.log('   Status states seen:', uniqueStates);

  } catch (error) {
    console.error('❌ Error:', error.message);
    logEvent('FATAL', error.message);
  } finally {
    if (pollTimer) clearInterval(pollTimer);
    try { await cu.disconnect(); } catch (e) {}
    saveLog();
  }
}

main();

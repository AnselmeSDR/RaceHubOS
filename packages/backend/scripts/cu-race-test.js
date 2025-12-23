#!/usr/bin/env node
/**
 * CU Race Test - Reset and start a race, capture timer events
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
const logFile = path.join(logsDir, `cu-race-${timestamp}.json`);

const log = { startTime: new Date().toISOString(), events: [] };
const timers = [];
const statuses = [];

function logEvent(type, data) {
  const elapsed = Date.now() - new Date(log.startTime).getTime();
  log.events.push({ elapsed, type, data });

  if (type === 'TIMER') {
    console.log(`⏱️  [${elapsed}ms] TIMER: ctrl=${data.ctrl}, ts=${data.ts}, sector=${data.sector}`);
  } else if (type === 'STATUS') {
    const states = ['RACING', 'LIGHTS_1', 'LIGHTS_2', 'LIGHTS_3', 'LIGHTS_4', 'LIGHTS_5', 'FALSE_START', 'GO'];
    console.log(`📊 [${elapsed}ms] STATUS: ${states[data.start] || data.start}`);
  } else {
    console.log(`[${elapsed}ms] ${type}: ${JSON.stringify(data)}`);
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('🏎️  CU Race Test - Reset & Start');
  console.log('=================================\n');

  const cu = new ControlUnit();
  let pollTimer = null;
  let lastStart = -1;

  cu.on('timer', (t) => {
    timers.push(t);
    logEvent('TIMER', { ctrl: t.controller, ts: t.timestamp, sector: t.sector });
  });

  cu.on('status', (s) => {
    statuses.push(s);
    if (s.start !== lastStart) {
      logEvent('STATUS', { start: s.start });
      lastStart = s.start;
    }
  });

  cu.on('error', (e) => logEvent('ERROR', e.message));

  try {
    console.log('🔗 Connecting...');
    const address = await cu.scan(10000);
    await cu.connect(address);
    await sleep(500);
    console.log('✅ Connected\n');

    // Start fast polling
    pollTimer = setInterval(async () => {
      try { await cu.poll(); } catch (e) {}
    }, 100);

    // 1. RESET
    console.log('🔄 1. RESET timer...');
    await cu.reset();
    await sleep(1000);

    // 2. ESC to make sure we're stopped
    console.log('⏹️  2. ESC (ensure stopped)...');
    await cu.press(ControlUnit.PACE_CAR_ESC_BUTTON_ID);
    await sleep(1000);

    // 3. START race
    console.log('🚦 3. START race...');
    await cu.press(ControlUnit.START_ENTER_BUTTON_ID);

    // 4. Wait and watch lights + timers
    console.log('\n⏳ Waiting 30s for lights sequence and timer events...');
    console.log('   👉 Pass cars over finish line!\n');

    await sleep(30000);

    // 5. STOP
    console.log('\n⏹️  5. STOP...');
    await cu.press(ControlUnit.PACE_CAR_ESC_BUTTON_ID);
    await sleep(1000);

    // Summary
    console.log('\n📊 SUMMARY');
    console.log('==========');
    console.log(`Timer events: ${timers.length}`);
    if (timers.length > 0) {
      const byCtrl = {};
      timers.forEach(t => byCtrl[t.controller] = (byCtrl[t.controller] || 0) + 1);
      console.log('By controller:', byCtrl);
      console.log('First 5 timers:', timers.slice(0, 5).map(t => `ctrl${t.controller}:${t.timestamp}`));
    }

    const states = ['RACING', 'LIGHTS_1', 'LIGHTS_2', 'LIGHTS_3', 'LIGHTS_4', 'LIGHTS_5', 'FALSE_START', 'GO'];
    const seenStates = [...new Set(statuses.map(s => states[s.start] || s.start))];
    console.log('Status states seen:', seenStates);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (pollTimer) clearInterval(pollTimer);
    try { await cu.disconnect(); } catch (e) {}

    log.endTime = new Date().toISOString();
    log.timers = timers;
    log.summary = { timerCount: timers.length, states: statuses.map(s => s.start) };
    fs.writeFileSync(logFile, JSON.stringify(log, null, 2));
    console.log(`\n📝 Log: ${logFile}`);
  }
}

main();

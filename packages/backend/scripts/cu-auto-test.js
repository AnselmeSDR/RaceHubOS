#!/usr/bin/env node
/**
 * CU Automated Test Script
 * Runs automated tests and logs all CU events
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
const logFile = path.join(logsDir, `cu-auto-test-${timestamp}.json`);

const log = {
  startTime: new Date().toISOString(),
  events: [],
  tests: [],
};

function logEvent(type, data) {
  const event = {
    time: new Date().toISOString(),
    elapsed: Date.now() - new Date(log.startTime).getTime(),
    type,
    data,
  };
  log.events.push(event);
  console.log(`[${event.elapsed}ms] ${type}:`, JSON.stringify(data).substring(0, 100));
}

function logTest(name, success, details = {}) {
  log.tests.push({ name, success, details, time: new Date().toISOString() });
  console.log(`${success ? '✅' : '❌'} TEST: ${name}`, details.error || '');
}

function saveLog() {
  log.endTime = new Date().toISOString();
  fs.writeFileSync(logFile, JSON.stringify(log, null, 2));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🏎️  CU Automated Test');
  console.log('=====================');
  console.log(`📝 Log: ${logFile}\n`);

  const cu = new ControlUnit();
  let timerEvents = [];
  let statusEvents = [];
  let pollTimer = null;

  // Event listeners
  cu.on('connected', () => logEvent('connected', {}));
  cu.on('disconnected', () => logEvent('disconnected', {}));
  cu.on('error', (err) => logEvent('error', { message: err.message }));

  cu.on('timer', (timer) => {
    logEvent('timer', timer);
    timerEvents.push(timer);
  });

  cu.on('status', (status) => {
    logEvent('status', status);
    statusEvents.push(status);
  });

  try {
    // TEST 1: Scan
    console.log('\n📡 Test 1: Scanning for CU...');
    const address = await cu.scan(15000);
    logTest('scan', !!address, { address });

    // TEST 2: Connect
    console.log('\n🔗 Test 2: Connecting...');
    await cu.connect(address);
    await sleep(500);
    logTest('connect', cu.isConnected());

    // TEST 3: Version
    console.log('\n📦 Test 3: Getting version...');
    const version = await cu.version();
    logTest('version', !!version, { version });

    // TEST 4: Info
    console.log('\n📋 Test 4: Getting info...');
    const info = await cu.getInfo();
    logTest('info', !!info, info);

    // TEST 5: Poll status
    console.log('\n📊 Test 5: Polling status...');
    statusEvents = [];
    for (let i = 0; i < 5; i++) {
      await cu.poll();
      await sleep(200);
    }
    logTest('poll_status', statusEvents.length > 0, { count: statusEvents.length });

    // TEST 6: Reset timer
    console.log('\n🔄 Test 6: Reset timer...');
    await cu.reset();
    await sleep(300);
    logTest('reset', true);

    // TEST 7: Start race (lights sequence)
    console.log('\n🚦 Test 7: Starting race (lights sequence)...');
    console.log('   ⏳ Watching for status changes during lights...');
    statusEvents = [];

    await cu.start();

    // Poll rapidly to catch lights sequence
    for (let i = 0; i < 30; i++) {
      await cu.poll();
      await sleep(100);
    }

    const lightStates = statusEvents.map(s => s.startName || s.start);
    logTest('start_race', lightStates.length > 0, { states: lightStates });

    // TEST 8: Wait for timer events (cars passing)
    console.log('\n⏱️  Test 8: Waiting 20s for timer events...');
    console.log('   👉 Pass cars over the finish line now!');
    timerEvents = [];

    // Start continuous polling
    pollTimer = setInterval(async () => {
      try { await cu.poll(); } catch (e) {}
    }, 100);

    await sleep(20000);

    clearInterval(pollTimer);
    pollTimer = null;

    const timersByController = {};
    timerEvents.forEach(t => {
      timersByController[t.controller] = (timersByController[t.controller] || 0) + 1;
    });

    logTest('timer_events', timerEvents.length > 0, {
      count: timerEvents.length,
      byController: timersByController,
      samples: timerEvents.slice(0, 5)
    });

    // TEST 9: Press ESC (stop)
    console.log('\n⏸️  Test 9: Pressing ESC...');
    await cu.press(ControlUnit.PACE_CAR_ESC_BUTTON_ID);
    await sleep(500);
    await cu.poll();
    logTest('press_esc', true);

    // TEST 10: Disconnect
    console.log('\n🔌 Test 10: Disconnecting...');
    await cu.disconnect();
    await sleep(500);
    logTest('disconnect', !cu.isConnected());

  } catch (error) {
    console.error('❌ Error:', error.message);
    logEvent('fatal_error', { message: error.message, stack: error.stack });
    logTest('fatal', false, { error: error.message });
  } finally {
    if (pollTimer) clearInterval(pollTimer);
    try { await cu.disconnect(); } catch (e) {}
  }

  // Summary
  console.log('\n📊 SUMMARY');
  console.log('==========');
  const passed = log.tests.filter(t => t.success).length;
  const failed = log.tests.filter(t => !t.success).length;
  console.log(`Tests: ${passed} passed, ${failed} failed`);
  console.log(`Events logged: ${log.events.length}`);
  console.log(`Timer events: ${timerEvents.length}`);

  saveLog();
  console.log(`\n📝 Full log saved to: ${logFile}`);
}

main().catch(console.error);

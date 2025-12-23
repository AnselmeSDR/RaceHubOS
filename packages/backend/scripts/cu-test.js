#!/usr/bin/env node
/**
 * CU Test Script - Connect to Control Unit and log all events
 * Usage: node scripts/cu-test.js
 *
 * Logs all events to logs/cu-test-<timestamp>.json
 */

import { ControlUnit } from '../src/services/controlUnit.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logsDir = path.join(__dirname, '../logs');

// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logFile = path.join(logsDir, `cu-test-${timestamp}.json`);

// Log storage
const log = {
  startTime: new Date().toISOString(),
  events: [],
  summary: {
    timers: 0,
    statuses: 0,
    errors: 0,
    timersByController: {},
  },
};

// Add event to log
function logEvent(type, data) {
  const event = {
    time: new Date().toISOString(),
    elapsed: Date.now() - new Date(log.startTime).getTime(),
    type,
    data,
  };
  log.events.push(event);

  // Update summary
  if (type === 'timer') {
    log.summary.timers++;
    const ctrl = data.controller;
    log.summary.timersByController[ctrl] = (log.summary.timersByController[ctrl] || 0) + 1;
  } else if (type === 'status') {
    log.summary.statuses++;
  } else if (type === 'error') {
    log.summary.errors++;
  }

  // Save log periodically (every 10 events)
  if (log.events.length % 10 === 0) {
    saveLog();
  }
}

// Save log to file
function saveLog() {
  log.endTime = new Date().toISOString();
  log.duration = Date.now() - new Date(log.startTime).getTime();
  fs.writeFileSync(logFile, JSON.stringify(log, null, 2));
}

// Format time in ms to readable string
function formatTime(ms) {
  if (ms < 1000) return `${ms}ms`;
  const secs = (ms / 1000).toFixed(3);
  return `${secs}s`;
}

// Main
async function main() {
  console.log('🏎️  CU Test Script');
  console.log('==================');
  console.log(`📝 Log file: ${logFile}`);
  console.log('');

  const cu = new ControlUnit();
  let pollInterval = null;
  let lastStatus = null;

  // Setup event listeners
  cu.on('connected', () => {
    console.log('✅ Connected to Control Unit');
    logEvent('connected', {});
  });

  cu.on('disconnected', () => {
    console.log('❌ Disconnected from Control Unit');
    logEvent('disconnected', {});
    saveLog();
  });

  cu.on('error', (error) => {
    console.error('❌ Error:', error.message);
    logEvent('error', { message: error.message, stack: error.stack });
  });

  cu.on('timer', (timer) => {
    const { controller, timestamp, sector } = timer;

    // Calculate lap time from last timestamp for this controller
    const key = `ctrl_${controller}_last`;
    const lastTs = log[key] || 0;
    const lapTime = lastTs > 0 ? timestamp - lastTs : 0;
    log[key] = timestamp;

    console.log(`⏱️  Timer: ctrl=${controller}, sector=${sector}, ts=${timestamp}, lap=${formatTime(lapTime)}`);
    logEvent('timer', { ...timer, lapTime });
  });

  cu.on('status', (status) => {
    const { fuel, start, mode, pit, display } = status;
    const startNames = ['RACING', 'LIGHTS_1', 'LIGHTS_2', 'LIGHTS_3', 'LIGHTS_4', 'LIGHTS_5', 'FALSE_START', 'GO', '?', 'STOPPED'];
    const startName = startNames[start] || `UNKNOWN(${start})`;

    // Only log if status changed
    const statusStr = JSON.stringify(status);
    if (statusStr !== lastStatus) {
      console.log(`📊 Status: start=${startName}, mode=${mode}, fuel=[${fuel.join(',')}], pit=[${pit.map(p => p ? '1' : '0').join('')}]`);
      logEvent('status', { ...status, startName });
      lastStatus = statusStr;
    }
  });

  // Scan for CU
  console.log('🔍 Scanning for Control Unit...');
  try {
    const address = await cu.scan(15000);
    console.log(`📍 Found CU at: ${address}`);
    logEvent('scan', { address });

    // Connect
    console.log('🔗 Connecting...');
    await cu.connect(address);

    // Get version
    const version = await cu.version();
    console.log(`📦 CU Version: ${version}`);
    logEvent('version', { version });

    // Get info
    const info = await cu.getInfo();
    console.log(`ℹ️  CU Info:`, info);
    logEvent('info', info);

    // Start polling
    console.log('');
    console.log('📡 Starting polling (500ms)...');
    console.log('');
    console.log('Commands:');
    console.log('  s - Start race (press START)');
    console.log('  e - Press ESC');
    console.log('  r - Reset timer');
    console.log('  p - Poll once');
    console.log('  i - Get info');
    console.log('  q - Quit');
    console.log('');

    pollInterval = setInterval(async () => {
      try {
        await cu.poll();
      } catch (err) {
        // Ignore timeout errors during polling
        if (!err.message.includes('timeout')) {
          console.error('Poll error:', err.message);
        }
      }
    }, 500);

    // Setup readline for commands
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.on('line', async (line) => {
      const cmd = line.trim().toLowerCase();

      try {
        switch (cmd) {
          case 's':
            console.log('▶️  Starting race...');
            await cu.start();
            logEvent('command', { action: 'start' });
            break;

          case 'e':
            console.log('⏸️  Pressing ESC...');
            await cu.press(ControlUnit.PACE_CAR_ESC_BUTTON_ID);
            logEvent('command', { action: 'esc' });
            break;

          case 'r':
            console.log('🔄 Resetting timer...');
            await cu.reset();
            logEvent('command', { action: 'reset' });
            break;

          case 'p':
            console.log('📡 Polling...');
            await cu.poll();
            break;

          case 'i':
            const info = await cu.getInfo();
            console.log('ℹ️  Info:', info);
            break;

          case 'q':
            console.log('👋 Quitting...');
            clearInterval(pollInterval);
            await cu.disconnect();
            saveLog();
            console.log(`📝 Log saved to: ${logFile}`);
            process.exit(0);
            break;

          default:
            console.log('Unknown command:', cmd);
        }
      } catch (err) {
        console.error('Command error:', err.message);
      }
    });

    // Handle Ctrl+C
    process.on('SIGINT', async () => {
      console.log('\n👋 Interrupted, saving log...');
      clearInterval(pollInterval);
      try {
        await cu.disconnect();
      } catch (e) {}
      saveLog();
      console.log(`📝 Log saved to: ${logFile}`);
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed:', error.message);
    logEvent('error', { message: error.message, phase: 'connect' });
    saveLog();
    process.exit(1);
  }
}

main();

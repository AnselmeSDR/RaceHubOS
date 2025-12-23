#!/usr/bin/env node
/**
 * CU Command - Send a command and watch for 30s
 * Usage: node cu-cmd.js <cmd>
 * cmd: r=reset, s=start, e=esc
 */

import { ControlUnit } from '../src/services/controlUnit.js';

const STATES = ['RACING', 'LIGHTS_1', 'LIGHTS_2', 'LIGHTS_3', 'LIGHTS_4', 'LIGHTS_5', 'FALSE_START', 'GO', '?', 'STOPPED'];
const cmd = process.argv[2];
const watchTime = parseInt(process.argv[3]) || 30000;

if (!cmd) {
  console.log('Usage: node cu-cmd.js <r|s|e> [watchTime]');
  process.exit(1);
}

async function main() {
  const cu = new ControlUnit();
  let lastStart = -1;
  let timerCount = 0;

  cu.on('timer', (t) => {
    timerCount++;
    console.log(`⏱️  TIMER #${timerCount}: ctrl=${t.controller} ts=${t.timestamp} sector=${t.sector}`);
  });

  cu.on('status', (s) => {
    if (s.start !== lastStart) {
      console.log(`📊 STATUS: ${STATES[s.start]} (start=${s.start})`);
      lastStart = s.start;
    }
  });

  try {
    console.log('🔗 Connecting...');
    const address = await cu.scan(10000);
    await cu.connect(address);
    console.log('✅ Connected\n');

    // Start polling
    const poll = setInterval(async () => {
      try { await cu.poll(); } catch (e) {}
    }, 100);

    // Wait a bit for initial status
    await new Promise(r => setTimeout(r, 500));

    // Send command
    if (cmd === 'r') {
      console.log('🔄 Sending RESET...');
      await cu.reset();
    } else if (cmd === 's') {
      console.log('🚦 Sending START...');
      await cu.press(ControlUnit.START_ENTER_BUTTON_ID);
    } else if (cmd === 'e') {
      console.log('⏸️  Sending ESC...');
      await cu.press(ControlUnit.PACE_CAR_ESC_BUTTON_ID);
    } else if (cmd === 'rs') {
      console.log('🔄 Sending RESET...');
      await cu.reset();
      await new Promise(r => setTimeout(r, 1000));
      console.log('🚦 Sending START...');
      await cu.press(ControlUnit.START_ENTER_BUTTON_ID);
    }

    console.log(`\n⏳ Watching for ${watchTime/1000}s... (pass cars!)\n`);
    await new Promise(r => setTimeout(r, watchTime));

    clearInterval(poll);
    console.log(`\n📊 Total timers: ${timerCount}`);

    // Don't disconnect - keep connection alive
    console.log('✅ Done (connection kept alive)');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();

#!/usr/bin/env node
/**
 * CU Fresh Start - ESC to stop, RESET, then START
 */

import { ControlUnit } from '../src/services/controlUnit.js';

const STATES = ['RACING', 'LIGHTS_1', 'LIGHTS_2', 'LIGHTS_3', 'LIGHTS_4', 'LIGHTS_5', 'FALSE_START', 'GO', '?', 'STOPPED'];

async function main() {
  console.log('🏎️  CU Fresh Start Test\n');

  const cu = new ControlUnit();
  let lastStart = -1;

  cu.on('status', (s) => {
    if (s.start !== lastStart) {
      console.log(`📊 STATUS: ${STATES[s.start]} (${s.start})`);
      lastStart = s.start;
    }
  });

  cu.on('timer', (t) => {
    console.log(`⏱️  TIMER: ctrl=${t.controller} ts=${t.timestamp}`);
  });

  try {
    console.log('🔗 Connecting...');
    const address = await cu.scan(15000);
    await cu.connect(address);
    console.log('✅ Connected!\n');

    const poll = setInterval(async () => {
      try { await cu.poll(); } catch (e) {}
    }, 50);

    await new Promise(r => setTimeout(r, 500));

    // 1. ESC to ensure stopped
    console.log('1️⃣  ESC (stop)...');
    await cu.press(ControlUnit.PACE_CAR_ESC_BUTTON_ID);
    await new Promise(r => setTimeout(r, 1500));

    // 2. RESET
    console.log('2️⃣  RESET...');
    await cu.reset();
    await new Promise(r => setTimeout(r, 1500));

    // 3. START
    console.log('3️⃣  START...\n');
    await cu.press(ControlUnit.START_ENTER_BUTTON_ID);

    console.log('⏳ Watching 15s for lights...\n');
    await new Promise(r => setTimeout(r, 15000));

    clearInterval(poll);
    console.log('\n✅ Done');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();

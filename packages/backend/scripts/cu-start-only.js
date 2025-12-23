#!/usr/bin/env node
/**
 * CU Start Only - Just RESET + START to observe lights sequence
 */

import { ControlUnit } from '../src/services/controlUnit.js';

const STATES = ['RACING', 'LIGHTS_1', 'LIGHTS_2', 'LIGHTS_3', 'LIGHTS_4', 'LIGHTS_5', 'FALSE_START', 'GO', '?', 'STOPPED'];

async function main() {
  console.log('🏎️  CU Start Only Test\n');

  const cu = new ControlUnit();
  let lastStart = -1;
  let timerCount = 0;

  cu.on('timer', (t) => {
    timerCount++;
    console.log(`  ⏱️  TIMER #${timerCount}: ctrl=${t.controller} ts=${t.timestamp}`);
  });

  cu.on('status', (s) => {
    if (s.start !== lastStart) {
      console.log(`  📊 STATUS: ${STATES[s.start]} (${s.start})`);
      lastStart = s.start;
    }
  });

  try {
    console.log('🔗 Connecting...');
    const address = await cu.scan(15000);
    await cu.connect(address);
    console.log('✅ Connected!\n');

    // Start polling
    const poll = setInterval(async () => {
      try { await cu.poll(); } catch (e) {}
    }, 50); // Poll faster to catch transitions

    await new Promise(r => setTimeout(r, 500));

    // RESET
    console.log('🔄 RESET...');
    await cu.reset();
    await new Promise(r => setTimeout(r, 2000));

    // START
    console.log('\n🚦 START - watching for 20 seconds...\n');
    await cu.press(ControlUnit.START_ENTER_BUTTON_ID);

    await new Promise(r => setTimeout(r, 20000));

    clearInterval(poll);
    console.log(`\n📊 Total timers: ${timerCount}`);
    console.log('✅ Done');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();

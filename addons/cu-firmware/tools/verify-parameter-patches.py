#!/usr/bin/env python3
"""Independently compile settings in C and compare the complete payload with the UI generator.
Requires the pinned avr-gcc 5.4.0/Atmel3.6.0 toolchain and Node 22+ on PATH.
Runs only in a temporary directory and never accesses a Control Unit.
"""
import importlib.util
import pathlib
import shutil
import subprocess
import tempfile

ADDON = pathlib.Path(__file__).resolve().parents[1]

def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, filename)
    loaded = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loaded)
    return loaded


def main():
    if subprocess.check_output(['avr-gcc', '-dumpversion'], text=True).strip() != '5.4.0':
        raise SystemExit('Pinned avr-gcc 5.4.0 is required')
    with tempfile.TemporaryDirectory(prefix='racehub-cu-verify-') as work:
        root = pathlib.Path(work) / 'firmware'
        shutil.copytree(ADDON / 'vendor/flatout/firmware', root)
        subprocess.run(['python3', str(root / 'build.py'), '--check'], check=True)
        for name in ['rails_emitter.c', 'isr_batch1.c', 'timer2_tick.c']:
            target = root / 'reconstruction/src' / name
            source = target.read_text()
            source = source.replace('d >= 0x1F5', 'd >= 701')
            source = source.replace('lapsense_a_rearm = 5;', 'lapsense_a_rearm = 7;')
            source = source.replace('lapsense_b_rearm = 5;', 'lapsense_b_rearm = 7;')
            target.write_text(source)
        target = root / 'bot/bot_mode.c'
        target.write_text(target.read_text().replace('WATCHDOG_CYCLES = 13', 'WATCHDOG_CYCLES = 20'))
        recon = module('parameter_reconstruction', root / 'reconstruction/build_image.py')
        rows, _ = recon.load_rows()
        image, _, problems = recon.from_source(rows, recon.symbol_maps(rows))
        if problems:
            raise SystemExit('\n'.join(problems))
        (root / 'build/parameter-stock.bin').write_bytes(image)
        build = module('parameter_bot_builder', root / 'build.py')
        (root / 'build/parameter-bot.bin').write_bytes(build.build_bot(image))
        script = r'''
import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const root=process.argv[1], built=process.argv[2];
const {createParameterizedFirmware}=await import(pathToFileURL(root+'/assets/parameters.mjs'));
const {decode}=await import(pathToFileURL(root+'/assets/firmware.mjs'));
for(const [tag,name] of [['v339-stock','stock'],['v339-bot.5','bot']]){
 const text=await fs.readFile(root+'/assets/baselines/'+tag+'.hmf','utf8');
 const result=await createParameterizedFirmware(text,{eventGapMs:701,debounceTicks:7,watchdogCycles:20,ledChase:true,cuSound:true,idleSleep:true,sensorTones:true,pcCarControl:true});
 const compiled=await fs.readFile(built+'/parameter-'+name+'.bin');
 assert.deepEqual(Buffer.from(decode(result.output).image),compiled.subarray(0,0x3800));
 console.log(tag+': every application byte matches the independently compiled C variant');
}
'''
        subprocess.run(['node', '--input-type=module', '-e', script, str(ADDON), str(root / 'build')], check=True)

if __name__ == '__main__':
    main()

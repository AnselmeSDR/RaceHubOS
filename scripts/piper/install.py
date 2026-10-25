#!/usr/bin/env python3
"""Install optional voices in a NEW directory, never into an existing Thorsten home."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import urllib.request

SOURCE = Path(__file__).resolve().parent
DEFAULT_HOME = Path.home() / '.local/share/racehubos-piper-multilang'


def download(url, target, digest):
    temporary = target.with_name(target.name + '.download')
    try:
        with urllib.request.urlopen(url, timeout=120) as response, temporary.open('wb') as out:
            shutil.copyfileobj(response, out)
        if hashlib.sha256(temporary.read_bytes()).hexdigest() != digest:
            raise ValueError('Checksum mismatch: ' + target.name)
        temporary.replace(target)
    finally:
        temporary.unlink(missing_ok=True)


def install(target, languages, runtime=None, model_cache=None):
    target = target.expanduser().resolve()
    manifest = json.loads((SOURCE / 'voices.json').read_text())
    if not languages or any(language not in ('de', 'en', 'fr') for language in languages):
        raise ValueError('Supported languages: de,en,fr')
    # Refuse even an empty existing directory: no merge, overwrite or in-place upgrade.
    if target.exists() or target.is_symlink():
        raise ValueError('Destination already exists; use a new directory: ' + str(target))
    if target in [Path('/opt/racehubos-piper'), Path('/opt/racehubos-piper-multilang')]:
        raise ValueError('Use an unprivileged new directory')
    stage = target.with_name(target.name + '.installing')
    stage.mkdir(parents=True, exist_ok=False)
    try:
        if runtime:
            shutil.copytree(Path(runtime).resolve() / 'venv', stage / 'venv', symlinks=True, ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
        else:
            subprocess.run([sys.executable, '-m', 'venv', str(stage / 'venv')], check=True)
            python = stage / ('venv/Scripts/python.exe' if os.name == 'nt' else 'venv/bin/python3')
            subprocess.run([str(python), '-m', 'pip', 'install', 'piper-tts==1.8.0'], check=True)
        voices = stage / 'voices'
        voices.mkdir()
        installed = []
        for voice in manifest['voices']:
            if voice['language'] not in languages:
                continue
            for filename, source in voice['files'].items():
                name = voice['id'] + '-MODEL_CARD' if filename == 'MODEL_CARD' else filename
                dest = voices / name
                cached = Path(model_cache) / name if model_cache else None
                if cached and cached.is_file():
                    if hashlib.sha256(cached.read_bytes()).hexdigest() != source['sha256']:
                        raise ValueError('Cached model checksum mismatch: ' + name)
                    shutil.copyfile(cached, dest)
                else:
                    download(source['url'], dest, source['sha256'])
            installed.append(voice)
        shutil.copyfile(SOURCE / 'worker-multilang.py', stage / 'worker-multilang.py')
        shutil.copyfile(SOURCE / 'speak.py', stage / 'speak.py')
        (stage / 'voices.json').write_text(json.dumps({'revision': manifest['revision'], 'voices': installed}, indent=2))
        (stage / 'README.txt').write_text('Optional Piper voices. Runtime: GPL-3.0 https://github.com/OHF-Voice/piper1-gpl\nVoice credits and dataset licences: voices/*-MODEL_CARD and voices.json.\nNo service, no RaceHubOS database, no browser-voice registration.\n')
        stage.rename(target)
        return target
    except BaseException:
        shutil.rmtree(stage)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target', type=Path, default=DEFAULT_HOME)
    parser.add_argument('--languages', default='de,en,fr')
    parser.add_argument('--runtime-from', type=Path, help='Copy an existing Piper venv read-only instead of downloading the runtime')
    parser.add_argument('--model-cache', type=Path, help='Directory containing checksum-matching downloaded models')
    args = parser.parse_args()
    print(install(args.target, args.languages.split(','), args.runtime_from, args.model_cache))


if __name__ == '__main__':
    main()

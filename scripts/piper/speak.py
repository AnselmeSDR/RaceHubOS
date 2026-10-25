#!/usr/bin/env python3
"""Independent CLI: generate a WAV, never play audio automatically."""
import argparse
import base64
import json
from pathlib import Path
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--language', choices=['de', 'en', 'fr'], required=True)
    parser.add_argument('--text', required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    home = Path(__file__).resolve().parent
    voices = json.loads((home / 'voices.json').read_text())['voices']
    voice = next(v for v in voices if v['language'] == args.language)
    python = home / ('venv/Scripts/python.exe' if sys.platform == 'win32' else 'venv/bin/python3')
    result = subprocess.run([str(python), '-B', str(home / 'worker-multilang.py'), '--model', str(home / 'voices' / (voice['id'] + '.onnx'))], input=json.dumps({'id': 1, 'text': args.text, 'rate': 0.95}) + '\n', capture_output=True, text=True, timeout=30, check=True)
    response = json.loads(result.stdout)
    if response.get('error'):
        raise ValueError(response['error'])
    with args.output.open('xb') as out:
        out.write(base64.b64decode(response['audio']))
    print(args.output)


if __name__ == '__main__':
    main()

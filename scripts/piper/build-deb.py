#!/usr/bin/env python3
"""Build an independent offline Linux amd64/Python 3.12 package, never install it."""
import argparse
import hashlib
import json
import platform
from pathlib import Path
import shutil
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--runtime-home', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if platform.system() != 'Linux' or platform.machine() not in ('x86_64', 'amd64') or sys.version_info[:2] != (3, 12):
        raise ValueError('This package builder targets Linux amd64 / Python 3.12 only')
    source = args.runtime_home.resolve()
    for required in ['worker-multilang.py', 'voices.json', 'venv/bin/python3']:
        if not (source / required).is_file():
            raise ValueError('Incomplete runtime')
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    stage = output / 'package-root'
    stage.mkdir(exist_ok=False)
    home = stage / 'opt/racehubos-piper-multilang'
    home.parent.mkdir(parents=True)
    shutil.copytree(source, home, symlinks=True, ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
    # Installed code is accessed through python -m / explicit scripts, not relocated pip launchers.
    for p in (home / 'venv/bin').iterdir():
        if not p.is_symlink():
            p.unlink()
    (home / 'venv/pyvenv.cfg').write_text('home = /usr/bin\ninclude-system-site-packages = false\nversion = 3.12\n')
    launcher = stage / 'usr/bin/racehubos-piper-multilang'
    launcher.parent.mkdir(parents=True)
    launcher.write_text('#!/bin/sh\nexec /usr/bin/python3 /opt/racehubos-piper-multilang/speak.py "$@"\n')
    launcher.chmod(0o755)
    shutil.copyfile(Path(__file__).with_name('speak.py'), home / 'speak.py')
    docs = stage / 'usr/share/doc/racehubos-piper-multilang'
    docs.mkdir(parents=True)
    shutil.copyfile('/usr/share/common-licenses/GPL-3', docs / 'GPL-3')
    (docs / 'copyright').write_text('Piper: GPL-3.0, https://github.com/OHF-Voice/piper1-gpl\nThorsten: Thorsten Mueller, CC0 dataset.\nLJ Speech: Keith Ito / Linda Johnson, public domain dataset.\nSiwis: University of Edinburgh / SIWIS corpus, CC-BY-4.0 dataset.\nOriginal model cards, source links and checksums: /opt/racehubos-piper-multilang/voices.json and voices/*-MODEL_CARD.\nPython library licences: venv/lib/python3.12/site-packages/*dist-info/.\nRaceHubOS installer/worker code: Apache-2.0.\n')
    shutil.copyfile('/usr/share/common-licenses/Apache-2.0', docs / 'Apache-2.0')
    control = stage / 'DEBIAN'
    control.mkdir()
    version = '1.29.0+voices.20261023.1'
    size = sum(p.stat().st_size for p in stage.rglob('*') if p.is_file() and not p.is_symlink()) // 1024
    (control / 'control').write_text(f'''Package: racehubos-piper-multilang
Version: {version}
Architecture: amd64
Section: sound
Priority: optional
Maintainer: RaceHubOS contributors <noreply@localhost>
Installed-Size: {size}
Depends: python3 (>= 3.12), python3 (<< 3.13), libc6 (>= 2.35), libstdc++6 (>= 12), libgcc-s1, zlib1g
Description: Optional offline Piper speech for RaceHubOS in German, English and French
 Independent runtime with Thorsten, LJ Speech and Siwis voice models.
 No service, installation-time downloads, database or existing voice changes.
''')
    package = output / f'racehubos-piper-multilang_{version}_amd64.deb'
    subprocess.run(['dpkg-deb', '--root-owner-group', '-Zzstd', '-z8', '--threads-max=2', '--build', str(stage), str(package)], check=True)
    Path(str(package) + '.sha256').write_text(hashlib.sha256(package.read_bytes()).hexdigest() + '  ' + package.name + '\n')
    print(package)


if __name__ == '__main__':
    main()

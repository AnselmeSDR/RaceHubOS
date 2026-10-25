#!/usr/bin/env python3
"""Read a Cockpit-XP backup without executing its programs, add-ons or XML code."""
import base64
import json
from pathlib import Path, PurePosixPath
import sqlite3
import sys
import tempfile
import xml.etree.ElementTree as ET
import zipfile

def decode(data):
    try:
        return data.decode('utf-8')
    except UnicodeDecodeError:
        return data.decode('cp1252', errors='replace')

def xml_values(text):
    if not text or len(text) > 1000000 or '<!' in text:
        return {}
    try:
        return {child.tag: (child.text or '').strip() for child in ET.fromstring(text)}
    except ET.ParseError:
        return {}


def service_values(row):
    text = row.get('ServiceWerte') or ''
    if not text or len(text) > 1000000 or '<!' in text:
        return None
    try:
        item = ET.fromstring(text).find('ServiceIntervalle')
        return {'active': bool(row.get('ServiceAktiv')), 'values': dict(item.attrib)} if item is not None else None
    except ET.ParseError:
        return None

def read_history(archive, members, temporary):
    found = [m for m in members if m.filename.replace('\\', '/').lower().endswith('database.sqlite/cpv2statistik')]
    if not found:
        return {}
    if len(found) != 1 or found[0].file_size > 50000000:
        raise ValueError('Keine eindeutig unterstützte Cockpit-XP-Statistikdatenbank.')
    target = Path(temporary) / 'statistik.sqlite'
    target.write_bytes(archive.read(found[0]))
    db = sqlite3.connect(target.as_uri() + '?mode=ro', uri=True)
    try:
        db.row_factory = sqlite3.Row
        db.text_factory = decode
        if db.execute('PRAGMA quick_check').fetchone()[0] != 'ok':
            raise ValueError('Cockpit-XP-Statistikdatenbank ist beschädigt.')
        tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        allowed = {
            'StRennResults': ['ID','Runden','Gesamtzeit','BesteRunde','Platz','RennStrecke','Datum','Uhrzeit','MasterID','RennArt','Fahrer','Fahrzeug'],
            'StMoreRecords': ['ID','Date','Car','Driver','Course','Recordtime','Sector','TopSpeedSector','TopSpeedValue'],
            'StRoundTime': ['ID','Date','Course','Car','Driver','RoundTime','Slot'],
            'StRennCounter': ['ID','Typid','Name','Totaltime','Totaldistance','Totalround','LastRunDate'],
            'StWinnerItems': ['ID','Name','AnzahlRennen','AnzahlSiege','TypID'],
        }
        result = {}
        for table, fields in allowed.items():
            if table not in tables:
                continue
            columns = {r[1] for r in db.execute('PRAGMA table_info(' + table + ')')}
            selected = [f for f in fields if f in columns]
            result[table] = [dict(r) for r in db.execute('SELECT ' + ','.join(selected) + ' FROM ' + table + ' LIMIT 50001')]
            if len(result[table]) > 50000:
                raise ValueError('Zu viele historische Statistikzeilen.')
        return result
    finally:
        db.close()

def convert(filename):
    with zipfile.ZipFile(filename) as archive, tempfile.TemporaryDirectory(prefix='racehub-cockpit-') as temporary:
        members = archive.infolist()
        if len(members) > 20000:
            raise ValueError('Zu viele Dateien im Archiv.')
        databases = [m for m in members if m.filename.replace('\\', '/').lower().endswith('database.sqlite/cpv2stamm')]
        if len(databases) != 1 or databases[0].file_size > 20000000:
            raise ValueError('Keine eindeutig unterstützte Cockpit-XP-SQLite-Stammdatenbank gefunden.')
        database = Path(temporary) / 'stamm.sqlite'
        database.write_bytes(archive.read(databases[0]))
        db = sqlite3.connect(database.as_uri() + '?mode=ro', uri=True)
        db.row_factory = sqlite3.Row
        db.text_factory = decode
        if db.execute('PRAGMA quick_check').fetchone()[0] != 'ok':
            raise ValueError('Cockpit-XP-Datenbank ist beschädigt.')
        tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if not {'DriverItems', 'CarItems', 'CourseItems'} <= tables:
            raise ValueError('Dieses Cockpit-XP-Datenformat wird noch nicht unterstützt.')
        rows = {}
        for table in ['DriverItems', 'CarItems', 'CourseItems', 'CarData']:
            rows[table] = [dict(row) for row in db.execute('SELECT * FROM ' + table + ' LIMIT 5001')] if table in tables else []
            if len(rows[table]) > 5000:
                raise ValueError('Zu viele Stammdatensätze.')
        db.close()
        images = {}
        for member in members:
            normalized = PurePosixPath(member.filename.replace('\\', '/'))
            if '/bilder/' not in ('/' + str(normalized)).lower() or normalized.suffix.lower() not in ['.png', '.jpg', '.jpeg', '.gif', '.webp']:
                continue
            key = normalized.name.lower()
            if key in images:
                raise ValueError('Mehrdeutige Bildnamen in der Cockpit-XP-Sicherung.')
            images[key] = member
        used_bytes = 0
        def image(name):
            nonlocal used_bytes
            member = images.get(PurePosixPath(str(name or '').replace('\\', '/')).name.lower())
            if not member or member.file_size > 5000000:
                return None
            used_bytes += member.file_size
            if used_bytes > 25000000:
                raise ValueError('Zu viele Bilddaten in der Übernahme.')
            return {'extension': PurePosixPath(member.filename.replace('\\', '/')).suffix.lower(), 'data': base64.b64encode(archive.read(member)).decode('ascii')}
        result = {'format': 'RaceHubOS-Cockpit-Import', 'version': 2, 'source': Path(filename).name, 'drivers': [], 'cars': [], 'tracks': [], 'notes': ['Übernahme von Stammdaten und zugeordneten Bildern. Keine Add-ons, Hardwareprofile, Lizenzen oder Layouts. Historische Statistik bleibt getrennt von aktuellen Ergebnissen. Geschwindigkeits-, Brems- und Tankwerte bleiben RaceHubOS-Standardwerte.']}
        for row in rows['DriverItems']:
            name = str(row.get('Driver') or row.get('FullName') or '').strip()
            if name:
                result['drivers'].append({'sourceId': str(row['ID']), 'name': name, 'aliases': [str(row.get('Driver') or ''), str(row.get('FullName') or '')], 'active': bool(row.get('Activ')), 'image': image(row.get('Picture'))})
        for row in rows['CarItems']:
            name = str(row.get('FullName') or row.get('Car') or '').strip()
            if name:
                xml = xml_values(row.get('XMLData'))
                notes = ['Aus Cockpit-XP übernommen. Ursprüngliche Bezeichnung: ' + str(row.get('Car') or name)]
                if xml.get('MoreInfo'):
                    notes.append(xml['MoreInfo'])
                notes.extend(str(p['Property']) + ': ' + str(p['Value']) for p in rows['CarData'] if p.get('CarName') == row.get('Car') and p.get('Value'))
                result['cars'].append({'sourceId': str(row['ID']), 'brand': 'Carrera', 'model': name, 'aliases': [str(row.get('Car') or ''), str(row.get('FullName') or '')], 'technology': {str(p['Property']): str(p['Value']) for p in rows['CarData'] if p.get('CarName') == row.get('Car') and p.get('Value')}, 'inUseSince': xml.get('ImEinsatzSeit'), 'service': service_values(row), 'notes': '\n'.join(notes)[:12000], 'active': bool(row.get('Activ')), 'image': image(row.get('Picture'))})
        for row in rows['CourseItems']:
            name = str(row.get('FullName') or row.get('Course') or '').strip()
            if name:
                result['tracks'].append({'sourceId': str(row['ID']), 'name': str(row.get('Course') or name), 'aliases': [str(row.get('Course') or ''), name], 'active': bool(row.get('Activ')), 'image': image(row.get('Picture'))})
        result['history'] = read_history(archive, members, temporary)
        return result

if __name__ == '__main__':
    try:
        print(json.dumps(convert(sys.argv[1]), ensure_ascii=False))
    except Exception as error:
        print('Keine lesbare Cockpit-XP-ZIP-Sicherung.' if isinstance(error, zipfile.BadZipFile) else 'Cockpit-XP-Daten konnten nicht gelesen werden: ' + str(error), file=sys.stderr)
        sys.exit(1)

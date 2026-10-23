#!/usr/bin/python3
"""Private JSON-lines bridge to the system BlueZ GATT API. No raw HCI socket."""
import json, os, signal, sys, time
import dbus
from dbus.mainloop.glib import DBusGMainLoop
from gi.repository import GLib

SERVICE = '39df7777-b1b4-b90b-57f1-7144ae4e4a6a'
OUTPUT = '39df8888-b1b4-b90b-57f1-7144ae4e4a6a'
NOTIFY = '39df9999-b1b4-b90b-57f1-7144ae4e4a6a'
DBusGMainLoop(set_as_default=True)
bus = dbus.SystemBus()
manager = dbus.Interface(bus.get_object('org.bluez', '/'), 'org.freedesktop.DBus.ObjectManager')
loop = GLib.MainLoop()
state = {'device': None, 'output': None, 'notify': None, 'connecting': False}

def emit(**value):
    print(json.dumps(value), flush=True)

def objects():
    return manager.GetManagedObjects(timeout=5)

def interface(path, name):
    return dbus.Interface(bus.get_object('org.bluez', path), name)

def reply(ident, result=None, error=None):
    emit(id=ident, result=result, error=str(error) if error else None)

def failed(ident, error):
    state['connecting'] = False
    reply(ident, error=error)

def properties(name, changed, invalidated, path=None):
    if name == 'org.bluez.GattCharacteristic1' and path == state['notify'] and 'Value' in changed:
        emit(event='data', hex=bytes(changed['Value']).hex())
    if name == 'org.bluez.Device1' and path == state['device'] and changed.get('Connected') is not None and not changed['Connected']:
        state['output'] = state['notify'] = None
        emit(event='disconnect')

bus.add_signal_receiver(properties, dbus_interface='org.freedesktop.DBus.Properties', signal_name='PropertiesChanged', path_keyword='path')

def find_device(all_objects, address=None):
    for path, ifaces in all_objects.items():
        props = ifaces.get('org.bluez.Device1', {})
        if (address and str(props.get('Address', '')).lower() == address.lower()) or (not address and str(props.get('Name', '')) == 'Control_Unit'):
            return str(path), props
    return None, None

def discover(ident, address=None, seconds=10, connect=False):
    all_objects = objects()
    path, props = find_device(all_objects, address)
    if path and not props.get('Name'):
        path, props = None, None  # refresh incomplete raw-HCI cache through discovery
    adapters = [p for p, i in all_objects.items() if 'org.bluez.Adapter1' in i]
    if not adapters:
        return failed(ident, 'No Linux Bluetooth adapter available.')
    adapter = interface(adapters[0], 'org.bluez.Adapter1')
    owned = False
    if not path:
        adapter.SetDiscoveryFilter(dbus.Dictionary({'Transport': dbus.String('le'), 'DuplicateData': dbus.Boolean(False)}, signature='sv'))
        adapter.StartDiscovery(timeout=5)
        owned = True
    deadline = time.monotonic() + seconds
    def check():
        try:
            path, props = find_device(objects(), address)
            if path or time.monotonic() >= deadline:
                if owned:
                    adapter.StopDiscovery(timeout=5)
                if not path:
                    failed(ident, 'Control Unit not found. Turn on the CU and AppConnect.')
                elif connect:
                    connect_device(ident, path, props)
                else:
                    reply(ident, {'address': str(props['Address']).lower(), 'name': str(props.get('Name', 'Control_Unit'))})
                return False
        except Exception as error:
            if owned:
                try:
                    adapter.StopDiscovery(timeout=5)
                except Exception:
                    pass
            failed(ident, error)
            return False
        return True
    if check():
        GLib.timeout_add(200, check)

def connect_device(ident, path, props):
    state['device'] = path
    state['connecting'] = True
    device = interface(path, 'org.bluez.Device1')
    deadline = time.monotonic() + 40
    def inspect():
        try:
            all_objects = objects()
            props = all_objects.get(path, {}).get('org.bluez.Device1', {})
            if not state['connecting']:
                return False
            if props.get('ServicesResolved'):
                service_paths = [str(p) for p, i in all_objects.items() if str(i.get('org.bluez.GattService1', {}).get('UUID', '')).lower() == SERVICE and str(i.get('org.bluez.GattService1', {}).get('Device', '')) == path]
                chars = {str(i['org.bluez.GattCharacteristic1'].get('UUID', '')).lower(): str(p) for p, i in all_objects.items() if 'org.bluez.GattCharacteristic1' in i and str(i['org.bluez.GattCharacteristic1'].get('Service')) in service_paths}
                if OUTPUT not in chars or NOTIFY not in chars:
                    raise RuntimeError('AppConnect channels are missing. Restart the CU and AppConnect.')
                state['output'], state['notify'] = chars[OUTPUT], chars[NOTIFY]
                interface(state['notify'], 'org.bluez.GattCharacteristic1').StartNotify(timeout=5)
                state['connecting'] = False
                reply(ident, {'address': str(props['Address']).lower(), 'name': str(props.get('Name', 'Control_Unit')), 'transport': 'bluez'})
                return False
            if time.monotonic() >= deadline:
                raise TimeoutError('AppConnect channels did not become ready. Restart the CU and AppConnect.')
        except Exception as error:
            failed(ident, error)
            return False
        return True
    def connected():
        GLib.timeout_add(100, inspect)
    def start_connect():
        device.Connect(reply_handler=connected, error_handler=lambda e: failed(ident, e), timeout=35)
    # A previous raw-HCI owner can leave a kernel connection without resolved GATT.
    if props.get('Connected'):
        device.Disconnect(reply_handler=start_connect, error_handler=lambda e: failed(ident, e), timeout=10)
    else:
        start_connect()

def command(cmd):
    ident = cmd.get('id')
    try:
        action = cmd.get('action')
        if action == 'scan':
            discover(ident, seconds=min(30, max(1, cmd.get('timeout', 10000) / 1000)))
        elif action == 'connect':
            address = cmd.get('address')
            if address and (len(address) != 17 or any(c not in '0123456789abcdefABCDEF:' for c in address)):
                raise ValueError('Invalid Bluetooth address.')
            discover(ident, address=address, seconds=15, connect=True)
        elif action == 'send':
            value = bytes.fromhex(cmd['hex'])
            if not state['output'] or not 1 <= len(value) <= 20:
                raise ValueError('AppConnect is not connected or the message is invalid.')
            interface(state['output'], 'org.bluez.GattCharacteristic1').WriteValue(dbus.Array(value, signature='y'), dbus.Dictionary({'type': dbus.String('command')}, signature='sv'), timeout=5)
            reply(ident, True)
        elif action == 'disconnect':
            state['connecting'] = False
            if state['device']:
                interface(state['device'], 'org.bluez.Device1').Disconnect(timeout=5)
            state['output'] = state['notify'] = None
            reply(ident, True)
        else:
            raise ValueError('Unknown Bluetooth command.')
    except Exception as error:
        reply(ident, error=error)

pending = b''
def stdin_ready(fd, condition):
    global pending
    chunk = os.read(fd, 65536)
    if not chunk:
        loop.quit()
        return False
    pending += chunk
    if len(pending) > 65536:
        loop.quit()
        return False
    while b'\n' in pending:
        line, pending = pending.split(b'\n', 1)
        try:
            command(json.loads(line))
        except Exception as error:
            emit(event='error', error=str(error))
    return True

GLib.io_add_watch(sys.stdin.fileno(), GLib.IO_IN | GLib.IO_HUP, stdin_ready)
# GLib must dispatch Unix signals itself; Python handlers can remain pending in C polling.
GLib.unix_signal_add(GLib.PRIORITY_DEFAULT, signal.SIGTERM, lambda: loop.quit() or False)
GLib.unix_signal_add(GLib.PRIORITY_DEFAULT, signal.SIGINT, lambda: loop.quit() or False)
parent_pid = os.getppid()
def parent_alive():
    if os.getppid() != parent_pid or parent_pid == 1:
        loop.quit()
        return False
    return True
GLib.timeout_add_seconds(1, parent_alive)
emit(event='bridge-ready')
try:
    loop.run()
finally:
    # Closing this client's bus releases its notification ownership. An orphan
    # must never disconnect a CU already taken over by a newer server.
    bus.close()

# CU connection recovery

`CuRecovery` owns retries for the real Control Unit. The Noble transport's legacy
retry loop is disabled while that owner is active. The simulator is independent.

- A failed initial connection, an unexpected disconnect, or 12 seconds without
  CU status schedules a retry. The delays are 5 seconds after the first failed
  attempt, 15 seconds after attempts 2–3, then 60 seconds. Fresh status resets
  the attempt counter. Retries continue until the user disconnects or switches
  to the simulator.
- A BLE connection is not considered live until fresh status arrives. The
  recovery snapshot is available as `recovery` on `/api/bluetooth/status` and
  through `cu:recovery` events (`connecting`, `awaiting_data`, `live`,
  `retry_wait`, `manual`, `disabled`). This backend contribution adds no UI text.
- Only one connection attempt may run. A repeated request for the same CU joins
  it; a different address is rejected while it is pending. Manual disconnection
  and simulator selection invalidate pending work. A late result must not restart
  CU polling or replace the simulator.
- Noble discovery, connect, service discovery, subscription and disconnect calls
  have a 10-second bound per operation. Scan-stop acknowledgement is awaited before
  connecting, and only AppConnect services/characteristics are discovered. Timed-out connections release their
  peripheral/cache. An explicit CU address is matched exactly.
- Polling generations prevent a stopped in-flight poll from restarting its old
  loop. Reattaching the CU clears timestamp baselines, so the first crossing
  after reconnection cannot invent a lap spanning the outage. Lost hardware
  events cannot be reconstructed.

Recovery reconnects the transport and restarts polling; it does not send race
start, stop, reset, speed, brake or fuel configuration commands. Existing handling
of status and race transitions in `SyncService` is unchanged.

## Validation

Use the backend test command against its disposable `test.db`. New Jest suites
`cuRecovery.test.js`, `bleRecovery.test.js`, and `cuRecoveryRoutes.test.js` use
fake devices and adapters; they never scan or connect to actual hardware.
Run `npm run check`, the production build and the backend suite before upload.

Hardware validation remains required on each supported platform: a failed startup
connection, AppConnect power cycling during a session, manual disconnect, and
switching between CU and simulator. Verify that the chosen CU alone reconnects,
manual disconnect stays disconnected, and existing results remain intact. This branch does not include CU reset or start-light changes.

## Linux transport

Linux uses the system BlueZ D-Bus GATT API through a private Python helper; Noble
is not loaded there. This avoids concurrent raw-HCI ownership with bluetoothd,
which caused unconfirmed connections and delayed HTTP responses in the hardware
test. macOS and Windows continue to use Noble. For explicit diagnostics only,
`RACEHUBOS_BLE_TRANSPORT=noble` selects the raw transport on Linux. When a sole
Linux HCI adapter exists its actual index is selected before Noble loads; an
explicit `NOBLE_HCI_DEVICE_ID` is respected. Multiple adapters require explicit
Noble selection.

The Linux host needs BlueZ, Python 3, `python3-dbus` and `python3-gi`, plus its
normal system D-Bus Bluetooth permissions. No raw socket capabilities are needed
by the BlueZ path. The app never installs packages or changes system permissions.
The helper scopes discovery and GATT notifications to its own client, exits on
parent loss, and uses bounded requests (connect: 60 seconds; disconnect/send:
8 seconds). Stopping a connection terminates its helper and pending requests.
`bleBluez.test.js` tests this boundary without hardware.

## Hardware evidence (2026-10-23)

Linux Mint, system BlueZ, a single hci1 adapter and a real Carrera AppConnect CU
were tested using a separate empty database and server port 3198. Connection
completed in about 1.8 seconds with fresh CU status. A user-performed power cycle
was detected, and recovery returned to live automatically without a connect click.
Manual disconnect stayed disconnected for 12 seconds. Switching to the simulator
kept it active for 12 seconds; switching back restored live CU status. The final
state was disconnected. No race session or real lap was recorded.

Raw HCI also left BlueZ discovery unable to see devices during diagnosis; a manual
adapter off/on restored discovery. The application does not power-cycle adapters.
The Linux fix avoids loading that raw transport in the first place. Hardware on
macOS/Windows and an active race with real lap crossings remain untested.

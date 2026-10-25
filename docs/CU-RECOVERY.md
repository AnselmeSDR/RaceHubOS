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
  connecting when available; a missing acknowledgement does not override discovery, and only AppConnect services/characteristics are discovered. Timed-out connections release their
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


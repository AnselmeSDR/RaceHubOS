# Linux Bluetooth transport

Linux uses system BlueZ through `node-ble` 1.13.0 (which depends on `dbus-next`), without loading Noble/raw HCI. Windows and macOS keep Noble. Set `RACEHUBOS_BLE_TRANSPORT=noble` only for explicit diagnostics. An explicit `NOBLE_HCI_DEVICE_ID` is preserved; if Linux has exactly one adapter its actual index is selected before loading Noble.

The host needs its normal BlueZ service and system D-Bus permissions. No Python runtime, python3-dbus, python3-gi, subprocess bridge or new raw-socket capabilities are required. The application changes no system configuration. Follow node-ble's upstream permissions documentation for the account running RaceHubOS; do not run the server as root.

Each attempt owns a private D-Bus connection, pending operations and notification/disconnect listeners. Connection is ready only after GATT resolution and notification subscription. Writes use write-without-response. Discovery started by another client is never stopped by this transport. Manual disconnect invalidates the attempt before bounded cleanup; late completions cannot publish readiness. Unexpected disconnects emit the existing transport event. This PR does not add automatic recovery; that feature is independent.

## Library choice (2026-10-25)

Compared the public APIs and npm publication metadata for node-ble and dbus-next. node-ble 1.13.0 was published in January 2025; dbus-next 0.10.2 dates from April 2022. Neither date guarantees future maintenance. node-ble provides device discovery, GATT readiness, notifications and write-without-response directly; dbus-next provides generic proxy interfaces and variants, requiring these BlueZ semantics to be implemented here. Chose node-ble with explicit operation bounds and cancellation around its promises. Its transitive dbus-next dependency remains a maintenance risk to track.

Sources:
- https://github.com/chrvadala/node-ble
- https://github.com/dbusjs/node-dbus-next
- https://registry.npmjs.org/node-ble
- https://registry.npmjs.org/dbus-next

## Validation

The Jest transport tests use injected fake D-Bus sessions; they never open Bluetooth or contact a real CU. Physical Linux hardware validation must be repeated for this implementation: discover and connect, power-cycle AppConnect, manual disconnect, repeated reconnect and status/lap data. Prior hardware results for the removed Python bridge are not evidence for this Node implementation. Windows recovery testing belongs to the separate recovery PR.

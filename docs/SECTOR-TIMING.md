# Optional sector timing

Sector recording/display is an independent feature, disabled by default. Enable it explicitly in Settings; active, paused or finishing sessions must be ended before changing it. The server persists `sectorTiming:enabled` and configures the synchronizer and session service before it starts serving requests. Disabled operation uses the original finish-line processing path and writes exactly the original lap fields.

One intermediate CU channel (2) produces two sections between consecutive finish passages (channel 1). A second intermediate channel (3) produces three sections. Only complete ordered measurements are written into the existing Lap.sector1/2/3 columns. Missing, repeated, backward or out-of-order crossings do not invent data. Separate controller state prevents mixing cars. Session/phase changes, pause/resume, device changes, disconnects, resets and a reversed CU clock invalidate the appropriate measuring baselines.

The active leaderboard receives intermediate/completed values. Reload restores the latest recorded lap's sectors. Historical session detail can display recorded splits, while missing values remain unknown. Normal track controls and lap counts are not changed by a display action. No timer is added to DeviceContext or the whole application.

Settings and display use shadcn components and FR/EN/DE JSON namespaces with French as reference. Files are .js; version, changelog, schema and lockfile are unchanged. This PR does not require the race-screen or pit-advice PRs.

**Real-CU acceptance is required before merging**, as requested by Anselme: run one and two intermediate sensors, verify actual lap and split persistence, missing/duplicate crossings, pause/resume, reconnect and disabled behavior. Automated tests use artificial events and disposable SQLite only and are not a hardware certification.

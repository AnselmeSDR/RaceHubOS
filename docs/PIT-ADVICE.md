# Optional pit advice

Independent feature; disabled by default. Settings offers explicit activation and one or two simultaneous refuelling places. The existing preferences API stores `pitAdvice:settings`. It does not require the optional race screen or sector timing.

Advice appears on active/finishing session leaderboards only. It requires connected CU/socket state, fuel and pit telemetry no more than five seconds old, FUEL ON and valid readings for every participating controller. Missing, invalid, stale or disconnected telemetry produces an unavailable message, never an invented recommendation. Cars already in the pit lane are excluded from the queue; remaining cars at 5/15 or below are sorted by fuel level and controller, with zero flagged for immediate refuelling.

The proposed group contains at most the configured number of places. Users must check places before entry. The lane count is not individual left/right occupancy, and no place assignment is inferred. This is an advisory display only: no CU commands, switch control, compulsory waiting, calibration in litres or promise of safe physical occupancy.

Only the mounted enabled panel owns its freshness timer/subscription. DeviceContext and SessionContext remain byte-for-byte unchanged; disabled operation mounts neither a new timer nor a new socket. Configuration and display use the existing shadcn components and FR/EN/DE JSON translations. Version, changelog, schema and lockfile are unchanged.

Automated tests cover disabled defaults, order and urgency, group limits, lane filtering, telemetry failures and the Settings flow in all three languages. A real track/operator check remains necessary to confirm actual telemetry and physical refuelling facilities. The tests do not claim a hardware validation.

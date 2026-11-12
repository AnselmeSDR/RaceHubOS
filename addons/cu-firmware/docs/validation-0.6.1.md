# 0.6.1 validation — 2026-11-12

- 3 localization tests: complete DE/EN/FR static text and accessible-label coverage, dynamic UI strings, numeric diagnostic suffixes, regional-language normalization and fallback.
- 9 parameter tests: baseline hashes, controls, rejected inputs, original-byte restoration and protection-code invariants.
- 9 flash/recovery tests against simulated BLE: ACKs, interruption, recovery lock, target/version gates and competing requests.
- 1 HTTP export test: origin checks, byte verification, attachment responses and expiry.
- Production frontend build passed. Existing bundle-size advisory remains.
- Browser: RaceHubOS English setting passed into the iframe; independent English/French language selector tested. Baseline load, three toggles and file generation worked in both languages. German restored afterwards.
- English and French generation of Stock V339 with sound, settings chase and idle sleep off both produced SHA-256 `3655cc5d6b58a4f5e912a2a5f599fd8bfc2892a2781002e53e5db2d3b184c3a1`, matching the previously verified file.
- Four viewport screenshots are in `screenshots/`; they show the real local workshop. Native file-picker button text follows the browser/OS locale.
- No CU flash was started for this release. Firmware patching, codec, server, recovery code and report schema were not changed for localization. Hardware validation of fault protection is outside these checks.

# RaceHubOS add-on

Follow the add-on contract at https://github.com/AnselmeSDR/RaceHubOS/blob/main/docs/ADDONS.md.

Work within this add-on. Keep the verified firmware codec, parameter patching, hardware-5 gate, maintenance lease, flash/recovery state machine and technical report schema unchanged for presentation-only changes. Never flash real hardware as part of localization tests.

Keep `assets/locales/{de,en,fr}.json` complete and run `tests/i18n.test.mjs` when UI text changes. Technical JSON reports and diagnostic records are intentionally language-independent; their existing original text is retained. See README.md for tests and installation.

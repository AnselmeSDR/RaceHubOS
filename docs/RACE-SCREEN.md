# Optional race screen

Settings contains a card that opens the dedicated `/settings/race-screen` editor. The race screen, automatic opening at session activation and fullscreen are independent options, all off by default. Disabled settings never open at activation. The Settings card also offers a manual live-view button after the feature is explicitly enabled.

The editor uses the project's shadcn Card, Button, Input, Select and Checkbox components. Its viewer uses the shared Dialog, respects the application's light/dark styling and remains closable if the browser rejects fullscreen. A screen's own configurable canvas colors are separate from the surrounding editor/dialog theme. Escape or Close returns to the controls; the feature never starts, stops, resets or controls a race.

Named profiles are saved through the existing preferences API in the new `raceScreen:settings` key. Selecting a saved profile for races is explicit. The editor previews 1–6 drivers, with one shared row template; drag, resize, visibility, fonts and colors are stored only after Save. Geometry is bounded. Profiles are limited to 50 and names to 80 characters. There is no migration of layouts from earlier contributions: those never existed on main, and the old preference key is not read.

Only the mounted live canvas owns its freshness clock and optional CU-status subscription. There is no timer or source change in DeviceContext, SessionContext or backend lap recording. Preview data is synthetic; previews send no hardware or session commands. Browser fullscreen still depends on browser permission/user interaction and always offers a normal dialog fallback.

This PR contains only the race screen. Sector timing and advisory pit ordering belong to separate independent PRs and are not prerequisites. Translation keys are in locales/fr|en|de/raceScreens.json with French as reference. Source files use .js. Application version, changelog, schema and lockfile are unchanged.

Tests cover disabled defaults, no legacy-layout migration, activation/resume semantics, named profiles, bounded geometry, shared rows, drag/resize/visibility, all three languages, manual live opening and denied-fullscreen fallback. Synthetic HTTP/browser tests do not replace hardware acceptance of a large display.

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.27.0] - 2026-11-10

### Added
- Website at https://anselmesdr.github.io/RaceHubOS/ in English, French and German: downloads, a tour of the app, the add-on catalog, what's new and a FAQ. In the app, cars show as cut-out pictures, without a frame.

## [1.26.0] - 2026-11-10

### Added
- Add-ons: the Add-ons page installs extra features without touching the core (from the catalog or a git link), updates, enables, disables or uninstalls them; the database is backed up before each action. In the catalog: Car service. Writing an add-on: `docs/ADDONS.md`.

### Fixed
- Control Unit: polling really stops during START, and a requested disconnection no longer triggers automatic reconnection.
- Permanently deleting a driver or a track that has laps no longer crashes; a car's year can be cleared; Settings shows the version again.

### Security
- `/api/img` and image deletion accepted a `..%2F` path and read or deleted a file outside the images.

## [1.25.8] - 2026-11-07

### Changed
- AGPL-3.0 license also declared in the backend, frontend and shared sub-packages.

## [1.25.7] - 2026-11-06

### Added
- License notices for third-party projects (THIRD_PARTY_NOTICES.md): carreralib, from which the CU protocol is derived.

### Removed
- Old, unused CU protocol parser on the interface side.

## [1.25.6] - 2026-11-06

### Changed
- License: switch from Apache-2.0 to AGPL-3.0, with the LICENSE file; any modified version, distributed or offered online, must remain open source. A commercial license is available for closed-source use.

## [1.25.5] - 2026-11-06

### Added
- Documentation of the measured pit lane behavior (entry, stop, exit) and of off-track detection, the basis for future pit stop tracking.

## [1.25.4] - 2026-11-03

### Fixed
- Interface on narrow screens: toolbars, championship wizard, driver profile and starting grid wrap instead of overflowing.
- Championship award titles translated, and the balancing session title that showed "sessionTypeAbbr.balancing".

## [1.25.3] - 2026-11-02

### Fixed
- Creating a new database failed ("Schema engine error") when RUST_LOG was set to warn or error.

## [1.25.2] - 2026-10-25

### Changed
- Code formatted by Prettier and checked by ESLint across the whole repository. No functional change.

## [1.25.1] - 2026-10-24

### Fixed
- Session leaderboard on narrow screens: the car name was cut off abruptly ("McLare"); it now ends with "…" and the columns tighten to show more of it.

## [1.25.0] - 2026-10-24

### Added
- **German interface**: Deutsch added to the language choice and the 17 existing namespaces translated (936 strings). The chosen language is remembered; the French and English translations remain available.
- **Voice announcements in the interface language**: best lap and podium, voice and times included.

### Fixed
- Texts that stayed in French or English whatever the language: `EL` tab, status bar, `START` button, names of automatically created sessions.
- Podium: lap count written in lowercase ("30 runden" in German).
- Standings cut off on narrow screens: they move below the session when space runs out. Track name truncated cleanly.
- Profile records: car and track stacked one above the other when space runs out, instead of being cut off.

### Changed
- A missing translation is shown in English instead of French.

## [1.24.2] - 2026-10-24

### Added
- Contribution guide (`CONTRIBUTING.md`): `type: description` commits without scope, tests required, version and changelog left to the maintainer.
- `commit-msg` hook that rejects a message not in that format; hooks are now installed on every `npm install`.

## [1.24.1] - 2026-09-09

### Fixed
- **Form dialogs overflowed the screen** with no way to scroll: the title now stays visible and the body scrolls. Affected every form in the app.
- Car profile: the specifications are always shown, with a prompt to fill them in if nothing is entered.

### Changed
- Car form: collapsible sections replaced by plain sections, everything is visible at once.
- Export button reduced to its icon.
- The specifications entered also appear in the entries of each exported session.

## [1.24.0] - 2026-09-09

### Added
- **Extended car profile** (TASK-38): equipment (scale, chassis, motor, gear ratio, front/rear tyres, guide, braids, magnet, notes) and measurements (weight, length, width, wheelbase, track widths, ground clearance). Everything is optional, in free text — parts change too often to fix a list. Shown on the profile and in the Excel exports, where only the specifications entered appear.

## [1.23.0] - 2026-09-09

### Added
- **Excel export** (TASK-36) from a session, a championship, a driver, a car, or a selection in the lists.
  - Session or championship: a **Reference** sheet covering the whole export, then each championship followed by its sessions, with its own standings. One sheet per session: entries (controller, car, settings, starting position, result) and every lap.
  - Driver or car: results summary, breakdown by championship / track / car (or driver), then one row per session. Laps are not loaded.
  - Times as real Excel durations (sortable, usable in formulas) displayed as `0:09.356`, timestamps to the millisecond.
  - Colored podium, tabs tinted by type, driver and car colors shown.
- ⚠️ The exported settings are the car's **current** ones: they are not yet frozen per session (TASK-37).

## [1.22.1] - 2026-09-01

### Added
- Tests of a full race sequence: grace lap counted then speed reduced, later crossings ignored, DNF at the end of the grace period, race by lap count, no Control Unit.

## [1.22.0] - 2026-08-31

### Changed
- **Statuses and modes move to `@racehubos/shared`** (TASK-04): `Session.status`, `Championship.status`, `Championship.mode` and `Session.fuelMode` were hardcoded in 19 files (106 places). Stored as text, validated by the code, values listed in a comment in the schema
- Championship and session statuses told apart: `championship.status` was compared against session statuses

## [1.21.3] - 2026-08-31

### Changed
- **No more `enum` in the database**, only text. A Prisma enum makes the whole table unreadable as soon as one row holds an unknown value (`findMany()` throws). The values are listed in a comment, validation lives in the code. No migration.

## [1.21.2] - 2026-08-31

### Fixed
- **The migration failed on Windows**, for two chained reasons, neither visible in development. Found on the race PC, in the middle of an update
  - `npx` is a `.cmd` file on Windows, an extension that `execFileSync` does not resolve: `spawnSync npx ENOENT`
  - Naming `npx.cmd` explicitly is not enough: since the BatBadBut fixes, node **refuses to run a `.cmd` without a shell** (`EINVAL`). And going through a shell would have brought back quoting problems on paths containing spaces
  - The Prisma CLI is now called **from JavaScript** (`src/lib/prismaCli.js`, `process.execPath`): same node, no shell, no quotes. In the migration as well as in the test setup
  - An `npm run check` rule forbids calling `npx` or `npm` through `execFile`/`spawn`
  - `execSync` and `exec` go through a shell and were not affected

## [1.21.0] - 2026-08-31

### Added
- **A guide of rules the code must follow** (`docs/CONVENTIONS.md`): each rule comes from a real incident in the project — the race PC that would not start, balancing missing from the statistics, a database rewritten without warning. The reason is written next to the rule, because it is what lets you judge a case nobody anticipated
- **`npm run check`** mechanically checks ten of these rules; **`npm run check:push`** adds the ones that only make sense before a push:
  - no `prisma db push`, and `schema.prisma` always covered by a migration
  - no session type spelled out outside `@racehubos/shared`
  - no shared symbol used without an import — **a successful Vite build does not catch this case**; it had let through 15 files that would have crashed during a race
  - Windows installer: no `::` inside a parenthesized block, balanced parentheses, `INSTALLER_VERSION` present and incremented whenever the file changes
  - every translation key present in French and in English
  - test scripts pointing at `test.db` and never at the real database
  - version incremented and changelog filled in
- **`npm run hooks:install`** installs a `pre-push` hook that runs these checks before each push (`git push --no-verify` remains possible, knowingly)

### Fixed
- Three session type default values were still hardcoded (`Podium`, `SessionLeaderboard`, `Displays`) — found by the new check

## [1.20.0] - 2026-08-31

### Changed
- **Session types now have a single definition** (TASK-03): `practice`, `qualif`, `race` and `balancing` were rewritten by hand everywhere — 129 places in 24 files
  - This is why **balancing had existed in the database for months without appearing in the statistics filter**: each list of types was an independent list, and nobody could find them all
  - A `@racehubos/shared` package holds the definition, used by the server as well as the interface
  - `schema.prisma` declares an `enum SessionType`: the Prisma client **now refuses to save a session whose type does not exist**. No migration — SQLite stores an enum as text, the database schema is unchanged
  - The filters on the **Statistics** and **Sessions** pages, the session form, the free session tabs, the standings tabs and the records panel **build their list from this definition**: adding a type will make it appear everywhere, without having to search
  - Three sets of labels duplicated the glossary (`championships`, `displays`, `race`): they are removed, everything goes through `glossary:sessionType` and `glossary:sessionTypeFull`, the only ones covering all four types in both French and English
  - Balancing is deliberately kept out of the race creation lists: it has its own screen, belongs to no championship and produces no standings
  - Tests check that the Prisma enum, the shared package and the translations can no longer diverge — adding a type without its label makes the suite fail

## [1.19.1] - 2026-08-31

### Fixed
- **The desktop installer was never updated**: it did clone the latest version of the application, but stayed frozen itself on the day it was downloaded
  - The one on the race PC dated from April 15 and still copied the whole `prisma/` folder of the old installation over the new one. That is how a `schema.prisma` containing `url = env("DATABASE_URL")`, which Prisma 7 rejects, ended up in a brand new v1.18.0 folder and prevented the application from starting
  - **The installer now updates itself as soon as it starts**, before any other action: it compares its number with the one published on GitHub, replaces itself and restarts if needed
  - The comparison is on a number (`INSTALLER_VERSION`) and not on the content: Git for Windows converts line endings on clone, so the desktop file is never identical to the one on GitHub and a content comparison would restart the installer endlessly
  - With no network or on error, the installer continues with the version it has instead of stopping
  - The installers already on desktops predate this mechanism and cannot acquire it on their own: the application therefore drops an up-to-date installer on the desktop after each successful update, which bootstraps it (desktop moved by OneDrive and French-named desktop included)
- **Three `::` comments were inside a parenthesized block** of the Windows installer — precisely the copy block involved in the failure. `cmd.exe` only accepts `REM` there; a test now checks this rule and the balance of the blocks, two errors invisible outside Windows

## [1.19.0] - 2026-08-31

### Changed
- **The schema only changes through migrations**: `prisma db push --accept-data-loss` is removed from startup, update, repair and both installers, replaced by `prisma migrate deploy`
  - `db push` rewrites the database to make it match the schema: it adds a column without breaking anything, but a rename or a type change **deletes the affected data without warning**. A migration describes the transformation, and therefore keeps the data
  - Each schema change is now a versioned file in `prisma/migrations/`, applied identically on every PC; in development it is created with `npm run prisma:migrate -w @racehubos/backend`
- **Databases older than migrations**: Prisma refuses to migrate an already filled database whose history it does not know (`P3005`) — the case of every existing installation, since `db push` writes no history
  - `src/lib/migrateSchema.js` compares the actual database schema with each sequence of migrations and marks as already applied the ones it actually contains, before applying the rest
  - What the database contains is never inferred from its history, always from the schema itself: an up-to-date database is fully baselined, an outdated database only up to its actual state, and the missing migrations really run
  - A database that matches no known state is not touched: startup stops and offers a repair, rather than half-migrating a race database
  - Five scenarios covered by tests on throwaway databases: fresh install, up-to-date database without history, outdated database, rerun, diverging schema
  - `npm run migrate -w @racehubos/backend` applies the migration by hand when needed

## [1.18.1] - 2026-08-29

### Fixed
- **The update no longer started on the race PC (Windows)**: the Prisma 7 migration failed with `os error 161 — chemin d'accès non valide`
  - `pathToFileURL()` produced `file:///C:/Users/…`, a valid URL but one the Prisma schema engine rejects on Windows; it expects the `file:C:\Users\…` form
  - The native path (`getDatabasePath()`) is now separate from the URL passed to Prisma (`getDatabaseUrl()`): `fileURLToPath()` turned `file:C:\…` into `/C:/Users/…`, which would have broken the backups
  - The defect could not be seen in development: on macOS and Linux, `file:///Users/…` works
  - Both directions of the conversion are covered by tests
- **Car settings expressed in levels** (RUSH-05): the Control Unit only knows 10 levels per setting (manual 30352), sent in a 4-bit field — no intermediate value exists
  - Fuel was converted over 15 levels: 100% sent 15 and 70% sent 11, instead of 10 and 7
  - The fuel gauge on the cards was computed out of 150: a full tank showed as two-thirds full
  - The sliders offered 101 positions for 10 real values — setting 70% or 74% had the same effect; they now move in steps and show the level (`7/10`), the one read on the CU's LEDs
  - Speed in green, braking in red, tank in blue, with the bar filled up to the level
  - No migration: the stored values are already multiples of 10

## [1.18.0] - 2026-08-28

### Changed
- **Cascading deletions**: deleting an object now hides everything that depends on it, instead of leaving orphan times visible in the statistics
  - **Track** → its championships, their sessions, their participants, the entries, the laps and the records
  - **Championship** → its sessions, their entries, their laps and its participants
  - **Session** → its entries, its laps and the records that come from them
  - **Driver** → their laps, their entries, their records and their championship participations
  - **Car** → its laps, its entries and its records
  - **Team** → only itself; its drivers are kept (the relation is optional: a driver can exist without a team)
  - Every foreign key in the model is now covered, except `ControllerConfig`, which has no soft-delete field (see TASK-32)
  - A record materializes a lap: hiding the lap hides the record
  - All rows of a single deletion share the same timestamp: restoring only brings back what that deletion had hidden, and leaves deleted what had been deliberately deleted before
  - Everything remains a soft delete (`deletedAt`): no data is erased
  - `node scripts/replay-cascades.js` replays the cascades on objects deleted before this version — without arguments it only reports, `--apply` backs up then applies. On the development machine, 8,484 rows still active under a deleted parent were hidden, including 8,146 laps from three tracks deleted in July
- **Championship participants**: editing the list now **hides** removed drivers instead of erasing them, and **reactivates** the ones added back — previously each edit deleted then recreated every row, erasing any trace of removals
  - New field `ChampionshipParticipant.deletedAt`
  - Hidden drivers are excluded from every read (standings, brackets, generation of automatic sessions)
  - The existing rule still applies: at least two participants, and no removal of a driver who has already run a qualifying session

### Added
- **Delete button on cards and detail pages**: deletion only existed in list view, behind a row selection — in grid view, there was no way to delete, and the detail pages offered nothing either (except sessions)
  - Present on driver, car, track and team cards, and in the action bar of the driver, car, track, session and championship pages
  - A team card had no actions: it also gains editing
  - The button confirms in place: a first click turns the trash can into "Confirm?", only the second one deletes
  - The armed state resets on its own after 4 seconds or as soon as the mouse leaves the card, so a card never stays armed
  - New shared component `DeleteButton`

### Fixed
- **Configuration of a finished championship**: name, track, participants and sessions could still be edited. Everything is now locked, with a banner that explains it and invites you to reopen the championship; the **Reopen championship** button of course stays active
- **Deleted track invisible in the configuration**: a championship run on a track deleted since then showed an empty field, as the list only offered active tracks. The referenced track is now shown, marked "(deleted)" — 4 of our 5 championships were affected
- **The interface tests could hit the race database**: the Playwright configuration reused the running server, hence the one connected to `dev.db`, and the tests created real entities in it. They now start their own servers on a throwaway database, built on each run from `schema.prisma`
  - Test IDs (`data-testid`) on list rows, cards, the Grid/List toggle and the delete button: the tests no longer depend on CSS classes, translated labels or the position of an element
  - Three interface tests had been outdated since redesigns (championship cards turned into a table, `.bg-white` classes replaced by the theme): fixed
- **Misleading error message on duplicates**: creating a driver with a number already taken answered "Email already exists". The Prisma 7 migration emptied `error.meta.target`, where the code read the conflicting column; the information now lives in `meta.driverAdapterError.cause.constraint.fields`. `src/lib/prismaErrors.js` reads both formats
- **Test cleanup**: `trackRecord`, `controllerConfig` and `championshipParticipant` were not purged between suites, which caused foreign key violations as soon as a test created a record

## [1.17.0] - 2026-08-26

### Added
- **"Championship" column in the statistics** (TASK-02): each time shows the championship in which it was set, or "—" when it comes from a free race, practice or balancing
  - Sortable and clickable column, which opens the championship page
  - Placed between "Track" and "Session"
  - **Filter by championship**, with an "Outside championship" option to isolate free races, practice and balancing; several championships can be combined

### Fixed
- **Filter menus and dropdowns transparent when scrolling**: their background was translucent, the opacity coming from a blur effect carried by an inner layer — which scrolled with the content and disappeared as soon as the list was scrolled, letting the page show through. The background is now opaque
- **Dropdowns that repositioned themselves while scrolling** (seen on the race PC): the options shifted and prevented picking a value further down. The lists are now anchored to the field (`position="popper"`) instead of being aligned on the selected option
- **Column order after a new column is added**: a list's saved order does not know about columns added later, which ended up pushed to the end of the table — off screen. They are now reinserted at the position where they are defined, without losing the order chosen by the user

## [1.16.0] - 2026-08-26

### Added
- **Reference driver for balancing** (RUSH-02): balancing measures the cars, not the drivers — all its laps now go to a single driver, whoever holds the controller
  - **Settings**: reference driver selection, a **Create The STIG** button (no duplicate if the driver already exists) and a button to reassign the balancing laps already recorded
  - **Balancing page**: warning and shortcut to the settings as long as no reference driver is set
  - Balancing sessions automatically assign their laps to the reference driver; races, qualifying and practice keep their real driver
  - New field `Driver.isReference` — only one reference driver at a time, editable like any driver (renaming it breaks nothing)
- **"Balancing" filter in the statistics**: balancing laps were already recorded with this type but were missing from the filter

## [1.15.0] - 2026-08-26

### Added
- **The application no longer starts on a broken installation**: if startup fails, the Windows and macOS launchers show the error and offer three choices — rerun the update (repair), try starting again, or close
  - Previously the window closed without a message: no way to know what had happened
  - The browser only opens if the application actually responds
  - A migration failure is distinguished from other errors (exit code 43) and states that the database was not modified, with the location of the backup
- **`npm run repair`**: replays an update outside the application (fetch, dependencies, build, backup, migration) — usable when the app does not start and so cannot offer its own update

### Changed
- **`startup.js`** exits with code 43 when the migration fails, instead of an unqualified error, so the launcher can explain the problem precisely

## [1.14.0] - 2026-08-26

### Added
- **Automatic rollback on a failed update**: if `npm install` or the frontend build fails after the `git pull`, the application goes back to the previous commit, reinstalls its dependencies and rebuilds the frontend
  - Previously, a dropped network or a dependency that does not compile left the installation half done: on the next restart, the app no longer worked
  - If the restore itself fails, the message says so explicitly instead of staying silent
  - Covered by integration tests on a real git repository

### Changed
- **The schema migration runs last** in the update, after the install and the build: it is the only irreversible step, so it is only attempted once the code is in place. On failure, `startup.js` replays it on restart

## [1.13.0] - 2026-08-26

### Added
- **Dated backup before each update**: the database is copied to `packages/backend/prisma/db-old/` as `YYYY-MM-DD_HH-MM-SS_<reason>.db`, with automatic rotation (last 10 kept)
  - Triggered by the in-app update (`update`), by the schema migration at startup (`schema-push`) and by the Windows/macOS installers (`install`)
  - Copy made with `VACUUM INTO`: consistent even while the server is running, and without associated `-wal`/`-shm` files
  - Manual backup possible: `node scripts/backup-db.js <reason>`
  - Replaces the single `dev.db.backup` that was overwritten on each update — so there was never any history

### Changed
- **Prisma 6 → 7**: new official SQLite adapter (`@prisma/adapter-better-sqlite3`), configuration moved to `prisma.config.js`, and centralized instantiation through `createPrismaClient()` (`src/lib/prisma.js`) — no more `new PrismaClient()` scattered across routes and services
  - `src/lib/database-url.js` keeps the Prisma 6 behavior: a relative `DATABASE_URL` (`file:./dev.db`) is still resolved from the `prisma/` folder
  - Dates stored as `unixepoch-ms`, as before the migration
- **Frontend tooling**: Vite 7 → 8, `@vitejs/plugin-react` 5 → 6, ESLint 9 → 10, `@tailwindcss/vite` 4.2 → 4.3
- **Libraries**: framer-motion 12 → 13, react-easy-crop 5 → 6, ink 6 → 7, plus the compatible updates (i18next, react-i18next, lucide-react, shadcn, globals, React 19.2.3)
- **Node.js 22+ required** (instead of 20+): required by Vite 8 and ESLint 10 — the Windows and macOS/Linux installers check for and install the right version
- **`package-lock.json` now versioned**: installations on the race PC are reproducible exactly

### Fixed
- **Update detection**: the comparison with GitHub was a simple string inequality (`latestVersion !== currentVersion`), so an **older** version was announced as "New version available" — and an update started from this banner would have rolled back with `db push` onto an earlier schema. The comparison is now semantic (`src/lib/version.js`, covered by tests)
- **The tests erased the real database**: `npm test` ran on `dev.db` (through the `DATABASE_URL` in `.env`) while `setup.js` empties every table — simply running the tests destroyed drivers, cars, sessions and laps
  - The tests now use a throwaway database `prisma/test.db`, **created at launch** from `schema.prisma` (`prisma migrate diff`) and deleted at the end
  - `setup.js` refuses to start if `DATABASE_URL` does not point to a test database
- **`startup.js`**: the database is backed up before the migration; if `prisma db push` fails, the version is no longer marked as migrated and startup stops with an explicit message — previously the application started on an out-of-sync schema without ever retrying
  - `--skip-generate` removed: the option no longer exists in Prisma 7

## [1.12.1] - 2026-08-26

### Added
- **End-of-session tests**: coverage of lap and time limits for free practice, qualifying, races and balancing sessions
- **Rush backlog**: added the next 12 product changes to `docs/TASKS.md`

### Fixed
- **Extra laps after the finish**: crossings by a driver who has already finished are ignored during the grace period, without changing their laps, times or position
- **Late CU events**: crossings received when no session is active are now ignored

## [1.12.0] - 2026-05-16

### Added
- **EN/FR i18n translation**: the whole app is now translatable, based on `react-i18next`
  - Infrastructure: `import.meta.glob` auto-detects the translation files, FR fallback, browser detection, localStorage persistence
  - Language selector in **Settings**
  - Namespaces: `common`, `glossary` (domain terms + statuses + session types), `layout`, `settings`, `dashboard`, `drivers`, `cars`, `tracks`, `teams`, `sessions`, `stats`, `championships`, `race`, `balancing`, `freeSession`, `displays`, `test`
  - Plurals handled by i18next (`_one` / `_other`) — automatic `count` parameter
  - Locale-aware dates (`toLocaleDateString(i18n.language)`)
  - All pages migrated (Settings, Layout, Dashboard, Drivers, Cars, Tracks, Teams, Sessions, Stats, Championships + all detail profiles + Free Mode, Balancing, Displays, Test) as well as all race/championship/balancing/crud/ui components
- **`ChampionshipBracket`**: for finished races, shows the **final position** (P1/P2/P3 in yellow for the podium) and the **total time** per driver, in addition to the grid position

### Changed
- **Session type colors centralized** in `lib/colors.js` (`sessionBadgeClass()` helper) and based on the theme variables (`bg-session-practice`, `bg-session-race`, etc.) — no more duplicated Tailwind classes across 6 files
- **`StandingsTabs`** now uses `glossary:sessionType` / `glossary:sessionTypeFull` instead of its own duplicated keys
- **`SessionSection`**: uniform `h-8` height on Select/Input + horizontal gap on the config table cells

### Fixed
- **`DriverProfile`, `CarProfile`, `TrackProfile`, `SessionDetail`**: native `confirm()` replaced by `ConfirmModal` for stats reset / deletion
- **`SessionDetail`**: dead code cleaned up (`getImgUrl`, `formatDuration`, `totalPauseDuration`, `totalLaps`, `fastestDriver` — scaffolding never wired up)
- **`Dashboard`**: correct vertical alignment of the stats card values (icon + label in one div, value in the other, `justify-between`)
- **`Dashboard` "All-time records"**: each record in its own bordered card → an item's value no longer runs into the next item's label

## [1.11.0] - 2026-05-13

### Added
- **Car profiles applied automatically**: at the start of each session, the `maxSpeed`/`brakeForce`/`fuelCapacity` values from each car's profile are applied to the CU (mapping 0-100 → CU 1-10 for speed/brake, 1-15 for fuel)
- **Slots without a driver**: the CU's 6 slots get the factory defaults (speed=10, brake=10, fuel=7) if no driver is assigned
- **End auto-throttle**: a driver who has met their condition (laps reached OR lap completed during the grace period) has their speed set to 1, the other drivers continue
- **CU technical doc**: `docs/CU-CARRERA-PROTOCOL.md` — complete reference of the BLE protocol, states, buttons, modes, fuel system
- **CU manual**: `docs/Carrera-30352-Control-Unit-Manual.pdf` added to the repo

### Fixed
- **Podium voice: announcement of non-existent positions**: with 1 or 2 drivers, the voice announced "third" / "second" for drivers who did not exist. The labels and drivers are now paired before the reverse
- **finishSession called several times**: `_finishing` guard added to prevent the grace period timer + heartbeat + check from triggering finishSession at the same time (caused speed oscillations)
- **applyCarConfigs order**: moved AFTER `prepareRace()` at session start so as not to disturb the L1 setup sequence

## [1.10.0] - 2026-05-12

### Added
- **End-of-race auto-throttle**: the speed of a driver who has met their finish condition (laps or time) is automatically lowered to 1, the other drivers continue at full speed. Restored to 15 at the end of the session
- **`pressButton` / `pressEsc` / `stopCars`**: new methods on `ControlUnit` (they were missing — the commands never reached the CU)
- **Improved BLE scan log**: shows the name of discovered peripherals in addition to the address

### Fixed
- **CU commands blocked by polling**: `request()` rewritten with an async mutex to serialize BLE commands properly. Before, continuous polling (`?`) hogged the channel and the commands (`T`, `J`, `=`) were never sent
- **BLE protocol: trailing `$` removed**: the `$` is only for the serial protocol, not BLE (aligned with `carreralib`)
- **Footer showing disconnected while the CU was active**: the backend did not emit `cu:connected` on the initial socket connection, and the frontend did not infer `connected` from the `cu:status` event
- **Graceful shutdown**: `httpServer.close()` is now awaited before `process.exit`, avoiding `EADDRINUSE` on restart in `--watch` mode

## [1.9.10] - 2026-04-18

### Added
- **CU auto-connect**: automatic connection to the last Control Unit at startup (toggle in Settings)
- **BLE reconnection**: recursive retry with a counter, states reset on disconnection

### Changed
- **ControlUnit**: address stored on connection

## [1.9.9] - 2026-04-15

### Changed
- **Balancing: metrics redesign**: 3 columns in the cards and the right panel — Best lap (purple), Best median over a window of 5 (yellow highlight + gap), Average of the best 60% of laps
- **Balancing: cards sorted** by best window-of-5 median (fastest first)
- **Balancing: medians per window of 5**: independent windows (1-5, 6-10, 10-15...) instead of cumulative steps
- **Balancing: median → all laps**: the median shown in the right panel is that of all laps combined
- **Balancing: 60% = average**: the 60% metric is now the average (not the median) of the best 60% of laps

### Fixed
- **Prisma warning**: removed the deprecated `prisma.seed` block from package.json

## [1.9.7] - 2026-04-15

### Fixed
- **Windows update EPERM**: removed the prisma generate `postinstall` from the root package.json (caused EPERM on Windows because the DLL is locked). Prisma generate is now handled by `startup.js` at startup and by the `dev` script in development

## [1.9.6] - 2026-04-15

### Fixed
- **Update: "connection lost"**: on a WebSocket disconnection during the update, the frontend shows "Restarting server..." and waits for the server to come back instead of showing an error
- **Windows browser opening**: the `.bat` waits for the server to be ready (polling `/health`) before opening the browser, instead of a fixed 3s timeout
- **Launcher update**: the `.bat` is automatically regenerated from the template during an update through the interface

## [1.9.4] - 2026-04-15

### Fixed
- **Balancing: saveLap crash**: `driverId` made optional in the Lap schema (it was required, causing a Prisma crash in balancing mode without a driver)
- **Windows update**: EPERM fix during `npm install` (Prisma DLL locked by the running process). The Prisma postinstall is now skipped during the update, and `prisma generate + db push` run when the server restarts

## [1.9.2] - 2026-04-15

### Fixed
- **Balancing: incomplete config**: in balancing mode, assigning a car without a driver no longer blocks the start (only cars are required)

## [1.9.1] - 2026-04-15

### Fixed
- **Automatic Prisma generate**: added a `postinstall` script to run `prisma generate` after `npm install` (fixes the error on new installations)

## [1.9.0] - 2026-04-12

### Added
- **Automatic championships**: new "Auto" mode for championships with automatic generation of the qualifying/race tree
- **Creation wizard**: multi-step wizard (info, drivers, qualif/race configuration, preview) with a Manual/Auto switch
- **Participant selection**: driver list with dynamic adding (automatic new row), editable at any time
- **Automatic session generation**: balanced distribution of drivers into qualif groups (round-robin) and races (sequential)
- **Auto-progression**: after all qualifying sessions, drivers are automatically assigned to races according to the merged standings (best lap)
- **Bracket/Tree**: 3-column view (qualifs → overall standings → races) with real-time updates
- **Flexible editing**: add extra drivers, qualifs or races even after the championship has started (finished sessions immutable)
- **Semantic colors**: CSS tokens in `@theme` (`session-practice`, `gap-laps`, `leader`, `ctrl-1`...) for consistent colors

### Changed
- **Race overall standings**: Laps + Gap/Total columns, gap in laps (orange) when the lap count differs from the leader's
- **Race leaderboard**: the leader shows "Leader" in purple during the race, the total time only at the end
- **Championship config**: sessions editable/deletable while in draft (even in auto mode), finished sessions locked
- **Status translation**: `finished` → `Terminé`, `active` → `En cours`, etc. in the configuration panel

## [1.8.0] - 2026-04-11

### Added
- **Balancing sessions**: new `balancing` session type dedicated to balancing the cars
- **Balancing page** (`/balancing`): dedicated page with a track selector, simplified config (controller + car only)
- **Lap time chart**: real-time recharts LineChart replacing the leaderboard, one line per car
- **Per-car statistics**: best lap, best median (per block of 5 laps), trend indicator (speeding up/slowing down/stable)
- **Gap between cars**: best median delta shown to compare performance
- **Overall standings per car**: best lap + best median per car (not per driver) in the right panel
- **Session history**: change in the best median session by session with colored indicators (green = improved, red = worse)
- **Outlier filter**: "Max time" input in the config to exclude aberrant laps from the chart and the calculations
- **First lap excluded**: the pit exit lap is automatically ignored in the calculations and the chart
- **Podium component**: extracted into a reusable component (`Podium.jsx`) with summary stats (laps completed/configured, actual/configured duration, grace period, best lap)
- **Session detail page redesign**: shadcn/ui migration, podium, built-in leaderboard, lap history, balancing support with chart, DNF

### Changed
- **SessionSection**: Driver and Grid columns hidden for balancing sessions, Grace period replaced by Max time
- **Sidebar**: "Balancing" entry added after Statistics (Scale icon)
- **session:bestlap event**: now includes `sessionType` to disable voice announcements in balancing
- **Sidebar during a session**: stays open during balancing sessions (no automatic collapse)
- **Detail pages redesign**: TrackProfile, DriverProfile, CarProfile migrated to shadcn/ui with a compact header, inline stats, clickable sessions
- **CRUD components migration**: FormModal, Modal, PageHeader, EmptyState, EntityCard, ColorPickerField, RangeField, PhotoUploadField, RecordDisplays to shadcn/ui
- **primaryColor removed**: all hardcoded colors replaced by semantic tokens (`text-primary`, `bg-card`, `border-border`)
- **Session history sorting**: sorted by `updatedAt` (instead of `createdAt`) so modified/reset sessions move to the top
- **History Date column**: shows `updatedAt` instead of `createdAt`
- **Podium stats**: shows laps completed/max, actual/configured duration, grace period with a 30s fallback
- **Unified session type colors**: practice=purple, qualif=blue, race=green, balancing=orange on every page
- **Dashboard driver standings**: colored races/wins/podiums, number of races shown
- **Production mode**: the Express backend serves the built frontend on a single port (3001), instant startup
- **In-app update**: section in Settings to check for and apply updates (git pull, npm install, build, prisma, automatic restart)
- **Update progress**: real-time WebSocket progress bar, error display, auto-reconnect after restart
- **Installation scripts**: `RaceHubOS-install-mac.command` and `RaceHubOS-install-win.bat` — a single script to download and run
- **Prerequisites auto-install**: Homebrew/Git/Node.js (Mac) or Git/Node.js via winget (Windows)
- **macOS desktop app**: `.app` with a custom icon, starts the server + opens the browser
- **Launcher with auto-restart**: restart loop (exit code 42) to support in-app updates
- **Kill port on launch**: the launcher frees port 3001 if already in use
- **DATABASE_URL fallback**: the backend automatically creates the SQLite connection if .env is missing
- **Dynamic version**: read from package.json, no more hardcoded value

### Fixed
- **isPitLap**: non-existent field replaced by `deletedAt` in stats.js
- **Safe git pull**: `checkout + pull --ff-only` preserves DB/uploads/.env
- **GitHub version cache**: uses the GitHub API instead of raw.githubusercontent (no CDN cache)
- **react-is**: missing recharts dependency added

## [1.6.0] - 2026-04-10

### Added
- **Best lap voice announcement**: French speech synthesis when a new session record is set (driver name + time)
- **End-of-race podium announcement**: voice announcement 3rd → 2nd → 1st with total time (race) or best lap (qualif) after the finish music
- **VoiceContext**: dedicated service for voice handling (speak, formatTimeVoice, preferences)
- **Voice settings**: on/off toggle, configurable minimum lap threshold (1-20, default 3), French voice selector with a test button
- **Total column (race)**: the leader shows their total time, the others the gap — single merged column

### Changed
- **Qualif/practice gap**: the leader shows their best lap in purple instead of "Leader"
- **session:finished event**: now includes `sessionType` to tell race and qualif apart in the announcements
- **Free session persistence**: track and mode (practice/qualif/race) saved in localStorage through AppContext
- **Automatic driver copy**: changing type in a free session copies the driver/car config from the previous session
- **Practice podium sorting**: aligned with the leaderboard (laps desc → bestLap asc) to avoid inconsistencies

### Fixed
- **Duplicate style attribute**: fixed the SessionSection podium (ringColor + backgroundColor merged)
- **Podium not shown**: session.drivers updated with the final leaderboard at the end of the session
- **Empty race standings**: missing `totalLaps` mapping in free session records
- **Standings not refreshed**: automatic standings refetch after the session ends (event listener)

## [1.5.0] - 2026-04-06

### Added
- **AppContext**: unified context for UI preferences (theme, admin, sidebar, standings), replaces ThemeContext
- **Editable session title**: click the title to edit inline (contentEditable), auto-save on blur
- **Inline session config**: controllers table always visible with inline selects and auto-save, no more form mode
- **Duration/laps/grace config**: inline inputs for qualif and race (free sessions and championships)
- **End-of-race podium**: visual podium display (1st/2nd/3rd) with avatars, gaps, best lap and stats
- **Start lights**: beep sound for each light, Space key to start, Escape key and close button to cancel
- **Sidebar/standings persistence**: state saved in localStorage, closed automatically during a race, restored afterwards
- **Free session config sync**: driver/car changes propagated to the other types (practice/qualif/race)
- **DB migration**: 'ready' sessions migrated to 'draft'

### Changed
- **ready status removed**: simplified cycle draft → active → paused → finishing → finished
- **Direct start**: "Start" button from draft (no need to go through "Ready" anymore)
- **Overall standings**: bright podium colors (colored round badges, gradients, borders), no more 5-driver limit
- **Dark mode gradient**: uses `var(--card)` instead of a hardcoded hex
- **Starting grid**: border and gradient always on the left
- **Session reset**: soft delete of laps for all types (no more hard delete for qualif/race)
- **Progress bars**: hidden when the session is finished (info in the podium)
- **Incomplete config**: blocks the start if a driver has no car or vice versa

### Fixed
- **gridPos**: added to the leaderboard endpoint and SessionService (grid positions working)
- **Infinite re-renders**: fixed useEffect deps in FreeSessionPage, ChampionshipDetail, SessionSection
- **Timing after reset**: timing reset in resetSession and loadSession
- **handleSaveConfig**: no unnecessary PUT/PATCH when only the drivers change
- **Free session name**: no more doubled "Free Practice free"

### Removed
- **ThemeContext**: merged into AppContext
- **Obsolete tests**: 4 test files removed (they imported renamed/removed modules)

## [1.2.0] - 2026-03-28

### Added
- **shadcn/ui Sidebar**: migration to the shadcn/ui Sidebar component (dashboard-01 style) with `SidebarProvider`, `SidebarInset`, collapsible in "icon" mode, `Ctrl+B` keyboard shortcut, mobile support via Sheet, tooltips in collapsed mode
- **Logo**: new RaceHubOS logo in the sidebar
- **Layout header**: top bar with `SidebarTrigger`, dynamic page title, result counter, grid/list toggle and add button (moved up from ListPage)
- **CU status footer**: fixed bottom bar with CU connection state, mode, last lap
- **Zinc dark mode**: dark mode palette switched to Zinc (neutral/bluish grays)
- **Dashboard**: complete redesign with all-time records, top 10 driver standings, fastest laps, stats cards, active session banner; data limited to championships (free sessions excluded)
- **`has_championship` filter**: new parameter on `/api/sessions`, `/api/stats/drivers`, `/api/stats/records`, `/api/stats/laptimes` to exclude sessions outside championships
- **Settings**: migration to shadcn/ui components (Card, Button, lucide icons), redundant header/back link removed
- **Backend Status**: migration to shadcn/ui Sheet (slide-in panel), lucide icons, filters by log type
- **lucide-react migration**: `@heroicons/react` fully replaced by `lucide-react` across the 47 files, heroicons package removed
- **Edit button (pencil)**: added on grid cards, table rows (fixed, non-movable actions column) and profile pages (Drivers, Cars, Tracks)
- **Free Mode**: migration to shadcn/ui components (Select, Tabs, Button)
- **DataTable**: `meta.className` support on columns, reduced padding on select/actions columns
- **Sidebar**: menu reorganized (Free Mode, Championships, History, Tracks, Teams, Drivers, Cars, Stats)
- **Free Mode**: track and type selects always clickable, overall standings toggle, semantic tokens, bright podium colors, shadcn Card empty state, free sessions created with "ready" status by default
- **Inline session configuration**: modal replaced by a form built directly into the session block (name, duration, laps, controllers, status)
- **Expanded leaderboard**: larger sizes (position, avatar, number, name, stats) when the overall standings are hidden
- **Championship page**: shadcn migration (ChampionshipHeader, ChampionshipConfigModal as a Sheet, semantic tokens), overall standings toggle, inline session config, shadcn selects for controllers and track
- **Leaderboard stats**: larger sizes in expanded mode (labels, laps, times, gap), LapTime size `xl`
- **Upgrade script**: `RaceHubOS-upgrade.bat` with prisma generate, desktop shortcut, versioned launcher
- **Finish championship**: button in the header when all Q/R sessions are finished, button in the config to force the end
- **Soft delete / hard delete**: DELETE does a soft delete, a second DELETE does a hard delete, PATCH restores, on all entities (drivers, cars, tracks, teams, championships, sessions, laps)
- **ListPage deleted items**: Restore + Delete permanently buttons in "Show deleted items" mode, modal confirmation, automatic deselection after the action
- **Stats laps**: DELETE/restore endpoint for laps, "Show deleted items" filter on the Stats page
- **DataTable**: sticky toolbar, empty state with a Search icon
- **Auto-collapse on start**: sidebar and overall standings close automatically when a session starts (Free Mode and Championship)
- **Default view**: option in the settings to choose Grid or List as the default on every page
- **PageHeaderContext**: React context to lift header elements from child pages up to the layout
- **shadcn/ui**: full integration with Tailwind v4, Popover, Select, Table, Checkbox, Input, Button, DropdownMenu, Skeleton, Badge, Card, Tabs components
- **Generic DataTable** (`data-table.jsx`): reusable component based on TanStack React Table with global search, multiple selection, per-column sorting (asc/desc), per-column filters via Popover, drag & drop to reorder columns (with framer-motion animation), configurable column visibility, infinite scroll, loading skeleton
- **Generic ListPage** (`list-page.jsx`): reusable page layout with header (icon + title + counter + add button), DataTable, selection action bar, deletion confirmation, empty state
- **FilterHeader** (`filter-header.jsx`): column header with sorting + funnel icon + filter options popover
- **User preferences**: `Preference` model in DB (JSON key/value), `GET/PUT /api/preferences/:key` route, column visibility and order saved per page
- **Soft delete**: `deletedAt` field on Championship, Session, SessionDriver, Lap, Driver, Car, Track, Team, TrackRecord; cascading deletion through `deletedAt` instead of hard delete; "Show deleted items" filter in the tables
- **Lazy loading**: all pages loaded dynamically through `React.lazy()` + `Suspense`, main bundle reduced from 900KB to 317KB

### Changed
- **Tailwind v3 → v4**: migration to Tailwind CSS v4 with the native Vite plugin (`@tailwindcss/vite`), oklch support, postcss.config.js and tailwind.config.js removed
- **Stats: server-side filters and sorting**: all filters, sorting and pagination are now handled by the backend (Prisma orderBy / skip / take), client-side sorting removed
- **Stats: infinite scroll**: the "Max number" filter replaced by infinite scroll with progressive loading in pages of 50
- **Stats: optional driver×car grouping**: grouping by best lap per driver/car/track combo can now be turned off with a checkbox
- **API `/api/stats/laptimes`**: added `offset`, `sortBy` (lapTime, driver, car, track, sessionType, date), `sortOrder`, `unique` parameters; returns `total` and `hasMore` for pagination
- **API `/api/championships`**: added `offset`, `limit`, `trackId`, `status`, `deleted` parameters; returns `total` and `hasMore`
- **API `/api/sessions`**: added `offset`, `limit`, `deleted` parameters; returns `total` and `hasMore`
- **Sessions: DataTable view**: custom list view replaced by the generic DataTable with per-column filters (type, track, status, championship), sorting, selection, drag & drop
- **Championships: DataTable view**: card grid replaced by the generic DataTable with per-column filters (track, status), sorting, selection, drag & drop
- **Lap.softDeletedAt → Lap.deletedAt**: renamed for consistency with the other models
- **Deletion**: switch from hard delete to soft delete with cascade on Session and Championship
- **Tracks: DataTable view**: card grid replaced by the generic DataTable with sorting, selection, search, infinite scroll, column drag & drop
- **Stats: DataTable view**: custom table replaced by the generic DataTable with per-column filters (driver, car, track, session), avatars, top 3 medals, infinite scroll
- **API `/api/tracks`**: added `offset`, `limit`, `deleted` parameters; returns `total` and `hasMore`
- **Drivers: DataTable + grid view**: grid/list toggle with shadcn Tabs, DataTable with columns (driver, no., team, races, wins, podiums, laps, record), original cards with racing stripe/gradient/blur in grid mode
- **Cars: DataTable + grid view**: separate brand/model/year columns, speed/braking bars, record, sessions, cards with specs in grid mode
- **Teams: DataTable + grid view**: columns (name, color, drivers), cards with a driver list in grid mode
- **Tracks: grid view**: grid mode added with cards (length/turns specs, record, sessions)
- **API `/api/drivers`**: added `offset`, `limit`, `deleted`, `sortBy`, `sortOrder` parameters; sorting by `_count` sessions/laps; returns `total` and `hasMore`
- **API `/api/cars`**: added `offset`, `limit`, `deleted`, `sortBy`, `sortOrder` parameters; sorting by `_count` sessions; returns `total` and `hasMore`
- **API `/api/teams`**: added `offset`, `limit`, `deleted`, `sortBy`, `sortOrder` parameters; sorting by `_count` drivers; returns `total` and `hasMore`
- **Grid/list toggle**: shadcn Tabs component in ListPage, preference saved in DB

### Fixed
- **Sorting on all pages**: server-side sorting for computed columns (relations, counts, durations) on championships, sessions, drivers, cars, tracks
- **Deleting cars linked to sessions**: added a Prisma transaction to cascade-delete the associated SessionDriver, Lap and FuelStop records before deleting the car
- **"Driver not found" shown**: added a `res.ok` check before parsing the JSON response in DriverProfile
- **Images not shown in the car list view**: added conditional rendering of `car.img` in CarTable with a fallback to the brand's initial
- **All-green colors in the car list view**: `car.color` used instead of the default color in CarTable for badges, progress bars and avatars
- **Driver/car counters at 0 on the dashboard**: added `res.ok` checks on the Dashboard API calls before updating the state
- **Simulator reachable without admin mode**: added the `isAdmin &&` condition on the /simulator link in the sidebar

## [0.1.0] - 2026-01-23

### Changed
- **SessionDriver**: `driverId` and `carId` are now optional in the Prisma schema to allow partial configurations in draft
- **Sessions route**: filter updated to accept configs with a driver OR a car (not necessarily both)
- **Images**: relative path stored (`/api/img/type/filename`) instead of the full URL, `/api/img/:type/:filename` endpoint to serve images (avoids port issues)
- **Settings**: simulator hidden from the device list if the user is not an admin

### Added
- **Statistics page rebuilt**: new design with a table of all records, filters (driver, car, track, session type, max number of results), sortable columns, avatars linking to the profiles, medals for the top 3
- **API route `/api/stats/laptimes`**: endpoint to fetch the best times per driver×car×track combo with filters and a configurable limit
- **Improved Top 10 Records design**: new `RecordDisplays` component with gold/silver/bronze medals for the top 3, stacked driver and car avatars, colored badges for the session type (Race/Qualifying/Practice)
- **Incomplete configuration validation**: blocks switching to "Ready" status if a controller has a driver without a car or vice versa, with a visual warning message
- **Partial draft saving**: a configuration can be saved with only the driver or only the car assigned
- **3-digit driver numbers**: wider badge (w-16 → w-20) and font size adapted to the number of digits in SessionLeaderboard
- **Car image in the leaderboard**: the car image is shown next to the driver's number in the race standings
- **"Reset stats" button**: added on the driver, car and track profile pages, deleting the associated data (laps, sessions, records) through a Prisma transaction
- **Car profile page** (`/cars/:id`): styled header, specs, Top 10 records (driver × track combo with session type), recent sessions
- **Track profile page** (`/tracks/:id`): header with image/specs (length, turns, races), track record, Top 10 records (driver × car combo with session type), clickable recent sessions
- **Driver profile page** (`/drivers/:id`): Top 10 records (car × track combo with session type) replaces the old "Fastest laps" display
- **Navigation to profiles**: clicking a card (driver/car/track) opens its profile page, pencil button to edit
- Initial project setup
- Monorepo structure with backend and frontend packages
- SQLite database with Prisma ORM
- WebSocket server with Socket.io
- Mock simulator for development
- Multi-display support (admin, scoreboard, stats, timing, driver views)

### Architecture
- Backend: Node.js + Express + Socket.io + Prisma
- Frontend: React + Vite + TailwindCSS + shadcn/ui
- Database: SQLite
- Bluetooth: Web Bluetooth API
- Deployment target: Raspberry Pi with multiple displays

## [0.1.0] - 2025-11-21

### Added
- Project initialization
- Basic structure and configuration

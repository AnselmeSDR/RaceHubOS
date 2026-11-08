# Cockpit-XP import

Open **Import** in the sidebar and select a Cockpit-XP ZIP backup. Node is the only runtime; `better-sqlite3` and `jszip` are direct backend dependencies. No program, add-on, hardware profile, license, XML instruction or source SQL is executed. Only the SQLite tables described below and referenced raster images are read; archive paths are never extracted.

Each object type has a separate tab: drivers, cars, tracks, sessions, results and laps. The preview displays actual editable records, including default speed 100, brake 50, fuel 100 and the model's default color when missing. A missing brand remains empty and must be supplied; it is never assumed to be Carrera. All dates are ISO timestamps and durations are milliseconds. Records are paged in groups of 25 to keep large imports responsive.

Review every tab. Edit fields, fix references, remove rows, and choose whether to include each picture. Removing an entity can leave dependent rows unresolved: explicitly repair or remove those rows. Ambiguous race/lap matches are left unresolved instead of guessed. The import button stays disabled for unresolved references; the server independently validates every submitted field, range and reference. Empty years and historical years such as 1888 are accepted.

The action selector either creates a new object or links to an existing one. Linked rows are not overwritten, including car equipment, CU settings and existing results. To change an imported proposal, choose Create and edit it before the initial import. Previously imported identities are fixed links; they cannot be silently remapped, copied or overwritten on repeat imports. Removing an already imported target requires restoring it before importing the same source rows again.

After explicit confirmation:

1. Refuse an active, paused or finishing session and an outdated preview.
2. Call the existing `backupDatabase()` into `prisma/db-old/`; backup failure stops the import before any writes.
3. Recheck the target snapshot inside a Prisma transaction. Store drivers, cars and tracks in their normal tables; races as finished `Session` rows, standings in `SessionDriver`, individual rounds in `Lap` with the session's track and reviewed driver/car/controller links.
4. Save only source fingerprints, object types and target IDs in `CockpitImportRecord`, created through a Prisma migration. No source archive in Preferences, no provenance markers in car notes. Fingerprints prevent reimporting identical source rows, even after the user edits a target's name or equipment.
5. On error roll back all database changes and remove newly written images. Preserve the reviewed preview for retry. Existing source and target files are never overwritten.

The import has the same network accessibility as other RaceHubOS features. It does not add a loopback/origin restriction or modify the Vite proxy. A successful import emits the usual data refresh event. It is independent of the catalog and all other feature PRs. Host version and changelog are unchanged.

## Supported source data

The ZIP contains exactly one `Database.sqlite/cpv2stamm` and optionally one `Database.sqlite/cpv2statistik` (nested backup directories and Windows separators are supported).

- `DriverItems`: ID, Driver/FullName, optional Email, Number, Color, Picture.
- `CarItems`: ID, Car/FullName, optional Brand/Manufacturer, Year, Color, MaxSpeed, BrakeForce, FuelCapacity, Notes, Picture. Selected `CarData` equipment is mapped to motor, gear ratio, scale and tyres; absent fields keep the normal defaults or remain optional.
- `CourseItems`: ID, Course/FullName, optional Length, Corners, Color, Picture.
- `StRennResults`: ID, Fahrer, Fahrzeug, RennStrecke, Runden, Gesamtzeit, BesteRunde, Platz, Datum, Uhrzeit, RennArt, MasterID. MasterID plus track groups participants of a race. Without MasterID, a complete date/time/track/type key is used; without time each result becomes its own proposed session. A reviewed session can hold the normal maximum of six controllers.
- `StRoundTime`: ID, Driver, Car, Course, RoundTime, Date, MasterID, optional Sector1/2/3. Laps link automatically only when driver/car/track and available race/date identifiers identify exactly one result. Otherwise select the session explicitly in preview. Imported result aggregates are preserved; a backup can contain fewer individual laps than its aggregate lap count.

Counters, winners summaries, maintenance intervals and unsupported source tables are not represented as fake sessions or hidden archives. Pictures must be PNG, JPEG, GIF or WebP with matching content signatures. Unknown file types and unused archive members are ignored. Sources with different table layouts need another explicit mapper; this does not claim universal compatibility with every Cockpit-XP version.

Limits: 180 MiB uploaded ZIP, 20,000 members, 50 MiB per SQLite database, 5,000 rows per supported table, 5 MiB per referenced image and 25 MiB total image data. Preview IDs expire after 30 minutes; three previews are kept per server. Exact source-content fingerprints support repeat imports, not fuzzy matching between independently changed exports. Transaction failure or a changed target requires rechecking the relevant preview.

Tests use generated SQLite/ZIP fixtures with a synthetic PNG. No personal backup, race database or manufacturer image is bundled. Native Windows/macOS runtime and representative real-backup acceptance remain separate validation items until exercised.

## Optional local catalog integration

When the local catalog feature is installed, the reviewed import offers an
unchecked option to also copy all selected cars into the catalog. The import
remains usable on its own; without the catalog model this option is disabled.

The car preview exposes a catalog reference for every selected car. Explicit
`Serial`, `ArticleNumber` or equipment `Artikelnummer`/`serial` values are
prefilled; references are never inferred from names. Missing references can be
entered manually and must be unique. Existing catalog references are retained,
with added/skipped counts shown after import. Existing linked cars stay unchanged.

Catalog copies include reviewed brand, model, year, scale, equipment, front/rear
tyre references, notes, photo and measurements. Explicit gram/millimetre fields
are supported; no unknown units are converted. Tyre references belong to the
car; the import does not guess axle assignments or create standalone tyre stock.
Newly imported cars receive the reviewed catalog reference. Catalog writes share
the normal transaction and mandatory pre-import backup; a catalog change also
invalidates a stale preview. Drivers, tracks and race history stay in their
normal import groups.

# Vehicle management and local catalogue

Cars can be created and edited manually or associated with a Carrera, Scalextric or Superslot article reference. A lookup changes nothing until the user explicitly applies selected brand, model, scale and image fields and saves the car. Equipment, mounted tyres, colour, CU settings and race results remain unchanged. Model year is optional.

## Sources and operation

Settings and the car form provide a manual update for all three sources:
- Carrera public product feeds: DIGITAL 124, DIGITAL 132 and EVOLUTION.
- Scalextric's public Cars catalogue and the product feed referenced by that page.
- Superslot's public vehicle listing at Hobbymodelismo.

Only single 1:32/1:24 vehicles are accepted. These are current lists, not a complete historical archive. Superslot H/C equivalences require an exact, unique normalized model/livery match; the prefix is never simply substituted. Sources and verification dates are retained. Two existing verified KITT/DeLorean records and their thumbnails are bundled in `packages/backend/data/catalog`; they are catalogue data, not a user's personal cars. Product images and names belong to their respective sources.

After updating, article lookups and downloaded thumbnails work offline. Reads never trigger remote requests. Old entries survive updates. All metadata sources must succeed before replacing the index. Requests, image size and total image storage are bounded; catalogue cache cleanup preserves images referenced by saved cars. No account, paid service or scheduled update is required.

Tyre lookup reads the explicit spare-parts section on the Carrera product page, or the bundled verified Scalextric references. It describes original-wheel fit only; unknown axle assignments remain unknown. Assigning front/rear tyre text requires an explicit action and saving the car. A failed online query preserves the previous cache.

## Persistence and scope

No schema migration is needed. The existing Preference table stores the index (`carrera:catalog:v1`), car reference (`carrera:car:<id>`), tyre cache (`carrera:tyres:<reference>`) and scale filter (`cars:scaleFilter`). Images use the normal local uploads directory. Backups must include both database and uploads. This branch does not add a backup system or distribute personal databases, imported Cockpit-XP data or the owner's catalogue cache.

The persistent scale filter runs before pagination and counting. Unknown scales appear under Both; an explicit vehicle scale takes precedence over catalogue scale. Voltage hints describe Carrera's original 14.8 V/18 V configurations and do not control hardware. EVOLUTION is analogue unless suitably converted.

The feature supplies French, English and German strings. The independent German base-interface translation remains in `feat/i18n-de`; this branch preserves upstream's language selection and default.

## Validation

Run the standard backend Jest suite, `npm run check:push` and `npm run build`. Catalogue/parser/import/API and translation regression tests live in the normal backend test directory and use only the isolated test database or disposable directories. UI tests use dedicated Playwright ports and e2e.db.

# Local vehicle and tyre catalog

Open **Catalog / Catalogue / Katalog** in the sidebar. The catalog starts empty.
Create or edit entries by hand, including front/rear tyre references, equipment,
measurements and a photo uploaded from your computer. No shop page, search service,
API or image is downloaded. Product references are arbitrary, case-sensitive text;
use the exact same reference in the catalog and car form.

In a car form, enter a reference and search the local catalog. Check the fields you
want and click **Apply selected fields**. Nothing is selected automatically. Save
the car to persist those fields. Unselected equipment, CU settings and race results
are preserved. `serial`, `scale`, `year`, `img`, `tyresFront`, `tyresRear` and other
specifications are normal Car columns; no per-car Preferences are used. Editing or
deleting a catalog entry does not retroactively change saved cars.

## JSON export and import (versions 1 and 2)

Use **Export catalog** to download every entry, or **Export article** on a card to
save only that article. Both downloads use the version-2 envelope with embedded base64 image files and can
be restored with the same JSON file picker. Only catalog fields are exported;
internal creation/update timestamps are omitted. Empty catalogs export an empty
array. Exports are limited to 1000 entries and 50 MiB (5 MiB per image) so every exported file fits
the importer. Exporting does not modify catalog entries or saved cars.

Version-2 exports contain an `images` object mapping each entry's image path to
its base64 file bytes. Import validates all metadata, image paths, encodings,
file signatures and sizes before writing. Images receive content-based local
filenames; existing photos are never overwritten. Shared images are embedded once.
Missing source photos reject export so incomplete files are not silently produced.
Version-1 imports remain supported (1 MiB, image paths only).

Select a UTF-8 JSON file on the Catalog page. Legacy data-only example (version 1, maximum 1 MiB, 1000 entries):

```json
{
  "version": 1,
  "entries": [
    {
      "serial": "MY-001",
      "brand": "My brand",
      "model": "My car",
      "year": 1888,
      "scale": "1:32",
      "tyresFront": "My front tyre reference",
      "tyresRear": "My rear tyre reference",
      "notes": "My own measurements"
    }
  ]
}
```

`serial`, `brand`, `model` are required nonempty strings. References must be unique
within the file. Other fields are optional and may be null:

- Strings: `img`, `scale`, `chassis`, `motor`, `gearRatio`, `tyresFront`, `tyresRear`,
  `guide`, `braids`, `magnet`, `notes`.
- Integers: `year`, `weightGrams`. Year has no historical range restriction and
  may be omitted or null.
- Finite numbers in millimetres: `lengthMm`, `widthMm`, `wheelbaseMm`,
  `frontTrackMm`, `rearTrackMm`, `groundClearanceMm`.

Unknown fields, invalid types, duplicate references and remote image URLs reject
the entire import before any write. All rows are written in one transaction.
Existing references are replaced with the imported entry (omitted optional fields
are cleared); other entries remain. Importing an empty array does nothing.

For legacy version-1 files, images are uploaded separately using the entry editor. `img` can reference only a
local car upload, e.g. `/api/img/cars/123456-789.jpg`. Upload the photo on the target
installation before importing that path; version-1 JSON contains no image bytes. Do not put
filesystem paths, external URLs or base64 images in `img`.

Entries live in the local SQLite database (`CatalogEntry`); photos live in the
existing `public/uploads/cars` directory. Database backups include the catalog table. Copy the upload directory as well
when backing up or moving photos to another installation. Removing an entry keeps its image because a car
may still use it. No catalog content or third-party product photos ship in the repo.
Only contribute repository images with permission and documented source/license.

## Scope

Scale filtering and additional year validation are deliberately excluded. A future
scale-filter PR should use a `FilterHeader` scale column in `Cars.jsx`, scales in use
as options, a comma-separated API parameter and `where.scale = { in: scale.split(',') }`.
No year-validation PR is needed for the catalog: year remains optional without a
historical range restriction.

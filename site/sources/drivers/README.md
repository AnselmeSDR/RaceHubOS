# Driver portraits: sources

The illustrated portraits of the drivers of the app, as they are in the app: 512×512, on a transparent background.
Nothing here is published with the site.

- `portraits/`: one portrait per driver.
- `drivers.json`: for each driver, their name, number and colour in the app, their file, and the site picture made
  from it (`site`).

The names are fictional, except Anselme SDR and Romain DAN. The screenshots of the site show these drivers as they are
(`site/scripts/screenshots.mjs`, `KEPT_DRIVERS` and `FICTIONAL_NAMES`).

## Put a portrait in the app

With the app running (backend on port 3001): upload the portrait, then set it on the driver.

```bash
curl -s -F img=@site/sources/drivers/portraits/<name>.png http://localhost:3001/api/upload/drivers   # answers data.url
curl -s -X PUT -H 'Content-Type: application/json' -d '{"img":"<data.url>"}' http://localhost:3001/api/drivers/<driver id>
```

## Make a site picture

At least twice the face of the demo (56 px), on a transparent background:

```bash
magick site/sources/drivers/portraits/<name>.png -resize 128x128 -background none -gravity center -extent 128x128 \
  -strip PNG32:site/img/drivers/<site name>.png
```

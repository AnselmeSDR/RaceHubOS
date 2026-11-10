# Car pictures: sources

The pictures of the cars, in the app and on the site, all come from this folder. Nothing here is published with the site.

- `originals/`: the pictures as generated, 1536×1024 on a black background.
- `transparent/`: the same cars cut out, on a transparent background. The app and the site use these.
- `cars.json`: for each car, its name in the app, its file, the prompt that generated it, and the site picture made from it (`site`).
- `cutout.swift`: the cut-out tool (macOS Vision).

## Generate a new car

The pictures were generated with Codex (its built-in image tool, on a ChatGPT plan), one job per car. The first batch
took a driver portrait of the app as its style reference; for a new car, take one of `originals/` so that it matches
the others. Write the prompt in the same shape as those in `cars.json`: only the car, its livery and its number change.

```bash
codex exec -m gpt-5.6-sol --skip-git-repo-check -s workspace-write -C "$PWD" \
  --output-last-message /tmp/car.txt \
  "Use your built-in image_gen tool to generate exactly one raster image for the prompt below. Do not edit any file. Do not ask questions. No SVG, no HTML, no placeholder.
Reference images (pass them to image_gen as referenced_image_paths): $PWD/site/sources/cars/originals/amg-gt3-8.png
When done, reply with exactly these two lines:
ASSET_NAME: <kebab-case-name>
IMAGE_PATH: <absolute path of the generated image>

Image prompt:
<the prompt>" < /dev/null
```

Copy the image from `IMAGE_PATH` into `originals/<name>.png`, then add the car to `cars.json`.

## Cut a car out

```bash
swiftc -O site/sources/cars/cutout.swift -o /tmp/cutout
/tmp/cutout site/sources/cars/originals/<name>.png site/sources/cars/transparent/<name>.png
```

## Put a car in the app

With the app running (backend on port 3001): upload the picture, at most 800 px wide, then set it on the car.

```bash
magick site/sources/cars/transparent/<name>.png -resize '800x800>' -strip /tmp/<name>.png
curl -s -F img=@/tmp/<name>.png http://localhost:3001/api/upload/cars   # answers data.url
curl -s -X PUT -H 'Content-Type: application/json' -d '{"img":"<data.url>"}' http://localhost:3001/api/cars/<car id>
```

## Make a site picture

Twice the 64×40 box of the demo, the whole car in it, on a transparent background:

```bash
magick site/sources/cars/transparent/<name>.png -resize 128x80 -background none -gravity center -extent 128x80 \
  -strip PNG32:site/img/cars/<site name>.png
```

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const directory = fileURLToPath(new URL('../../data/catalog/', import.meta.url));
const records = JSON.parse(fs.readFileSync(path.join(directory, 'fahrzeuginfos.json'), 'utf8'));
export const scalextricEntries = records.map((info) => ({
  articleNumber: info.artikelnummer,
  aliases: [...new Set([info.artikelnummer, info.referenz])],
  manufacturer: info.artikelnummer.startsWith('H') ? 'Superslot' : 'Scalextric',
  brand: info.hersteller,
  model: info.modell,
  scale: info.massstab,
  series: info.artikelnummer.startsWith('H') ? 'SUPERSLOT' : 'SCALEXTRIC',
  sourceUrl: info.quelle,
  imageUrl: info.bildquelle,
  img: info.bild,
  imageSha256: info.bildSha256,
  tyres: {
    articleNumber: info.artikelnummer,
    manufacturer: 'Scalextric',
    checkedAt: info.reifen.geprueftAm,
    sourceUrl: info.reifen.quelle,
    archived: true,
    parts: [
      {
        articleNumber: info.reifen.artikelnummer,
        title: 'Passender Original-Ersatzreifensatz',
        packSize: info.reifen.satzgroesse,
        sourceUrl: info.reifen.quelle,
        axle: null,
      },
    ],
  },
}));
export function scalextricImage(entry) {
  return fs.readFileSync(path.join(directory, 'bilder', path.basename(entry.img)));
}
export function canonicalReference(number) {
  return scalextricEntries.find((e) => e.aliases.includes(number))?.articleNumber || number;
}

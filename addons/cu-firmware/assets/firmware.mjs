// HMF transform derived from CarlosMagni/flatout firmware/tools/hmf.py (MIT).
export const APP_END = 0x3800;
export function decode(text) {
  if (typeof text !== 'string' || text.length > 200000) throw Error('HMF-Datei zu groß');
  let n = 0,
    eof = false;
  const image = new Uint8Array(APP_END).fill(255),
    used = new Set(),
    records = [];
  for (const raw of text.split(/\r?\n/).filter((s) => s.trim())) {
    const line = raw.trim();
    if (eof || !/^"(?:[0-9a-fA-F]{4})+"$/.test(line)) throw Error('Ungültige HMF-Zeile');
    const words = line.slice(1, -1).match(/.{4}/g);
    const rec = words.map((w) => {
      const b = ((parseInt(w, 16) - ((0x38 + n++) & 255)) * 32269) & 65535;
      if (b > 255) throw Error('HMF-Kodierung ungültig');
      return b;
    });
    if (rec.length < 5 || rec[0] !== rec.length - 5 || rec.reduce((a, b) => a + b, 0) & 255)
      throw Error('HEX-Prüfsumme ungültig');
    const addr = (rec[1] << 8) | rec[2],
      type = rec[3];
    if (type === 1) {
      if (rec[0] || addr) throw Error('Ungültiges Dateiende');
      eof = true;
    } else if (type === 0) {
      if (!rec[0] || addr + rec[0] > APP_END) throw Error('Adresse außerhalb Anwendung / Bootloader');
      rec.slice(4, -1).forEach((b, i) => {
        if (used.has(addr + i)) throw Error('Überlappende Datensätze');
        used.add(addr + i);
        image[addr + i] = b;
      });
    } else throw Error('Nicht unterstützter HEX-Datensatz');
    records.push(rec);
  }
  if (!eof || !used.size) throw Error('Unvollständige Firmware');
  return { image, used, records };
}
export function encode(records) {
  let n = 0;
  return (
    records
      .map(
        (rec) =>
          '"' +
          rec
            .map((b) => ((b * 0xc5 + ((0x38 + n++) & 255)) & 65535).toString(16).padStart(4, '0').toUpperCase())
            .join('') +
          '"'
      )
      .join('\r\n') + '\r\n'
  );
}
export async function sha256(bytes) {
  return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes)), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('');
}
function hex(value) {
  if (typeof value !== 'string' || !/^(?:[0-9a-fA-F]{2})+$/.test(value)) throw Error('Patch benötigt Hex-Bytes');
  return Uint8Array.from(value.match(/../g), (b) => parseInt(b, 16));
}
export async function patchFirmware(text, recipe) {
  const original = new TextEncoder().encode(text),
    hash = await sha256(original);
  if (
    recipe?.schema !== 1 ||
    recipe.baseSha256 !== hash ||
    !Array.isArray(recipe.patches) ||
    !recipe.patches.length ||
    recipe.patches.length > 256
  )
    throw Error('Patch passt nicht zur SHA-256 der Quelldatei');
  const { image, used, records } = decode(text),
    touched = new Set(),
    changes = [];
  for (const patch of recipe.patches) {
    const before = hex(patch.before),
      after = hex(patch.after),
      address = patch.address;
    if (
      !Number.isInteger(address) ||
      address < 0 ||
      before.length !== after.length ||
      address + before.length > APP_END
    )
      throw Error('Ungültiger Patchbereich');
    for (let i = 0; i < before.length; i++) {
      const at = address + i;
      if (touched.has(at) || !used.has(at) || image[at] !== before[i])
        throw Error('Patch überlappt oder erwartete Originalbytes fehlen');
      touched.add(at);
      image[at] = after[i];
    }
    changes.push({ address, before: patch.before, after: patch.after });
  }
  const updated = records.map((rec) => {
    if (rec[3] !== 0) return rec.slice();
    const start = (rec[1] << 8) | rec[2],
      body = [...rec.slice(0, 4), ...image.slice(start, start + rec[0])];
    return [...body, -body.reduce((a, b) => a + b, 0) & 255];
  });
  const output = encode(updated);
  decode(output);
  return {
    output,
    report: {
      schema: 1,
      baseSha256: hash,
      outputSha256: await sha256(new TextEncoder().encode(output)),
      changes,
      hardwareVerified: false,
    },
  };
}

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { resolveLanguage, translate } from "../assets/i18n.mjs";
const dictionaries = Object.fromEntries(
  await Promise.all(
    ["de", "en", "fr"].map(async (lang) => [
      lang,
      JSON.parse(
        await fs.readFile(
          new URL(`../assets/locales/${lang}.json`, import.meta.url),
          "utf8",
        ),
      ),
    ]),
  ),
);
test("all workshop text and accessible labels have German, English and French entries", async () => {
  const html = (
    await fs.readFile(new URL("../assets/index.html", import.meta.url), "utf8")
  ).replace(/<(style|script|code)\b[^>]*>[\s\S]*?<\/\1>/g, "<span></span>");
  const strings = [...html.matchAll(/>([^<>]+)</g)].map((m) => m[1]);
  strings.push(
    ...[...html.matchAll(/(?:aria-label|placeholder)="([^"]+)"/g)].map(
      (m) => m[1],
    ),
  );
  for (const raw of strings) {
    const key = raw.trim().replace(/\s+/g, " ");
    if (!key || ["Deutsch", "English", "Français"].includes(key)) continue;
    for (const lang of ["de", "en", "fr"])
      assert.ok(dictionaries[lang][key], `${lang}: ${key}`);
  }
  for (const lang of ["en", "fr"])
    assert.deepEqual(
      Object.keys(dictionaries[lang]).sort(),
      Object.keys(dictionaries.de).sort(),
    );
});
test("dynamic UI literals are translated and whitespace/technical details are preserved", async () => {
  for (const file of ["app.mjs", "parameter-ui.mjs"]) {
    const code = await fs.readFile(
      new URL("../assets/" + file, import.meta.url),
      "utf8",
    );
    for (const [, key] of code.matchAll(/\bt\("([^"]+)"\)/g))
      for (const lang of ["en", "fr"])
        assert.ok(dictionaries[lang][key.trim().replace(/\s+/g, " ")]);
  }
  assert.equal(translate(" CU-Ticks", dictionaries.en), " CU ticks");
  assert.equal(
    translate("· geprüftes Profil", dictionaries.fr),
    "· profil vérifié",
  );
  assert.equal(
    translate("Unbekannte AVR-Anweisung an 0x1564", dictionaries.en),
    "Unknown AVR instruction at 0x1564",
  );
  assert.equal(
    translate("eventGapMs: gültiger Bereich 101–5000", dictionaries.fr),
    "eventGapMs: plage valide 101–5000",
  );
  assert.equal(translate("5339", dictionaries.en), "5339");
  assert.equal(
    translate(
      "4866c2036446950f3e68aa990d83ea2f4cfebe5470639e45f38cae1115e253b6",
      dictionaries.fr,
    ),
    "4866c2036446950f3e68aa990d83ea2f4cfebe5470639e45f38cae1115e253b6",
  );
});
test("supported regional languages normalize, unsupported values safely fall back", () => {
  for (const [input, want] of [
    ["en-GB", "en"],
    ["fr-FR", "fr"],
    ["de_DE", "de"],
    ["EN", "en"],
    ["../../x", "de"],
    ["es", "de"],
    [null, "de"],
  ])
    assert.equal(resolveLanguage(input), want);
});

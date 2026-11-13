// Verified against Flatout 6f25ea68, reconstructed with avr-gcc 5.4.0/Atmel 3.6.0.
// Only immediate operands and the LED-chaser entry are changed; no code relocation.
import { decode, sha256, patchFirmware } from "./firmware.mjs";
export const DEFAULTS = Object.freeze({
  eventGapMs: 501,
  debounceTicks: 5,
  watchdogCycles: 13,
  ledChase: true,
  cuSound: true,
  idleSleep: true,
  sensorTones: true,
  pcCarControl: true,
});
export const LIMITS = Object.freeze({
  eventGapMs: [101, 5000],
  debounceTicks: [1, 20],
  watchdogCycles: [7, 40],
});
export const PROFILES = Object.freeze([
  {
    id: "v339-stock",
    bots: false,
    sha256: "a50857e53adaac48f27992e3998a64a5ea10315d837807ba267c618f98cdf611",
  },
  {
    id: "v339-bot.5",
    bots: true,
    sha256: "8fa7b962a4dda91c3b62c5ecab018b731eaae6a59fcf20f29c8be4d4a239e482",
  },
]);
const GAP = 0xf9e,
  SENSORS = [0xbb4, 0xc1a, 0xe2e, 0xe72],
  WATCHDOG = 0x377a,
  CHASE = 0x1a2c,
  SOUND = 0x0140;
export const EXTRA_SWITCHES = Object.freeze([
  {
    key: "idleSleep",
    label: "Energiesparmodus nach Inaktivität",
    sites: [{ address: 0x1564, before: "f894", after: "0895" }],
  },
  {
    key: "sensorTones",
    label: "CU-Töne bei Sensorereignissen",
    sites: [
      0xfea, 0xff2, 0xffa, 0x1002, 0x1096, 0x109e, 0x10ba, 0x10c2, 0x10e2,
      0x10ea, 0x10f2, 0x10fa, 0x111c, 0x1124,
    ].map((address) => ({ address, before: "0e94a000", after: "00000000" })),
  },
  {
    key: "pcCarControl",
    label: "Serien-Fahrzeugsteuerung per PC (C)",
    sites: [{ address: 0x0346, before: "ede1", after: "0895" }],
  },
]);
const originalGap = "455f5140610971094b305e4f6e4f7f4f";
const fromHex = (h) => Uint8Array.from(h.match(/../g), (s) => parseInt(s, 16));
const hex = (b) =>
  Array.from(b, (n) => n.toString(16).padStart(2, "0")).join("");
function word(base, reg, immediate) {
  const w =
    base | ((immediate & 0xf0) << 4) | ((reg - 16) << 4) | (immediate & 15);
  return [w & 255, w >> 8];
}
function immediate(image, at, base, reg) {
  const w = image[at] | (image[at + 1] << 8);
  if ((w & 0xf0f0) !== (base | ((reg - 16) << 4)))
    throw Error("Unbekannte AVR-Anweisung an 0x" + at.toString(16));
  return ((w >> 4) & 0xf0) | (w & 15);
}
export function gapInstructions(n) {
  const upper = (0xffff0000 - n) >>> 0;
  return Uint8Array.from([
    ...word(0x5000, 20, n & 255),
    ...word(0x4000, 21, n >> 8),
    0x61,
    0x09,
    0x71,
    0x09,
    ...word(0x3000, 20, upper & 255),
    ...word(0x4000, 21, (upper >>> 8) & 255),
    ...word(0x4000, 22, (upper >>> 16) & 255),
    ...word(0x4000, 23, upper >>> 24),
  ]);
}
export function validateParameters(values, bots) {
  if (!values || Object.keys(values).some((k) => !Object.hasOwn(DEFAULTS, k)))
    throw Error("Unbekannte Einstellung");
  for (const [key, [min, max]] of Object.entries(LIMITS)) {
    if (key === "watchdogCycles" && !bots) continue;
    if (
      !Number.isInteger(values[key]) ||
      values[key] < min ||
      values[key] > max
    )
      throw Error(key + ": gültiger Bereich " + min + "–" + max);
  }
  if (typeof values.ledChase !== "boolean")
    throw Error("LED-Lauflicht muss an oder aus sein");
  if (typeof values.cuSound !== "boolean")
    throw Error("CU-Piepton muss an oder aus sein");
  for (const { key, label } of EXTRA_SWITCHES)
    if (typeof values[key] !== "boolean")
      throw Error(label + ": an oder aus wählen");
}
export async function readParameters(text) {
  const { image, used } = decode(text);
  if (used.size !== 0x3800) throw Error("Vollständige V339-Firmware benötigt");
  const n =
    immediate(image, GAP, 0x5000, 20) |
    (immediate(image, GAP + 2, 0x4000, 21) << 8);
  if (hex(image.slice(GAP, GAP + 16)) !== hex(gapInstructions(n)))
    throw Error("Ereignisfilter entspricht keinem unterstützten Profil");
  const debounce = SENSORS.map((at) => immediate(image, at, 0xe000, 24));
  if (!debounce.every((n) => n === debounce[0]))
    throw Error("Sensorwerte A/B sind nicht konsistent");
  const chase = hex(image.slice(CHASE, CHASE + 2));
  if (!["dc9b", "0895"].includes(chase))
    throw Error("LED-Lauflicht entspricht keinem unterstützten Profil");
  const sound = hex(image.slice(SOUND, SOUND + 2));
  if (!["282f", "0895"].includes(sound))
    throw Error("CU-Tonroutine entspricht keinem unterstützten Profil");
  const switches = {};
  for (const option of EXTRA_SWITCHES) {
    const states = option.sites.map((site) => {
      const actual = hex(
        image.slice(site.address, site.address + site.before.length / 2),
      );
      if (actual === site.before) return true;
      if (actual === site.after) return false;
      throw Error(
        option.label + ": unbekannter Code an 0x" + site.address.toString(16),
      );
    });
    if (!states.every((value) => value === states[0]))
      throw Error(option.label + ": uneinheitliche Schalterstellen");
    switches[option.key] = states[0];
  }
  const normal = new Uint8Array(0x4000).fill(255);
  normal.set(image);
  normal.set(fromHex(originalGap), GAP);
  for (const at of SENSORS) normal.set([0x85, 0xe0], at);
  normal.set([0xdc, 0x9b], CHASE);
  normal.set([0x28, 0x2f], SOUND);
  for (const option of EXTRA_SWITCHES)
    for (const site of option.sites)
      normal.set(fromHex(site.before), site.address);
  let profile = PROFILES[0],
    watchdog = DEFAULTS.watchdogCycles;
  if ((await sha256(normal)) !== profile.sha256) {
    watchdog = immediate(image, WATCHDOG, 0xe000, 25);
    normal.set([0x9d, 0xe0], WATCHDOG);
    profile = PROFILES[1];
    if ((await sha256(normal)) !== profile.sha256)
      throw Error(
        "Regler unterstützen nur die geprüfte V339 Stock/Bot.5-Basis und daraus erzeugte Profile",
      );
  }
  const values = {
    eventGapMs: n,
    debounceTicks: debounce[0],
    watchdogCycles: watchdog,
    ledChase: chase === "dc9b",
    cuSound: sound === "282f",
    ...switches,
  };
  validateParameters(values, profile.bots);
  return { profile, values };
}
export async function createParameterizedFirmware(text, values) {
  const { profile } = await readParameters(text);
  validateParameters(values, profile.bots);
  const { image } = decode(text),
    patches = [];
  function add(address, after) {
    const before = image.slice(address, address + after.length);
    if (hex(before) !== hex(after))
      patches.push({ address, before: hex(before), after: hex(after) });
  }
  add(GAP, gapInstructions(values.eventGapMs));
  for (const at of SENSORS)
    add(at, Uint8Array.from(word(0xe000, 24, values.debounceTicks)));
  if (profile.bots)
    add(WATCHDOG, Uint8Array.from(word(0xe000, 25, values.watchdogCycles)));
  add(CHASE, fromHex(values.ledChase ? "dc9b" : "0895"));
  add(SOUND, fromHex(values.cuSound ? "282f" : "0895"));
  for (const option of EXTRA_SWITCHES)
    for (const site of option.sites)
      add(site.address, fromHex(values[option.key] ? site.before : site.after));
  const baseSha256 = await sha256(new TextEncoder().encode(text));
  const recipe = { schema: 1, baseSha256, patches };
  const result = patches.length
    ? await patchFirmware(text, recipe)
    : {
        output: text,
        report: {
          schema: 1,
          baseSha256,
          outputSha256: baseSha256,
          changes: [],
          hardwareVerified: false,
        },
      };
  return {
    ...result,
    recipe,
    report: {
      ...result.report,
      profile: profile.id,
      parameters: {
        ...values,
        watchdogCycles: profile.bots ? values.watchdogCycles : null,
      },
      protection: {
        adcFaultDetectionUnchanged: true,
        faultPowerCutUnchanged: true,
        faultBlinkPathUnchanged: true,
        globalKeepAwakeSettingUnchanged: true,
        startLightsUnchanged: true,
        verifiedBy:
          "full-image profile normalization; code-byte invariants, not a hardware fault test",
      },
      watchdogApproxMs: profile.bots ? values.watchdogCycles * 75 : null,
      notes: [
        "Mindestabstand gilt pro Fahrzeug für aufeinanderfolgende Sensorereignisse; keine Mindest-Rundenzeit der Rennsoftware.",
        "Sensorentprellung in CU-Ticks; keine pauschale Umrechnung in Millisekunden.",
        "LED-Schalter betrifft lights_chase_step beim Speichern/Programmieren, nicht Startampel oder Fehleranzeigen.",
        "CU-Piepton aus unterdrückt die Tonwarteschlange unabhängig von einer Bluetooth-/USB-Verbindung. Auch Hinweis-/Warntöne über diese Routine werden unterdrückt; andere Signalwege sind nicht zugesichert.",
        "CU-Piepton an stellt die ursprüngliche Tonroutine wieder her; die vorhandene CU-Sound-Einstellung gilt weiterhin.",
        "Energiesparmodus aus überspringt nur den fehlerfreien Inaktivitäts-Schlafpfad. Fehlerpfad, ADC-Erkennung und Stromabschaltung bleiben bytegleich; cfg_keep_awake wird nicht erzwungen.",
        "Sensorereignis-Töne aus entfernt ausschließlich Tonaufrufe in rail_events_process; mit CU-Piepton aus sind diese ohnehin stumm.",
        "Serien-Fahrzeugsteuerung per PC aus ignoriert den C-Steuerbefehl. Handregler bleiben nutzbar, das separate Bot-Modul B wird dadurch nicht gesperrt. Software kann weiterhin eine Quittierung erhalten.",
        "Schalter ändern nur die Firmware-Datei. Wirkung auf der CU erst nach einem gesonderten Flash.",
        "Keine CU-Übertragung und keine Hardwarevalidierung.",
      ],
      flashed: false,
    },
  };
}

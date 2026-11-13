import { t } from "./i18n.mjs";
import {
  readParameters,
  createParameterizedFirmware,
  DEFAULTS,
} from "./parameters.mjs";
const $ = (id) => document.getElementById(id);
let source = null,
  loaded = null,
  result = null,
  generation = 0,
  revision = 0;
const controls = {
  eventGapMs: ["eventGap", "eventGapNumber", "eventGapValue"],
  debounceTicks: ["debounce", "debounceNumber", "debounceValue"],
  watchdogCycles: ["watchdog", "watchdogNumber", "watchdogValue"],
};

function clearResult() {
  for (const id of ["saveParameters", "saveParameterReport"]) {
    $(id).removeAttribute("href");
    $(id).setAttribute("aria-disabled", "true");
  }
  revision++;
  result = null;

  $("parameterReport").textContent = "";
  $("parameterResult").textContent = t(
    "Werte geändert. Neue Firmware erstellen, um sie zu übernehmen.",
  );
}
function summary() {
  $("eventGapValue").textContent = $("eventGapNumber").value + " ms";
  $("debounceValue").textContent = $("debounceNumber").value + t(" CU-Ticks");
  $("watchdogValue").textContent =
    loaded && !loaded.profile.bots
      ? t("Nicht vorhanden in Stock-Firmware")
      : $("watchdogNumber").value +
        t(" Bahnzyklen ≈ ") +
        Number($("watchdogNumber").value) * 75 +
        " ms";
}
function showValues(values) {
  for (const [key, [range, number]] of Object.entries(controls)) {
    $(range).value = values[key];
    $(number).value = values[key];
  }
  $("ledChase").checked = values.ledChase;
  $("cuSound").checked = values.cuSound;
  for (const key of ["idleSleep", "sensorTones", "pcCarControl"])
    $(key).checked = values[key];
  summary();
}
for (const [, [range, number]] of Object.entries(controls)) {
  $(range).addEventListener("input", () => {
    $(number).value = $(range).value;
    clearResult();
    summary();
  });
  $(number).addEventListener("input", () => {
    $(range).value = $(number).value;
    clearResult();
    summary();
  });
}
$("ledChase").addEventListener("change", clearResult);
$("cuSound").addEventListener("change", clearResult);
for (const key of ["idleSleep", "sensorTones", "pcCarControl"])
  $(key).addEventListener("change", clearResult);
function resetSource() {
  generation++;
  source = null;
  loaded = null;
  $("parameterFields").disabled = true;
  clearResult();
}
async function load(text, label, id) {
  const info = await readParameters(text);
  if (id !== generation) return;
  source = text;
  loaded = info;
  $("parameterFields").disabled = false;
  $("watchdogFields").disabled = !info.profile.bots;
  showValues(info.values);
  $("parameterBaseStatus").textContent =
    label + t(" · geprüftes Profil ") + info.profile.id;
  $("parameterResult").textContent = t(
    "Basis geladen. Einstellungen wählen und eine neue Firmware-Datei erstellen.",
  );
}
$("loadParameterBase").onclick = async () => {
  resetSource();
  const id = generation,
    tag = $("parameterBase").value;
  try {
    const response = await fetch(
      "./baselines/" + encodeURIComponent(tag) + ".hmf",
      { cache: "no-store" },
    );
    if (!response.ok) throw Error(t("Basisdatei konnte nicht geladen werden"));
    await load(
      await response.text(),
      tag + t(" (lokal aus Quellcode gebaut)"),
      id,
    );
  } catch (error) {
    if (id === generation)
      $("parameterBaseStatus").textContent = t(error.message);
  }
};
$("parameterBase").onchange = () => {
  resetSource();
  $("parameterBaseStatus").textContent = t(
    "Neue Basis ausgewählt. Bitte „Geprüfte Basis laden“ anklicken.",
  );
};
$("parameterFile").onchange = async () => {
  resetSource();
  const id = generation;
  try {
    const file = $("parameterFile").files[0];
    if (!file) return;
    if (file.size > 200000) throw Error(t("Datei zu groß"));
    await load(await file.text(), file.name, id);
  } catch (error) {
    if (id === generation)
      $("parameterBaseStatus").textContent = t(error.message);
  }
};
$("resetParameters").onclick = () => {
  if (!loaded) return;
  clearResult();
  showValues(DEFAULTS);
};
$("createParameters").onclick = async () => {
  const id = generation;
  clearResult();
  const currentRevision = revision;
  try {
    if (!source || !loaded) throw Error(t("Zuerst eine geprüfte Basis laden"));
    const values = Object.fromEntries(
      Object.entries(controls).map(([key, [, number]]) => [
        key,
        Number($(number).value),
      ]),
    );
    values.ledChase = $("ledChase").checked;
    values.cuSound = $("cuSound").checked;
    for (const key of ["idleSleep", "sensorTones", "pcCarControl"])
      values[key] = $(key).checked;
    const created = await createParameterizedFirmware(source, values);
    if (id !== generation || currentRevision !== revision) return;
    result = created;
    $("parameterReport").textContent = JSON.stringify(result.report, null, 2);
    $("parameterResult").textContent = t(
      "Firmware erstellt und erneut geprüft. Keine Übertragung an die CU. Hardwareprüfung steht aus.",
    );
    const response = await fetch("/api/addons/cu-firmware/exports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: result.output,
        report: { ...result.report, recipe: result.recipe },
      }),
    });
    const prepared = await response.json();
    if (!response.ok || !prepared.success)
      throw Error(prepared.error || t("Downloadvorbereitung fehlgeschlagen"));
    if (id !== generation || currentRevision !== revision) return;
    exportLink(
      "saveParameters",
      "/api/addons/cu-firmware/exports/" + prepared.id + "/hmf",
    );
    exportLink(
      "saveParameterReport",
      "/api/addons/cu-firmware/exports/" + prepared.id + "/report",
    );
  } catch (error) {
    if (id === generation) $("parameterResult").textContent = t(error.message);
  }
};
function exportLink(id, url) {
  $(id).href = url;
  $(id).setAttribute("aria-disabled", "false");
}

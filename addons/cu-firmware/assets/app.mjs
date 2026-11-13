import { t } from "./i18n.mjs";
import { decode, sha256, patchFirmware } from "./firmware.mjs";
const $ = (id) => document.getElementById(id);
let text = null;
const manifest = await (await fetch("./known-images.json")).json();
$("source").onchange = async () => {
  text = null;
  $("apply").disabled = true;
  $("result").textContent = "";
  try {
    const file = $("source").files[0];
    if (!file) return;
    if (file.size > 200000) throw Error(t("Datei zu groß"));
    const candidate = await file.text(),
      data = decode(candidate),
      hash = await sha256(new TextEncoder().encode(candidate));
    const known = manifest.images.find((i) => i.sha256 === hash);
    if (known?.status === "defective")
      throw Error(t("Bekannte fehlerhafte Firmware: ") + known.tag);
    text = candidate;
    $("info").textContent = JSON.stringify(
      {
        sha256: hash,
        bytes: data.used.size,
        image: known?.tag || t("Unbekannt / eigene Firmware"),
        status: known?.status || t("nicht hardwarevalidiert"),
      },
      null,
      2,
    );
    $("apply").disabled = false;
  } catch (e) {
    $("info").textContent = t(e.message);
  }
};
function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
$("apply").onclick = async () => {
  try {
    const file = $("recipe").files[0];
    if (!file || file.size > 100000)
      throw Error(t("Patch-Rezept auswählen (max. 100 KB)"));
    const result = await patchFirmware(text, JSON.parse(await file.text()));
    download("cu-custom.hmf", result.output, "text/plain");
    download(
      "cu-custom-report.json",
      JSON.stringify(result.report, null, 2),
      "application/json",
    );
    $("result").textContent = t(
      "Erstellt: cu-custom.hmf und Prüfbericht. Originaldatei unverändert. Hardwareprüfung steht aus.",
    );
  } catch (e) {
    $("result").textContent = t(e.message);
  }
};

// Flashing is server-owned; closing/reloading this page does not cancel a job.
let flashText = null,
  flashInfo = null,
  flashState = null,
  inspecting = 0;
async function api(path, body) {
  const response = await fetch(
    "/api/cu-firmware/" + path,
    body === undefined
      ? { cache: "no-store" }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const value = await response.json();
  if (!response.ok || !value.success)
    throw Error(value.error || t("Firmware-Dienst nicht verfügbar"));
  return value.data;
}
function updateStart() {
  const recovery = $("flashMode").value === "recovery";
  $("startFlash").disabled =
    !flashText ||
    !flashInfo ||
    !flashState ||
    flashState.running ||
    !$("bench").checked ||
    (flashInfo.status === "unknown" && !$("allowUnknown").checked) ||
    !/^5\d{3}$/.test($("expectedVersion").value.trim()) ||
    (recovery && (!$("hardware5").checked || !$("recoveryReset").checked));
}
for (const id of [
  "bench",
  "allowUnknown",
  "hardware5",
  "recoveryReset",
  "flashMode",
  "expectedVersion",
]) {
  $(id).addEventListener("change", updateStart);
  $(id).addEventListener("input", updateStart);
}
$("flashFile").onchange = () => {
  inspecting++;
  flashText = null;
  flashInfo = null;
  $("flashInfo").textContent = t("Datei erneut prüfen.");
  updateStart();
};
$("inspectFlash").onclick = async () => {
  const generation = ++inspecting;
  flashText = null;
  flashInfo = null;
  updateStart();
  try {
    const file = $("flashFile").files[0];
    if (!file || file.size > 200000)
      throw Error(t("HMF-Datei auswählen (max. 200 KB)"));
    const candidate = await file.text(),
      info = await api("inspect", { text: candidate });
    if (generation !== inspecting) return;
    flashText = candidate;
    flashInfo = info;
    if (info.expectedVersion) $("expectedVersion").value = info.expectedVersion;
    $("flashInfo").textContent = JSON.stringify(info, null, 2);
    updateStart();
  } catch (e) {
    if (generation === inspecting) $("flashInfo").textContent = t(e.message);
  }
};
async function refreshFlash() {
  try {
    flashState = await api("status");
    $("flashStatus").textContent = JSON.stringify(flashState, null, 2);
    if (!$("cuAddress").value && flashState.address)
      $("cuAddress").value = flashState.address;
    updateStart();
  } catch (e) {
    flashState = null;
    updateStart();
    $("flashStatus").textContent = t(e.message);
  }
}
$("refreshFlash").onclick = refreshFlash;
$("saveFlashReport").onclick = () => {
  if (flashState)
    download(
      "cu-flash-report.json",
      JSON.stringify(flashState, null, 2),
      "application/json",
    );
};
$("startFlash").onclick = async () => {
  $("startFlash").disabled = true;
  try {
    const recovery = $("flashMode").value === "recovery";
    const state = await api("start", {
      text: flashText,
      sha256: flashInfo.sha256,
      recovery,
      restartNormal: !recovery && Boolean(flashState?.recoveryRequired),
      recoveryResetConfirmed: $("recoveryReset").checked,
      hardware5Confirmed: $("hardware5").checked,
      address: $("cuAddress").value.trim() || undefined,
      expectedVersion: $("expectedVersion").value.trim(),
      allowUnknown: $("allowUnknown").checked,
      benchConfirmed: $("bench").checked,
    });
    flashState = state;
    $("flashStatus").textContent = JSON.stringify(state, null, 2);
  } catch (e) {
    $("flashStatus").textContent = t(e.message);
  } finally {
    updateStart();
  }
};
await refreshFlash();
setInterval(() => {
  void refreshFlash();
}, 1500);

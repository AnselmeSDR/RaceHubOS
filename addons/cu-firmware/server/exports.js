// Short-lived, memory-only downloads. These routes never use a ControlUnit.
import { randomUUID } from "node:crypto";
import { readParameters } from "../assets/parameters.mjs";
import { sha256 } from "../assets/firmware.mjs";
export function registerExports(router, { now = Date.now } = {}) {
  const exports = new Map();
  router.post("/exports", async (req, res) => {
    try {
      if (
        req.get("origin") !== `${req.protocol}://${req.get("host")}` ||
        !req.is("application/json")
      )
        return res
          .status(403)
          .json({
            success: false,
            error: "Downloadvorbereitung nur aus RaceHubOS",
          });
      const { text, report } = req.body;
      if (
        typeof text !== "string" ||
        text.length > 200000 ||
        !report ||
        JSON.stringify(report).length > 30000
      )
        return res
          .status(400)
          .json({ success: false, error: "Ungültiger Firmware-Export" });
      const parsed = await readParameters(text);
      const outputSha256 = await sha256(new TextEncoder().encode(text));
      if (report.outputSha256 !== outputSha256)
        return res
          .status(400)
          .json({ success: false, error: "Export-Prüfsumme stimmt nicht" });
      for (const [id, item] of exports)
        if (item.expires <= now()) exports.delete(id);
      if (exports.size >= 20) exports.delete(exports.keys().next().value);
      const id = randomUUID();
      exports.set(id, {
        text,
        report: JSON.stringify(
          {
            ...report,
            profile: parsed.profile.id,
            parameters: {
              ...parsed.values,
              watchdogCycles: parsed.profile.bots
                ? parsed.values.watchdogCycles
                : null,
            },
            outputSha256,
            flashed: false,
            hardwareVerified: false,
          },
          null,
          2,
        ),
        expires: now() + 10 * 60 * 1000,
        name: parsed.profile.id + "-angepasst.hmf",
      });
      res.set("Cache-Control", "no-store").json({ success: true, id });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });
  router.get("/exports/:id/:format", (req, res) => {
    const item = exports.get(req.params.id),
      format = req.params.format;
    if (!item || item.expires <= now() || !["hmf", "report"].includes(format)) {
      if (item?.expires <= now()) exports.delete(req.params.id);
      return res
        .status(404)
        .json({
          success: false,
          error: "Export abgelaufen. Firmware erneut erstellen.",
        });
    }
    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    res.attachment(
      format === "hmf" ? item.name : "cu-einstellungsbericht.json",
    );
    res
      .type(format === "hmf" ? "application/octet-stream" : "application/json")
      .send(format === "hmf" ? item.text : item.report);
  });
}

import express from "express";
import { fileURLToPath } from "node:url";
import { CuFirmwareService } from "./CuFirmwareService.js";
import { createCuFirmwareRouter } from "./router.js";
import { runtime } from "./state.js";
import { registerExports } from "./exports.js";
export default async function register(ctx) {
  if (ctx.version !== "1.27.0")
    throw Error("CU Firmware requires tested RaceHubOS 1.27.0");
  const { controlUnit: cu, sync, session } = ctx.services;
  const recovery = cu.carreraRecovery || {
    enabled: false,
    stop() {
      this.enabled = false;
    },
  };
  const originalConnect = recovery.connect?.bind(recovery),
    originalCheck = recovery.check?.bind(recovery);
  if (originalConnect)
    recovery.connect = (...args) =>
      cu._firmwareLease
        ? Promise.reject(Error("CU firmware maintenance / recovery required"))
        : originalConnect(...args);
  if (originalCheck)
    recovery.check = (...args) =>
      cu._firmwareLease ? Promise.resolve() : originalCheck(...args);
  const firmware = new CuFirmwareService({
    cu,
    sync,
    recovery,
    session,
    io: { emit: (_name, data) => ctx.io.emit("cu-firmware:state", data) },
    directory: ctx.dataDir,
  });
  await firmware.ready;
  runtime.firmware = firmware;
  ctx.app.use("/api/cu-firmware", createCuFirmwareRouter(firmware));
  registerExports(ctx.router);
  const assets = fileURLToPath(new URL("../assets/", import.meta.url));
  ctx.router.use(
    "/assets",
    (req, res, next) => {
      res.set("Cache-Control", "no-store");
      res.set("X-Content-Type-Options", "nosniff");
      res.set(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'",
      );
      next();
    },
    express.static(assets, { index: "index.html" }),
  );
  ctx.log.info("Firmware workshop ready; no firmware upload started.");
  return () => {
    if (originalConnect) recovery.connect = originalConnect;
    if (originalCheck) recovery.check = originalCheck;
    runtime.firmware = null;
  };
}

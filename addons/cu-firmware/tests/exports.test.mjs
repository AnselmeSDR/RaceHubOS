import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import fs from "node:fs/promises";
import { registerExports } from "../server/exports.js";
import {
  createParameterizedFirmware,
  DEFAULTS,
} from "../assets/parameters.mjs";
test("exports require same origin, verify bytes, send real attachments and expire without using hardware", async () => {
  const base = await fs.readFile(
    new URL("../assets/baselines/v339-stock.hmf", import.meta.url),
    "utf8",
  );
  const generated = await createParameterizedFirmware(base, {
    ...DEFAULTS,
    ledChase: false,
    cuSound: false,
  });
  let time = 1;
  const app = express(),
    router = express.Router();
  app.use(express.json());
  registerExports(router, { now: () => time });
  app.use(router);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) =>
    server.listening ? resolve() : server.once("listening", resolve),
  );
  const origin = "http://127.0.0.1:" + server.address().port;
  try {
    assert.equal(
      (
        await request(server)
          .post("/exports")
          .send({ text: generated.output, report: generated.report })
      ).status,
      403,
    );
    const ready = await request(server)
      .post("/exports")
      .set("Origin", origin)
      .send({ text: generated.output, report: generated.report });
    assert.equal(ready.status, 200);
    const file = await request(server).get(
      "/exports/" + ready.body.id + "/hmf",
    );
    assert.equal(file.status, 200);
    assert.match(
      file.headers["content-disposition"],
      /attachment.*v339-stock-angepasst.hmf/,
    );
    assert.equal(file.body.toString(), generated.output);
    const report = await request(server).get(
      "/exports/" + ready.body.id + "/report",
    );
    assert.equal(report.body.parameters.ledChase, false);
    assert.equal(report.body.parameters.cuSound, false);
    assert.equal(report.body.flashed, false);
    assert.equal(
      (
        await request(server)
          .post("/exports")
          .set("Origin", origin)
          .send({ text: generated.output, report: { outputSha256: "bad" } })
      ).status,
      400,
    );
    time = 11 * 60 * 1000;
    assert.equal(
      (await request(server).get("/exports/" + ready.body.id + "/hmf")).status,
      404,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  readParameters,
  createParameterizedFirmware,
  DEFAULTS,
  gapInstructions,
} from "../assets/parameters.mjs";
import { decode, encode, patchFirmware, sha256 } from "../assets/firmware.mjs";
const stock = await fs.readFile(
  new URL("../assets/baselines/v339-stock.hmf", import.meta.url),
  "utf8",
);
const bot = await fs.readFile(
  new URL("../assets/baselines/v339-bot.5.hmf", import.meta.url),
  "utf8",
);
async function altered(text, address, after) {
  const { image } = decode(text),
    hex = (b) => Buffer.from(b).toString("hex");
  return (
    await patchFirmware(text, {
      schema: 1,
      baseSha256: await sha256(new TextEncoder().encode(text)),
      patches: [
        {
          address,
          before: hex(image.slice(address, address + after.length)),
          after: hex(after),
        },
      ],
    })
  ).output;
}
test("both source-built baselines match approved hashes and defaults; unchanged export preserves bytes", async () => {
  for (const [text, bots] of [
    [stock, false],
    [bot, true],
  ]) {
    const loaded = await readParameters(text);
    assert.equal(loaded.profile.bots, bots);
    assert.deepEqual(loaded.values, DEFAULTS);
    const output = await createParameterizedFirmware(text, { ...DEFAULTS });
    assert.equal(output.output, text);
    assert.equal(output.report.changes.length, 0);
  }
});
test("all controls roundtrip and alter only specified AVR operands, leaving vectors/start countdown and bootloader boundary intact", async () => {
  for (const text of [stock, bot]) {
    const values = {
      eventGapMs: 701,
      debounceTicks: 7,
      watchdogCycles: 20,
      ledChase: false,
      cuSound: true,
      idleSleep: true,
      sensorTones: true,
      pcCarControl: true,
    };
    const generated = await createParameterizedFirmware(text, values),
      parsed = await readParameters(generated.output);
    assert.deepEqual(parsed.values, {
      ...values,
      watchdogCycles: parsed.profile.bots ? 20 : 13,
    });
    const a = decode(text).image,
      b = decode(generated.output).image;
    const allowed = new Set([
      0xf9e,
      0xf9f,
      0xfa0,
      0xfa1,
      0xfa6,
      0xfa7,
      0xfa8,
      0xfa9,
      0xfaa,
      0xfab,
      0xfac,
      0xfad,
      0xbb4,
      0xbb5,
      0xc1a,
      0xc1b,
      0xe2e,
      0xe2f,
      0xe72,
      0xe73,
      0x1a2c,
      0x1a2d,
      ...(parsed.profile.bots ? [0x377a, 0x377b] : []),
    ]);
    for (let i = 0; i < a.length; i++)
      if (a[i] !== b[i])
        assert.ok(allowed.has(i), "unexpected change " + i.toString(16));
    assert.deepEqual([...b.slice(0x1a2c, 0x1a2e)], [0x08, 0x95]); // AVR RET: only the pure LED-chaser entry
    assert.deepEqual(b.slice(0x1cde, 0x2b14), a.slice(0x1cde, 0x2b14)); // state machine / starting lights
    assert.deepEqual(b.slice(0xe4e, 0xe50), a.slice(0xe4e, 0xe50)); // memset size 5 must stay unchanged!
    assert.deepEqual(b.slice(0xe92, 0xe94), a.slice(0xe92, 0xe94));
    assert.equal(generated.report.flashed, false);
    assert.equal(generated.report.hardwareVerified, false);
    const restored = await createParameterizedFirmware(generated.output, {
      ...DEFAULTS,
    });
    assert.equal(restored.output, text);
  }
});
test("range boundaries work; stock cannot acquire a bot watchdog via controls", async () => {
  for (const eventGapMs of [101, 255, 256, 257, 501, 1024, 5000]) {
    const values = {
      eventGapMs,
      debounceTicks: eventGapMs % 2 ? 1 : 20,
      watchdogCycles: eventGapMs % 2 ? 7 : 40,
      ledChase: true,
      cuSound: true,
      idleSleep: true,
      sensorTones: true,
      pcCarControl: true,
    };
    assert.deepEqual(
      (
        await readParameters(
          (await createParameterizedFirmware(bot, values)).output,
        )
      ).values,
      values,
    );
  }
  const output = await createParameterizedFirmware(stock, {
    ...DEFAULTS,
    watchdogCycles: 40,
  });
  assert.equal(output.output, stock);
  assert.equal(output.report.parameters.watchdogCycles, null);
});
test("re-encoded AVR interval predicate matches original C range including wraparound", () => {
  const imm = (a, o) => ((a[o + 1] & 15) << 4) | (a[o] & 15);
  for (const n of [101, 255, 256, 257, 501, 701, 1024, 5000]) {
    const a = gapInstructions(n),
      lower = imm(a, 0) | (imm(a, 2) << 8),
      upper =
        (imm(a, 8) |
          (imm(a, 10) << 8) |
          (imm(a, 12) << 16) |
          (imm(a, 14) << 24)) >>>
        0;
    assert.equal(lower, n);
    for (const d of [
      0,
      n - 1,
      n,
      n + 1,
      5000,
      65535,
      0xfffeffff,
      0xffff0000,
      0xffffffff,
    ])
      assert.equal((d - lower) >>> 0 < upper, d >= n && d < 0xffff0000);
  }
});
test("reject malformed ranges, unknown firmware, stray modifications and inconsistent sensor patches", async () => {
  for (const values of [
    { ...DEFAULTS, eventGapMs: 100 },
    { ...DEFAULTS, eventGapMs: 5001 },
    { ...DEFAULTS, debounceTicks: 0 },
    { ...DEFAULTS, debounceTicks: 21 },
    { ...DEFAULTS, watchdogCycles: 0 },
    { ...DEFAULTS, watchdogCycles: 41 },
    { ...DEFAULTS, watchdogCycles: 7.5 },
    { ...DEFAULTS, ledChase: "false" },
    { ...DEFAULTS, extra: 1 },
  ])
    await assert.rejects(() => createParameterizedFirmware(bot, values));
  await assert.rejects(() => readParameters(awaitable()));
  function awaitable() {
    return "invalid";
  }
  await assert.rejects(() => readParameters(awaitableFile()));
  function awaitableFile() {
    return encode([[0, 0, 0, 1, 255]]);
  }
  const tampered = await altered(bot, 0x200, [0x00, 0x00]);
  await assert.rejects(() => readParameters(tampered));
  const inconsistent = await altered(bot, 0xbb4, [0x87, 0xe0]);
  await assert.rejects(() => readParameters(inconsistent), /konsistent/);
  const badOpcode = await altered(bot, 0xf9e, [0x08, 0x95]);
  await assert.rejects(() => readParameters(badOpcode), /AVR/);
});

test("CU sound toggle changes only the beep-queue entry; works for stock/bot and restores exact original", async () => {
  for (const text of [stock, bot]) {
    const generated = await createParameterizedFirmware(text, {
      ...DEFAULTS,
      cuSound: false,
    });
    assert.equal(
      (await readParameters(generated.output)).values.cuSound,
      false,
    );
    const a = decode(text).image,
      b = decode(generated.output).image;
    assert.deepEqual(
      Array.from(a.keys()).filter((i) => a[i] !== b[i]),
      [0x140, 0x141],
    );
    assert.deepEqual([...b.slice(0x140, 0x142)], [0x08, 0x95]); // AVR RET before any queue/connection inspection
    assert.deepEqual(generated.report.changes, [
      { address: 0x140, before: "282f", after: "0895" },
    ]);
    assert.equal(generated.report.flashed, false);
    assert.equal(
      (await createParameterizedFirmware(generated.output, { ...DEFAULTS }))
        .output,
      text,
    );
  }
});
test("sound composes with other controls and old parameterized images remain supported", async () => {
  const old = await createParameterizedFirmware(bot, {
    ...DEFAULTS,
    ledChase: false,
    eventGapMs: 701,
  });
  assert.equal((await readParameters(old.output)).values.cuSound, true);
  const values = {
    ...DEFAULTS,
    cuSound: false,
    ledChase: false,
    eventGapMs: 701,
    debounceTicks: 7,
    watchdogCycles: 20,
  };
  const generated = await createParameterizedFirmware(old.output, values);
  assert.deepEqual((await readParameters(generated.output)).values, values);
  await assert.rejects(
    () => createParameterizedFirmware(bot, { ...DEFAULTS, cuSound: "off" }),
    /Piepton/,
  );
  const invalid = await altered(bot, 0x140, [0x00, 0x00]);
  await assert.rejects(() => readParameters(invalid), /Tonroutine/);
});

test("additional switches compose, preserve protection code and restore exact baselines", async () => {
  for (const text of [stock, bot]) {
    const values = {
      ...DEFAULTS,
      idleSleep: false,
      sensorTones: false,
      pcCarControl: false,
      cuSound: false,
      ledChase: false,
    };
    const result = await createParameterizedFirmware(text, values);
    assert.deepEqual((await readParameters(result.output)).values, values);
    const a = decode(text).image,
      b = decode(result.output).image;
    // LDS fault flag; CPSE r24,r1; RJMP over the sleep path. Only CLI becomes RET.
    assert.deepEqual(
      [...b.slice(0x155c, 0x1566)],
      [0x80, 0x91, 0xdb, 0x03, 0x81, 0x11, 0x18, 0xc0, 0x08, 0x95],
    );
    for (const [start, end] of [
      [0x1566, 0x1a2c],
      [0x1cde, 0x2b14],
      [0x2f8a, 0x309a],
    ])
      assert.deepEqual(b.slice(start, end), a.slice(start, end));
    // Nonzero fault flag takes the original jump to the unchanged fault branch.
    assert.equal(0x1564 + 2 * 0x18, 0x1594);
    assert.deepEqual([...b.slice(0x346, 0x348)], [8, 0x95]);
    assert.equal(result.report.protection.faultPowerCutUnchanged, true);
    assert.equal(result.report.hardwareVerified, false);
    assert.equal(
      (await createParameterizedFirmware(result.output, { ...DEFAULTS }))
        .output,
      text,
    );
  }
});
test("reject partial tone switches and unknown sleep opcode", async () => {
  const partial = await altered(stock, 0xfea, [0, 0, 0, 0]);
  await assert.rejects(() => readParameters(partial), /uneinheitliche/);
  const invalid = await altered(stock, 0x1564, [0, 0]);
  await assert.rejects(() => readParameters(invalid), /unbekannter Code/);
  for (const key of ["idleSleep", "sensorTones", "pcCarControl"])
    await assert.rejects(() =>
      createParameterizedFirmware(stock, { ...DEFAULTS, [key]: "off" }),
    );
});

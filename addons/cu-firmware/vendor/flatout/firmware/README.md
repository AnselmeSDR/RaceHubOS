# firmware — Control Unit firmware V339 and the bot module, built from source

**RaceLab bots do not need any of this**: on a stock V338/V339 CU they use the firmware's own
`C` command (see [`docs/bot-protocol.md`](../docs/bot-protocol.md)). This folder is for
going further than the stock CU allows. It builds, **from source**:

- **the V339 firmware rebuilt from C** (`reconstruction/`): every function of the stock
  firmware rewritten in C until it compiles to exactly the original bytes. With the
  toolchain's start-up code and libraries, the image it builds is byte-identical to the
  stock firmware (`v339-stock`);
- **the bot module** (`bot/`): about 300 bytes of C and asm stubs in free flash, plus three
  `jmp` hooks into the stock code (`v339-bot.N`). It adds one serial command, `B`
  (throttle, lane change, hand back to the controller, per slot) and a firmware watchdog;
  RaceLab uses it when `C` is not available.

No firmware image is stored in the repository: `manifest.json` records each image's tag and
SHA-256, and `build.py` produces the images into `build/` (ignored by git).

```
firmware/
├── build.py           builds both images, checks them against manifest.json
├── manifest.json      image tags and SHA-256 — what the app trusts
├── Dockerfile         the pinned toolchain (avr-gcc 5.4.0 + Atmel 3.6.0, avr-libc 2.0.0)
├── bot/               the bot module (see bot/README.md)
├── reconstruction/    V339 in C (see reconstruction/README.md)
├── tools/hmf.py       .HMF codec
├── CHANGELOG.md       one entry per image tag
└── build/             output: v339-stock.{hmf,bin}, v339-bot.N.{hmf,bin} (not committed)
```

## Build

```bash
python3 firmware/build.py           # → firmware/build/, every image checked against manifest.json
python3 firmware/build.py --check   # exit 1 on any SHA-256 mismatch (CI)
```

It needs avr-gcc **5.4.0** (Atmel 3.6.0 build). If that compiler is not installed, `build.py`
runs itself inside the Docker image from `Dockerfile` (built on first use, a few minutes) —
so in practice it only needs Docker. The RaceLab app runs the same build from its firmware
panel (**Build the images**) when the images are missing.

```
v339-stock.hmf   sha256 c1af1e5a…  = v339-stock
bot module: 308 bytes at 0x36b8
v339-bot.5.hmf   sha256 4a0a514b…  = v339-bot.5
```

## Images and tags

| tag | status | built |
|---|---|---|
| `v339-bot.5` | recommended — bot state in free RAM, firmware watchdog | yes |
| `v339-stock` | stock — the rollback | yes |
| `v339-stock-vendor` | stock — the vendor update file (other line layout, same payload) | no, recognised when imported |
| `v339-bot.4`, `v339-bot.3` | defective — bot state in firmware RAM; the app refuses them | no |
| `v339-bot.2`, `v339-bot.1` | defective — the app refuses them | no |

The app decides everything (label, warning, refusal) from the SHA-256 of a file, never from
its name. Tags are `v339-bot.N`: CU firmware 339, bot module revision N.

## Release a new bot image

1. Change `bot/`, run `python3 firmware/build.py` until it is right.
2. Test on the virtual CU (`racelab --sim --stock-firmware`), then on a bench CU, car lifted
   first.
3. `python3 firmware/build.py --release v339-bot.6` — records the new tag and SHA-256 in
   `manifest.json` (`recommended`) and marks the previous one `superseded`.
4. Fill in its `notes` and add a line to `CHANGELOG.md`.

An image found defective later gets `"status": "defective"` with an `issue` and a `warning`:
the app then shows it in red and refuses to flash it.

## Flash

From the app: System → Advanced options (see the
[user guide](../docs/user-guide.md#updating-the-cu-firmware)). The factory bootloader
(`0x3800+`) is never written: a failed update can always be re-flashed.

## Contribute

- **Bot module** — [`bot/README.md`](bot/README.md): serial contract, RAM map, hooks.
- **Reconstruction** — [`reconstruction/README.md`](reconstruction/README.md): readable
  names, semantics, hardware checks; `build.py --check` must stay green.
- Protocol docs: [`docs/protocol.md`](../docs/protocol.md),
  [`docs/bot-protocol.md`](../docs/bot-protocol.md).

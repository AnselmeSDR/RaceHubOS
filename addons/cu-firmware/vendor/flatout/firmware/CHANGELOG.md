# Changelog — firmware images

SHA-256 of the `.HMF` file. Full list in `manifest.json`. Images are built from source by `build.py`.

## v339-bot.5 — recommended

`4a0a514bcf72308ffde3a9aba2e0cbb54a61b5744b3de6047e136a85c0e02bbf`

- Bot state moved out of the slot structs to free RAM `0x0417-0x0424`, which crt0 now
  clears at reset (`.bss` clear loop extended). The full C reconstruction showed that
  slot bytes +2 (status: tank level, empty bit) and +3 (button press edge, rewritten every
  cycle) are firmware state: bot.3 and bot.4 overlapped them.
- Firmware watchdog: throttle 0 after ~1 s (13 rail cycles) without a throttle command.
- Module 308 bytes (of 312 free).

## v339-bot.4 — defective, never flash

`1657008f732b8bda2e3f1a6f2807b52e59a71b356c9151cf9f6f80768f7f56a4`

- Same module as bot.3, built with the pinned toolchain (avr-gcc 5.4.0) on the stock image
  rebuilt from the C. Defective like bot.3: bot state in firmware RAM (see bot.5).

## v339-bot.3 — defective, never flash

`0ee3eb1a6753dc45e4a09f58b56acca8d0e526c5cf44c9f1fbcca0976ca62c9d`

- Bot state moved to free bytes of the slot structs (`0x21C + 16·i + 2`, masks at
  `0x21F`/`0x22F`). Fixes bot.2.
- Built with avr-gcc 9.5.0. Defective: its state (throttle in slot byte +2, masks in slot 0/1
  byte +3) is firmware state, as the full reconstruction later showed (see bot.5).

## v339-bot.2 — defective, never flash

`35f452f432cd1ee2443c7103d4ec49a3c91cdd2ac8cab247a40b1bb06bec71e6`

- Bot state at `0x00E9-0x00F2` overlapped entry 0 of the firmware's event ring
  (`0x00E9-0x0118`): corrupted throttle sent to the cars, wrong `?` status frames.
  See [`bot/event-ring-incident.md`](bot/event-ring-incident.md).

## v339-bot.1 — defective, never flash

`2e21d0c8ebcd8c6b433dea05328bd9d94e253329b1a0fb6e3847f773efbf1a79`

- The hook wrote the throttle over the controller word's address bits: the bots'
  cars did not stop.

## v339-stock

`c1af1e5a3ea9a2d3590fdff94f49bb7409be63e66729813c9ff2043ecd2b608e`

- Stock V339, rebuilt from the C reconstruction (byte-identical), encoded with
  fixed-length lines; same payload as the vendor update file (`v339-stock-vendor`, `843ae3d8…`).

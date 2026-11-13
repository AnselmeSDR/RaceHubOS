# ⚠️ CRITICAL CORRECTION — 0x00E9 IS NOT FREE (before flashing!)

## Discovery (0x0EB8 agent + cross-check with the reconstructed f_01a6)
**0x00E9-0x0118 = the firmware's EVENT RING** (8 entries × 6 bytes):
- initialized by `f_01a6` (0x01A6): `for (i=0;i<48;i+=6) ring[i] = 8;` + ring
  read/write pointers `0x00DB/0x00DC` and `0x017E/0x017F` = 0x00E9
- WRITTEN by `f_0eb8` (0x0EB8, the "rails" task): entry {idx, tick(32b), chan-1} 6 B,
  wrap 0x0113→0x00E9
- READ by the `?` command (cmd_status 0x0374)

## The conflict
`bot_mode.c`: `BOT_GAZ(i) = *(volatile uint8_t *)(0x00E9 + i)` (i = 0..5)
→ **overlaps ring entry 0** (0xE9-0xEE)!
Consequences: (a) every rail pass (ring write) overwrites the throttle of addresses
0-5 → **the bots would send a random throttle to the cars**; (b) every bot write
corrupts ring entry 0 → the `?` statuses return garbage.

## Applied fix (image `0ee3eb1a…`)
Implemented in `bot_mode.c`: `BOT_GAZ(i)` = slot struct byte **[2]**
(`0x21C + 16·i + 2`), bot mask in slot 0 byte [3] (`0x21F`). The proposal below
(byte [7]) was the first candidate; [2] was retained. Old image `35f452f4…`
(state at `0x00E9`) is defective: never flash it.

## Fix (original proposal)
Move the BOT state into a REAL free zone. Clean candidate: **the free bytes of the
slot structs** (0x21C + 16·i, free: [2], [3], [7], [8], [11], [12], [13] = 7 per
slot!) — e.g. BOT_GAZ(i) = byte [7] of slot i (i=0..5), watchdog state in [2]/[3].
Rebuild the bot firmware via `python3 build_bot.py` (pipeline intact, new SHA/HMF to
re-document everywhere: reports, ETAT-DU-PROJET, app).
Alternatives: check a truly unused .bss zone (full RAM audit to redo with ALL the
reconstructions — doubt is not enough).

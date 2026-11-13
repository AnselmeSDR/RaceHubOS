# Firmware notes, CU hardware 5 — V339 (for step 2)

Analysis in progress, everything verified in the Ghidra export (`ghidra/export/V339v2/`).
Convention: `mem_xxxx` addresses = SRAM (real SRAM = mem - 0x60), bare
`0xXXXX` addresses = flash bytes.

## System map

- `reset` 0x00E4 → `FUN_code_1a8f` (main: init then loop) and `FUN_code_1b54` (short jump to the loop)
- **Scheduler**: `FUN_code_17c5` (0x2F8A) calls, per cycle:
  - `FUN_code_1527` (0x2A4E, 1414 B) — race logic, the biggest
  - `FUN_code_0d2e` (0x1A5C) → `FUN_code_0c79` (the `J`? to be confirmed), `FUN_code_0b94`
  - `FUN_code_0b16`, `FUN_code_0aae`, `FUN_code_0581`
- **Serial dispatcher**: `FUN_code_0354` (0x06A8) — state 6/7 of the RX machine:
  | letter | handler | note |
  |---|---|---|
  | `0` | `FUN_code_0101` | version = '5' + flash string 0x37FB ("339") + '$' |
  | `I` | `FUN_code_02a0` | ? |
  | `?` | `FUN_code_01ba` (460 B) | timing/laps |
  | `J` | `FUN_code_0146` | car programming (word 0-3/6/17/18) |
  | `T` | `FUN_code_019d` | button |
  | `:` | `FUN_code_0119` | exclusion |
  | `=` | `FUN_code_0125` | chrono reset |
  | `C` | `FUN_code_01a3` | ? |
  | `E` | (flag 0x00DA=1) | tied to the firmware update |
  | `G` | inline (0x00E7 = param, 0x0218=5) | firmware update |

## Rails transmission chain

1. **Controller sampling**: the potentiometers are read (ADC? to be confirmed where).
2. **`isr_TIMER1_CAPT`** (0x0BA2): period measurement on a rail edge (sync), keeps
   the measurement in 0x01A6/0x01A7/0x01A9, arms a counter 0x01A8=5.
3. **`isr_TIMER0_COMP`** (0x081A): state machine 0x018C (counter), toggles TCCR0
   (0x53), re-arms INT0/INT1 (GIFR 0x5A = 0x60, GICR 0x5B |= 0x60) — manages the
   reception window of the external pulses.
4. **`isr_TIMER1_COMPB`** (0x309A) = **TX shifter**:
   - current 16-bit register: `0x03D6:0x03D7` (right shift by 1 bit per interrupt)
   - at word end (counter 0x03DF == 0): reloads OCR1A/B (timing) and copies
     **the next 2 words from `0x01B0-0x01B3` to `0x0412-0x0415`**
   - ⇒ the main code prepares the words in `0x01B0..01B3`
5. `isr_INT0/1/2` (0x091C/0x0C08/0x09CC): rail edges (external pulse reception?
   timing) — to be detailed.

## Word injection queue (main lead for the patch)

`FUN_code_0afc` (0x15F8) = circular queue of 32 entries:
- 2-byte entries at `0x01BD + 2×idx`: `((word|address<<5) << 4) | value`
- repeat counters at `0x03E0 + idx`
- head pointer: `0x01BB`
- called by: the `J` (FUN_code_0146), `FUN_code_075c`, `FUN_code_1527`, `FUN_code_1925`

**Open question #1**: who drains this queue and how do the words end up in
`0x01B0-0x01B3` (the TX buffer)? This is the mechanism to reuse to inject the
bot's throttle.

**Open question #2**: where is the controller speed array (0-15) per
controller, fed by the pots? This is the other patch candidate (write the bot
slot's speed directly).

## Depth of analysis (pass 2, after Opus 5.5 review)

### Rails cycle: 10 words (not 16!)

The builder bounds the index: `cpi Zlo,0x0A` @0x301C. Word -> address mapping
(`mem_03dd = word>7 ? word-2 : word`, builder 17c5):

| word | role |
|---|---|
| 0-5 | controllers addr 0-5 (wired) |
| 6 | pace car / other — DO NOT TOUCH (hook) |
| 7 | programming word (the cars' EEPROM!) — DO NOT TOUCH |
| 8-9 | controllers addr 6-7 (Wireless+, the app advertises 8 racers) |

### The tables "per controller address" (1 byte per addr, addr 0-7)

| base | role | written by |
|---|---|---|
| 0x0180+adr | received bytes (RX) | pulse decoder FUN_code_0547 |
| 0x00DD+adr | processed (the composer 1527 @0x2A9A extracts `&0xF` = throttle) | transfer/cycle |
| 0x007B+adr | current TX throttle — the composer FUN_code_0d2e @0x1B76 reads `ld Z,+0`, then **composes the word with `~throttle`** (com R24) and pushes it DIRECTLY into the shifter (sts 0x03D6/03D7)! | 0d2e/cycle |

⇒ two distinct composers: 0d2e (controller throttle, word direct to the shifter) and
1527 (words with 0x21C+16i structure, loaded by the builder). Bytes
0x0075-0x007A (neighbors) = lighting/lights state tied to the addresses.

### Injection queues (TWO)

1. **0x01BD + 2×idx** (32 entries, head 0x01BB, repeats 0x03E0+idx) —
   filled by FUN_code_0afc (controller injection words, cf. J).
2. **0x0094 + 2×idx** (32 entries, head 0x00D5, flags 0x00D7/0x00D8,
   enable 0x019C) — filled by FUN_code_00a0 = display telegrams
   (called by 0637/075c/0b94/1925).

### SRAM map (0x60-0x45F, validated by outils/sram_map.py + manual review)

- 0x0060-0x006B: .data (copied from flash at reset)
- 0x0062+word: per-word state table (builder/composer)
- 0x0075-0x0082: TX zone per address (lights + current TX throttle)
- 0x008C-0x0093: controller/lights state (0b94, 0ad8)
- 0x0094-0x00D3: telegram queue (32×2)
- 0x00D4-0x00E8: flags/command (0x00D9 button T, 0x00DA flag E, 0x00DD+adr, 0x00E5 RX state…)
- **0x00E9-0x0118: FREE (48 B)** — our BOT state (BOT_GAZ 0x00E9+adr,
  BOT_MASK 0x00F1, LANE_PENDING 0x00F2) — below 0x0119, out of reach of the
  RX buffer overflow (present in the original: unbounded write from 0x011D;
  the firmware update requires it, we do not cap it)
- 0x0119-0x012E: commands + RX buffer (0x011D…)
- 0x0130-0x017C: free (unreferenced, unindexed)
- 0x0180-0x01B2: RX (0x0180+adr, 0x0188 dual-use RX state, 0x0189/0x018B/0x018D)
- 0x01BD-0x01FC: queue 1 (2×32); 0x01FD-0x01FF: pointers
- 0x020E-0x031B: word structures (0x21C+16×i, +6 bit count, +7/8 timing, +14/15 word)
- 0x03D6-0x03DF: TX shifter (+ bit counter 0x03DF)
- 0x03E0-0x03FF: queue 1 repeats
- 0x0400-0x0416: misc (0x040E-0x040F ADC, 0x0410/0x0411 thresholds, 0x0412-0x0415 TX timestamp)
- 0x0417-0x045F: stack zone (SP init 0x045F, ~73 B of margin — keep an eye on it)

### Corrections applied after review (C1-C5, M1-M3)

1. C1: real link (avr-gcc stubs.S + bot_mode.c, -Wl,--section-start=.text=0x36B8
   -Wl,--no-relax, no more .incbin/objcopy-on-.o); safeguards: empty .data/.bss
   required + hunt for unresolved branches (call 0x0 / br .+0) in the ELF.
2. C4: P3 = JMP (not call) -> STUB3 does not touch the stack.
3. C5: `out 0x0c` (UDR in I/O) instead of `out 0x2c` (TCNT1L!) — Ghidra memory
   notation ≠ I/O address.
4. C2: C addresses = direct DATA addresses (0x01BA, 0x011D/0x011E).
5. C3: stride 1 (sign extension, not ×2); bot throttle in a private BOT_GAZ
   (0x00E9+) -> immune to being overwritten by a physical controller (M3).
6. M1: match.py fails if a patch does not land on an instruction start.
7. M2: hook bounded to the 10 words, words 6/7 forbidden (pace/programming);
   remaining calibration (GAS_MASK/LANE_SHIFT) on the analyzer bench, WITHOUT a car.

Verifications: diff vs original = 20 bytes (hooks) + 296 B overlay;
`.data/.bss` empty; 0 unresolved branches; HMF round-trip OK; cuflash dry-run
OK (897 lines, version 5339).

## MAJOR STRUCTURES (discovered PA-7bis, Oct 2026)

### Main state machine @0x1C76 → end 0x2A4C (~3.7 KB — THE biggest function)
- Prologue: push r10-r17 + Y (10 registers saved = bulky state)
- State: `*(uint8_t*)0x0218`; **switch 0..32 (33 states)**;
  state >= 33 → DEFAULT @0x2A32: `*(0x0218) = 4` then return
- Jump table T1 = **0x54-0x95** (33 .word entries = word addresses of the case bodies)
  - dispatch: `movw Z,R25R24; subi Zlo,0xD6; sbci Zhi,0xFF; jmp 0x3640`
  - helper 0x3640: `add Zlo,Zlo; adc Zhi,Zhi; lpm r0,Z+; lpm Zhi,Z; mov Zlo,r0; ijmp`
    (= **__tablejump2__ of libgcc** — NOT cross-jumping! (corrected by the main agent): any dense switch compiles to it + .progmem.gcc_sw_table table)
- Case bodies: 0x1CA4..0x2948 (see the decoded table in journal.md)
- Called by `jmp 0x1c76` @0x2E3C (**= main loop**; loops over the state machine
  then returns)

### Word-cycle emitter @0x2A4E (right after the state machine)
- Identical prologue (push r10-r17 + Y)
- Reads `*(uint8_t*)0x01BA` (cycle index 0..9); if < 10:
  `r24 = table_0x62[idx]` else 0; **stores the value into 0x01BA**
  = `cycle_idx = table62[cycle_idx];` → **table 0x62 = the sequence
  0,4,1,5,2,8,3,6,7,9 confirmed in the code** (cycle advance)

### The 5 jump tables of the 0x54-0xE3 blob (solved by full raw scan)
Dispatches found (movw Z + subi/sbci + jmp 0x3640), all INSIDE the machine:
| table | base | cases | dispatch @ | role |
|---|---|---|---|---|
| T1 | 0x54 | 33 | 0x1CA0 | state switch 0x0218 (0..32) |
| T2 | 0x96 | 10 | 0x2168 | sub-switch (inside a machine case) |
| T3 | 0xAA | 9 | 0x21F0 | sub-switch |
| T4 | 0xBC | 10 | 0x23D0 | sub-switch |
| T5 | 0xD0 | 10 | 0x246A | sub-switch |
(33+10+9+10+10 = 72 entries = 144 bytes ✓)
- Readers of the cycle table (SRAM 0x62, 10 bytes, .data permutation):
  0x2A6C (emitter) AND **0x3022** (≈ a main-loop function, right before
  bot patch point #3 = 0x304A!)
- Main loop: `jmp 0x1C76` @0x2E3C (the loop = relaunches the state machine)

## ⚡ THE KEY TO MATCHING (major discovery, PA-7 final)

**The original firmware references NAMED GLOBALS (placed by the linker), not address
literals.** Consequence on the generated code:
- `char *buf = txbuf;` (txbuf = global) → `ldi r28, lo8(txbuf)` **relocated** (resolved
  to `cd e1 d1 e0` at link) instead of a direct constant `ldi`
- Accesses through this pointer ARE NOT folded (symbolic value unknown at compile time!)
  → `st Y`, `std Y+1`, `std Y+2`, `movw r24,r28` for the argument (2 bytes!)
  instead of `sts 0x011E` etc. (4 bytes) predicted by all compilers with literals
- `buf + 1` (arithmetic on a symbol) → always foldable → `ldi` pair WITH reloc (resolved
  to `8e e1 91 e0` = 0x011E) ✓
- Buffers must be **volatile** for I/O (repeated accesses = re-reads)

**Identified named buffers:**
| symbol (reconstructed name) | address | usage |
|---|---|---|
| txbuf | 0x011D | TX reply buffer (0x011D-0x0128 of the parser) |
| rx_ptr | 0x011A-0x011B | RX parser pointer (reset to txbuf after the reply) |
| table_dd | 0x00DD-0x00E2 | config table (target of cmd_C) |
| flag_17d | 0x017D | end-of-parse flag (0x3C by cmd_C) |
| id339 (progmem) | 0x37FB | "339\0" (version string) |

**Validated matching method (golden rule for ALL the rewriting):**
1. Declare the globals as `extern` (or in a .c) and leave the ADDRESSES to the linker
   (order/placement = via linker script / sections, like the original)
2. The comparator masks the relocated bytes → match "by construction" at link
3. Compiler: **GCC 4.7.0 → 4.8.1, -Os** (4.9.2 eliminated by cmd_C; 4.6.4 eliminated
   by TCO/mul; ≥5.x eliminated by cmd_C/folds; the exact patch level will be refined on the
   big functions — 5.4.0+Atmel3.6.0 also matches the current witnesses)

## 9-BIT WORD COMPOSER — FUN_code_03aa @0x0754 (decoded bit by bit)

**Signature:** `void comp(uint8_t id, uint8_t which)` (ABI args: r24 = id, r22 = which)

**Source structure (reconstructed):**
```c
if (var_1b5 || var_1b4)
    w = (flag_20f == 0) ? 1 : 0;      /* the TA bit */
else
    w = 0;
st = (uint8_t *)(0x021C + (id << 4)); /* slot struct (16 B) */
if (which) { a = st[4]; b = st[5]; }  /* second pair (which != 0) */
else       { a = st[0]; b = st[1]; }  /* main pair */
for (i=0;i<4;i++) { w = (w<<1) | (a&1); a >>= 1; }   /* 4 throttle bits */
w = (w<<1) | (b & 1);                                 /* SW bit */
t = id;
for (i=0;i<3;i++) { w = (w<<1) | (t&1); t >>= 1; }    /* 3 address bits */
st[6] = 9;
*(uint16_t *)(st + 14) = w;           /* word stored in st[14..15] */
```

**Word format (LSB first on the wire) — CONFIRMED byte by byte:**
| wire position | bits | meaning |
|---|---|---|
| 0-2 | R2 R1 R0 | car address (id & 7, R2 first!) |
| 3 | SW | button (0 = pressed) — source b&1 |
| 4-7 | G3 G2 G1 G0 | 4-bit throttle (MSB G3 first) — source a |
| 8 | TA | system flag (var_1b5/1b4 + flag_20f) |

⇒ Matches exactly the LR captures (start + R2R1R0 + SW + G3..G0 + TA)
⇒ `st[6] = 9` = constant written at each composition (bit count/relays?)
⇒ `st[14..15]` = the composed word, ready to be loaded into the shifter

## COMMAND DISPATCHER — FUN_code_0354 @0x06A8 (decoded, complete map)

**2-state machine on `rx_state` (0x00E5)** — called by the RXC ISR:

### State 6 (command LETTER phase)
| received | action | next |
|---|---|---|
| `?` | call 0x374 (cmd_status_timing) | state=2 + echo + UDRIE |
| `I` | call 0x540 (cmd_I) | state=2 + echo + UDRIE |
| `0` | call 0x202 (cmd_version) | state=2 + echo + UDRIE |
| other | (nothing) | echo + UDRIE only |

(echo = `UDR = rx_byte; UCSRB |= 0x20` = echo of the received character + restart of TX)

### State 7 (PARAMETERS phase)
```
var_e6 = 0;                      /* reset of the param counter */
switch (rx_byte) {
  'E': var_da = 1;               /* flag (reply already sent?) */
  '=': call 0x24A (bit parser)
  'C': call 0x346 (cmd_C)        /* config */
  ':': call 0x232 (cmd_exclusion)
  'J': call 0x28C (cmd_J_programmer)
  'T': call 0x33A (cmd_T button)
  'G': var_e7 = txbuf[0]-'0'; state_218 (0x0218) = 5;   /* FIRMWARE UPDATE */
}
if (rx_byte != 'E') UDR = '$';   /* ACK except for E */
rx_state = 0;
```
⇒ **The complete incoming protocol is now documented** (for RaceLab!):
letters `?`/`I`/`0` = queries, params `C`/`:`/`J`/`T`/`G` = config/actions.

## CMD_J (programming) — FUN_code_0146 @0x028C (decoded, 108/174 matching)

```c
uint8_t a = txbuf[1]*16 + (txbuf[0]-'0');   /* 2-char field (raw ×16!) */
uint8_t b = txbuf[2]-'0'; uint8_t c = txbuf[3]-'0';
f_15f8(a, b, c);                             /* sub-processing 0x15F8 */
if ((a&0x0F)==2 && !(a&0x10) && a<0xC0) {
    if (b < 2) b = 8;
    a >>= 5;                                 /* idx (the original MUTATES a!) */
    v = b * 0x07C4;                          /* 1988 ticks */
    table_190[a] = v;                        /* 16-bit table @0x190 */
    slot[a][9..10] = v;                      /* 0x21C+16·a+9 */
}
if ((a&0x0F)<4 && !(a&0x10) && a<0xC0) state_218 = 8;
if (a == 6) { if (b == 9) flag_213 = 1; }
else if (a == 0xF5) var_e8 = b;
```
Matching residue: order of the txbuf loads (target: txbuf[1] first) + r24:r25/Z alloc

## TIMER2 TICK — FUN_code_0637 @0x0C6E (564 B, MATCHED byte-exact at the pin)
The CU's heartbeat (tail-call of f_0ea2 at each TOV2, TCNT2+=6 ≈ 7.6 ms):

**CARS struct decoded (8 slots × 35 B @0x2BE):**
```c
struct car { int16_t pos;                    /* +0x00: position/tick */
             uint32_t t02, t06, t0a, t0e;    /* +0x02..+0x10: 4 32-bit timestamps */
             uint32_t b12, b16, b1a;         /* +0x12..+0x1C: 3 32-bit timestamps */
             uint8_t b1e, b1f, c20, c21, act; };  /* +0x1E..+0x22: flags */
```
+ aliases: t2c0 = cars[0].t02, f2dc = cars[0].b1e, t2e3 = cars[1].t0e??, f2ff = cars[1].b1f
**Role:** RX frame watchdog (0xE6), per-lane lap locking (capture flags 0x1A7/0x1AC →
snapshot of the 32-bit tick 0x1B0 into cars[i]), rail signalling (g19f=0x400 + f140(4,6)),
capture guard windows A (0x1A6, ICF1/PD6) and B (0x1AB, INTF1/PD3) with interrupt re-arm + clear.

## f140 (0x0140) — add/sighting @0x0094 (100/102 at the pin)
```c
extern volatile uint8_t v019c;      /* filters active? */
extern volatile uint8_t v_d5;       /* circular index (mod 32) */
extern volatile uint16_t v_d7d8;    /* 0x00D7: 16 bits — b*10/15 (period!) */
void f140(uint8_t a, uint8_t b) {
    if (v019c == 0) return;
    if (v_d7d8 != 0) {
        *(volatile uint8_t*)(((v_d5&0x1F)<<1)+0x94) = a;
        *((volatile uint8_t*)(((v_d5&0x1F)<<1)+0x94)+1) = b;
        v_d5 = v_d5 + 1;
    } else {
        v_d7d8 = (int)b * 10 / 15;   /* SIGNED div (__divmodhi4)! */
        set_timer2(a);
    }
}
```
Called by the tick (0xC6E): `f140(4,6)` = rail signalling.
Validated forms: single 16-bit var (test `or r24,r25; breq`), `<<1` (not ×2), +1 offset on the pointer.

## STATE MACHINE 0x1C76 (complete semantics — r2tmp/notes_E.md)
- 0/1: cold init then wait (PROG upload→8, buttons→8, launch→2/3)
- 2/3: start-light countdown (PORTA4/5, PORTC7/2, f_0afc(0xF4, 0x401, 2))
- 4/5: **DFU firmware UPDATE** (0xE7==0x12 → EEPROM[1]=0x55 + wdt_enable → reboot into the bootloader!)
- 6/7: light sequences T3/T4/T5 (table 1,2,3,5,6,7,9,11,13,15) + slot config
- 8/9: EEPROM save 20 B (0x190→@8) with checksum + chaser light (chenillard) f_0d16
- 11: free slot choice; 12-23: race cycle per slot; 24-32: grid/locks
- **__udivmodhi4 ABI: r24:r25 = REMAINDER, r22:r23 = QUOTIENT** (trap solved!)

## ⚠️ CORRECTION (2026-10) — 0x00E9-0x0118 = RING, NOT "FREE"
The zone 0xE9-0x118 (8×6 B) = **event ring** (init f_01a6: *p=8 ×8; written by
f_0eb8: {idx, tick32b, chan}; pointers 0xDB/0xDC + 0x17E/0x17F; read by cmd '?').
**The BOT patch writing BOT_GAZ at 0xE9+ = CONFLICT** → move the bot state (see
bot/event-ring-incident.md). The rest of the bot plan (overlay 0x36B8) = OK.

## "?" FRAME (cmd_status @0x0374) — FULL FORMAT DECODED (for RaceLab!)
Reply built in txbuf (0x011D) + checksum by envoyer_buffer + '$'.

### Case 1: NO rail event (ring[read][0] != 8) — the "event" reply
| pos | content |
|---|---|
| 0 | `(ring[0]+1) & 0xF` + '0' — event idx + 1 |
| 1-8 | 32-bit tick (ring[1..4]) as **8 hex digits, most significant first** |
| 9 | ring[5] + 0x31 — the **channel** (0→'1', 1→'2', ...) |
| 10 | 0 (checksum); 11: '$' |
Then: ring[0] = 8 (consumed), ring_rd += 6 (wrap 0x113→0xE9), rx_ptr = txbuf.

### Case 2: RACE step (ring[read][0] == 8) — the state frame
| pos | content |
|---|---|
| 0 | ':' (0x3A) |
| 1-6 | **slot[i].f11 + '0'** for i = 0..5 (the 6 cars!) |
| 7-8 | '0','0' |
| 9 | state 0x0218: if ≥24 → (state-0xE7) else '0' (hence '1'+state-24) |
| 10 | '0' +1 if 0x1B5 +2 if 0x1B4 +4 if 0x20F +8 if PINB.1 — **flags byte** |
| 11 | mask (slots 3..0).f12 + '0' (bit3 = slot3 … bit0 = slot0) |
| 12 | (slot[5].f12<<1 \| slot[4].f12) + '0' |
| 13 | 0x01A0 + '0' (number of cars?) |
| 14 | (0x0219 & 0xF) + '0' |
| 15 | (0x0219 >> 4) + '0' |
| 16 | 0 → replaced by the CHECKSUM by envoyer_buffer! |
| 17 | '$' |

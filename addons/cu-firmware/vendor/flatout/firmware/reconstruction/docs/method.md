# Method — byte-exact reconstruction of the V339 firmware

## Compiler (PINNED — final revision)
**avr-gcc 5.4.0+Atmel3.6.0** (`-Os`, `-mmcu=atmega16`) — Ubuntu 18.04 package
`gcc-avr 1:5.4.0+Atmel3.6.0-1build1`, pinned in [`../Dockerfile`](../Dockerfile).
(⚠️ An Atmel 3.6.1 build of 5.4.0 is different and breaks cmd_C.)
**Evidence for the pin**: the 7 ISRs (including isr_rxc, IMPOSSIBLE on 4.8.1 — IRA) + cmd_I/V/C
+ cmd_exclusion + main + exit + trk_init + envoyer_buffer = all byte-exact at 5.4.0+Atmel.
Eliminated: 4.8.1 (isr_rxc impossible), 4.9.2 (cmd_C), 4.7.x (unrolled the loops),
4.6.4- (no TCO/mul), 3.x/4.2 (r16/r17 allocation).
⚠️ **C FORMS ARE PIN-SPECIFIC**: e.g. cmd_C requires the TERNARY form
(`b = (src[1]=='1') ? 0x10 : 0x00`) at 5.4.0 (the if/else form matched at 4.8.1 only).
Always re-test at 5.4.0+Atmel.

## Symbolic method (THE key)
The firmware references **named globals** (txbuf @0x011D, rx_ptr @0x011A...).
In C: `extern char txbuf[];` → GCC emits a relocated `ldi lo8(txbuf)/hi8(txbuf)`, and
**the optimizers can no longer fold the accesses** → `st Y`, `std Y+n`, `movw` (the original!).
With `(char*)0x011D` literals, all compilers "fold" → ✗.

## Validated idioms (reuse everywhere)
- I/O buffers: **volatile** (re-read after calls, e.g. 0x024A re-reads txbuf[0])
- Pair stores: `*(uint16_t *)(p + n) = 0x3E20;` (0x20,0x3E = " >")
- Checksum: `somme(p, n)` (0x0B44) — raw sum; reply: low nibble + '0'
- Reply buffer: text + checksum + '$' (`while (p[1] != '$') sum += *p++;`)
- Terminal calls: `f();` as the last void statement → `jmp` (TCO ✓)
- Critical sections: avr-libc `cli()/sei()`, or in/ori/out pairs for |= / &= ~
- Bit tests: `if (var & mask)` → `sbrs/sbrc` (avr-gcc -Os)
- Pointer compared with an address: write it against the SYMBOL (`ev == &event_ring[42]`),
  not the number (`== 0x0113`). With a symbol the high byte is loaded first
  (`ldi r24,hi8; cpi r30,lo8; cpc r31,r24`); with a constant the compare insn emits
  `cpi; ldi; cpc` (cmd_status_send, 0x0374)
- Register assignment of long-lived values follows their live ranges: reading another variable that holds
  the same value late in the function (`p[30] = m & 3` instead of `acc & 3`) ends the first one's live
  range early and changes which call-saved registers IRA picks (rail_reply_rx_step, 0x324A)
- A loop storing zeros (`do *q++ = 0; while (--n)`) is turned into memset and unrolled when n is small;
  the original's `ldi; movw X,Z; st X+,r1; dec; brne` comes from `memset(p, 0, n)` itself (state machine)
- `(uint8_t)(i << 5)` lets GCC narrow the shift to 8 bits (swap/andi); the original's 16-bit shift loop
  needs `int i` and no cast (state machine, case 24)
- Scratch registers for `ldi` constants (shift counts, mul constants) are picked by peephole2, which
  ROTATES through the allocation order across the whole function (`search_ofs` in recog.c). A wrong
  `ldi r24` where the original has `ldi r27` usually means an EARLIER part of the function differs:
  fix functions/cases in layout order (state machine: fixing cases 1-3 fixed 12/13/15/18/19/31)
- A volatile tested several times (`if (v == 1) … else if (v == 2)`) is re-read each time; the original
  reading it once means a `switch (v)` or a local copy (`ev = v; if (ev == 6) … else if (ev == 2)`);
  the order of the tests tells which (switch sorts the cases, if/else keeps the source order)
- `switch ((uint8_t)i)` on an `int` loop index is folded back to a 16-bit switch (GCC knows the range);
  an 8-bit switch (`cpi r24` only, `brcs`) needs a genuine `uint8_t` counter (state machine, case 32)
- Repeated `PORT |= bit` statements across case pairs that the original shares are a fall-through cascade
  (`case 8: case 9: PORTC |= 0x08; /* fallthrough */ case 6: case 7: …`) (state machine, case 5)
- An empty `default: break;` in an inner switch changes which copy of a merged tail survives (crossjump);
  drop it when the original jumps into another branch's identical tail (state machine, case 7)
- The order of two loop-entry assignments (`i = 0` / `found = 0xFF`) follows the variables' declaration
  order: declare `found` before `i` to emit it after (state machine, case 11)
- The then/else layout of `x = (x == C) ? i : C`: the constant becomes a PHI argument whose copy block is
  placed by edge splitting at SSA exit. Writing `if (x != C) { x = C; __asm__ __volatile__(""); } else x = i;`
  keeps that arm a real block in the original position (state machine, case 11)
- Two values sharing a register pair (a mul input and its product): an empty asm reading both after the
  product (`__asm__ __volatile__("" : : "r"(w), "r"(m))`) keeps the input alive and moves it to another
  register (ctl_pulse_decode, 0x0A8E)
- score.py does not see the switch tables (separate section) nor operand order hidden in relocated bytes:
  always finish with a full link (code + tables at their addresses). It caught case 7's table (odd entries
  jump straight to the 'on' code: even steps blink, odd steps are steady) and a swapped compare in case 2
- A local pointer into a volatile table takes the Y pair and pushes other values out of r28/r29; indexing
  the table directly (`ctl_rx_table[i]`) gives the original allocation (word_cycle_step, 0x2A4E)
- `edge = (prev != 0)` is turned by phiopt into a hoisted bool (`ldi r24,1` before the test); a goto to the
  join plus an empty asm in the shared `edge = 0` block keeps two constant blocks (word_cycle_step)
- `v--; if (v == 0)` re-reads a volatile; `if (--v == 0)` does not (word_cycle_step)
- Declaration order also sets the order of PHI copies on an edge and of loop-init `ldi`s (word_cycle_step)
- A function marked matched by score.py alone can still be wrong: relocated bytes (addresses in ldi,
  calls, switch-table bases) are masked. build_image.py links every function against the shared symbol
  map and compares the whole image — it is the reference check (it caught cmd_ctl_table_set, 0x0346)
- `__builtin_expect` does not reorder blocks at -Os, but it does choose a branch's polarity: `expect(c, 0)`
  gave the original's `and; breq` where no hint gave `cpse; rjmp` (rail_events_process, 0x0EB8)
- An empty asm pin can also fix the order of two pointer initialisations: `__asm__ __volatile__("" :
  "+z"(src))` right after `src = …` loads Z before X (cmd_ctl_table_set, 0x0346)

## Pipeline
```bash
# write the function in src/<file>.c (symbolic externs)
docker run --rm -v "$PWD/firmware:/fw" avr-gcc-5.4 sh -c '
  avr-gcc -mmcu=atmega16 -Os -c src/<file>.c -o /tmp/f.o &&
  avr-objdump -dzr -m avr:5 /tmp/f.o > /tmp/dump.txt &&
  python3 score.py /tmp/dump.txt <symbol>=<addr>:<size>'
```
The scorer masks the bytes with a relocation (R_AVR*): they will be resolved at link
once the symbols are placed at the right addresses (via linker script / sections —
the declaration order of the globals determines the .data/.bss layout).
`-z` is needed when the function holds runs of zero words (`nop`s): without it objdump
prints "..." and the scorer sees fewer bytes (lire_boutons: 76 instead of 140).
The masked bytes include every conditional branch / rjmp, so a `.o` MATCH can still be
wrong at link (opposite branch polarity, block layout): confirm with
`python3 linkcheck.py <src> <sym> <addr> <size> [ram:name=0xADDR ...]` (README).
When one file holds several identical variants of a function, compile with
`-fno-ipa-icf`: identical bodies are folded into a `jmp` to the first one (4 bytes).

## Architecture (firmware map)
- 0x0000-0x0122: crt0 + tables (5 GCC jump tables: 33+10+9+10+10 cases)
- 0x01A6, 0x01CE, 0x01EA, 0x0202...0x0B5C: command parser + helpers
- 0x0C6E+: ISRs and controller logic
- **0x1C76: state machine (33 states, `0x0218`)** — heart of the CU
- **0x2A4E: word-cycle emitter** (SRAM cycle table 0x62)
- 0x2E3C: main loop (`jmp 0x1C76`)
- 0x3640: switch dispatch helper (`__tablejump2__`, see the journal); 0x364C: strcpy_P

## ISR idioms (validated by the ISR batch — see ETAPES discovery 12)
- POSITIVE `if (flag) {process} else {flag=1;}` — the inverted form breaks the layout
- ranges: `c != '#' && c != '$'` (adjacent) → subi/cpi 2/brcs
- `x == y && y != 0` → cpse + and/breq
- `(uint8_t)(a + k - b) >> 4` → add/sub/swap/andi
- volatile order: snapshot first, writes after
- `&= ~bit`: cbi (< 0x20) / in-andi-out (≥ 0x20)
- `extern volatile uint8_t *p;` → lds Z + ld + relds/adiw/sts
- ISR(): `__attribute__((signal, used, externally_visible))` (avr-libc 1.8.0 expansion)

## What decides the order of the code at -Os (observed at the pin, rank/ADC/sum session)
- **No scheduler**: `-fschedule-insns(2)` are off at -Os (no sched dump exists). "Scheduler
  micro-ordering" residues are really the order fixed at expand + a few RTL passes.
- **Expand order**: the statements of a block come first, the PHI copies of the successor
  (`i = 0`, `sum = 0`) come LAST in the pre-header. Expressions hoisted by the RTL
  loop-invariant pass land after them (`sum = 0` is emitted before the loop bound
  `p + n` when that bound is written in the loop condition: `for (q = p; q < p + n; q++)`).
- **TER** (temporary expression replacement): an SSA name with ONE use in the same block is
  expanded at its use. So `x = p[3]` is delayed to the add that uses it, and a zero-extend
  used once is delayed to the store. A name with TWO uses stays where it is written:
  that is how the firmware's early `ldi r31,0` / early loads arise.
- **Loop layout** (bb-reorder, software trace cache): a loop whose test is reached through
  a second pointer (`for (u = cars, j = 0; j != n; j++, u++)`) gets rotated (test at the
  bottom, entered by an rjmp, +2 bytes); the indexed form `for (j = 0; j != n; j++) {
  u = &cars[j]; ... }` keeps the test on top like the firmware.
- **Branch polarity** at link follows the block layout: five separate `t->rank--` leaves
  give the opposite brcc/brcs polarity from the firmware; one `rank--` reached from a
  single `||` / `?:` expression gives the right one (rank_compute_a). Which of the two
  is right is per function (rank_compute_b wants one `rank--` per leaf): try both.
- **ivopts** picks the pointer IV of `for (i..) sum += q[i]` by cost: with `q = p + 4`
  an expression visible to the loop it keeps the counter `i` as a second IV (what the
  firmware has); if `q` is a name defined inside a previous loop it drops `i` (pointer
  difference, +2 bytes). So write the sum loop on the expression (`p[4 + i]`).
- **`x = p + 4` first, `i = 0` second** (f18f2): to get the firmware's order (`mov r15,r1`
  BEFORE the `movw/subi/sbci` of q) q must be computed INSIDE the loop (RTL loop-invariant
  motion then hoists it after the PHI copy, and code hoisting merges it with the `p + 4` of
  the next loop: `movw r30,r16`). A single use `q[i]` is folded into `p + (i + 4)` and the
  hoisted value disappears; the second use that keeps it is an empty asm barrier
  `__asm__ __volatile__("" : : "r"(q));` (no instruction emitted; precedent: buttons_scan).

## Idioms validated in the rank/ADC/sum session (5.4.0+Atmel3.6.0)
| function | form |
|---|---|
| sum_bytes (0xB44) | `for (uint8_t *q = p; q < p + n; q++) sum += *q;` (separate pointer, bound in the condition) |
| beep_queue_push (0x140) | one 16-bit `beep_ticks_left`; 2nd store re-computes its base pointer (`q = queue + ((wr & 0x1F) << 1); q[1] = b;`) to get `std Z+1`; `(b * 10) / 15` signed -> `mul` + `__divmodhi4` |
| idle_timeout_service (0x15B0) | debounce `do { if (buttons_scan()) n = 0xFF; } while (n--);` -> `ldi 0xFF / mov / add / cpse` |
| lire_boutons (0x144C) | `b = 0; if (!(PINC & 0x10)) b = 5;` (NOT if/else); asm barrier on `f` still needed |
| adc_sample_channels (0x162C) | `*(uint16_t *)(0x0402 + i + i) = ADC;` (the array / `i*2` forms fold into a widening mul and delay the zero-extend) |
| rank_compute_a/b (0x12AE/0x1344) | indexed inner loop `u = &cars[j]`; leaves: one `||`/`?:` expression + one `rank--` (a), one `rank--` per leaf (b) |
| update_frame_decode (0x18F2) | `uint16_t t = *(uint16_t *)(p + 2);` then `(uint8_t)t + (uint8_t)(t >> 8)` (the 16-bit field is loaded as ONE ld pair before the adds); loop 1 `{ q = p + 4; asm barrier on q; q[i] = ...; }`, sum loop on `p[4 + i]` (see above) |

## Table of validated FORMS at the pin (5.4.0+Atmel3.6.0)
| function | exact C form (pin-specific!) |
|---|---|
| cmd_C (0x346) | `uint8_t b = (src[1] == '1') ? 0x10 : 0x00;` (TERNARY — the if/else only matches on 4.8.1!) |
| 0x01A6 | `for (i = 0; i < 48; i += 6) slots[i] = 8;` (INDEX — the pointer form = ✗ at the pin) |
| envoyer_buffer (0x1EA) | `for (;;) { if (p[1] == '$') break; sum += *p++; }` (or separate body) |
| dispatcher (0x6A8) | switch(rx_state) + case 6/7; inner switch with `default: goto reply;`; case order = `= E J T C` then `:` `G` |
| composer (0x754) | `w = (!(a || b) || flag) ? 0 : 1;` (NEGATION!) + pointer `SLOTS+(id<<4)` duplicated in both branches AND at the end; `extern volatile` on flag_20f |
| ISR rxc (0x566) | nested switch in 10 separate clauses, `case '0'` then `case ':'` at the head (cross-jumping anchor) |

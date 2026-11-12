# reconstruction — V339 in C

The V339 firmware rewritten in C, function by function, until each one compiles
to **exactly the original bytes** with the compiler of the era (matching
compilation). Research work: the bot image does not depend on it
([`../build.py`](../build.py) patches the stock image).

**Status**: complete. All 53 functions of the firmware are byte-exact; the image rebuilt from
the C is identical to the stock image (`build_image.py`, checked in CI), with 94% of its
application bytes coming from the C. The rest is the interrupt vectors, the C runtime start-up,
the avr-libc/libgcc routines (the 8 crt/libc/libgcc rows of `functions.tsv`), the version string
and the free flash.

```
reconstruction/
├── src/            one file per area of the firmware (map below)
├── functions.tsv   every function: address, size, status, source file and symbol
├── build_image.py  rebuilds the image from the C and compares it with the stock image
├── symbols.txt     shared symbol map (RAM and code addresses)
├── score.py        compares one compiled function with the stock image (relocations masked)
├── linkcheck.py    links one function at its address and compares all its bytes
├── Dockerfile      the pinned compiler
└── docs/
    ├── method.md         the matching method and the table of C forms
    ├── journal.md        research journal (20 discoveries)
    ├── firmware-notes.md firmware map: ISRs, commands, RAM, frames
    └── glossary.md       proposed readable names for functions and globals
```

## Pinned compiler

avr-gcc **5.4.0 + Atmel patches 3.6.0**, `-Os -mmcu=atmega16`. C forms are
compiler-specific: always score with this one.

```bash
docker build -t avr-gcc-5.4 firmware      # or let firmware/build.py do it
```

## Rebuild the image from the C

```bash
python3 firmware/build.py        # builds v339-stock from this C (and the bot image), checks the SHA-256
docker run --rm -v "$PWD/firmware:/fw" avr-gcc-5.4 sh -c 'cd /fw/reconstruction && python3 build_image.py'
# from the C functions : 13662 bytes, crt / libraries / data.c : 362 bytes
# IDENTICAL: the image is rebuilt from source
```

The image is assembled from source only: every MATCHED function of `functions.tsv` (columns
`file`, `symbol`) linked at its address, with the symbols it references at theirs (the
`/* 0xADDR */` comments of each file, then `symbols.txt`); the state machine's switch tables at
0x54; the interrupt vectors and C start-up from the toolchain's crt; the libgcc/avr-libc routines
at 0x35F0; `src/data.c` (initialised data, version string); `0xFF` elsewhere. Its SHA-256 must be
the stock one; it is then written to `firmware/build/v339-stock.bin`, the reference `score.py`,
`linkcheck.py` and `build_image.py --overlay` compare against. `--discover` fills the
`file`/`symbol` columns for new MATCHED rows. CI runs `firmware/build.py --check` on every push.

## Score a function

`score.py <objdump> <symbol>=<addr>:<size>` — `addr` is the byte address in the
flash and `size` the length, both from `functions.tsv`. Bytes carrying a
relocation are masked (they are resolved at link).

```bash
docker run --rm -v "$PWD/firmware:/fw" avr-gcc-5.4 sh -c 'cd /fw/reconstruction &&
  avr-gcc -mmcu=atmega16 -Os -c src/event_ring_reset.c -o /tmp/f.o &&
  avr-objdump -dzr -m avr:5 /tmp/f.o > /tmp/dump.txt &&
  python3 score.py /tmp/dump.txt f01a6_i=0x01a6:40'
# f01a6_i   0x01a6 size= 40/40  ✅ MATCH
```

Use `-dzr` (with `-z`): without it objdump elides runs of zero words ("...") and
`score.py` loses the bytes of a function that contains `nop` runs (lire_boutons).

A function counts as done when it matches at link (sections placed at the
firmware addresses), not only in `score.py`: branches and signedness show up
there (the scorer masks every relocated byte, branches included). `linkcheck.py`
links one function at its address, with the externs it uses at their real
addresses, and compares all the bytes:

```bash
docker run --rm -v "$PWD/firmware:/fw" avr-gcc-5.4 \
  python3 linkcheck.py src/rank_tracker.c rank_compute_a 0x12ae 150 ram:cars=0x2be
# LINK rank_compute_a @0x12ae: built 150 B (target 150 B), identical bytes 150/150  ✅ MATCH
```

Status per function: `functions.tsv`.

## Contribute

The reconstruction is complete; what is left is making it readable and checking it on hardware:

1. **Readable names** — many functions and globals still carry their address-based names
   (`f162c`, `unk_217`…). `docs/glossary.md` proposes names; a rename must keep
   `build_image.py` identical (names do not change the bytes, but check it).
2. **Semantics** — comments explaining what each state, frame and field means, and corrections
   to `docs/firmware-notes.md`. Some behaviours found here still need a real CU to confirm
   (e.g. the leader-lap injection when PINB.1 is clear, in `rails_emitter.c`).
3. **Keep it green** — any change to `src/` must leave `build_image.py` on IDENTICAL (CI runs it).

Some files keep several variants of a function (`_v1`, `_v2`…): they record which C forms match
and which do not; `functions.tsv` names the one used in the image.

## File map

| File | Content |
|---|---|
| `main_exit.c` | `main` (210 B) + `exit` |
| `setup.c` | buzzer timer mode (0x0122), serial port init (0x01CE) |
| `timer2_tick.c` | Timer2 tick (0x0C6E): 32-bit clock, lap locks, cars[] |
| `main_loop.c` | rail cycle service, TX shift ISR, slots init, TX init, reply receiver (0x324A) |
| `word_cycle.c` | word-cycle emitter (0x2A4E): the 10-word rail cycle, fuel, inject queue |
| `state_machine.c` | the state machine (0x1C76, 33 states, 3.5 KB) |
| `rails_emitter.c` | rail events (0x0EB8): event ring, positions/starts to the tower |
| `parser_base.c` | cmd_T, Timer2 overflow poll, capture arming |
| `parser_settings.c` | bit params, Timer0 window start, PROG frame defaults |
| `cmd_i_version_exclusion.c` | cmd_I / version / exclusion |
| `cmd_ctl_table.c` | cmd_C (0x0346): controller table from the serial frame |
| `cmd_prog_car.c` | cmd_J (programming) |
| `cmd_status_frame.c` | the `?` status frame (0x0374) |
| `cmd_dispatcher_word_composer.c` | command dispatcher (0x06A8) + 9-bit word composer (0x0754) |
| `isr_batch1.c`, `isr_batch2.c` | ISRs: serial TX/RX, captures, INT0/1/2, Timer0 |
| `batch_15xx_1axx.c` | ADC, inject queue, timers, hex parse, update stream, lights chase |
| `rank_tracker.c` | car table reset, buttons scan, rank a/b |
| `controllers_misc.c` | beep queue, reply checksum, sum, controller pulse decoder (0x0A8E) |
| `event_ring_reset.c` | event ring reset (0x01A6) |
| `*_forms.c`, `cmd_c_forms.c` | variants kept as a record of the C forms tried |

Stock pieces need no source: crt0, vectors, `exit`, switch tables (regenerated by
the linker), avr-libc 1.6.8 (`strcpy_P`, eeprom helpers) and libgcc
(`__divmodhi4`, `__udivmodhi4`, `__tablejump2__`).

"""linkcheck.py — link-level check of ONE reconstructed function against the stock image.

score.py masks every byte that carries a relocation, which hides the branch and call
encodings (brne vs breq, the sense of a conditional jump, call targets). This script
links the function at its real address, with the externs it references defined at their
real addresses, and compares ALL the bytes. A function is only "MATCHED ✓ link" when this
prints MATCH (see README: "A function counts as done when it matches at link").

Run it inside the pinned container (python 3.6, avr-gcc, binutils), from reconstruction/:

  docker run --rm -v "$PWD/firmware:/fw" avr-gcc-5.4 \\
      python3 linkcheck.py src/rank_tracker.c rank_compute_a 0x12ae 150 ram:cars=0x2be

usage: linkcheck.py <src.c> <symbol> <addr> <size> [name=0xADDR | ram:name=0xADDR ...]
  name=0xADDR      code symbol (function in the flash, byte address), e.g. buttons_scan=0x144c.
                   If the file itself defines `name`, that copy is placed at ADDR (so a call
                   from <symbol> is encoded exactly as in the firmware); otherwise it is an
                   absolute symbol (libgcc/libc routines, functions of other files).
  ram:name=0xADDR  data symbol: SRAM address as in the firmware (the 0x800000 data-space
                   offset of the AVR ELF is added here), e.g. ram:cars=0x2be
Env CFLAGS_EXTRA adds compiler flags (e.g. -fno-ipa-icf when a file holds identical variants).
Each function is built in its own section (-ffunction-sections, no relaxation).
"""
import os
import subprocess
import sys
import tempfile
from pathlib import Path

REF = Path(__file__).resolve().parent.parent / "build" / "v339-stock.bin"  # built by firmware/build.py
if not REF.is_file():
    sys.exit("linkcheck.py: %s not found — run `python3 firmware/build.py` first: it builds the reference image from source" % REF)
FW = REF.read_bytes()


def run(cmd):
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True)
    if p.returncode:
        lines = p.stdout.splitlines()
        more = "\n... (%d more lines: define the missing symbols on the command line)" % (len(lines) - 12) \
            if len(lines) > 12 else ""
        sys.exit("command failed: %s\n%s%s" % (" ".join(cmd), "\n".join(lines[:12]), more))
    return p.stdout


def main():
    if len(sys.argv) < 5:
        sys.exit(__doc__)
    src, sym, addr, size = sys.argv[1], sys.argv[2], int(sys.argv[3], 0), int(sys.argv[4], 0)
    code, ram = {}, {}
    for spec in sys.argv[5:]:
        if spec.startswith("ram:"):
            name, _, val = spec[4:].partition("=")
            ram[name] = int(val, 0) + 0x800000
        else:
            name, _, val = spec.partition("=")
            code[name] = int(val, 0)
    with tempfile.TemporaryDirectory() as d:
        obj, elf, out, ld = d + "/f.o", d + "/f.elf", d + "/f.bin", d + "/f.ld"
        run(["avr-gcc", "-mmcu=atmega16", "-Os", "-ffunction-sections"]
            + os.environ.get("CFLAGS_EXTRA", "").split() + ["-c", src, "-o", obj])
        defined = set(l.split()[2] for l in run(["avr-nm", obj]).splitlines()
                      if len(l.split()) == 3 and l.split()[1] in "Tt")
        placed = dict((n, a) for n, a in code.items() if n in defined)
        placed[sym] = addr
        script = "SECTIONS {\n"
        for n, a in placed.items():
            script += "  .text.%s 0x%x : { *(.text.%s) }\n" % (n, a, n)
        script += "}\n"
        Path(ld).write_text(script)
        defsyms = []
        for n, a in code.items():
            if n not in placed:
                defsyms += ["--defsym", "%s=0x%x" % (n, a)]
        for n, a in ram.items():
            defsyms += ["--defsym", "%s=0x%x" % (n, a)]
        run(["avr-ld", "-m", "avr5", "--gc-sections", "-T", ld, "-e", sym] + defsyms + ["-o", elf, obj])
        run(["avr-objcopy", "-O", "binary", "-j", ".text." + sym, elf, out])
        built = Path(out).read_bytes()
    target = FW[addr:addr + size]
    n = min(len(built), size)
    ident = sum(1 for i in range(n) if built[i] == target[i])
    ok = len(built) == size and ident == size
    print("LINK %s @0x%04x: built %d B (target %d B), identical bytes %d/%d  %s"
          % (sym, addr, len(built), size, ident, size, "✅ MATCH" if ok else "✗ DIFF"))
    if not ok:
        print("   target:", " ".join("%02x" % x for x in target))
        print("   built :", " ".join("%02x" % x for x in built[:size]))


main()

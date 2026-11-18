#!/usr/bin/env python3
"""build_image.py — build the V339 image from the C reconstruction and the toolchain alone.

Normally run through `python3 firmware/build.py` (pinned toolchain, Docker when needed). Directly:

    docker run --rm -v "$PWD/firmware:/fw" avr-gcc-5.4 sh -c 'cd reconstruction && python3 build_image.py'
    ... python3 build_image.py --overlay   # diagnostic: each function overlaid on the reference image
    ... python3 build_image.py --discover  # fill the file/symbol columns of new MATCHED rows

The image is assembled from: every MATCHED function of functions.tsv (columns `file`, `symbol`),
compiled -Os with one section per function and linked at its firmware address, with the symbols it
references at THEIR addresses (the `/* 0xADDR */` comments of each file, then symbols.txt); the
state machine's switch tables at 0x54; the interrupt vectors and C start-up from the toolchain's
crt; the libgcc/avr-libc routines at 0x35F0; src/data.c (initialised data, version string); 0xFF
elsewhere. No byte is taken from an existing image. The SHA-256 must be the stock one
(STOCK_SHA256); the image is then written to firmware/build/v339-stock.bin, the reference that
score.py, linkcheck.py and --overlay compare against.
"""
import csv
import hashlib
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / "src"
TSV = HERE / "functions.tsv"
STOCK_PATH = HERE.parent / "build" / "v339-stock.bin"   # reference, written only when it verifies
STOCK = STOCK_PATH.read_bytes() if STOCK_PATH.exists() else None
APP_END = 0x3800                      # the bootloader (0x3800+) is not part of the application
CFLAGS = ["-mmcu=atmega16", "-Os", "-ffunction-sections", "-fno-ipa-icf"]
SWITCH_TABLES = 0x0054                # .progmem.gcc_sw_table of the state machine
LIBGCC = {"__udivmodhi4": 0x35F0, "__divmodhi4": 0x3618, "__tablejump2__": 0x3640, "strcpy_P": 0x364C}
STOCK_SHA256 = "a50857e53adaac48f27992e3998a64a5ea10315d837807ba267c618f98cdf611"   # v339-stock (firmware/manifest.json)
IMAGE_SIZE = 0x4000
# interrupt vector -> handler (functions.tsv symbols); the others go to __bad_interrupt
VECTORS = {1: "ctl_pulse0_isr", 2: "lapsense_b_isr", 5: "lapsense_a_isr", 7: "rail_tx_shift_isr",
           11: "serial_rx_isr", 12: "serial_tx_isr", 18: "ctl_pulse2_isr", 19: "ctl_pulse_window_isr"}
# toolchain library routines, in the original order from 0x35F0 (libgcc, avr-libc 2.0.0 = 1.6.8 bytes)
LIBRARY_ORDER = [("libgcc", "_udivmodhi4.o"), ("libgcc", "_divmodhi4.o"), ("libgcc", "_tablejump2.o"),
                 ("libc", "strcpy_P.o"), ("libdev", "eerd_block.o"), ("libdev", "eewr_block.o"),
                 ("libdev", "eewr_byte.o")]
LIBRARY_START = 0x35F0
DATA_RAM, DATA_LOAD, BSS_END, STACK = 0x0060, 0x36AC, 0x0417, 0x045F
VERSION_ADDR = 0x37F0
DECL = re.compile(r"^\s*(?:extern\s+)?[A-Za-z_][\w\s\*]*?\b([A-Za-z_]\w*)\s*(\(|\[|;|,)[^\n]*?/\*\s*0x([0-9A-Fa-f]{3,4})\b")


def run(cmd):
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True)
    if p.returncode:
        raise RuntimeError("%s\n%s" % (" ".join(cmd), p.stdout[-2000:]))
    return p.stdout


def file_symbols(f):
    """name -> (address, is_code) from one file's declaration comments."""
    out = {}
    for line in f.read_text().splitlines():
        m = DECL.match(line)
        if m and not line.lstrip().startswith(("/*", "*", "//")):
            out.setdefault(m.group(1), (int(m.group(3), 16), m.group(2) == "("))
    return out


def shared_symbols():
    """symbols.txt: name address [code|ram]."""
    out = {}
    for line in (HERE / "symbols.txt").read_text().splitlines():
        p = line.split("#")[0].split()
        if len(p) >= 2:
            out[p[0]] = (int(p[1], 16), len(p) > 2 and p[2] == "code")
    return out


def symbol_maps(rows):
    """Per source file: its own comments, then symbols.txt, then functions.tsv, then libgcc."""
    base = {name: (addr, True) for name, addr in LIBGCC.items()}
    base.update({r["symbol"]: (int(r["addr_byte"], 16), True) for r in rows if r.get("symbol")})
    base.update(shared_symbols())
    maps = {}
    for f in sorted(SRC.glob("*.c")):
        m = dict(base)
        m.update(file_symbols(f))
        maps[f.name] = m
    return maps


class Objects:
    """One compiled object per source file, with its defined function sections and sizes."""

    def __init__(self, tmp):
        self.tmp, self.cache = tmp, {}

    def get(self, name):
        if name not in self.cache:
            obj = os.path.join(self.tmp, name + ".o")
            run(["avr-gcc"] + CFLAGS + ["-c", str(SRC / name), "-o", obj])
            funcs = {}                      # symbol -> (section, size)
            for line in run(["avr-objdump", "-t", obj]).splitlines():
                m = re.match(r"^[0-9a-f]+ [lg]\s+F (\S+)\s+([0-9a-f]+) (\S+)$", line)
                if m:
                    funcs[m.group(3)] = (m.group(1), int(m.group(2), 16))
            self.cache[name] = (obj, funcs)
        return self.cache[name]


def link_function(objs, maps, src, sym, addr):
    """Link `sym` from `src` at `addr`; return {address: bytes} of what it places (code, and tables)."""
    obj, funcs = objs.get(src)
    smap = maps[src]
    section = funcs[sym][0]
    refs = set()
    for line in run(["avr-objdump", "-r", "-j", section, obj]).splitlines():
        m = re.match(r"^[0-9a-f]+\s+R_AVR_\w+\s+([^\s+]+)", line)
        if m:
            refs.add(m.group(1))
    script = ["SECTIONS {", "  .f 0x%x : { *(%s) }" % (addr, section)]
    tables = sorted(r for r in refs if r.startswith(".progmem.gcc_sw_table"))
    if tables:
        script.append("  .sw 0x%x : { %s }" % (SWITCH_TABLES, " ".join("*(%s)" % t for t in tables)))
    by_section = {sec: name for name, (sec, _) in funcs.items()}

    def section_refs(sec):
        out = set()
        for line in run(["avr-objdump", "-r", "-j", sec, obj]).splitlines():
            m = re.match(r"^[0-9a-f]+\s+R_AVR_\w+\s+([^\s+]+)", line)
            if m:
                out.add(by_section.get(m.group(1), m.group(1)))
        return out

    missing, placed, todo = [], {sym}, [sym]
    while todo:                               # same-file callees, transitively, at their own address
        for c in sorted(section_refs(funcs[todo.pop()][0])):
            if c in funcs and c not in placed:
                placed.add(c)
                if c not in smap:
                    missing.append(c)
                    continue
                script.append("  .c_%s 0x%x : { *(%s) }" % (c, smap[c][0], funcs[c][0]))
                todo.append(c)
    defsyms = []                              # every undefined symbol of the object we know about
    for name in run(["avr-nm", "-u", obj]).split():
        if name == "U":
            continue
        if name in smap:
            a, is_code = smap[name]
            defsyms += ["--defsym", "%s=0x%x" % (name, a if is_code else a + 0x800000)]
        elif name in refs:
            missing.append(name)
    if missing:
        raise RuntimeError("%s: no address for %s (add a /* 0xADDR */ comment or a symbols.txt entry)" % (sym, sorted(set(missing))))
    script.append("}")
    ld, elf = os.path.join(objs.tmp, "f.ld"), os.path.join(objs.tmp, "f.elf")
    Path(ld).write_text("\n".join(script) + "\n")
    run(["avr-ld", "-m", "avr5", "--gc-sections", "-T", ld, "-e", sym] + defsyms + ["-o", elf, obj])
    out = {}
    for sec, base in ((".f", addr), (".sw", SWITCH_TABLES)):
        if sec == ".sw" and not tables:
            continue
        b = os.path.join(objs.tmp, "f.bin")
        run(["avr-objcopy", "-O", "binary", "-j", sec, elf, b])
        out[base] = Path(b).read_bytes()
    return out


def toolchain():
    q = lambda arg: run(["avr-gcc", "-mmcu=atmega16", arg]).strip()
    return {"crt": q("-print-file-name=crtatmega16.o"), "libgcc": q("-print-libgcc-file-name"),
            "libc": q("-print-file-name=libc.a"), "libdev": q("-print-file-name=libatmega16.a")}


def extract(elf, tmp, *sections):
    out = {}
    for sec in sections:
        b = os.path.join(tmp, "x.bin")
        run(["avr-objcopy", "-O", "binary", "-j", sec, elf, b])
        out[sec] = Path(b).read_bytes()
    return out


def section_addr(elf, sec):
    for line in run(["avr-objdump", "-h", elf]).splitlines():
        p = line.split()
        if len(p) > 4 and p[1] == sec:
            return int(p[3], 16), int(p[4], 16)          # VMA, LMA
    raise RuntimeError("no section %s in %s" % (sec, elf))


def build_startup(tmp, tc, handlers):
    """Interrupt vectors (0x0000) and C start-up (0xE4): avr-libc crt + libgcc copy/clear loops."""
    ld = os.path.join(tmp, "crt.ld")
    Path(ld).write_text("SECTIONS {\n  .vectors 0x0 : { KEEP(*(.vectors)) }\n"
                        "  .init 0xE4 : { KEEP(*(.init0)) KEEP(*(.init1)) KEEP(*(.init2)) KEEP(*(.init3))\n"
                        "    KEEP(*(.init4)) KEEP(*(.init5)) KEEP(*(.init6)) KEEP(*(.init7)) KEEP(*(.init8))\n"
                        "    KEEP(*(.init9)) *(.text) }\n  /DISCARD/ : { *(.fini*) *(.data*) *(.bss*) }\n}\n")
    syms = {"main": handlers["main"], "exit": handlers["exit"], "__data_load_start": DATA_LOAD,
            "__data_start": 0x800000 + DATA_RAM, "__data_end": 0x800000 + DATA_RAM + 12,
            "__bss_start": 0x800000 + DATA_RAM + 12, "__bss_end": 0x800000 + BSS_END, "__stack": 0x800000 + STACK}
    syms.update({"__vector_%d" % n: a for n, a in handlers["vectors"].items()})
    defs = sum((["--defsym", "%s=0x%x" % kv] for kv in syms.items()), [])
    elf = os.path.join(tmp, "crt.elf")
    run(["avr-ld", "-m", "avr5", "-T", ld, "-u", "__do_copy_data", "-u", "__do_clear_bss"] + defs
        + ["-o", elf, tc["crt"], tc["libgcc"]])
    x = extract(elf, tmp, ".vectors", ".init")
    return {0x0000: x[".vectors"], 0x00E4: x[".init"]}


def build_library(tmp, tc):
    """libgcc / avr-libc routines at 0x35F0 in the original order, then _exit."""
    lines = ["SECTIONS {", "  .lib 0x%x : {" % LIBRARY_START]
    lines += ["    *%s:%s(.text*)" % (os.path.basename(tc[lib]), member) for lib, member in LIBRARY_ORDER]
    lines += ["  }", "  .fin : { *libgcc.a:_exit.o(.fini9) *libgcc.a:_exit.o(.fini0) }", "  /DISCARD/ : { *(*) }", "}"]
    ld, elf = os.path.join(tmp, "lib.ld"), os.path.join(tmp, "lib.elf")
    Path(ld).write_text("\n".join(lines) + "\n")
    undef = ["__udivmodhi4", "__divmodhi4", "__tablejump2__", "strcpy_P", "eeprom_read_block",
             "eeprom_write_block", "eeprom_write_byte", "_exit"]
    run(["avr-ld", "-m", "avr5", "-T", ld] + sum((["-u", u] for u in undef), [])
        + ["-o", elf, tc["libgcc"], tc["libc"], tc["libdev"], tc["libgcc"]])
    x = extract(elf, tmp, ".lib", ".fin")
    fin_at = section_addr(elf, ".fin")[0]
    return {LIBRARY_START: x[".lib"], fin_at: x[".fin"]}


def build_data(tmp):
    """src/data.c: initialised data (copied to RAM 0x0060 from flash 0x36AC) and the version string."""
    obj, elf, ld = (os.path.join(tmp, n) for n in ("data.o", "data.elf", "data.ld"))
    run(["avr-gcc"] + CFLAGS + ["-c", str(SRC / "data.c"), "-o", obj])
    Path(ld).write_text("SECTIONS {\n  .data 0x%x : AT(0x%x) { *(.data*) }\n  .version 0x%x : { KEEP(*(.version)) }\n}\n"
                        % (0x800000 + DATA_RAM, DATA_LOAD, VERSION_ADDR))
    run(["avr-ld", "-m", "avr5", "-T", ld, "--defsym", "prog_buf=0x800190", "-o", elf, obj])
    x = extract(elf, tmp, ".data", ".version")
    return {DATA_LOAD: x[".data"], VERSION_ADDR: x[".version"]}


def from_source(rows, maps):
    """The whole image from the C sources and the toolchain only (no byte from the stock image)."""
    image, owner, problems = bytearray(b"\xff" * IMAGE_SIZE), {}, []

    def put(base, data, what):
        for i, b in enumerate(data):
            if base + i in owner:
                problems.append("overlap at 0x%04x: %s and %s" % (base + i, owner[base + i], what))
                return
            owner[base + i] = what
        image[base:base + len(data)] = data

    by_symbol = {r["symbol"]: int(r["addr_byte"], 16) for r in rows if r.get("symbol")}
    with tempfile.TemporaryDirectory() as tmp:
        objs, tc = Objects(tmp), toolchain()
        for r in rows:
            if not r["status"].startswith("MATCHED"):
                continue
            addr = int(r["addr_byte"], 16)
            try:
                placed = link_function(objs, maps, r["file"], r["symbol"], addr)
            except RuntimeError as e:
                problems.append("0x%04x %s: %s" % (addr, r["symbol"], str(e).splitlines()[0]))
                continue
            for base, data in placed.items():
                put(base, data, r["symbol"] if base == addr else "switch tables")
        handlers = {"main": by_symbol["main"], "exit": 0x36A8,
                    "vectors": {n: by_symbol[s] for n, s in VECTORS.items()}}
        for what, pieces in (("crt", build_startup(tmp, tc, handlers)), ("libraries", build_library(tmp, tc)),
                             ("data.c", build_data(tmp))):
            for base, data in pieces.items():
                put(base, data, what)
    return bytes(image), owner, problems


def load_rows():
    with open(TSV, newline="") as f:
        rows = list(csv.DictReader(f, delimiter="\t"))
    fields = list(rows[0].keys())
    for col in ("file", "symbol"):
        if col not in fields:
            fields.append(col)
            for r in rows:
                r[col] = ""
    return rows, fields


def save_rows(rows, fields):
    with open(TSV, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, delimiter="\t", lineterminator="\n")
        w.writeheader()
        w.writerows(rows)


def discover(rows, objs, maps):
    """For MATCHED rows without file/symbol: the function of the right size that links byte-exact."""
    files = sorted(p.name for p in SRC.glob("*.c"))
    for r in rows:
        if not r["status"].startswith("MATCHED") or (r["file"] and r["symbol"]):
            continue
        addr, size = int(r["addr_byte"], 16), int(r["size_bytes"])
        found = None
        for name in files:
            _, funcs = objs.get(name)
            for sym, (_, sz) in funcs.items():
                if sz != size:
                    continue
                try:
                    placed = link_function(objs, maps, name, sym, addr)
                except RuntimeError:
                    continue
                if placed[addr] == STOCK[addr:addr + size]:
                    found = (name, sym)
                    break
            if found:
                break
        r["file"], r["symbol"] = found if found else ("", "")
        if found:                             # later functions may call this one
            for m in maps.values():
                m.setdefault(found[1], (addr, True))
        print("0x%04x %-22s %s" % (addr, r["semantic_name"], "%s:%s" % found if found else "NOT FOUND"))


def report_from_source(rows, maps):
    image, owner, problems = from_source(rows, maps)
    out = HERE.parent / "build"
    out.mkdir(exist_ok=True)
    sha_ok = hashlib.sha256(image).hexdigest() == STOCK_SHA256
    name = "v339-stock" if sha_ok else "v339-stock.candidate"   # never overwrite the reference with a bad build
    (out / (name + ".bin")).write_bytes(image)
    sys.path.insert(0, str(HERE.parent / "tools"))
    import hmf
    records = [[16, a >> 8, a & 0xFF, 0, *image[a:a + 16]] for a in range(0, APP_END, 16)]
    records = [r + [-sum(r) & 0xFF] for r in records] + [[0, 0, 0, 1, 0xFF]]
    (out / (name + ".hmf")).write_bytes(("\r\n".join(hmf.encode_records(records)) + "\r\n").encode())
    from_c = sum(1 for w in owner.values() if w not in ("crt", "libraries", "data.c"))
    sha = hashlib.sha256(image).hexdigest()
    print("built from source: firmware/build/%s.bin + .hmf (no byte taken from the stock image)" % name)
    print("  from the C functions : %d bytes" % from_c)
    print("  crt / libraries / data.c : %d bytes" % (len(owner) - from_c))
    print("  0xFF fill            : %d bytes" % (IMAGE_SIZE - len(owner)))
    print("  sha256 %s (expected %s)" % (sha, STOCK_SHA256))
    for pr in problems:
        print("problem:", pr)
    if STOCK and sha != STOCK_SHA256:
        diff = [a for a in range(IMAGE_SIZE) if image[a] != STOCK[a]]
        holes = sorted({a for a in diff if a not in owner})
        print("DIFFERENT: %d bytes; not produced by any piece: %d (first 0x%04x)" % (len(diff), len(holes), holes[0] if holes else 0))
        ranges = []
        for x in holes:
            if ranges and x == ranges[-1][1]:
                ranges[-1][1] = x + 1
            else:
                ranges.append([x, x + 1])
        for lo, hi in ranges[:10]:
            print("  missing 0x%04x-0x%04x (%d B)" % (lo, hi, hi - lo))
        return 1
    print("IDENTICAL: the image is rebuilt from source" if sha == STOCK_SHA256 else "DIFFERENT")
    return 0 if sha == STOCK_SHA256 and not problems else 1


def main():
    rows, fields = load_rows()
    maps = symbol_maps(rows)
    if ("--overlay" in sys.argv or "--discover" in sys.argv) and STOCK is None:
        sys.exit("build_image.py: %s not found — run `python3 firmware/build.py` first" % STOCK_PATH)
    with tempfile.TemporaryDirectory() as tmp:
        objs = Objects(tmp)
        if "--overlay" not in sys.argv and "--discover" not in sys.argv:
            return report_from_source(rows, maps)
        if "--discover" in sys.argv:
            while True:
                before = sum(bool(r["symbol"]) for r in rows)
                discover(rows, objs, maps)
                if sum(bool(r["symbol"]) for r in rows) == before:
                    break
            save_rows(rows, fields)
            return 0
        image, covered, problems = bytearray(STOCK), 0, []
        for r in rows:
            if not r["status"].startswith("MATCHED"):
                continue
            addr, size = int(r["addr_byte"], 16), int(r["size_bytes"])
            if not (r["file"] and r["symbol"]):
                problems.append("0x%04x: no file/symbol (run with --discover)" % addr)
                continue
            try:
                placed = link_function(objs, maps, r["file"], r["symbol"], addr)
            except RuntimeError as e:
                problems.append("0x%04x %s: %s" % (addr, r["symbol"], str(e).splitlines()[0]))
                continue
            if len(placed[addr]) != size:
                problems.append("0x%04x %s: %d bytes, expected %d" % (addr, r["symbol"], len(placed[addr]), size))
            for base, data in placed.items():
                image[base:base + len(data)] = data
                covered += len(data)
    diff = [a for a in range(APP_END) if image[a] != STOCK[a]]
    print("functions from C : %d / %d rows of functions.tsv" % (sum(r["status"].startswith("MATCHED") for r in rows), len(rows)))
    print("bytes from C     : %d of %d application bytes (%.1f%%)" % (covered, APP_END, 100.0 * covered / APP_END))
    print("image sha256     : %s" % hashlib.sha256(bytes(image)).hexdigest())
    print("stock sha256     : %s" % hashlib.sha256(STOCK).hexdigest())
    for p in problems:
        print("problem:", p)
    if diff:
        print("DIFFERENT: %d bytes, first at 0x%04x" % (len(diff), diff[0]))
        return 1
    print("IDENTICAL to the reference image" + (" (with problems above)" if problems else ""))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())

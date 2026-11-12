"""score.py — byte-exact scoring of reconstructed functions against the stock image.

Usage: python3 score.py <dump.txt> <symbol>=<addr>:<size> ... | <table.json>
  dump.txt   : avr-objdump -dr of the compiled .o
  table.json : {"symbol": [addr, size], ...}; addr = byte address in the flash
Bytes carrying an R_AVR* relocation in the .o are masked (resolved at link).
"""
import sys, re, json
from pathlib import Path
ICI = Path(__file__).resolve().parent
REF = ICI.parent / "build" / "v339-stock.bin"  # built from source by firmware/build.py (SHA-checked)
if not REF.is_file():
    sys.exit("score.py: %s not found — run `python3 firmware/build.py` first: it builds the reference image from source" % REF)
FW = REF.read_bytes()

def hexs(data):
    return " ".join("%02x" % x for x in data)  # Python 3.6 (the pinned container)

def parse_dump(path):
    fonc, cur = {}, None
    for line in Path(path).read_text().splitlines():
        m = re.match(r"^([0-9a-f]+) <([A-Za-z0-9_]+)>:", line)
        if m:
            cur = m.group(2); fonc[cur] = [bytearray(), set()]; continue
        if cur and "R_AVR" in line and len(fonc[cur][0]) >= 2:
            n = len(fonc[cur][0]); fonc[cur][1] |= {n-2, n-1}; continue
        m = re.match(r"^\s+[0-9a-f]+:\s+((?:[0-9a-f]{2} )+)", line)
        if m and cur:
            fonc[cur][0] += bytes.fromhex(m.group(1).replace(" ", ""))
    return {k: (bytes(v[0]), v[1]) for k, v in fonc.items()}

def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    dump, specs = sys.argv[1], sys.argv[2:]
    if specs[0].endswith(".json"):
        table = json.loads(Path(specs[0]).read_text())
    else:
        table = {}
        for spec in specs:
            sym, _, loc = spec.partition("=")
            addr, _, size = loc.partition(":")
            table[sym] = (int(addr, 0), int(size, 0))
    fonc = parse_dump(dump)
    ok_n = tot = 0
    for nom, (addr, taille) in table.items():
        orig = FW[addr:addr+taille]
        b, mask = fonc.get(nom, (b"", set()))
        n = min(len(orig), len(b))
        ident = sum(1 for i in range(n) if i in mask or orig[i] == b[i])
        ok = (len(b) == taille) and ident == taille
        ok_n += ok; tot += 1
        statut = "✅ MATCH" if ok else f"✗ {ident:3d}/{taille}"
        print(f"{nom:20s} 0x{addr:04x} size={len(b):3d}/{taille:<3d} {statut}")
        if not ok:
            print(f"   target: {hexs(orig)}")
            print(f"   built : {hexs(b)}")
            if mask: print(f"   masked relocs: {sorted(mask)}")
    print(f"=== SCORE {ok_n}/{tot} ===")
main()

#!/usr/bin/env python3
"""Build the CU firmware images from source: V339 stock (the C reconstruction) and V339 + bot module.

    python3 firmware/build.py                  # build into firmware/build/, check against manifest.json
    python3 firmware/build.py --check          # exit 1 unless every image matches its manifest SHA-256
    python3 firmware/build.py --release TAG    # record the bot build in manifest.json as TAG (v339-bot.N)

Pinned toolchain: avr-gcc 5.4.0 + Atmel 3.6.0, avr-libc 2.0.0 (firmware/Dockerfile). When avr-gcc
5.4.0 is not installed, the script runs itself inside that Docker image (built on first use).

1. stock: reconstruction/build_image.py links every function of the C reconstruction at its
   address, with the toolchain's start-up code and libraries — the result must have the stock
   SHA-256 from the manifest;
2. bot: bot/ is compiled at 0x36B8 (free flash) and three jmp hooks are written into the stock image.
No firmware image is stored in the repository: manifest.json only records tags and SHA-256.
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BOT, BUILD = ROOT / "bot", ROOT / "build"
MANIFEST = ROOT / "manifest.json"
DOCKER_IMAGE = "avr-gcc-5.4"
REFERENCE_GCC = "5.4.0"
STOCK_TAG = "v339-stock"
MODULE_START, MODULE_END = 0x36B8, 0x37F0  # free flash; 0x37F0+ = id string, 0x3800+ = bootloader
APP_END = 0x3800  # the bootloader is never written
NOP = b"\x00\x00"
# stock site -> (stub, nops after the 4-byte jmp); each hook replaces whole instructions
HOOKS = {
    0x05FC: ("STUB1", 2),  # serial ISR, error path (sts + ldi + out, 8 bytes)
    0x06E6: ("STUB2", 0),  # dispatcher: sts 0x00E6,r1 (4 bytes)
    0x304A: ("STUB3", 2),  # rail word builder: the 2 sts to the shifter (8 bytes); jmp, not call
}
# other patches of the stock image: address -> (stock bytes, new bytes)
PATCHES = {
    0x0110: (b"\xa7\x31", b"\xa5\x32"),  # crt0 .bss clear: cpi r26,0x17 -> 0x25 (bot state 0x0417-0x0424 zeroed)
}
CFLAGS = ["-mmcu=atmega16", "-Os", "-ffreestanding", "-fno-jump-tables",
          "-fno-tree-loop-distribute-patterns",  # no implicit memcpy/memset
          "-nostartfiles", "-nostdlib",
          "-Wl,--section-start=.text=0x%x" % MODULE_START, "-Wl,--no-relax"]


def fail(message):
    sys.exit("build: " + message)


def gcc_version():
    try:
        return subprocess.run(["avr-gcc", "-dumpversion"], stdout=subprocess.PIPE,
                              universal_newlines=True).stdout.strip()
    except FileNotFoundError:
        return None


def in_docker(argv):
    """Re-run this script inside the pinned toolchain image."""
    if not shutil.which("docker"):
        fail("avr-gcc %s not found and Docker is not installed (see firmware/README.md)" % REFERENCE_GCC)
    # with the daemon stopped, every docker command waits forever: ask it first, briefly
    try:
        up = subprocess.run(["docker", "info"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                            timeout=20).returncode == 0
    except subprocess.TimeoutExpired:
        up = False
    if not up:
        fail("Docker is installed but not running: start Docker Desktop, then try again")
    have = subprocess.run(["docker", "image", "inspect", DOCKER_IMAGE], stdout=subprocess.DEVNULL,
                          stderr=subprocess.DEVNULL).returncode == 0
    if not have:
        print("building the toolchain image %s (once)..." % DOCKER_IMAGE, flush=True)
        if subprocess.run(["docker", "build", "-q", "-t", DOCKER_IMAGE, str(ROOT)]).returncode:
            fail("docker build failed")
    cmd = ["docker", "run", "--rm", "-e", "LANG=C.UTF-8", "-v", "%s:/fw" % ROOT, DOCKER_IMAGE,
           "python3", "/fw/build.py"] + argv
    return subprocess.run(cmd).returncode


def run(*cmd):
    r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True, cwd=str(BUILD))
    if r.returncode:
        fail("%s\n%s" % (" ".join(cmd), r.stdout))
    return r.stdout


def sha(data):
    return hashlib.sha256(data).hexdigest()


def jmp(target):
    """Absolute jmp (2 words, opcode 0x940C) to a byte address."""
    k = target // 2
    w1 = 0x940C | (((k >> 17) & 0x1F) << 4) | ((k >> 16) & 1)
    return bytes([w1 & 0xFF, w1 >> 8, k & 0xFF, (k >> 8) & 0xFF])


def to_hmf(image):
    sys.path.insert(0, str(ROOT / "tools"))
    import hmf
    records = [[16, a >> 8, a & 0xFF, 0] + list(image[a:a + 16]) for a in range(0, APP_END, 16)]
    records = [r + [-sum(r) & 0xFF] for r in records] + [[0, 0, 0, 1, 0xFF]]  # + EOF record
    return ("\r\n".join(hmf.encode_records(records)) + "\r\n").encode()


def build_stock():
    sys.path.insert(0, str(ROOT / "reconstruction"))
    import build_image
    rows, _ = build_image.load_rows()
    image, _, problems = build_image.from_source(rows, build_image.symbol_maps(rows))
    for p in problems:
        print("problem:", p)
    return image


def compile_module():
    run("avr-gcc", *(CFLAGS + [str(BOT / "stubs.S"), str(BOT / "bot_mode.c"), "-o", "bot.elf"]))
    m = re.search(r"^\s*(\d+)\s+(\d+)\s+(\d+)\s", run("avr-size", "bot.elf").splitlines()[1])
    text, data, bss = map(int, m.groups())
    if data or bss:
        fail(".data/.bss not empty: nothing initializes them in the firmware")
    if text > MODULE_END - MODULE_START:
        fail("module too large: %d > %d free bytes" % (text, MODULE_END - MODULE_START))
    dis = run("avr-objdump", "-d", "-m", "avr:5", "bot.elf")
    unresolved = [l for l in dis.splitlines() if re.search(r"call\s+0x0+\b|br\w+\s+\. [-+] ?0\b", l)]
    if unresolved:
        fail("unresolved branch/call:\n" + "\n".join(unresolved))
    run("avr-objcopy", "-O", "binary", "-j", ".text", "bot.elf", "module.bin")
    stubs = {m.group(2): int(m.group(1), 16)
             for m in re.finditer(r"^([0-9a-f]+) \w (STUB\d)$", run("avr-nm", "bot.elf"), re.M)}
    if set(stubs) != {"STUB1", "STUB2", "STUB3"} or stubs["STUB1"] != MODULE_START:
        fail("unexpected stub layout: %s" % stubs)
    return (BUILD / "module.bin").read_bytes(), stubs


def build_bot(stock):
    module, stubs = compile_module()
    image = bytearray(stock)
    if any(b != 0xFF for b in image[MODULE_START:MODULE_START + len(module)]):
        fail("module area is not free in the stock image")
    image[MODULE_START:MODULE_START + len(module)] = module
    for site, (stub, nops) in HOOKS.items():
        patch = jmp(stubs[stub]) + NOP * nops
        image[site:site + len(patch)] = patch
    for site, (old, new) in PATCHES.items():
        if bytes(image[site:site + len(old)]) != old:
            fail("unexpected stock bytes at 0x%04x" % site)
        image[site:site + len(new)] = new
    print("bot module: %d bytes at 0x%04x, stubs %s" % (len(module), MODULE_START,
          ", ".join("%s=0x%04x" % kv for kv in sorted(stubs.items()))))
    return bytes(image)


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--check", action="store_true", help="fail unless every image matches the manifest")
    ap.add_argument("--release", metavar="TAG", help="record the bot build in manifest.json as TAG")
    args = ap.parse_args()
    if gcc_version() != REFERENCE_GCC:
        return in_docker(sys.argv[1:])

    BUILD.mkdir(exist_ok=True)
    manifest = json.loads(MANIFEST.read_text())
    entries = manifest["images"]
    by_tag = {e["tag"]: e for e in entries}
    known = {e["sha256"]: e for e in entries}

    stock = build_stock()
    stock_entry = by_tag[STOCK_TAG]
    stock_ok = sha(stock) == stock_entry["bin_sha256"]
    print("%-22s sha256 %s  %s" % (stock_entry["file"], sha(to_hmf(stock)),
                                   "= %s" % STOCK_TAG if stock_ok else "DIFFERENT from %s" % STOCK_TAG))
    if not stock_ok:
        fail("the C reconstruction no longer rebuilds the stock image: run "
             "`python3 reconstruction/build_image.py --from-source` to see which bytes differ")
    (BUILD / stock_entry["bin"]).write_bytes(stock)
    (BUILD / stock_entry["file"]).write_bytes(to_hmf(stock))

    bot = build_bot(stock)
    bot_hmf = to_hmf(bot)
    same = known.get(sha(bot_hmf))
    current = next((e for e in entries if e["bots"] and e["status"] == "recommended"), None)
    if same and same["status"] == "defective":
        fail("this build is the known-defective %s: %s" % (same["tag"], same.get("warning")))
    name = same["file"] if same else "v339-bot.new.hmf"
    (BUILD / name).write_bytes(bot_hmf)
    (BUILD / name.replace(".hmf", ".bin")).write_bytes(bot)
    print("%-22s sha256 %s  %s" % (name, sha(bot_hmf), "= %s" % same["tag"] if same
                                   else "new image (current: %s)" % (current["tag"] if current else "none")))

    if args.release:
        tag = args.release
        if not re.match(r"^v339-bot\.\d+$", tag) or tag in by_tag:
            fail("tag %r: expected a new v339-bot.N" % tag)
        if same:
            fail("nothing to release: already recorded as %s" % same["tag"])
        os.replace(str(BUILD / name), str(BUILD / (tag + ".hmf")))
        os.replace(str(BUILD / name.replace(".hmf", ".bin")), str(BUILD / (tag + ".bin")))
        if current:
            current["status"] = "superseded"
        entries.insert(0, {"tag": tag, "label": "V339 + bot module", "status": "recommended", "bots": True,
                           "file": tag + ".hmf", "sha256": sha(bot_hmf), "bin": tag + ".bin",
                           "bin_sha256": sha(bot), "notes": ""})
        MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
        print("recorded %s in manifest.json — add its notes there and a line in CHANGELOG.md" % tag)
        return 0
    if args.check and not (same and current and same["tag"] == current["tag"]):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Carrera Control Unit .HMF firmware files <-> Intel HEX / raw binary.

Each .HMF line is one Intel HEX record, wrapped in double quotes. Every byte b of the
record is written as a 4-digit hex word:  word = (b * 0xC5 + ((0x38 + n) & 0xFF)) & 0xFFFF
where n counts the bytes already encoded in the whole file (not reset per line).

Usage:
  hmf.py decode FILE.HMF OUT_PREFIX     -> OUT_PREFIX.hex (plain Intel HEX) and OUT_PREFIX.bin (flash image, 0xFF-filled)
  hmf.py encode FILE.hex OUT.HMF        -> re-encode a plain Intel HEX file
  hmf.py check FILE.HMF                 -> decode, re-encode and compare byte for byte
"""
import sys

MUL, K0 = 0xC5, 0x38
MUL_INV = next(x for x in range(1, 0x10000, 2) if (MUL * x) & 0xFFFF == 1)  # pow(MUL, -1, 0x10000); Python 3.6-compatible
FLASH_SIZE = 0x4000  # ATmega16: 16 KiB, bootloader from 0x3800


def hmf_lines(path):
    with open(path, encoding="ascii") as f:
        return [l.strip().replace('"', "") for l in f if l.strip()]


def decode_records(lines):
    n, records = 0, []
    for no, line in enumerate(lines, 1):
        rec = []
        for i in range(0, len(line), 4):
            b = ((int(line[i:i + 4], 16) - ((K0 + n) & 0xFF)) * MUL_INV) & 0xFFFF
            if b > 0xFF:
                raise ValueError(f"line {no}: word {i // 4} does not decode")
            rec.append(b)
            n += 1
        if rec[0] != len(rec) - 5 or sum(rec) & 0xFF:
            raise ValueError(f"line {no}: bad Intel HEX length or checksum")
        records.append(rec)
    return records


def encode_records(records):
    n, lines = 0, []
    for rec in records:
        words = []
        for b in rec:
            words.append("%04X" % ((b * MUL + ((K0 + n) & 0xFF)) & 0xFFFF))
            n += 1
        lines.append('"' + "".join(words) + '"')
    return lines


def records_to_image(records):
    image, used = bytearray(b"\xff" * FLASH_SIZE), set()
    for rec in records:
        addr, typ, data = rec[1] << 8 | rec[2], rec[3], rec[4:-1]
        if typ == 0:
            for i, b in enumerate(data):
                image[addr + i] = b
                used.add(addr + i)
    return image, used


def parse_ihex(path):
    records = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line.startswith(":"):
                records.append(list(bytes.fromhex(line[1:])))
    return records


def main():
    cmd = sys.argv[1]
    if cmd == "decode":
        records = decode_records(hmf_lines(sys.argv[2]))
        out = sys.argv[3]
        with open(out + ".hex", "w") as f:
            for rec in records:
                f.write(":" + bytes(rec).hex().upper() + "\n")
        image, used = records_to_image(records)
        with open(out + ".bin", "wb") as f:
            f.write(image)
        print(f"{len(records)} records, {len(used)} bytes, {min(used):#06x}-{max(used):#06x}")
    elif cmd == "encode":
        lines = encode_records(parse_ihex(sys.argv[2]))
        with open(sys.argv[3], "w", newline="\r\n") as f:
            f.write("\n".join(lines) + "\n")
    elif cmd == "check":
        lines = hmf_lines(sys.argv[2])
        again = [l.replace('"', "") for l in encode_records(decode_records(lines))]
        print("round-trip OK" if again == [l.upper() for l in lines] else "round-trip MISMATCH")
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()

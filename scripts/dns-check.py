#!/usr/bin/env python3
"""
Answers one question: why does the domain not resolve, and whose fault is it?

`nslookup` cannot answer that. It gives you one word — usually SERVFAIL — which
is the resolver saying "something upstream went wrong" without saying what. The
three causes look identical through nslookup and need completely different
fixes:

  * the registry has no delegation      -> fix the nameservers at IRNIC
  * the nameservers refuse the zone     -> create the zone at the DNS provider
  * DNSSEC is broken                    -> fix or remove the DS record

So this script talks to each layer of the chain directly, in order, and prints
the raw response code from each. It speaks DNS over a UDP socket rather than
shelling out to `dig`, because `dig` is not installed on Windows and this has to
run from the same laptop that runs the deploy.

It also matters that this bypasses the local resolver entirely. On many Iranian
connections the ISP intercepts port 53 and answers on behalf of whatever server
you asked for -- during this project a query aimed at Parspack's nameserver came
back from an entirely different address. Every reply below is checked against
the server that was actually asked.

Usage:
    python3 scripts/dns-check.py [domain] [expected-ip]

    python3 scripts/dns-check.py araspro.ir 198.51.100.10

With no arguments it checks araspro.ir and only reports what it finds.
"""

from __future__ import annotations

import random
import socket
import struct
import sys

RCODE = {
    0: "NOERROR",
    1: "FORMERR",
    2: "SERVFAIL",
    3: "NXDOMAIN",
    4: "NOTIMP",
    5: "REFUSED",
}
TYPE_NAME = {1: "A", 2: "NS", 5: "CNAME", 6: "SOA", 28: "AAAA", 43: "DS"}
TYPE_NUM = {v: k for k, v in TYPE_NAME.items()}

# a.nic.ir. The .ir registry, and the only authority on who the domain is
# actually delegated to. Anything else is a cache.
IR_REGISTRY = "193.189.123.2"

PUBLIC_RESOLVERS = ["8.8.8.8", "1.1.1.1"]


def _encode(name: str) -> bytes:
    return b"".join(bytes([len(l)]) + l.encode() for l in name.split(".") if l) + b"\x00"


def _decode(data: bytes, off: int) -> tuple[str, int]:
    """Reads a name, following compression pointers, and returns where to resume."""
    parts: list[str] = []
    resume = off
    jumped = False
    while True:
        length = data[off]
        if length & 0xC0 == 0xC0:
            pointer = struct.unpack(">H", data[off : off + 2])[0] & 0x3FFF
            if not jumped:
                resume = off + 2
            off = pointer
            jumped = True
            continue
        off += 1
        if length == 0:
            break
        parts.append(data[off : off + length].decode("latin1"))
        off += length
    return ".".join(parts), (resume if jumped else off)


def query(server: str, name: str, qtype: str, recursive: bool = False, timeout: float = 6.0) -> dict:
    """One UDP question to one server. No retries: a timeout is itself a finding."""
    transaction = random.randint(0, 0xFFFF)
    flags = 0x0100 if recursive else 0x0000
    packet = (
        struct.pack(">HHHHHH", transaction, flags, 1, 0, 0, 0)
        + _encode(name)
        + struct.pack(">HH", TYPE_NUM[qtype], 1)
    )

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(timeout)
    try:
        sock.sendto(packet, (server, 53))
        data, peer = sock.recvfrom(4096)
    except Exception as exc:  # noqa: BLE001 - any failure is reported, not raised
        return {"rcode": f"NO REPLY ({type(exc).__name__})", "records": [], "spoofed": False}
    finally:
        sock.close()

    reply_flags = struct.unpack(">H", data[2:4])[0]
    qd, an, ns, ar = struct.unpack(">HHHH", data[4:12])

    off = 12
    for _ in range(qd):
        _, off = _decode(data, off)
        off += 4

    records = []
    for section, count in (("ANSWER", an), ("AUTHORITY", ns), ("ADDITIONAL", ar)):
        for _ in range(count):
            rname, off = _decode(data, off)
            rtype, _cls, ttl, rdlen = struct.unpack(">HHIH", data[off : off + 10])
            off += 10
            raw = data[off : off + rdlen]
            if rtype == 1 and rdlen == 4:
                value = ".".join(map(str, raw))
            elif rtype in (2, 5, 6):
                value, _ = _decode(data, off)
            elif rtype == 43:
                value = "DS " + raw[:4].hex()
            else:
                value = f"type{rtype}"
            records.append(
                {"section": section, "name": rname, "type": TYPE_NAME.get(rtype, rtype), "value": value, "ttl": ttl}
            )
            off += rdlen

    return {
        "rcode": RCODE.get(reply_flags & 0xF, reply_flags & 0xF),
        "authoritative": bool(reply_flags & 0x0400),
        "records": records,
        # The ISP-interception check: did the answer come back from the address
        # we asked, or did something in the middle answer for it?
        "spoofed": peer[0] != server,
    }


def _flag(result: dict) -> str:
    return "  <-- ANSWERED BY A DIFFERENT SERVER (ISP interception)" if result.get("spoofed") else ""


def main() -> int:
    domain = sys.argv[1] if len(sys.argv) > 1 else "araspro.ir"
    expected_ip = sys.argv[2] if len(sys.argv) > 2 else None

    print(f"Checking {domain}\n")

    # ---- Layer 1: the registry ---------------------------------------------
    print("1. DELEGATION — what the .ir registry says (a.nic.ir)")
    referral = query(IR_REGISTRY, domain, "NS")
    nameservers = [r["value"] for r in referral["records"] if r["type"] == "NS"]
    print(f"   rcode: {referral['rcode']}{_flag(referral)}")
    if nameservers:
        for ns in nameservers:
            print(f"   NS  {ns}")
    else:
        print("   NO NAMESERVERS — the domain is not delegated. Fix this at IRNIC first;")
        print("   nothing below can work until it is set.")
        return 1

    # DNSSEC: a DS record here with an unsigned zone below is a silent SERVFAIL.
    ds = query(IR_REGISTRY, domain, "DS")
    ds_records = [r for r in ds["records"] if r["type"] == "DS"]
    print(f"   DNSSEC: {'DS PRESENT — zone must be signed' if ds_records else 'no DS record (DNSSEC not in use)'}")

    # ---- Layer 2: the nameservers themselves -------------------------------
    print("\n2. ZONE — do those nameservers actually host the zone?")
    print("   REFUSED here means the zone was never created at the DNS provider.")
    hosted_anywhere = False
    for ns in nameservers:
        addresses = [r["value"] for r in query(PUBLIC_RESOLVERS[0], ns, "A", recursive=True)["records"] if r["type"] == "A"]
        if not addresses:
            print(f"   {ns:<22} NAME DOES NOT RESOLVE — the delegation points at a host that does not exist")
            continue
        for ip in addresses:
            zone = query(ip, domain, "SOA")
            # Control question. If the server answers for its own provider's
            # zone but refuses ours, the server is healthy and the zone is
            # genuinely absent -- rather than the server being unreachable.
            control = query(ip, ".".join(ns.split(".")[-2:]), "SOA")
            verdict = ""
            if zone["rcode"] == "REFUSED" and control["rcode"] == "NOERROR":
                verdict = "  zone NOT hosted here (server is healthy — it answers other zones)"
            elif zone["rcode"] == "NOERROR":
                hosted_anywhere = True
                verdict = "  zone IS hosted here"
            print(f"   {ns:<22} {ip:<16} SOA {zone['rcode']:<10} (control {control['rcode']}){verdict}")

    # ---- Layer 3: what the world sees --------------------------------------
    print("\n3. RESOLUTION — what a visitor's resolver returns")
    for resolver in PUBLIC_RESOLVERS:
        for host in (domain, f"www.{domain}"):
            result = query(resolver, host, "A", recursive=True)
            ips = [r["value"] for r in result["records"] if r["type"] == "A"]
            note = ""
            if expected_ip and ips:
                note = "  CORRECT" if expected_ip in ips else f"  WRONG — expected {expected_ip}"
            print(f"   {resolver:<10} {host:<22} {result['rcode']:<10} {ips}{note}{_flag(result)}")

    # ---- Verdict ------------------------------------------------------------
    print("\nVERDICT")
    if not hosted_anywhere:
        print("   The domain is delegated, but no nameserver hosts the zone.")
        print("   Fix: create the DNS zone for this domain at the DNS provider,")
        print("   then add the A records. See")
        print("   docs/deployment/05-nginx-and-ssl/01-connect-the-domain.md")
        return 1

    resolved = query(PUBLIC_RESOLVERS[0], domain, "A", recursive=True)
    ips = [r["value"] for r in resolved["records"] if r["type"] == "A"]
    if expected_ip and expected_ip not in ips:
        print(f"   Zone exists but {domain} does not point at {expected_ip} yet.")
        return 1
    if not ips:
        print("   Zone exists but has no A record for the bare domain yet.")
        return 1

    print(f"   {domain} resolves to {ips}. Safe to run nginx.yml for the certificate.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

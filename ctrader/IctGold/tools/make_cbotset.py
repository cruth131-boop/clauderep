#!/usr/bin/env python3
"""Turn the parameter lists in paramsets/*.json into cTrader .cbotset files (Automate > cBot > Load Parameters).

  make_cbotset.py [--bot bot] [--out paramsets/cbotset] [--period m2] [--full] paramsets/v261-recommended.json ...

Every key is checked against the [Parameter] properties in bot/*.cs (name, bool, number, enum member); an unknown name
or value aborts. Without --full a set contains only the parameters that differ from the source defaults, so loading it
does not overwrite account-specific settings (news path, kill switch, owner id ...). --full writes every parameter.
"""
import argparse
import glob
import json
import os
import re
import sys

PARAM = re.compile(r'\[Parameter\("([^"]*)"\s*,\s*DefaultValue\s*=\s*([^,\]]+)[^\]]*\]\s*public\s+([\w.]+)\s+(\w+)\s*\{', re.S)
ENUM = re.compile(r'public\s+enum\s+(\w+)\s*\{([^}]*)\}', re.S)


def load_bot(bot_dir):
    params, enums = {}, {}
    for path in glob.glob(os.path.join(bot_dir, "*.cs")):
        src = open(path, encoding="utf-8").read()
        for name, body in ENUM.findall(src):
            enums[name] = [m.split("=")[0].strip() for m in re.sub(r"//.*", "", body).split(",") if m.strip()]
        for label, default, typ, prop in PARAM.findall(src):
            params[prop] = (label, default.strip(), typ.split(".")[-1])
    return params, enums


def norm(value, typ, enums, prop):
    v = str(value).strip()
    if typ == "bool":
        if v.lower() not in ("true", "false"):
            raise ValueError(f"{prop}: '{v}' is not a bool")
        return "True" if v.lower() == "true" else "False"
    if typ in ("int", "double"):
        float(v)
        return v
    if typ == "string":
        return v.strip('"')
    if typ in enums:
        member = v.split(".")[-1]
        if member not in enums[typ]:
            raise ValueError(f"{prop}: '{member}' is not a member of {typ} {enums[typ]}")
        return member
    raise ValueError(f"{prop}: unsupported type {typ}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sets", nargs="+")
    ap.add_argument("--bot", default=os.path.join(os.path.dirname(__file__), "..", "bot"))
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "paramsets", "cbotset"))
    ap.add_argument("--period", default="m2")
    ap.add_argument("--full", action="store_true")
    a = ap.parse_args()
    params, enums = load_bot(a.bot)
    os.makedirs(a.out, exist_ok=True)
    for path in a.sets:
        doc = json.load(open(path, encoding="utf-8"))
        values = {}
        if a.full:
            for prop, (_, default, typ) in params.items():
                values[prop] = norm(default, typ, enums, prop)
        for prop, value in doc["Parameters"].items():
            if prop not in params:
                sys.exit(f"{path}: unknown parameter {prop}")
            values[prop] = norm(value, params[prop][2], enums, prop)
        symbol = doc["Parameters"].get("RequiredSymbolPrefix", "XAUUSD") or "XAUUSD"
        out = {"Chart": {"Symbol": symbol, "Period": a.period}, "Parameters": dict(sorted(values.items()))}
        name = os.path.splitext(os.path.basename(path))[0]
        target = os.path.join(a.out, name + ".cbotset")
        with open(target, "w", encoding="utf-8") as f:
            json.dump(out, f, indent=2)
            f.write("\n")
        print(f"{target}: {len(values)} parameters, {symbol} {a.period}")


if __name__ == "__main__":
    main()

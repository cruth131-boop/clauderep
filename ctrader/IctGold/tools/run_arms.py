#!/usr/bin/env python3
"""Run the offline harness for a set of parameter arms on several datasets (parallel) and tabulate the results.

  run_arms.py --exe harness/out/new/IctGoldHarness --data NAME=path:from:to [...] --out runs/dir --arms singles|combos|all
Each arm is a list of Name=Value overrides on top of the bot defaults (= v2.59 behaviour).
The script also checks invariants from the OPEN log lines and the funnel (no post-fill protection rejects).
"""
import argparse
import concurrent.futures as cf
import os
import re
import subprocess

ROBUST = ["FailFastStaticGates=true", "AllowDeepFillWithHold=true"]
BEST = ROBUST + ["EntryMode=FvgCeTouch", "RrBasis=StructuralTarget"]
FIXES = ["FvgSearchWholeLeg=true", "DeliveryVetoAfterMssOnly=true", "FailFastStaticGates=true", "AllowDeepFillWithHold=true"]
ARMS = {
    "singles": {
        "A0_control": [],
        "P1_fvg_leg": ["FvgSearchWholeLeg=true"],
        "P2_veto_after_mss": ["DeliveryVetoAfterMssOnly=true"],
        "P3_failfast": ["FailFastStaticGates=true"],
        "P4_slot_upgrade": ["UpgradeSlotOnStrongerSweep=true"],
        "P5s_consumed_sweeps": ["IgnoreConsumedLiquidity=Sweeps"],
        "P5t_consumed_targets": ["IgnoreConsumedLiquidity=Targets"],
        "P6_deep_fill": ["AllowDeepFillWithHold=true"],
        "E1_rr_structural": ["RrBasis=StructuralTarget"],
        "E2_ce_entry": ["EntryMode=FvgCeTouch"],
        "E2z_ce_zone_stop": ["EntryMode=FvgCeTouch", "CeStopAnchor=ZoneEdge"],
        "H4_bias": ["HtfBiasFilter=H4Structure"],
        "M5_eq_only": ["M5InternalMinimumStrength=2"],
        "S_nypm": ["TradeNyPm=true"],
    },
    "final": {
        "A0_control": [],
        "C7_best": BEST,
        "K1_best_cont": BEST + ["EnableContinuationLane=true"],
        "K2_best_cont_nypm": BEST + ["EnableContinuationLane=true", "TradeNyPm=true"],
    },
    "lane": {
        "A0_control": [],
        "K0_cont_only": ["EnableContinuationLane=true"],
        "C7_best": BEST,
        "C8_best_nypm": BEST + ["TradeNyPm=true"],
        "K1_best_cont": BEST + ["EnableContinuationLane=true"],
        "K2_best_cont_nypm": BEST + ["EnableContinuationLane=true", "TradeNyPm=true"],
    },
    "combos": {
        "A0_control": [],
        "C1_p3_p6": ROBUST,
        "C2_c1_ce": ROBUST + ["EntryMode=FvgCeTouch"],
        "C3_c1_ce_zone": ROBUST + ["EntryMode=FvgCeTouch", "CeStopAnchor=ZoneEdge"],
        "C4_c2_nypm": ROBUST + ["EntryMode=FvgCeTouch", "TradeNyPm=true"],
        "C5_c3_nypm": ROBUST + ["EntryMode=FvgCeTouch", "CeStopAnchor=ZoneEdge", "TradeNyPm=true"],
        "C6_c2_fvgleg": ROBUST + ["EntryMode=FvgCeTouch", "FvgSearchWholeLeg=true"],
        "C7_c2_rr": ROBUST + ["EntryMode=FvgCeTouch", "RrBasis=StructuralTarget"],
    },
}
METRIC = re.compile(r"(\w+)=(-?[\d.]+|NaN)%?")
OPEN = re.compile(r"OPEN (LONG|SHORT): type=([^,]+), score=(\d+), entry=([\d.]+), SL=([\d.]+) \(([\d.]+)p\), TP1=([\d.]+) \(([\d.]+)p\), "
                  r"TP2=([\d.]+) \(([\d.]+)p\), TP1-RR=([\d.]+)")


def run(exe, arm, params, ds, path, frm, to, out, substeps):
    tag = f"{arm}__{ds}"
    cmd = [exe, "--data", path, "--from", frm, "--to", to, "--out", out, "--tag", tag, "--log", "--substeps", str(substeps)]
    for p in params:
        cmd += ["--set", p]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL)
    return arm, ds, tag


def parse(out, tag):
    text = open(os.path.join(out, tag + ".summary.txt")).read()
    line = [l for l in text.splitlines() if l.startswith("signals=")][0]
    m = {k: float(v) if v != "NaN" else float("nan") for k, v in METRIC.findall(line)}
    funnel = {}
    for l in text.split("funnel:")[1].splitlines():
        if "=" in l:
            k, v = l.strip().rsplit("=", 1)
            funnel[k] = int(v)
    opens = OPEN.findall(open(os.path.join(out, tag + ".log")).read())
    return m, funnel, opens


def invariants(arm_params, opens, funnel):
    issues = []
    post = {k: v for k, v in funnel.items() if "rej:postfill" in k}
    if post:
        issues.append("postfill rejects " + str(post))
    structural = "RrBasis=StructuralTarget" in arm_params
    for o in opens:
        sl, tp1, tp2, rr1 = float(o[5]), float(o[7]), float(o[9]), float(o[10])
        if structural:
            if tp2 / sl < 2.0 - 0.05:
                issues.append(f"tp2/risk {tp2/sl:.2f} < 2")
            if tp1 / sl < 1.0 - 0.05:
                issues.append(f"tp1/risk {tp1/sl:.2f} < 1")
        elif rr1 < 1.60 - 0.01:
            issues.append(f"tp1 rr {rr1:.2f} < 1.6")
    return issues[:5]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--exe", required=True)
    ap.add_argument("--data", action="append", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--arms", default="singles")
    ap.add_argument("--jobs", type=int, default=4)
    ap.add_argument("--substeps", type=int, default=4)
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    if args.arms == "all":
        arms = {}
        for group in ("singles", "combos", "lane", "final"):
            arms.update(ARMS[group])
    else:
        arms = ARMS[args.arms]
    datasets = []
    for d in args.data:
        name, rest = d.split("=", 1)
        path, frm, to = rest.rsplit(":", 2)
        datasets.append((name, path, frm, to))
    jobs = [(a, p, *d) for a, p in arms.items() for d in datasets]
    with cf.ThreadPoolExecutor(args.jobs) as ex:
        list(ex.map(lambda j: run(args.exe, *j, args.out, args.substeps), jobs))

    rows = []
    for a, p in arms.items():
        for ds, *_ in datasets:
            m, funnel, opens = parse(args.out, f"{a}__{ds}")
            rows.append((a, ds, m, invariants(p, opens, funnel), funnel))
    hdr = "| arm | data | signals | /day | win % | sum R | avg R | PF(R) | net EUR | max DD % | invariants |"
    lines = [hdr, "|" + "---|" * 11]
    for a, ds, m, inv, _ in rows:
        lines.append(f"| {a} | {ds} | {m['signals']:.0f} | {m['signals_per_day']:.2f} | {m['win_rate']:.1f} | {m['sum_r']:.1f} | "
                     f"{m['avg_r']:.3f} | {m['pf_r']:.2f} | {m['net_eur']:.0f} | {m['max_dd_pct']:.1f} | {'ok' if not inv else '; '.join(inv)} |")
    table = "\n".join(lines)
    open(os.path.join(args.out, "RESULTS.md"), "w").write(table + "\n")
    print(table)
    keys = ["PARENT|slot_upgrade", "PARENT|ce_touch", "PARENT|failfast:arm", "PARENT|failfast:m5_internal_zone",
            "PARENT|rej:exec:htf_bias", "PARENT|rej:exec:rr_floor", "PARENT|rej:exec:delivery_veto", "PARENT|reset:no_pd_array",
            "PARENT|reset:zone_over_mitigated", "PARENT|rej:exec:no_target_room", "PARENT|armed"]
    print("\nfunnel (first dataset):")
    for a, ds, m, inv, f in rows:
        if ds == datasets[0][0]:
            print(f"  {a:22s} " + " ".join(f"{k.split('|')[1]}={f.get(k, 0)}" for k in keys))


if __name__ == "__main__":
    main()

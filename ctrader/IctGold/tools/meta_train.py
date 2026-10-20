#!/usr/bin/env python3
"""Train / evaluate the meta-labeling model from META_CAND / META_OUT telemetry (Meta Mode = Log or Shadow runs).

  meta_train.py --train a.log b.log [--test c.log] [--out model.json] [--min-expected-r 0.2] [--l2 3.0]
                [--soft-gates score,rr_floor,...] [--min-rr 1.5]

Label: the bracket outcome of every candidate that reached the order gate (entry = CE for CE touches, plan stop, structural
TP2), resolved on M1 bars after the decision, stop first inside a bar. y = 1 for TARGET, 0 for STOP; TIMEOUT/CENSORED rows
are not used for fitting (their marked-to-market R is still used in the R statistics).
Model: L2-regularised logistic regression on standardised features (IRLS), p = P(TP2 before stop);
expected R = p * TP2_R - (1 - p). The bot overrides a soft rejection when expected R >= min_expected_r.

What the report answers, strictly on the --test files (walk-forward: train only on earlier periods):
  * discrimination (AUC) and calibration of p
  * accepted candidates (what the rules trade) vs soft-rejected candidates, bracket R
  * soft-rejected candidates the model would take, per threshold: count, per day, mean R, PF  -> the frequency the
    override adds and whether it holds up out of sample
  * accepted candidates the model would veto (Meta Veto), per threshold
"""
import argparse
import datetime as dt
import json
import os
import re

import numpy as np

SOFT = ["score", "rr_floor", "delivery_veto", "m5_internal_context", "htf_bias", "gate:extended session quality"]
LINE = re.compile(r"(META_CAND|META_OUT)\|(.*)$")


def parse(paths):
    rows = []
    for path in paths:
        cand, out = {}, {}
        tag = os.path.basename(path)
        with open(path, encoding="utf-8", errors="replace") as f:
            for line in f:
                m = LINE.search(line)
                if not m:
                    continue
                kv = dict(x.split("=", 1) for x in m.group(2).split("|") if "=" in x)
                (cand if m.group(1) == "META_CAND" else out)[kv["id"]] = kv
        for k, c in cand.items():
            o = out.get(k)
            if o is None:
                continue
            c = dict(c)
            c["_status"], c["_r"], c["_file"] = o["status"], float(o["r"]), tag
            rows.append(c)
    return rows


def matrix(rows, feats):
    X = np.array([[float(r.get("f_" + f, "nan")) for f in feats] for r in rows], dtype=float)
    X[np.isnan(X)] = 0.0
    return X


def fit(X, y, l2):
    n, d = X.shape
    Xb = np.hstack([X, np.ones((n, 1))])
    w = np.zeros(d + 1)
    reg = np.full(d + 1, l2)
    reg[-1] = 0.0
    for _ in range(50):
        z = np.clip(Xb @ w, -40, 40)
        p = 1 / (1 + np.exp(-z))
        g = Xb.T @ (p - y) + reg * w
        H = (Xb * (p * (1 - p))[:, None]).T @ Xb + np.diag(reg) + 1e-9 * np.eye(d + 1)
        step = np.linalg.solve(H, g)
        w -= step
        if np.max(np.abs(step)) < 1e-8:
            break
    return w[:-1], w[-1]


def auc(y, s):
    o = np.argsort(s)
    ranks = np.empty(len(s))
    ranks[o] = np.arange(1, len(s) + 1)
    pos = y == 1
    n1, n0 = pos.sum(), (~pos).sum()
    return float((ranks[pos].sum() - n1 * (n1 + 1) / 2) / (n1 * n0)) if n1 and n0 else float("nan")


def pf(r):
    w, l = r[r > 0].sum(), -r[r < 0].sum()
    return w / l if l > 0 else float("nan")


def days(rows):
    ds = {r["t"][:10] for r in rows}
    if not ds:
        return 1
    a, b = min(ds), max(ds)
    n = (dt.date.fromisoformat(b) - dt.date.fromisoformat(a)).days + 1
    return max(1, round(n * 5 / 7))


def tp2r(r):
    e, s, t = float(r["entry"]), float(r["sl"]), float(r["tp2"])
    return abs(t - e) / abs(e - s) if e != s else 0.0


def report(rows, model, thresholds, min_rr, soft):
    if not rows:
        print("  (no rows)")
        return
    feats = model["features"]
    X = (matrix(rows, feats) - np.array(model["mean"])) / np.array(model["std"])
    p = 1 / (1 + np.exp(-np.clip(X @ np.array(model["weights"]) + model["bias"], -40, 40)))
    R = np.array([r["_r"] for r in rows])
    T = np.array([tp2r(r) for r in rows])
    exp_r = p * T - (1 - p)
    res = np.array([r["_status"] in ("TARGET", "STOP") for r in rows])
    y = np.array([1 if r["_status"] == "TARGET" else 0 for r in rows])
    acc = np.array([r["decision"] == "accept" for r in rows])
    waived = [set(r.get("waived", "na").split("+")) - {"na"} for r in rows]
    soft_ok = np.array([bool(w) and w <= set(soft) for w in waived])
    runner = np.array([r.get("tp2_name", "") == "Runner TP2" for r in rows])
    elig = (~acc) & soft_ok & (~runner) & (T >= min_rr - 1e-9)
    nd = days(rows)
    print(f"  rows {len(rows)} on ~{nd} trading days; resolved {res.sum()}; AUC {auc(y[res], p[res]):.3f}; "
          f"Brier {np.mean((p[res] - y[res]) ** 2):.3f}")
    print("  calibration (p decile: mean p / hit rate / n):", end="")
    if res.sum() >= 50:
        q = np.quantile(p[res], np.linspace(0, 1, 6))
        for a, b in zip(q[:-1], q[1:]):
            m = res & (p >= a) & (p <= b)
            print(f"  {p[m].mean():.2f}/{y[m].mean():.2f}/{m.sum()}", end="")
    print()
    print(f"  accepted:        n {acc.sum():4d} ({acc.sum() / nd:.2f}/day) mean R {R[acc].mean():+.3f} PF {pf(R[acc]):.2f}")
    print(f"  soft-rejected:   n {elig.sum():4d} ({elig.sum() / nd:.2f}/day) mean R {R[elig].mean() if elig.any() else float('nan'):+.3f} "
          f"PF {pf(R[elig]) if elig.any() else float('nan'):.2f}   (eligible for override)")
    for th in thresholds:
        m = elig & (exp_r >= th)
        print(f"  override exp_R >= {th:4.2f}: n {m.sum():4d} ({m.sum() / nd:.2f}/day) mean R {R[m].mean() if m.any() else float('nan'):+.3f} "
              f"PF {pf(R[m]) if m.any() else float('nan'):.2f}")
    for th in (-0.3, -0.2, -0.1, 0.0):
        v = acc & (exp_r < th)
        k = acc & ~v
        print(f"  veto accepted exp_R < {th:+.1f}: vetoed n {v.sum():4d} mean R {R[v].mean() if v.any() else float('nan'):+.3f} | kept n {k.sum():4d} "
              f"mean R {R[k].mean() if k.any() else float('nan'):+.3f} PF {pf(R[k]) if k.any() else float('nan'):.2f}")
    by = {}
    for r, e in zip(rows, elig):
        if e:
            by.setdefault(r.get("waived"), []).append(r["_r"])
    print("  soft-rejected by waived gate: " + ", ".join(f"{k} n={len(v)} R={np.mean(v):+.2f}" for k, v in sorted(by.items())))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--train", nargs="+", required=True)
    ap.add_argument("--test", nargs="*", default=[])
    ap.add_argument("--out")
    ap.add_argument("--l2", type=float, default=3.0)
    ap.add_argument("--min-expected-r", type=float, default=0.2)
    ap.add_argument("--min-rr", type=float, default=1.5)
    ap.add_argument("--soft-gates", default=",".join(SOFT))
    ap.add_argument("--thresholds", default="0.0,0.1,0.2,0.3,0.5")
    a = ap.parse_args()
    soft = [g for g in a.soft_gates.split(",") if g]
    train = parse(a.train)
    fit_rows = [r for r in train if r["_status"] in ("TARGET", "STOP")]
    feats = sorted({k[2:] for r in train for k in r if k.startswith("f_")})
    X = matrix(fit_rows, feats)
    mean, std = X.mean(axis=0), X.std(axis=0)
    keep = std > 1e-9
    feats = [f for f, k in zip(feats, keep) if k]
    X = (X[:, keep] - mean[keep]) / std[keep]
    y = np.array([1 if r["_status"] == "TARGET" else 0 for r in fit_rows])
    w, b = fit(X, y, a.l2)
    t0 = min(r["t"] for r in train)[:10]
    t1 = max(r["t"] for r in train)[:10]
    model = {"version": "meta-lr-1", "trained_on": f"{t0}..{t1} ({', '.join(sorted({r['_file'] for r in train}))})",
             "features": feats, "mean": mean[keep].tolist(), "std": std[keep].tolist(), "weights": w.tolist(), "bias": float(b),
             "min_expected_r": a.min_expected_r, "soft_gates": soft, "l2": a.l2, "n_train": int(len(fit_rows)),
             "label": "TP2 before stop (bracket from CE / decision quote), timeouts excluded"}
    print(f"train: {len(train)} candidates ({len(fit_rows)} resolved, hit rate {y.mean():.3f}), {len(feats)} features, {t0}..{t1}")
    top = sorted(zip(feats, w), key=lambda x: -abs(x[1]))[:12]
    print("  strongest standardised weights: " + ", ".join(f"{f} {v:+.2f}" for f, v in top))
    ths = [float(x) for x in a.thresholds.split(",")]
    print("in-sample:")
    report(train, model, ths, a.min_rr, soft)
    if a.test:
        print("OUT-OF-SAMPLE (" + ", ".join(os.path.basename(p) for p in a.test) + "):")
        report(parse(a.test), model, ths, a.min_rr, soft)
    if a.out:
        with open(a.out, "w") as f:
            json.dump(model, f, indent=1)
        print("model ->", a.out)


if __name__ == "__main__":
    main()

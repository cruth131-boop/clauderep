// v2.61-dev (item 5): meta-labeling model for setups that the rule gates rejected on a SOFT gate.
// Pure logic, no cTrader types. The model is a standardised logistic regression trained offline (tools/meta_train.py) on the
// META_CAND / META_OUT telemetry of backtests: p = P(structural TP2 is reached before the stop). The bot turns p into an
// expected R of the bracket (p * TP2_R - (1 - p)) and may take a soft-rejected setup when that expectation clears a threshold.
// The JSON is self-describing (feature order, standardisation, training window) and validated fail-closed at start.
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.Json;

namespace MetaLabel
{
    public sealed class MetaModel
    {
        public string Version = "";
        public string TrainedOn = "";
        public string[] Features = new string[0];
        public double[] Mean = new double[0], Std = new double[0], Weights = new double[0];
        public double Bias;
        public double MinExpectedR;
        public string[] SoftGates = new string[0];

        public static MetaModel Load(string path)
        {
            if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
                throw new InvalidOperationException("META: model file not found: " + path);
            using (JsonDocument doc = JsonDocument.Parse(File.ReadAllBytes(path)))
            {
                JsonElement r = doc.RootElement;
                var m = new MetaModel
                {
                    Version = Str(r, "version"),
                    TrainedOn = Str(r, "trained_on"),
                    Features = r.GetProperty("features").EnumerateArray().Select(x => x.GetString()).ToArray(),
                    Mean = Nums(r, "mean"),
                    Std = Nums(r, "std"),
                    Weights = Nums(r, "weights"),
                    Bias = r.GetProperty("bias").GetDouble(),
                    MinExpectedR = r.TryGetProperty("min_expected_r", out JsonElement e) ? e.GetDouble() : 0.2,
                    SoftGates = r.TryGetProperty("soft_gates", out JsonElement g) ? g.EnumerateArray().Select(x => x.GetString()).ToArray() : new string[0]
                };
                int n = m.Features.Length;
                if (n == 0 || m.Mean.Length != n || m.Std.Length != n || m.Weights.Length != n)
                    throw new InvalidOperationException("META: model dimensions inconsistent (features/mean/std/weights).");
                if (m.Std.Any(x => !(x > 0)) || m.Weights.Concat(m.Mean).Any(x => double.IsNaN(x) || double.IsInfinity(x)) || double.IsNaN(m.Bias))
                    throw new InvalidOperationException("META: model contains non-finite or zero-variance parameters.");
                return m;
            }
        }

        // Missing features count as the training mean (standardised 0).
        public double Probability(IDictionary<string, double> x)
        {
            double z = Bias;
            for (int k = 0; k < Features.Length; k++)
            {
                double v;
                if (!x.TryGetValue(Features[k], out v) || double.IsNaN(v) || double.IsInfinity(v)) continue;
                z += Weights[k] * (v - Mean[k]) / Std[k];
            }
            return 1.0 / (1.0 + Math.Exp(-Math.Max(-40, Math.Min(40, z))));
        }

        public static double ExpectedR(double p, double targetR) { return p * targetR - (1.0 - p); }

        private static string Str(JsonElement r, string k) { return r.TryGetProperty(k, out JsonElement v) && v.ValueKind == JsonValueKind.String ? v.GetString() : ""; }
        private static double[] Nums(JsonElement r, string k) { return r.GetProperty(k).EnumerateArray().Select(x => x.GetDouble()).ToArray(); }
    }

    // Bracket outcome of one candidate (market entry at the decision quote, plan stop, plan TP2), evaluated on bid M1 bars;
    // stop first when both are inside one bar (conservative); unresolved at the horizon = marked to market (censored).
    public sealed class BracketShadow
    {
        public string Id;
        public int Direction;
        public double Entry, Stop, Target, Spread;
        public DateTime StartUtc, HorizonUtc;
        public string Status = "PENDING";
        public double R;
        public DateTime EndUtc;
        private double _last;

        // Returns true once resolved. Bars must be passed in time order, only bars that opened at/after StartUtc.
        public bool OnBar(DateTime openUtc, double high, double low, double close)
        {
            if (Status != "PENDING") return true;
            double risk = Math.Abs(Entry - Stop);
            if (!(risk > 0)) { Status = "INVALID"; R = 0; EndUtc = openUtc; return true; }
            double exitHigh = Direction > 0 ? high : high + Spread, exitLow = Direction > 0 ? low : low + Spread;
            bool stopHit = Direction > 0 ? exitLow <= Stop : exitHigh >= Stop;
            bool targetHit = Direction > 0 ? exitHigh >= Target : exitLow <= Target;
            _last = Direction > 0 ? close : close + Spread;
            if (stopHit) { Status = "STOP"; R = -1; EndUtc = openUtc; return true; }
            if (targetHit) { Status = "TARGET"; R = Math.Abs(Target - Entry) / risk; EndUtc = openUtc; return true; }
            if (openUtc >= HorizonUtc) { Status = "TIMEOUT"; R = Direction * (_last - Entry) / risk; EndUtc = openUtc; return true; }
            return false;
        }

        public string Format()
        {
            return "META_OUT|id=" + Id + "|status=" + Status + "|r=" + R.ToString("0.####", CultureInfo.InvariantCulture) +
                   "|t_end=" + EndUtc.ToString("yyyy-MM-ddTHH:mm:ssZ", CultureInfo.InvariantCulture);
        }
    }
}

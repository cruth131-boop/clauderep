// Test-harness stand-ins for project files that were not part of the upload
// (candidate telemetry, funnel telemetry, live-news gate, NS pattern detector / entry geometry).
// They are NOT production code. Telemetry is reduced to a counter so the harness can report a funnel;
// the NS detector returns no patterns (all NS cores are OFF by default and are not tested here).
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using cAlgo.API;
using NewSetups;

namespace CandidateTelemetry
{
    public enum CandidateTerminalStage { Filled, Deduped, Invalidated, FormationRejected }
}

namespace NewSetups
{
    public sealed class Bar
    {
        public int Index; public DateTime OpenUtc; public double Open, High, Low, Close, Atr;
    }

    public sealed class Pattern
    {
        public string Core, Id;
        public int Direction, StartIndex, BreakIndex, DeadlineIndex, SourceIndex = -1, MssPivotIndex = -1;
        public DateTime BreakUtc, MssPivotConfirmedUtc;
        public double ImpulseLow, ImpulseHigh, InvalidExtreme, BlockLow, BlockHigh;
        public int[] Anchors;
        public DateTime[] AnchorOpenUtc, AnchorConfirmedUtc;
    }

    public static class Patterns
    {
        public static IEnumerable<Pattern> Detect(List<Bar> bars, int minutes, int direction, double tick, double minSweepPrice, double minSweepAtr, double mssBuffer)
        { return Enumerable.Empty<Pattern>(); }
    }

    public static class EntryGeometry
    {
        public static bool Contains(double price, double low, double high) { return price >= low - 1e-9 && price <= high + 1e-9; }
        public static double StopTick(double stop, int direction, double tick)
        { return direction > 0 ? Math.Floor(stop / tick + 1e-9) * tick : Math.Ceiling(stop / tick - 1e-9) * tick; }
        public static double FillRatio(int direction, double low, double high, double barLow, double barHigh)
        {
            double w = high - low; if (!(w > 0)) return double.NaN;
            return direction > 0 ? Math.Max(0, Math.Min(1, (high - Math.Max(low, barLow)) / w)) : Math.Max(0, Math.Min(1, (Math.Min(high, barHigh) - low) / w));
        }
        public static bool Clip(int direction, double low, double high, double impLow, double impHigh, double blockLow, double blockHigh,
            bool ote, double tick, out double outLow, out double outHigh)
        {
            outLow = Math.Max(low, impLow); outHigh = Math.Min(high, impHigh);
            if (ote && impHigh > impLow)
            {
                double r = impHigh - impLow;
                double a = direction > 0 ? impHigh - 0.79 * r : impLow + 0.62 * r, b = direction > 0 ? impHigh - 0.62 * r : impLow + 0.79 * r;
                outLow = Math.Max(outLow, a); outHigh = Math.Min(outHigh, b);
            }
            return outHigh - outLow >= tick - 1e-12;
        }
    }
}

namespace FailSafe
{
    public sealed class NewsWindows { public int HighBefore, HighAfter, MediumBefore, MediumAfter, CloseBefore, MaxAgeMinutes; public bool BlockMedium; }
    public sealed class LiveNewsSnapshot
    {
        public List<NewsItem> Events = new List<NewsItem>();
        public DateTime CoverageStartUtc, CoverageEndUtc, SourceAsOfUtc;
        public string Generation = "", Sha256 = "";
        public List<DateTime> BlockedDays = new List<DateTime>();
    }
    public sealed class LiveNewsFeed
    {
        public LiveNewsFeed(string path, ISet<string> currencies) { }
        public LiveNewsSnapshot Current { get { return null; } }
        public string Fault { get { return "harness: live news not available"; } }
    }
    public sealed class LiveNewsGate
    {
        public LiveNewsGate(LiveNewsFeed feed) { Feed = feed; }
        public LiveNewsFeed Feed { get; private set; }
        public LiveNewsSnapshot Refresh(DateTime now, bool force) { return null; }
        public string Check(DateTime now, NewsWindows w) { return "harness: live news not available"; }
    }
    public static class PositionNews
    {
        public static NewsItem NextCloseEvent(IEnumerable<NewsItem> events, DateTime utc, int closeBeforeMinutes)
        {
            return events.Where(e => e.Impact >= 3 && e.TimeUtc >= utc && e.TimeUtc <= utc.AddMinutes(closeBeforeMinutes)).OrderBy(e => e.TimeUtc).FirstOrDefault();
        }
    }
}

namespace cAlgo.Robots
{
    public partial class IctGoldV259Dev
    {
        private readonly Dictionary<string, int> _harnessFunnel = new Dictionary<string, int>(StringComparer.Ordinal);
        public IReadOnlyDictionary<string, int> HarnessFunnel { get { return _harnessFunnel; } }
        private void HarnessCount(string key) { int n; _harnessFunnel.TryGetValue(key, out n); _harnessFunnel[key] = n + 1; }

        // ---- funnel telemetry (counter only)
        private void NsF(string module, string key) { HarnessCount(module + "|" + key); }
        private void NsFE(string module, string key, string detail) { HarnessCount(module + "|" + key); }
        private T NsRej<T>(string module, string reason) where T : class { HarnessCount(module + "|rej:" + reason); return null; }
        private bool NsRejB(string module, string reason) { HarnessCount(module + "|rej:" + reason); return false; }
        private string NsMod(SetupState s) { return s == null ? "?" : s.NsNew ? (s.NsCore ?? "NS") : s.NsOte ? "OTE" : "PARENT"; }
        private string NsModP(Pattern p) { return p == null ? "?" : p.Core ?? "?"; }
        private static string Fi(double v) { return v.ToString("0.#####", CultureInfo.InvariantCulture); }
        private void NsFunnelSummary() { }

        // ---- candidate telemetry (no-op observer)
        private void CandInitialize() { }
        private void CandAdvanceShadows(bool force) { }
        private void CandObserveShadowDetectors(int i, DateTime t) { }
        private void CandReset(SetupState s, int line) { }
        private void CandOnStop() { }
        private void CandEnsureState(SetupState s, DateTime t) { }
        private void CandEnd(SetupState s, DateTime t, CandidateTelemetry.CandidateTerminalStage stage, string why) { }
        private void CandEndById(string id, DateTime t, CandidateTelemetry.CandidateTerminalStage stage, string why) { }
        private string CandBeginPattern(Pattern p, DateTime t) { return ""; }
        private void CandBind(SetupState s, string id, DateTime t) { }
        private void CandCaptureGeometry(SetupState s, DateTime t, double entry, double stop, double tp1, double rr, double volume = double.NaN) { }
    }
}

// Test-harness stand-in for the one project file that is still not part of the upload: the NS funnel telemetry
// (NsF / NsFE / NsRej / NsRejB / NsMod / NsModP / Fi / NsFunnelSummary). It is NOT production code; telemetry is
// reduced to a counter so the harness can report a funnel. All other partial files are the real project files.
using System;
using System.Collections.Generic;
using System.Globalization;
using NewSetups;

namespace cAlgo.Robots
{
    public partial class IctGoldV259Dev
    {
        private readonly Dictionary<string, int> _harnessFunnel = new Dictionary<string, int>(StringComparer.Ordinal);
        public IReadOnlyDictionary<string, int> HarnessFunnel { get { return _harnessFunnel; } }
        private void HarnessCount(string key) { int n; _harnessFunnel.TryGetValue(key, out n); _harnessFunnel[key] = n + 1; }

        private void NsF(string module, string key) { HarnessCount(module + "|" + key); }
        private void NsFE(string module, string key, string detail) { HarnessCount(module + "|" + key); }
        private T NsRej<T>(string module, string reason) where T : class { HarnessCount(module + "|rej:" + reason); return null; }
        private bool NsRejB(string module, string reason) { HarnessCount(module + "|rej:" + reason); return false; }
        private string NsMod(SetupState s) { return s == null ? "?" : s.NsNew ? (s.NsCore ?? "NS") : s.NsOte ? "OTE" : "PARENT"; }
        private string NsModP(Pattern p) { return p == null ? "?" : p.Core ?? "?"; }
        private static string Fi(double v) { return v.ToString("0.#####", CultureInfo.InvariantCulture); }
        private void NsFunnelSummary() { }
    }
}

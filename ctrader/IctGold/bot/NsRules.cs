using System;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace NewSetups
{
    // v2.48-dev: pure decision rules (no cTrader types) so tests/ns48 compiles and executes exactly this file.
    // The bot (Ns.cs, main file) calls these; it must not re-implement them.
    public static class NsRules
    {
        // ---- history gap tolerance -------------------------------------------------------------------
        // DEV DURATION HEURISTIC, not calendar validation: a gap between two consecutive bars is tolerated when
        // the missing span is >= 55 min (daily break is 60) and <= 96 h. 96 h covers a Good-Friday-close ->
        // Sunday-reopen holiday weekend (72 h was exceeded at Easter 2025/2026, which silently re-blocked
        // trading for days). Any hole of that length mid-session is accepted too; a lost few minutes of ticks
        // (<55 min) and longer outages (>96 h) still fail closed. No strategy threshold depends on this.
        public static readonly TimeSpan MinMissing = TimeSpan.FromMinutes(55);
        public static readonly TimeSpan MaxMissing = TimeSpan.FromHours(96);
        public static bool GapTolerated(TimeSpan gap, int minutes)
        {
            TimeSpan tf = TimeSpan.FromMinutes(minutes);
            if (gap == tf) return true;
            if (gap <= tf) return false;
            TimeSpan missing = gap - tf;
            return missing >= MinMissing && missing <= MaxMissing;
        }

        // ---- Parent gate scope -------------------------------------------------------------------------
        // The NS history gate protects NS-core requests only. A Parent order (or any non-NS setup) must stay
        // byte-identical to the all-OFF bot as long as the NS module itself does not trade.
        public static bool HistoryGateApplies(bool anyNsFlag, bool setupIsNsCore)
        {
            return anyNsFlag && setupIsNsCore;
        }

        // ---- context (trend) rule ----------------------------------------------------------------------
        // Returns "ok" or the reject reason. Strings are the funnel keys already used since v2.46 (OFF/other
        // cores keep the exact H1 + M15 contract). K01 with NsJudasH1OnlyContext: H1 trend must equal d, the
        // M15 trend is diagnostic only (never a veto). History/closed-bar requirements are unchanged.
        public static string ContextWhy(string core, bool judasH1Only, int d, bool enoughHistory, bool historyValid,
            int h1Trend, int m15Trend)
        {
            if (!enoughHistory) return "short_history";
            if (!historyValid) return "history_invalid";
            bool h1Only = judasH1Only && core == "K01";
            if (h1Only) return h1Trend == d ? "ok" : "h1_trend=" + h1Trend + "_misaligned";
            if (h1Trend != d && m15Trend != d) return "h1_trend=" + h1Trend + "_m15_trend=" + m15Trend + "_both_misaligned";
            if (h1Trend != d) return "h1_trend=" + h1Trend + "_misaligned";
            if (m15Trend != d) return "m15_trend=" + m15Trend + "_misaligned";
            return "ok";
        }
        public static bool ContextOk(string core, bool judasH1Only, int d, bool enoughHistory, bool historyValid,
            int h1Trend, int m15Trend)
        {
            return ContextWhy(core, judasH1Only, d, enoughHistory, historyValid, h1Trend, m15Trend) == "ok";
        }
        // True when the H1-only switch let a candidate pass that the legacy H1+M15 rule would have vetoed.
        public static bool H1OnlyOverrodeM15(string core, bool judasH1Only, int d, int h1Trend, int m15Trend)
        {
            return judasH1Only && core == "K01" && h1Trend == d && m15Trend != d;
        }

        // ---- K04 pre-touch deadline --------------------------------------------------------------------
        // Mitigation with NsMitigationPatternRetestDeadline: before the first touch only the pattern deadline
        // (M15 break index + 8 closed M15 bars; the deadline bar itself is allowed, '>' is terminal) applies;
        // the extra exec deadline (eventStart + Scale(12) M2 bars) is not set. Duration of 8 M15 steps is 120 min
        // only over continuous bars, NOT a wall-clock limit across trading pauses (operational assumption).
        public static bool PatternOnlyPreTouch(string core, bool mitigationPatternDeadline)
        {
            return core == "K04" && mitigationPatternDeadline;
        }
        public static int InitialExecDeadline(bool patternOnlyPreTouch, int eventStart, int scaled12)
        {
            return patternOnlyPreTouch ? int.MaxValue : eventStart + scaled12;
        }
        // First valid touch: the short touch->confirmation window starts now; it can only shorten, never extend.
        public static int TouchDeadline(int currentExecDeadline, int touchIndex, int scaled5)
        {
            long cand = (long)touchIndex + scaled5;
            return (int)Math.Min((long)currentExecDeadline, cand);
        }
        // Returns null while alive, else the terminal reason (order: exec, then pattern).
        public static string DeadlineReason(int i, int execDeadline, int patternIndex, int patternDeadline)
        {
            if (i > execDeadline) return "deadline_exec";
            if (patternIndex > patternDeadline) return "deadline_pattern";
            return null;
        }

        // ---- source-timeframe zone ATR ----------------------------------------------------------------
        // NsSourceTfZoneAtr ON (default since v2.48): non-K01 zone width is normalised by the ATR of the block's
        // own timeframe. An invalid source ATR is a reject, NOT a silent fallback to the M2 execution ATR.
        // Returns: 1 = use source ATR, 0 = use M2 execution ATR (switch OFF or K01), -1 = reject.
        public static int ZoneAtrMode(bool sourceTfZoneAtr, string core, double sourceTfAtr)
        {
            if (!sourceTfZoneAtr || core == "K01") return 0;
            return (!double.IsNaN(sourceTfAtr) && !double.IsInfinity(sourceTfAtr) && sourceTfAtr > 0) ? 1 : -1;
        }

        // ---- lane attribution in the order comment -----------------------------------------------------
        // <ownerMarker>core=<Parent|K01|K03|K04|K05>|NS-2|policy=<OTE|NONE>|cid=<10 hex>   (NS trades)
        // <ownerMarker>core=Parent                                                           (Parent trades)
        // ownerMarker is the restart-ownership prefix ("G3|<version>|<instance>|"); ownership detection is
        // StartsWith(ownerMarker) and is not affected. The lane comes first so truncation never loses it.
        public static string LaneComment(string ownerMarker, string core, bool isNs, bool ote, string candidateId)
        {
            if (!isNs) return ownerMarker + "core=Parent";
            return ownerMarker + "core=" + core + "|NS-2|policy=" + (ote ? "OTE" : "NONE") + "|cid=" + ShortId(candidateId);
        }
        public static string ShortId(string id)
        {
            using (var sha = SHA1.Create())
            {
                byte[] h = sha.ComputeHash(Encoding.UTF8.GetBytes(id ?? ""));
                var sb = new StringBuilder();
                for (int k = 0; k < 5; k++) sb.Append(h[k].ToString("x2", CultureInfo.InvariantCulture));
                return sb.ToString();
            }
        }
        // Extracts the lane (Parent/K01/K03/K04/K05) from an order/position comment; null when absent.
        public static string LaneOf(string comment)
        {
            if (string.IsNullOrEmpty(comment)) return null;
            int at = comment.IndexOf("core=", StringComparison.Ordinal);
            if (at < 0) return null;
            int s = at + 5, e = s;
            while (e < comment.Length && comment[e] != '|') e++;
            string lane = comment.Substring(s, e - s);
            return lane.Length > 0 ? lane : null;
        }
    }
}

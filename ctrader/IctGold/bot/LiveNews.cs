using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

// v2.54-dev live news from the local MQL5 generation (Option A, artifacts/dev-v247/LIVE_NEWS_SOURCE.md).
// Pure logic, NO cTrader API types (compiled by the offline test project and by the bot).
//
// Contract:
//  * The CSV path points into the "current" symlink. It is resolved on EVERY reload; CSV + manifest are always
//    read from that ONE resolved generation directory (never one file from each of two generations).
//  * Integrity/schema/timezone/hash/future-timestamp defects -> Fault (entries blocked immediately, even if an older
//    valid generation exists). Transport defects (directory unreadable) keep the last valid generation, but only
//    until the stale/coverage limits; the age is always measured from the snapshot's own source_as_of_utc, so a
//    reload can never make data younger.
//  * USD/HIGH rows with time_status TENTATIVE/ALL_DAY (regardless of "enabled") block their whole UTC day.
namespace FailSafe
{
    public sealed class LiveNewsSnapshot
    {
        public string Generation;                 // resolved generation directory
        public string Sha256;
        public DateTime SourceAsOfUtc, CoverageStartUtc, CoverageEndUtc;
        public List<NewsItem> Events = new List<NewsItem>();      // EXACT + enabled + currency filter + impact >= 1
        public HashSet<DateTime> BlockedDays = new HashSet<DateTime>(); // UTC dates of TENTATIVE/ALL_DAY HIGH events
        public int RowCount;
    }

    public sealed class LiveNewsIntegrityException : Exception { public LiveNewsIntegrityException(string m) : base(m) { } }
    public sealed class LiveNewsTransportException : Exception { public LiveNewsTransportException(string m) : base(m) { } }

    public sealed class NewsWindows
    {
        public int HighBefore, HighAfter, MediumBefore, MediumAfter, CloseBefore, MaxAgeMinutes;
        public bool BlockMedium;
        public int Lead { get { return Math.Max(Math.Max(HighBefore, MediumBefore), CloseBefore); } }
        public int Lag { get { return Math.Max(HighAfter, MediumAfter); } }
    }

    // v2.54-dev (V52-2): the selection ManageNewsRisk uses for open positions (HIGH event within CloseHighNewsMinutesBefore of the PUBLISHED list).
    // It reads only the published events: a later feed fault/generation change neither adds nor removes anything here (no fault close policy).
    public static class PositionNews
    {
        public static NewsItem NextCloseEvent(IEnumerable<NewsItem> published, DateTime utc, int closeMinutesBefore)
        {
            if (closeMinutesBefore <= 0) return null;
            NewsItem best = null;
            foreach (NewsItem x in published)
                if (x.Impact >= 3 && x.TimeUtc >= utc && x.TimeUtc <= utc.AddMinutes(closeMinutesBefore) && (best == null || x.TimeUtc < best.TimeUtc)) best = x;
            return best;
        }
    }

    // v2.54-dev (F1): the ONE refresh/publication path used by tick, entry and pre-order guards. "Published" is the snapshot
    // the bot actually uses (events, coverage); publication is judged from the feed's CURRENT snapshot object, never from Poll's
    // transient "changed" return, so a poll made by any caller can no longer consume the change signal.
    public sealed class LiveNewsGate
    {
        public readonly LiveNewsFeed Feed;
        public LiveNewsSnapshot Published { get; private set; }
        public int Publications { get; private set; }
        public LiveNewsGate(LiveNewsFeed feed) { Feed = feed; }

        // Returns the snapshot when a new one was published by this call, otherwise null.
        public LiveNewsSnapshot Refresh(DateTime nowUtc, bool force)
        {
            Feed.Poll(nowUtc, force);
            LiveNewsSnapshot c = Feed.Current;
            if (c == null || ReferenceEquals(c, Published)) return null;
            // A re-read of identical content (same generation, hash and coverage) only refreshes freshness (source_as_of_utc is read
            // from Feed.Current by the caller); it carries no new events, so nothing is re-published.
            LiveNewsSnapshot p = Published;
            if (p != null && p.Generation == c.Generation && p.Sha256 == c.Sha256 && p.CoverageStartUtc == c.CoverageStartUtc && p.CoverageEndUtc == c.CoverageEndUtc)
            { Published = c; return null; }
            Published = c; Publications++;
            return c;
        }

        // Health + EXACT event windows of the published snapshot. null = entries permitted.
        public string Check(DateTime nowUtc, NewsWindows w)
        {
            if (!ReferenceEquals(Feed.Current, Published)) return "news snapshot not published";
            return Feed.Check(nowUtc, w.Lead, w.Lag, w.MaxAgeMinutes) ?? Feed.CheckEvents(nowUtc, w);
        }
    }

    public sealed class LiveNewsFeed
    {
        public const int MaxAgeMinutes = 720;
        public const int ReloadSeconds = 60;
        public const int FutureToleranceMinutes = 0;
        public const string CsvName = "news-calendar.csv";
        public const string ManifestName = "news-calendar.manifest.json";

        public static readonly string[] Columns =
        {
            "schema_version", "event_id", "event_time_local", "timezone_id", "utc_offset", "event_time_utc", "time_status",
            "currency", "impact", "title", "enabled", "source_provider", "source_event_id", "source_url", "source_retrieved_utc",
            "revision", "notes"
        };

        private readonly string _csvPath;
        private readonly ISet<string> _currencies;
        private DateTime _lastPollUtc = DateTime.MinValue;

        public LiveNewsSnapshot Current { get; private set; }
        public string Fault { get; private set; }          // integrity fault of the latest reload (null = none)
        public string Transport { get; private set; }      // transport problem of the latest reload (null = none)
        public int Loads { get; private set; }             // number of successful (accepted) loads
        public int GenerationChanges { get; private set; }

        public LiveNewsFeed(string csvPath, ISet<string> currencies)
        {
            if (string.IsNullOrWhiteSpace(csvPath)) throw new InvalidOperationException("NEWS live: News Calendar Path must not be empty.");
            if (!string.Equals(Path.GetFileName(csvPath.Trim()), CsvName, StringComparison.Ordinal))
                throw new InvalidOperationException("NEWS live: News Calendar Path must end in " + CsvName + ".");
            _csvPath = Path.GetFullPath(csvPath.Trim());
            _currencies = currencies ?? new HashSet<string>();
        }

        // Re-reads the generation if the throttle (60 s) elapsed. Returns true when the accepted snapshot changed.
        public bool Poll(DateTime nowUtc, bool force)
        {
            if (!force && _lastPollUtc != DateTime.MinValue && nowUtc >= _lastPollUtc && nowUtc < _lastPollUtc.AddSeconds(ReloadSeconds)) return false;
            _lastPollUtc = nowUtc;
            try
            {
                LiveNewsSnapshot s = Load(nowUtc);
                if (Current != null && s.SourceAsOfUtc < Current.SourceAsOfUtc)
                    throw new LiveNewsIntegrityException("generation regression: source_as_of_utc " + Fmt(s.SourceAsOfUtc) + " is older than the loaded " + Fmt(Current.SourceAsOfUtc));
                bool changed = Current == null || !string.Equals(Current.Generation, s.Generation, StringComparison.Ordinal) || Current.Sha256 != s.Sha256;
                if (changed && Current != null) GenerationChanges++;
                Current = s; Fault = null; Transport = null; Loads++;
                return changed;
            }
            catch (LiveNewsIntegrityException ex) { Fault = ex.Message; return false; }
            catch (LiveNewsTransportException ex) { Transport = ex.Message; return false; }
            catch (Exception ex) when (ex is IOException || ex is UnauthorizedAccessException) { Transport = ex.GetType().Name + ": " + ex.Message; return false; }
        }

        // null = entries are permitted. beforeMin is future look-ahead; afterMin is the past-event window.
        public string Check(DateTime nowUtc, int beforeMin, int afterMin, int maxAgeMinutes)
        {
            if (Fault != null) return "news feed integrity fault: " + Fault;
            LiveNewsSnapshot s = Current;
            if (s == null) return "news data unavailable" + (Transport != null ? " (" + Transport + ")" : "");
            if (s.SourceAsOfUtc > nowUtc.AddMinutes(FutureToleranceMinutes)) return "news source timestamp in the future";
            double age = (nowUtc - s.SourceAsOfUtc).TotalMinutes;
            if (age >= Math.Min(maxAgeMinutes <= 0 ? MaxAgeMinutes : maxAgeMinutes, MaxAgeMinutes)) return "news data stale (" + ((int)age) + " min since source_as_of_utc)";
            DateTime r0 = nowUtc.AddMinutes(-Math.Max(0, afterMin)), r1 = nowUtc.AddMinutes(Math.Max(0, beforeMin));
            if (r0 < s.CoverageStartUtc || r1 > s.CoverageEndUtc)
                return "news calendar coverage " + Fmt(s.CoverageStartUtc) + ".." + Fmt(s.CoverageEndUtc) + " does not cover " + Fmt(r0) + ".." + Fmt(r1);
            for (DateTime day = r0.Date; day <= r1.Date; day = day.AddDays(1))
                if (s.BlockedDays.Contains(day))
                    return "news USD/HIGH tentative or all-day event on this UTC day";
            return null;
        }

        // v2.54-dev (F1): EXACT HIGH / enabled MEDIUM event windows of the CURRENT snapshot (same arithmetic as the bot's IsNewsBlocked).
        public string CheckEvents(DateTime nowUtc, NewsWindows w)
        {
            LiveNewsSnapshot s = Current;
            if (s == null) return "news data unavailable";
            foreach (NewsItem e in s.Events)
            {
                if (e.Impact < 2) continue;
                if (e.Impact == 2 && !w.BlockMedium) continue;
                int before = e.Impact >= 3 ? w.HighBefore : w.MediumBefore, after = e.Impact >= 3 ? w.HighAfter : w.MediumAfter;
                if (nowUtc >= e.TimeUtc.AddMinutes(-before) && nowUtc <= e.TimeUtc.AddMinutes(after)) return "news " + e.Currency + " " + e.Title;
            }
            return null;
        }

        // ------------------------------------------------------------------ load
        private static string Fmt(DateTime t) { return t.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture); }

        private string ResolveGenerationDir()
        {
            string dir = Path.GetDirectoryName(_csvPath);
            var di = new DirectoryInfo(dir);
            if (!di.Exists) throw new LiveNewsTransportException("news directory not found: " + dir);
            FileSystemInfo target = di.ResolveLinkTarget(true);
            string full = target != null ? target.FullName : di.FullName;
            if (!Directory.Exists(full)) throw new LiveNewsTransportException("news generation directory not found: " + full);
            return full;
        }

        private LiveNewsSnapshot Load(DateTime nowUtc)
        {
            string gdir = ResolveGenerationDir();
            string csvFile = Path.Combine(gdir, CsvName), manFile = Path.Combine(gdir, ManifestName);
            if (!File.Exists(csvFile)) throw new LiveNewsIntegrityException("generation lacks " + CsvName + ": " + gdir);
            if (!File.Exists(manFile)) throw new LiveNewsIntegrityException("generation lacks " + ManifestName + ": " + gdir);
            byte[] csv = File.ReadAllBytes(csvFile);
            byte[] man = File.ReadAllBytes(manFile);

            // v2.54-dev (F3): the parsed document is disposed on every path; all manifest validation and the CSV
            // parse happen inside the using scope, nothing escapes it except the plain snapshot object.
            JsonDocument doc;
            try { doc = JsonDocument.Parse(man); }
            catch (JsonException ex) { throw new LiveNewsIntegrityException("manifest is not valid JSON: " + ex.Message); }
            using (doc)
                return LoadFromManifest(doc.RootElement, csv, gdir, nowUtc);
        }

        private LiveNewsSnapshot LoadFromManifest(JsonElement m, byte[] csv, string gdir, DateTime nowUtc)
        {
            if (m.ValueKind != JsonValueKind.Object) throw new LiveNewsIntegrityException("manifest is not a JSON object");

            if (Str(m, "schema_version") != "1.0") throw new LiveNewsIntegrityException("manifest schema_version must be 1.0");
            if (Str(m, "validation_status") != "VALID") throw new LiveNewsIntegrityException("manifest validation_status must be VALID");
            if (Str(m, "source_provider") != "mql5") throw new LiveNewsIntegrityException("manifest source_provider must be mql5");
            string expected = Str(m, "calendar_sha256");
            if (expected == null || expected.Length != 64 || expected.Any(c => !Uri.IsHexDigit(c))) throw new LiveNewsIntegrityException("manifest calendar_sha256 missing or malformed");
            string actual;
            using (SHA256 sha = SHA256.Create())
                actual = string.Concat(sha.ComputeHash(csv).Select(b => b.ToString("x2", CultureInfo.InvariantCulture)));
            if (!string.Equals(actual, expected.ToLowerInvariant(), StringComparison.Ordinal))
                throw new LiveNewsIntegrityException("CSV/manifest pair inconsistent: hash mismatch (manifest " + expected + ", file " + actual + ")");
            JsonElement bytes;
            if (!m.TryGetProperty("calendar_bytes", out bytes) || bytes.ValueKind != JsonValueKind.Number || !bytes.TryGetInt64(out long nb) || nb != csv.LongLength)
                throw new LiveNewsIntegrityException("manifest calendar_bytes missing or not equal to the CSV size");

            DateTime asOf = Utc(m, "source_as_of_utc"), c0 = Utc(m, "coverage_start_utc"), c1 = Utc(m, "coverage_end_utc");
            if (c1 <= c0) throw new LiveNewsIntegrityException("manifest coverage window empty or inverted");
            if (asOf > nowUtc.AddMinutes(FutureToleranceMinutes)) throw new LiveNewsIntegrityException("source_as_of_utc " + Fmt(asOf) + " lies in the future");
            if (c0 > asOf) throw new LiveNewsIntegrityException("coverage_start_utc after source_as_of_utc");
            JsonElement rc;
            if (!m.TryGetProperty("row_count", out rc) || rc.ValueKind != JsonValueKind.Number || !rc.TryGetInt32(out int rowCount))
                throw new LiveNewsIntegrityException("manifest row_count missing");
            bool emptyOk = m.TryGetProperty("empty_coverage_confirmed", out JsonElement ec) && ec.ValueKind == JsonValueKind.True;

            LiveNewsSnapshot s = ParseCsv(Encoding.UTF8.GetString(csv), nowUtc, asOf, rowCount);
            if (s.Events.Count == 0 && s.BlockedDays.Count == 0 && !emptyOk)
                throw new LiveNewsIntegrityException("calendar yields no blocking events and empty_coverage_confirmed is not set");
            s.Generation = gdir; s.Sha256 = actual; s.SourceAsOfUtc = asOf; s.CoverageStartUtc = c0; s.CoverageEndUtc = c1;
            s.Events.Sort((a, b) => a.TimeUtc.CompareTo(b.TimeUtc));
            return s;
        }

        private static string Str(JsonElement o, string key)
        {
            JsonElement v;
            return o.TryGetProperty(key, out v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
        }

        private static DateTime Utc(JsonElement o, string key)
        {
            string raw = Str(o, key); DateTime t;
            if (string.IsNullOrEmpty(raw) || !DateTime.TryParseExact(raw, "yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out t))
                throw new LiveNewsIntegrityException("manifest " + key + " missing or not strict UTC (yyyy-MM-ddTHH:mm:ssZ)");
            return t;
        }

        // Every row is validated BEFORE any filtering; one defective row rejects the whole generation.
        private LiveNewsSnapshot ParseCsv(string text, DateTime nowUtc, DateTime sourceAsOfUtc, int manifestRows)
        {
            List<List<string>> recs = Records(text);
            if (recs.Count == 0) throw new LiveNewsIntegrityException("CSV empty");
            if (!recs[0].SequenceEqual(Columns)) throw new LiveNewsIntegrityException("CSV header does not match the schema 1.0 contract");
            var s = new LiveNewsSnapshot();
            var ids = new HashSet<string>(StringComparer.Ordinal);
            var sourceIds = new HashSet<string>(StringComparer.Ordinal);
            var naturalKeys = new Dictionary<string, string>(StringComparer.Ordinal);
            int[] required = { 0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15 };   // v2.54-dev (F2): source_event_id is mandatory
            for (int i = 1; i < recs.Count; i++)
            {
                List<string> r = recs[i]; string at = "CSV row " + (i + 1) + " ";
                if (r.Count != Columns.Length) throw new LiveNewsIntegrityException(at + "has " + r.Count + " columns, expected " + Columns.Length);
                foreach (int column in required)
                    if (string.IsNullOrWhiteSpace(r[column])) throw new LiveNewsIntegrityException(at + "required field " + Columns[column] + " is empty");
                if (r[0] != "1.0") throw new LiveNewsIntegrityException(at + "schema_version must be 1.0");
                if (!ids.Add(r[1])) throw new LiveNewsIntegrityException(at + "event_id duplicated");
                if (r[3] != "Etc/UTC") throw new LiveNewsIntegrityException(at + "timezone_id must be Etc/UTC (no local time zone assumption)");
                if (r[4] != "+00:00") throw new LiveNewsIntegrityException(at + "utc_offset must be +00:00");
                DateTime utc, local;
                if (!DateTime.TryParseExact(r[5], "yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out utc))
                    throw new LiveNewsIntegrityException(at + "event_time_utc is not strict UTC with Z");
                if (!DateTime.TryParseExact(r[2], "yyyy-MM-dd'T'HH:mm:ss", CultureInfo.InvariantCulture, DateTimeStyles.None, out local) || local != utc)
                    throw new LiveNewsIntegrityException(at + "event_time_local inconsistent with event_time_utc under Etc/UTC +00:00");
                string status = r[6];
                if (status != "EXACT" && status != "TENTATIVE" && status != "ALL_DAY" && status != "CANCELLED") throw new LiveNewsIntegrityException(at + "unknown time_status");
                string cur = r[7];
                if (cur.Length != 3 || cur.Any(c => c < 'A' || c > 'Z')) throw new LiveNewsIntegrityException(at + "currency must be 3 upper-case letters");
                string impact = r[8];
                if (impact != "HIGH" && impact != "MEDIUM" && impact != "LOW" && impact != "HOLIDAY" && impact != "UNKNOWN")
                    throw new LiveNewsIntegrityException(at + "unknown impact label");
                if (r[10] != "true" && r[10] != "false") throw new LiveNewsIntegrityException(at + "enabled must be true/false");
                if (r[11] != "mql5") throw new LiveNewsIntegrityException(at + "source_provider must be mql5");
                // v2.54-dev (F2): every row (also irrelevant/disabled ones) needs a canonical ASCII-numeric MQL5 id bound to event_id.
                if (r[12].Length == 0 || r[12].Any(c => c < '0' || c > '9')) throw new LiveNewsIntegrityException(at + "source_event_id must be a non-empty ASCII number");
                if (!sourceIds.Add(r[12])) throw new LiveNewsIntegrityException(at + "source_event_id duplicated");
                if (r[1] != "mql5:" + r[12]) throw new LiveNewsIntegrityException(at + "event_id does not match source_event_id");
                if (!r[15].All(char.IsDigit)) throw new LiveNewsIntegrityException(at + "revision must be a non-negative integer");
                DateTime ret;
                if (!DateTime.TryParseExact(r[14], "yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out ret))
                    throw new LiveNewsIntegrityException(at + "source_retrieved_utc is not strict UTC with Z");
                if (ret > nowUtc.AddMinutes(FutureToleranceMinutes)) throw new LiveNewsIntegrityException(at + "source_retrieved_utc lies in the future");
                if (ret > sourceAsOfUtc) throw new LiveNewsIntegrityException(at + "source_retrieved_utc is later than manifest source_as_of_utc");
                string natural = r[5] + "\u001f" + cur + "\u001f" + r[9].Trim().ToUpperInvariant();
                if (naturalKeys.TryGetValue(natural, out string owner) && owner != r[1])
                    throw new LiveNewsIntegrityException(at + "different event_ids share one natural event key");
                naturalKeys[natural] = r[1];

                if (_currencies.Count > 0 && !_currencies.Contains(cur)) continue;
                int level = NewsFeedValidator.ImpactLevel(impact);
                if (level <= 0) continue;
                if (status == "TENTATIVE" || status == "ALL_DAY")
                {
                    // exact time unknown: the whole UTC day is closed for entries (HIGH only), whatever "enabled" says
                    if (level >= 3) s.BlockedDays.Add(utc.Date);
                    continue;
                }
                if (status == "CANCELLED" || r[10] != "true") continue;
                s.Events.Add(new NewsItem { Title = r[9], Currency = cur, Impact = level, TimeUtc = utc });
            }
            s.RowCount = recs.Count - 1;
            if (s.RowCount != manifestRows) throw new LiveNewsIntegrityException("CSV has " + s.RowCount + " rows, manifest row_count " + manifestRows);
            return s;
        }

        // RFC-4180-style records (quotes, doubled quotes, embedded separators/newlines). Trailing blank line tolerated.
        private static List<List<string>> Records(string text)
        {
            var recs = new List<List<string>>(); var row = new List<string>(); var cur = new StringBuilder();
            bool q = false, any = false;
            for (int i = 0; i < text.Length; i++)
            {
                char c = text[i];
                if (q)
                {
                    if (c == '"') { if (i + 1 < text.Length && text[i + 1] == '"') { cur.Append('"'); i++; } else q = false; }
                    else cur.Append(c);
                    continue;
                }
                if (c == '"') { q = true; any = true; continue; }
                if (c == ',') { row.Add(cur.ToString()); cur.Length = 0; any = true; continue; }
                if (c == '\r') continue;
                if (c == '\n')
                {
                    if (any || cur.Length > 0) { row.Add(cur.ToString()); recs.Add(row); }
                    row = new List<string>(); cur.Length = 0; any = false; continue;
                }
                cur.Append(c); any = true;
            }
            if (q) throw new LiveNewsIntegrityException("CSV has an unterminated quoted field");
            if (any || cur.Length > 0) { row.Add(cur.ToString()); recs.Add(row); }
            return recs;
        }
    }
}

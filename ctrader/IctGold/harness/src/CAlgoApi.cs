// Minimal offline re-implementation of the cTrader Automate API surface used by the ICT Gold cBot,
// plus a deterministic tick engine. Test harness only: it is NOT the cTrader backtester.
// Fills: market orders at the current Bid/Ask; SL/TP at their exact price (the synthetic ticks are
// minute extremes, the real path passes the level), at the tick price after a gap > 5 min.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace cAlgo.API.Internals { internal static class InternalsPlaceholder { } }

namespace cAlgo.API
{
    public enum TimeZones { UTC }
    public enum AccessRights { None, FullAccess }
    public enum RunningMode { RealTime, SilentBacktesting, VisualBacktesting, Optimization }
    public enum TradeType { Buy, Sell }
    public enum RoundingMode { ToNearest, Down, Up }
    public enum ProtectionType { None, Relative, Absolute }
    public enum VerticalAlignment { Top, Center, Bottom }
    public enum HorizontalAlignment { Left, Center, Right }
    public enum ErrorCode { TechnicalError, BadVolume, NoMoney, MarketClosed, Disconnected, EntityNotFound, Timeout, InvalidRequest }
    public enum PositionCloseReason { Closed, StopLoss, TakeProfit, StopOut }
    public enum PendingOrderType { Limit, Stop, StopLimit }
    public enum PendingOrderCancellationReason { Cancelled, Expired, Rejected }

    [AttributeUsage(AttributeTargets.Class)]
    public sealed class RobotAttribute : Attribute
    {
        public TimeZones TimeZone { get; set; }
        public AccessRights AccessRights { get; set; }
    }

    [AttributeUsage(AttributeTargets.Property)]
    public sealed class ParameterAttribute : Attribute
    {
        public ParameterAttribute() { }
        public ParameterAttribute(string name) { Name = name; }
        public string Name { get; set; }
        public object DefaultValue { get; set; }
        public double MinValue { get; set; }
        public double MaxValue { get; set; }
        public double Step { get; set; }
        public string Group { get; set; }
    }

    public sealed class Color { public static readonly Color White = new Color(); }

    public sealed class TimeFrame
    {
        public readonly int Minutes;
        private TimeFrame(int m) { Minutes = m; }
        public static readonly TimeFrame Minute = new TimeFrame(1), Minute2 = new TimeFrame(2), Minute5 = new TimeFrame(5),
            Minute15 = new TimeFrame(15), Hour = new TimeFrame(60), Hour4 = new TimeFrame(240), Daily = new TimeFrame(1440);
        public override string ToString() { return "m" + Minutes; }
    }

    public interface DataSeries { double this[int index] { get; } int Count { get; } double LastValue { get; } }
    public interface TimeSeries { DateTime this[int index] { get; } int Count { get; } int GetIndexByTime(DateTime time); }

    internal sealed class ListSeries : DataSeries
    {
        private readonly List<double> _v;
        public ListSeries(List<double> v) { _v = v; }
        public double this[int i] { get { return i >= 0 && i < _v.Count ? _v[i] : double.NaN; } }
        public int Count { get { return _v.Count; } }
        public double LastValue { get { return _v.Count > 0 ? _v[_v.Count - 1] : double.NaN; } }
    }

    internal sealed class ListTimes : TimeSeries
    {
        private readonly List<DateTime> _t;
        public ListTimes(List<DateTime> t) { _t = t; }
        public DateTime this[int i] { get { return i >= 0 && i < _t.Count ? _t[i] : DateTime.MinValue; } }
        public int Count { get { return _t.Count; } }
        // Index of the bar whose open time is the latest one <= time; -1 when time precedes the first bar.
        public int GetIndexByTime(DateTime time)
        {
            int lo = 0, hi = _t.Count - 1, ans = -1;
            while (lo <= hi)
            {
                int mid = (lo + hi) >> 1;
                if (_t[mid] <= time) { ans = mid; lo = mid + 1; } else hi = mid - 1;
            }
            return ans;
        }
    }

    public sealed class Bars
    {
        internal readonly int Minutes;
        private readonly List<DateTime> _t = new List<DateTime>();
        private readonly List<double> _o = new List<double>(), _h = new List<double>(), _l = new List<double>(), _c = new List<double>();
        internal Bars(int minutes)
        {
            Minutes = minutes;
            OpenTimes = new ListTimes(_t); OpenPrices = new ListSeries(_o); HighPrices = new ListSeries(_h);
            LowPrices = new ListSeries(_l); ClosePrices = new ListSeries(_c);
        }
        public int Count { get { return _t.Count; } }
        public TimeSeries OpenTimes { get; private set; }
        public DataSeries OpenPrices { get; private set; }
        public DataSeries HighPrices { get; private set; }
        public DataSeries LowPrices { get; private set; }
        public DataSeries ClosePrices { get; private set; }
        public int LoadMoreHistory() { return 0; }

        internal void OnTick(DateTime t, double price)
        {
            long span = Minutes * TimeSpan.TicksPerMinute;
            var open = new DateTime(t.Ticks - t.Ticks % span, DateTimeKind.Unspecified);
            int n = _t.Count;
            if (n == 0 || open > _t[n - 1])
            {
                _t.Add(open); _o.Add(price); _h.Add(price); _l.Add(price); _c.Add(price);
                return;
            }
            n--;
            if (price > _h[n]) _h[n] = price;
            if (price < _l[n]) _l[n] = price;
            _c[n] = price;
        }
    }

    public sealed class Asset { public string Name { get; internal set; } }

    public sealed class Account
    {
        internal Engine E;
        public double Balance { get; internal set; }
        public double Equity { get { return E.Equity(); } }
        public double Margin { get { return E.UsedMargin(); } }
        public double FreeMargin { get { return Equity - Margin; } }
        public int Number { get { return 9000001; } }
        public bool IsLive { get { return false; } }
        public double PreciseLeverage { get { return 30.0; } }
        public Asset Asset { get; internal set; }
    }

    public sealed class Symbol
    {
        // Defaults = XAUUSD as used by all v2.59/v2.60 gold tests; the runner overrides them for other instruments (--symbol-spec).
        public string Name { get; internal set; }
        public double Bid { get; internal set; }
        public double Ask { get; internal set; }
        public double TickSize { get; internal set; } = 0.01;
        public double PipSize { get; internal set; } = 0.1;
        public double LotSize { get; internal set; } = 100;
        public double VolumeInUnitsMin { get; internal set; } = 1;
        public double VolumeInUnitsStep { get; internal set; } = 1;
        public double VolumeInUnitsMax { get; internal set; } = 10000;
        internal double QuoteToAccount = 0.92;     // quote currency -> EUR, fixed for the test
        internal double SymbolLeverage = 20;
        internal int Digits { get { return Math.Max(0, (int)Math.Round(-Math.Log10(TickSize))); } }
        public double Spread { get { return Ask - Bid; } }
        public double PipValue { get { return PipSize * QuoteToAccount; } }
        public double TickValue { get { return TickSize * QuoteToAccount; } }
        public double NormalizeVolumeInUnits(double v, RoundingMode mode = RoundingMode.ToNearest)
        {
            double q = v / VolumeInUnitsStep;
            q = mode == RoundingMode.Down ? Math.Floor(q + 1e-9) : mode == RoundingMode.Up ? Math.Ceiling(q - 1e-9) : Math.Round(q);
            return q * VolumeInUnitsStep;
        }
        public double QuantityToVolumeInUnits(double q) { return q * LotSize; }
        public double VolumeInUnitsToQuantity(double u) { return u / LotSize; }
        public double AmountRisked(double units, double pips) { return units * pips * PipSize * QuoteToAccount; }
        public double GetEstimatedMargin(TradeType t, double units) { return units * (t == TradeType.Buy ? Ask : Bid) * QuoteToAccount / SymbolLeverage; }
    }

    public sealed class Position
    {
        internal Engine E;
        internal bool IsClosed;
        internal double ClosePrice;
        public int Id { get; internal set; }
        public TradeType TradeType { get; internal set; }
        public double EntryPrice { get; internal set; }
        public double? StopLoss { get; internal set; }
        public double? TakeProfit { get; internal set; }
        public double VolumeInUnits { get; internal set; }
        public string Label { get; internal set; }
        public string SymbolName { get; internal set; }
        public string Comment { get; internal set; }
        public DateTime EntryTime { get; internal set; }
        public double Commissions { get { return 0; } }
        public double Swap { get { return 0; } }
        public double GrossProfit { get { return E.Pnl(this, VolumeInUnits, IsClosed ? ClosePrice : E.ExitPrice(this)); } }
        public double NetProfit { get { return GrossProfit; } }
        public TradeResult ModifyVolume(double volume) { return E.ModifyVolume(this, volume); }
    }

    public sealed class PendingOrder
    {
        public int Id { get; internal set; }
        public PendingOrderType OrderType { get; internal set; }
        public TradeType TradeType { get; internal set; }
        public double TargetPrice { get; internal set; }
        public double VolumeInUnits { get; internal set; }
        public double? StopLossPips { get; internal set; }
        public double? TakeProfitPips { get; internal set; }
        public DateTime? ExpirationTime { get; internal set; }
        public string Label { get; internal set; }
        public string SymbolName { get; internal set; }
        public string Comment { get; internal set; }
    }

    public sealed class PendingOrderFilledEventArgs
    {
        public PendingOrder PendingOrder { get; internal set; }
        public Position Position { get; internal set; }
    }

    public sealed class PendingOrderCancelledEventArgs
    {
        public PendingOrder PendingOrder { get; internal set; }
        public PendingOrderCancellationReason Reason { get; internal set; }
    }

    public sealed class HistoricalTrade
    {
        public int PositionId { get; internal set; }
        public TradeType TradeType { get; internal set; }
        public double EntryPrice { get; internal set; }
        public DateTime EntryTime { get; internal set; }
        public double ClosingPrice { get; internal set; }
        public DateTime ClosingTime { get; internal set; }
        public double VolumeInUnits { get; internal set; }
        public double GrossProfit { get; internal set; }
        public double NetProfit { get { return GrossProfit; } }
        public double Commissions { get { return 0; } }
        public double Swap { get { return 0; } }
        public string Label { get; internal set; }
        public string Comment { get; internal set; }
    }

    public sealed class TradeResult
    {
        public bool IsSuccessful { get; internal set; }
        public Position Position { get; internal set; }
        public PendingOrder PendingOrder { get; internal set; }
        public ErrorCode? Error { get; internal set; }
    }

    public sealed class PositionClosedEventArgs
    {
        public Position Position { get; internal set; }
        public PositionCloseReason Reason { get; internal set; }
    }

    public sealed class Positions : IEnumerable<Position>
    {
        internal readonly List<Position> Open = new List<Position>();
        public event Action<PositionClosedEventArgs> Closed;
        public int Count { get { return Open.Count; } }
        public Position[] FindAll(string label, string symbolName) { return Open.Where(p => p.Label == label && p.SymbolName == symbolName).ToArray(); }
        public Position FindById(int id) { return Open.FirstOrDefault(p => p.Id == id); }
        public IEnumerator<Position> GetEnumerator() { return Open.ToList().GetEnumerator(); }
        IEnumerator IEnumerable.GetEnumerator() { return GetEnumerator(); }
        internal void RaiseClosed(Position p, PositionCloseReason r) { var h = Closed; if (h != null) h(new PositionClosedEventArgs { Position = p, Reason = r }); }
    }

    public sealed class PendingOrders : IEnumerable<PendingOrder>
    {
        internal readonly List<PendingOrder> Open = new List<PendingOrder>();
        public event Action<PendingOrderFilledEventArgs> Filled;
        public event Action<PendingOrderCancelledEventArgs> Cancelled;
        public int Count { get { return Open.Count; } }
        public IEnumerator<PendingOrder> GetEnumerator() { return Open.ToList().GetEnumerator(); }
        IEnumerator IEnumerable.GetEnumerator() { return GetEnumerator(); }
        internal void RaiseFilled(PendingOrder o, Position p) { var h = Filled; if (h != null) h(new PendingOrderFilledEventArgs { PendingOrder = o, Position = p }); }
        internal void RaiseCancelled(PendingOrder o, PendingOrderCancellationReason r) { var h = Cancelled; if (h != null) h(new PendingOrderCancelledEventArgs { PendingOrder = o, Reason = r }); }
    }

    public sealed class History : IEnumerable<HistoricalTrade>
    {
        internal readonly List<HistoricalTrade> Items = new List<HistoricalTrade>();
        public IEnumerator<HistoricalTrade> GetEnumerator() { return Items.GetEnumerator(); }
        IEnumerator IEnumerable.GetEnumerator() { return GetEnumerator(); }
    }

    public sealed class Server { internal Engine E; public DateTime Time { get { return E.Now; } } }
    public sealed class HttpResponse { public bool IsSuccessful { get; internal set; } public string Body { get; internal set; } }
    public sealed class Http { public HttpResponse Get(string url) { return new HttpResponse { IsSuccessful = false, Body = "" }; } }
    public sealed class Chart
    {
        public void DrawStaticText(string name, string text, VerticalAlignment v, HorizontalAlignment h, Color c) { }
        public void RemoveObject(string name) { }
    }
    public sealed class MarketData
    {
        internal Engine E;
        public Bars GetBars(TimeFrame tf, string symbolName) { return E.GetBars(tf.Minutes); }
    }

    public abstract class Robot
    {
        internal Engine HarnessEngine;
        public Symbol Symbol { get { return HarnessEngine.Symbol; } }
        public string SymbolName { get { return HarnessEngine.Symbol.Name; } }
        public MarketData MarketData { get { return HarnessEngine.MarketData; } }
        public Positions Positions { get { return HarnessEngine.Positions; } }
        public PendingOrders PendingOrders { get { return HarnessEngine.PendingOrders; } }
        public Account Account { get { return HarnessEngine.Account; } }
        public Server Server { get { return HarnessEngine.Server; } }
        public History History { get { return HarnessEngine.History; } }
        public Http Http { get { return HarnessEngine.Http; } }
        public Chart Chart { get { return HarnessEngine.Chart; } }
        public RunningMode RunningMode { get { return RunningMode.SilentBacktesting; } }

        protected virtual void OnStart() { }
        protected virtual void OnTick() { }
        protected virtual void OnStop() { }
        internal void HarnessStart() { OnStart(); }
        internal void HarnessTick() { OnTick(); }
        internal void HarnessStop() { OnStop(); }

        public void Print(string message) { HarnessEngine.Log(message); }
        public void Print(string format, params object[] args)
        {
            string s;
            try { s = args == null || args.Length == 0 ? format : string.Format(CultureInfo.InvariantCulture, format, args); }
            catch (FormatException) { s = format; }
            HarnessEngine.Log(s);
        }

        public TradeResult ExecuteMarketOrder(TradeType tradeType, string symbolName, double volume, string label, double? stopLossPips, double? takeProfitPips, string comment)
        { return HarnessEngine.MarketOrder(tradeType, volume, label, stopLossPips, takeProfitPips, comment); }
        public TradeResult ModifyPosition(Position position, double? stopLoss, double? takeProfit, ProtectionType protectionType)
        { return HarnessEngine.Modify(position, stopLoss, takeProfit); }
        public TradeResult ClosePosition(Position position) { return HarnessEngine.Close(position, PositionCloseReason.Closed, null); }
        public TradeResult PlaceLimitOrder(TradeType tradeType, string symbolName, double volume, double targetPrice, string label, double? stopLossPips, double? takeProfitPips, DateTime? expiryTime, string comment)
        { return HarnessEngine.PlaceLimit(tradeType, volume, targetPrice, label, stopLossPips, takeProfitPips, expiryTime, comment); }
        public TradeResult CancelPendingOrder(PendingOrder order) { return HarnessEngine.CancelPending(order, PendingOrderCancellationReason.Cancelled); }
    }

    // ------------------------------------------------------------------ engine
    public sealed class FillRecord
    {
        public int PositionId; public TradeType Side; public DateTime EntryTime; public double EntryPrice, InitialStop, Units, InitialRiskEur;
        public string Comment, OpenLog; public double Realized; public DateTime ExitTime; public bool Closed; public int Fills;
        public double Mfe;
        public bool ViaLimit;
    }

    public sealed class Engine
    {
        public readonly Symbol Symbol = new Symbol { Name = "XAUUSD" };
        public int LimitFills, LimitCancels, LimitExpiries, LimitRejects;
        internal readonly MarketData MarketData;
        internal readonly Positions Positions = new Positions();
        internal readonly PendingOrders PendingOrders = new PendingOrders();
        internal readonly Account Account;
        internal readonly Server Server;
        internal readonly History History = new History();
        internal readonly Http Http = new Http();
        internal readonly Chart Chart = new Chart();
        private readonly Dictionary<int, Bars> _bars = new Dictionary<int, Bars>();
        private int _nextId = 1;
        private DateTime _lastTick = DateTime.MinValue;
        public DateTime Now { get; private set; }
        public double Spread = 0.20;
        public Action<string> Logger = delegate { };
        public readonly Dictionary<int, FillRecord> Records = new Dictionary<int, FillRecord>();
        public double PeakEquity, MaxDrawdown, MaxDrawdownPct;
        public string LastOpenLog;

        public Engine(double balance)
        {
            MarketData = new MarketData { E = this };
            Server = new Server { E = this };
            Account = new Account { E = this, Balance = balance, Asset = new Asset { Name = "EUR" } };
            foreach (int m in new[] { 1, 2, 5, 15, 60, 240, 1440 }) _bars[m] = new Bars(m);
            PeakEquity = balance;
        }

        internal Bars GetBars(int minutes) { return _bars[minutes]; }
        internal void Log(string s)
        {
            if (s.StartsWith("OPEN ", StringComparison.Ordinal)) LastOpenLog = s;
            Logger(s);
        }

        public void PushTick(DateTime t, double bid)
        {
            bool gap = _lastTick != DateTime.MinValue && (t - _lastTick).TotalMinutes > 5;
            _lastTick = t;
            Now = t;
            Symbol.Bid = Math.Round(bid, Symbol.Digits);
            Symbol.Ask = Math.Round(bid + Spread, Symbol.Digits);
            foreach (var b in _bars.Values) b.OnTick(t, Symbol.Bid);
            CheckPending(gap);
            CheckStops(gap);
        }

        public void AfterTick()
        {
            double eq = Equity();
            if (eq > PeakEquity) PeakEquity = eq;
            double dd = PeakEquity - eq;
            if (dd > MaxDrawdown) { MaxDrawdown = dd; MaxDrawdownPct = dd / PeakEquity * 100.0; }
            foreach (var p in Positions.Open)
            {
                FillRecord r; if (!Records.TryGetValue(p.Id, out r) || r.InitialStop == 0) continue;
                double risk = Math.Abs(r.EntryPrice - r.InitialStop);
                double fav = (p.TradeType == TradeType.Buy ? ExitPrice(p) - r.EntryPrice : r.EntryPrice - ExitPrice(p)) / risk;
                if (fav > r.Mfe) r.Mfe = fav;
            }
        }

        internal double ExitPrice(Position p) { return p.TradeType == TradeType.Buy ? Symbol.Bid : Symbol.Ask; }
        internal double Pnl(Position p, double units, double exit)
        {
            double d = p.TradeType == TradeType.Buy ? exit - p.EntryPrice : p.EntryPrice - exit;
            return d * units * Symbol.QuoteToAccount;
        }
        internal double Equity() { return Account.Balance + Positions.Open.Sum(p => Pnl(p, p.VolumeInUnits, ExitPrice(p))); }
        internal double UsedMargin() { return Positions.Open.Sum(p => p.VolumeInUnits * p.EntryPrice * Symbol.QuoteToAccount / Symbol.SymbolLeverage); }
        private double Tick(double price) { return Math.Round(price / Symbol.TickSize) * Symbol.TickSize; }

        internal TradeResult MarketOrder(TradeType side, double volume, string label, double? slPips, double? tpPips, string comment)
        {
            if (volume < Symbol.VolumeInUnitsMin || Math.Abs(volume / Symbol.VolumeInUnitsStep - Math.Round(volume / Symbol.VolumeInUnitsStep)) > 1e-9)
                return new TradeResult { IsSuccessful = false, Error = ErrorCode.BadVolume };
            double price = side == TradeType.Buy ? Symbol.Ask : Symbol.Bid;
            if (volume * price * Symbol.QuoteToAccount / Symbol.SymbolLeverage > Account.FreeMargin)
                return new TradeResult { IsSuccessful = false, Error = ErrorCode.NoMoney };
            int dir = side == TradeType.Buy ? 1 : -1;
            var p = new Position
            {
                E = this, Id = _nextId++, TradeType = side, EntryPrice = price, VolumeInUnits = volume, Label = label, SymbolName = Symbol.Name,
                Comment = comment, EntryTime = Now,
                StopLoss = slPips.HasValue ? Tick(price - dir * slPips.Value * Symbol.PipSize) : (double?)null,
                TakeProfit = tpPips.HasValue ? Tick(price + dir * tpPips.Value * Symbol.PipSize) : (double?)null
            };
            Positions.Open.Add(p);
            Records[p.Id] = new FillRecord { PositionId = p.Id, Side = side, EntryTime = Now, EntryPrice = price, Units = volume, Comment = comment,
                InitialStop = p.StopLoss ?? 0, InitialRiskEur = p.StopLoss.HasValue ? Math.Abs(price - p.StopLoss.Value) * volume * Symbol.QuoteToAccount : 0 };
            return new TradeResult { IsSuccessful = true, Position = p };
        }

        // Limit orders: a buy limit must rest below the Ask, a sell limit above the Bid (otherwise the server rejects it).
        internal TradeResult PlaceLimit(TradeType side, double volume, double target, string label, double? slPips, double? tpPips, DateTime? expiry, string comment)
        {
            if (volume < Symbol.VolumeInUnitsMin || Math.Abs(volume / Symbol.VolumeInUnitsStep - Math.Round(volume / Symbol.VolumeInUnitsStep)) > 1e-9)
                return new TradeResult { IsSuccessful = false, Error = ErrorCode.BadVolume };
            double t = Tick(target);
            if (side == TradeType.Buy ? t >= Symbol.Ask : t <= Symbol.Bid) { LimitRejects++; return new TradeResult { IsSuccessful = false, Error = ErrorCode.InvalidRequest }; }
            if (expiry.HasValue && expiry.Value <= Now) { LimitRejects++; return new TradeResult { IsSuccessful = false, Error = ErrorCode.InvalidRequest }; }
            var o = new PendingOrder { Id = _nextId++, OrderType = PendingOrderType.Limit, TradeType = side, TargetPrice = t, VolumeInUnits = volume, StopLossPips = slPips,
                TakeProfitPips = tpPips, ExpirationTime = expiry, Label = label, SymbolName = Symbol.Name, Comment = comment };
            PendingOrders.Open.Add(o);
            return new TradeResult { IsSuccessful = true, PendingOrder = o };
        }

        internal TradeResult CancelPending(PendingOrder o, PendingOrderCancellationReason reason)
        {
            if (o == null || !PendingOrders.Open.Remove(o)) return new TradeResult { IsSuccessful = false, Error = ErrorCode.EntityNotFound };
            if (reason == PendingOrderCancellationReason.Expired) LimitExpiries++; else LimitCancels++;
            PendingOrders.RaiseCancelled(o, reason);
            return new TradeResult { IsSuccessful = true, PendingOrder = o };
        }

        // Fill at the limit price (or better after a gap); protection is placed relative to the fill price.
        private void CheckPending(bool gap)
        {
            foreach (var o in PendingOrders.Open.ToList())
            {
                if (!PendingOrders.Open.Contains(o)) continue;
                if (o.ExpirationTime.HasValue && Now >= o.ExpirationTime.Value) { CancelPending(o, PendingOrderCancellationReason.Expired); continue; }
                bool buy = o.TradeType == TradeType.Buy;
                double px = buy ? Symbol.Ask : Symbol.Bid;
                if (buy ? px > o.TargetPrice : px < o.TargetPrice) continue;
                double fill = gap ? px : o.TargetPrice;
                if (o.VolumeInUnits * fill * Symbol.QuoteToAccount / Symbol.SymbolLeverage > Account.FreeMargin)
                { PendingOrders.Open.Remove(o); LimitRejects++; PendingOrders.RaiseCancelled(o, PendingOrderCancellationReason.Rejected); continue; }
                PendingOrders.Open.Remove(o);
                int dir = buy ? 1 : -1;
                var p = new Position
                {
                    E = this, Id = _nextId++, TradeType = o.TradeType, EntryPrice = fill, VolumeInUnits = o.VolumeInUnits, Label = o.Label, SymbolName = Symbol.Name,
                    Comment = o.Comment, EntryTime = Now,
                    StopLoss = o.StopLossPips.HasValue ? Tick(fill - dir * o.StopLossPips.Value * Symbol.PipSize) : (double?)null,
                    TakeProfit = o.TakeProfitPips.HasValue ? Tick(fill + dir * o.TakeProfitPips.Value * Symbol.PipSize) : (double?)null
                };
                Positions.Open.Add(p);
                Records[p.Id] = new FillRecord { PositionId = p.Id, Side = o.TradeType, EntryTime = Now, EntryPrice = fill, Units = o.VolumeInUnits, Comment = o.Comment,
                    InitialStop = p.StopLoss ?? 0, InitialRiskEur = p.StopLoss.HasValue ? Math.Abs(fill - p.StopLoss.Value) * o.VolumeInUnits * Symbol.QuoteToAccount : 0, ViaLimit = true };
                LimitFills++;
                PendingOrders.RaiseFilled(o, p);
            }
        }

        internal TradeResult Modify(Position p, double? sl, double? tp)
        {
            if (p == null || p.IsClosed) return new TradeResult { IsSuccessful = false, Error = ErrorCode.EntityNotFound };
            double? s = sl.HasValue ? Tick(sl.Value) : (double?)null, t = tp.HasValue ? Tick(tp.Value) : (double?)null;
            double px = ExitPrice(p);
            bool buy = p.TradeType == TradeType.Buy;
            if (s.HasValue && (buy ? s.Value >= px : s.Value <= px)) return new TradeResult { IsSuccessful = false, Error = ErrorCode.InvalidRequest, Position = p };
            if (t.HasValue && (buy ? t.Value <= px : t.Value >= px)) return new TradeResult { IsSuccessful = false, Error = ErrorCode.InvalidRequest, Position = p };
            p.StopLoss = s; p.TakeProfit = t;
            FillRecord r;
            // The protection the bot verifies right after the fill (same timestamp) defines the initial risk.
            if (Records.TryGetValue(p.Id, out r) && r.EntryTime == Now && s.HasValue)
            {
                r.InitialStop = s.Value;
                r.InitialRiskEur = Math.Abs(p.EntryPrice - s.Value) * p.VolumeInUnits * Symbol.QuoteToAccount;
            }
            return new TradeResult { IsSuccessful = true, Position = p };
        }

        internal TradeResult ModifyVolume(Position p, double volume)
        {
            if (p == null || p.IsClosed || volume <= 0 || volume >= p.VolumeInUnits) return new TradeResult { IsSuccessful = false, Error = ErrorCode.BadVolume };
            double closed = p.VolumeInUnits - volume, px = ExitPrice(p);
            double pnl = Pnl(p, closed, px);
            Account.Balance += pnl;
            History.Items.Add(new HistoricalTrade { PositionId = p.Id, TradeType = p.TradeType, EntryPrice = p.EntryPrice, EntryTime = p.EntryTime, ClosingPrice = px,
                ClosingTime = Now, VolumeInUnits = closed, GrossProfit = pnl, Label = p.Label, Comment = p.Comment });
            p.VolumeInUnits = volume;
            FillRecord r; if (Records.TryGetValue(p.Id, out r)) { r.Realized += pnl; r.Fills++; }
            return new TradeResult { IsSuccessful = true, Position = p };
        }

        internal TradeResult Close(Position p, PositionCloseReason reason, double? atPrice)
        {
            if (p == null || p.IsClosed) return new TradeResult { IsSuccessful = false, Error = ErrorCode.EntityNotFound };
            double px = atPrice ?? ExitPrice(p);
            double pnl = Pnl(p, p.VolumeInUnits, px);
            Account.Balance += pnl;
            p.IsClosed = true; p.ClosePrice = px;
            Positions.Open.Remove(p);
            History.Items.Add(new HistoricalTrade { PositionId = p.Id, TradeType = p.TradeType, EntryPrice = p.EntryPrice, EntryTime = p.EntryTime, ClosingPrice = px,
                ClosingTime = Now, VolumeInUnits = p.VolumeInUnits, GrossProfit = pnl, Label = p.Label, Comment = p.Comment });
            FillRecord r; if (Records.TryGetValue(p.Id, out r)) { r.Realized += pnl; r.Fills++; r.Closed = true; r.ExitTime = Now; }
            Positions.RaiseClosed(p, reason);
            return new TradeResult { IsSuccessful = true, Position = p };
        }

        private void CheckStops(bool gap)
        {
            foreach (var p in Positions.Open.ToList())
            {
                bool buy = p.TradeType == TradeType.Buy;
                double px = ExitPrice(p);
                if (p.StopLoss.HasValue && (buy ? px <= p.StopLoss.Value : px >= p.StopLoss.Value))
                    Close(p, PositionCloseReason.StopLoss, gap ? px : p.StopLoss.Value);
                else if (p.TakeProfit.HasValue && (buy ? px >= p.TakeProfit.Value : px <= p.TakeProfit.Value))
                    Close(p, PositionCloseReason.TakeProfit, gap ? px : p.TakeProfit.Value);
            }
        }

        public void ForceCloseAll() { foreach (var p in Positions.Open.ToList()) Close(p, PositionCloseReason.Closed, null); }
    }
}

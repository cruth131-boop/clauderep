using System;
using System.Collections.Generic;
using System.Globalization;

namespace NewSetups
{
    public sealed class Bar { public int Index; public DateTime OpenUtc; public double Open, High, Low, Close, Atr; }
    // Detached value snapshots. Public fields are the agreed adapter interface;
    // caller mutation is possible, but subsequent detection never mutates a returned pattern.
    public sealed class Pattern
    {
        public string Core, Id;
        public int Direction, StartIndex, BreakIndex, DeadlineIndex, SourceIndex;
        public DateTime BreakUtc;
        public DateTime[] AnchorOpenUtc, AnchorConfirmedUtc;
        public int MssPivotIndex = -1;
        public DateTime MssPivotConfirmedUtc;
        public double ImpulseLow, ImpulseHigh, BlockLow, BlockHigh, InvalidExtreme;
        public int[] Anchors;
    }
    // NS-1 development geometry only: no eligibility, execution or tradability claim.
    public static class Patterns
    {
        private sealed class Pivot { public int Pos, Side; public double Price; }
        // v2.48-dev: gap tolerance is the DEV duration heuristic in NsRules.GapTolerated (missing span 55 min .. 96 h).
        // It is NOT calendar/session validation: any hole of that length is accepted wherever it occurs.
        private static bool Contiguous(DateTime prev, DateTime cur, int minutes)
        {
            return NsRules.GapTolerated(cur - prev, minutes);
        }
        private static bool Finite(double x) => !double.IsNaN(x) && !double.IsInfinity(x);
        public static List<Pattern> Detect(IReadOnlyList<Bar> bars, int minutes, int direction,
            double tick, double minimumSweepPrice, double minimumSweepAtr, double mssAtrBuffer)
        {
            var output = new List<Pattern>();
            if (bars == null || (minutes != 15 && minutes != 60) || Math.Abs((long)direction) != 1 ||
                !Finite(tick) || tick <= 0 || !Finite(minimumSweepPrice) || minimumSweepPrice < 0 ||
                !Finite(minimumSweepAtr) || minimumSweepAtr < 0 || !Finite(mssAtrBuffer) || mssAtrBuffer < 0)
                return output;
            int history = minutes == 15 ? 160 : 120;
            if (bars.Count < history || bars[bars.Count-1] == null || bars[bars.Count-1].Index > int.MaxValue - 8 ||
                bars[bars.Count-1].OpenUtc > DateTime.MaxValue.AddMinutes(-minutes)) return output;
            for (int i = 0; i < bars.Count; i++)
            {
                var z = bars[i];
                if (z == null || z.OpenUtc.Kind != DateTimeKind.Utc || !Finite(z.Open) || !Finite(z.High) ||
                    !Finite(z.Low) || !Finite(z.Close) || !Finite(z.Atr) || z.Atr <= 0 || z.High <= z.Low ||
                    z.Low > Math.Min(z.Open,z.Close) || z.High < Math.Max(z.Open,z.Close) ||
                    (i > 0 && ((long)z.Index != (long)bars[i-1].Index + 1 ||
                    !Contiguous(bars[i-1].OpenUtc, z.OpenUtc, minutes)))) return output;
            }
            int j = bars.Count - 1, first = bars.Count - history;
            var br = bars[j]; double buffer = Math.Max(tick, br.Atr * mssAtrBuffer);
            double body = direction * (br.Close - br.Open), range = br.High - br.Low;
            if (body <= 0 || body < .6 * br.Atr || range < .8 * br.Atr || 100 * body / range < 58) return output;
            var pivots = new List<Pivot>();
            // Confirmation strictly before break for both families (j > C+2).
            for (int k = first + 2; k + 2 < j; k++)
            {
                bool high = true, low = true;
                for (int r = -2; r <= 2; r++) if (r != 0)
                { high &= bars[k].High > bars[k+r].High; low &= bars[k].Low < bars[k+r].Low; }
                // Outside bars with both pivot kinds have no knowable intrabar order.
                if (high == low) continue;
                var p = new Pivot { Pos = k, Side = high ? 1 : -1, Price = high ? bars[k].High : bars[k].Low };
                if (pivots.Count > 0 && pivots[pivots.Count-1].Side == p.Side)
                {
                    var prev = pivots[pivots.Count-1];
                    if (p.Side * (p.Price - prev.Price) > 0) pivots[pivots.Count-1] = p;
                }
                else pivots.Add(p);
            }
            if (minutes == 60)
            {
                if (pivots.Count < 2) return output;
                var b = pivots[pivots.Count-2]; var a = pivots[pivots.Count-1];
                if (b.Side != direction || a.Side != -direction || j-a.Pos > 24 ||
                    direction * (br.Close-b.Price) <= buffer) return output;
                output.Add(Create("K05", bars, direction, a.Pos, j, 6,
                    b.Price-buffer, b.Price+buffer, new[]{b.Pos,a.Pos}, minutes, b.Pos));
                return output;
            }
            if (pivots.Count < 3) return output;
            var A = pivots[pivots.Count-3]; var B = pivots[pivots.Count-2]; var C = pivots[pivots.Count-1];
            if (A.Side != -direction || B.Side != direction || C.Side != -direction || j-A.Pos > 32 ||
                direction * (br.Close-B.Price) <= buffer) return output;
            double sweep = Math.Max(minimumSweepPrice, minimumSweepAtr * bars[C.Pos].Atr);
            double cBuffer = Math.Max(tick, mssAtrBuffer * bars[C.Pos].Atr);
            double change = direction * (C.Price-A.Price);
            string core = change < -sweep ? "K03" : change > cBuffer ? "K04" : null;
            if (core == null) return output;
            int start = core == "K03" ? A.Pos+1 : B.Pos;
            int end = core == "K03" ? B.Pos : C.Pos-1;
            int v = -1;
            for (int k = end; k >= start; k--) if (direction * (bars[k].Close-bars[k].Open) > 0) { v=k; break; }
            if (v < 0) return output;
            var block = bars[v];
            if (block.High-block.Low > 1.50 * block.Atr ||
                direction * (br.Close-(direction==1 ? block.High : block.Low)) <= buffer) return output;
            output.Add(Create(core,bars,direction,C.Pos,j,8,block.Low,block.High,new[]{A.Pos,B.Pos,C.Pos},minutes,v));
            return output;
        }
        private static Pattern Create(string core,IReadOnlyList<Bar> bars,int d,int origin,int j,int expiry,
            double low,double high,int[] positions,int minutes,int sourcePosition)
        {
            double impulseLow=bars[origin].Low, impulseHigh=bars[origin].High;
            for(int k=origin;k<=j;k++){impulseLow=Math.Min(impulseLow,bars[k].Low);impulseHigh=Math.Max(impulseHigh,bars[k].High);}
            // Origin extreme stays fixed even if a later bar makes an adverse extreme.
            if(d==1) impulseLow=bars[origin].Low; else impulseHigh=bars[origin].High;
            var anchors=new int[positions.Length];
            var opens=new DateTime[positions.Length];
            var confirmed=new DateTime[positions.Length];
            string id=core+"|"+minutes+"|"+d;
            for(int k=0;k<positions.Length;k++) {var b=bars[positions[k]];anchors[k]=b.Index;opens[k]=b.OpenUtc;
                confirmed[k]=bars[positions[k]+2].OpenUtc.AddMinutes(minutes);
                id+="|"+minutes+":"+b.Index+":"+b.OpenUtc.ToString("O",CultureInfo.InvariantCulture);}
            id+="|"+bars[j].OpenUtc.AddMinutes(minutes).ToString("O",CultureInfo.InvariantCulture);
            return new Pattern { Core=core,Id=id,Direction=d,StartIndex=bars[positions[0]].Index,
                BreakIndex=bars[j].Index,DeadlineIndex=checked(bars[j].Index+expiry),SourceIndex=bars[sourcePosition].Index,BreakUtc=bars[j].OpenUtc.AddMinutes(minutes),
                ImpulseLow=impulseLow,ImpulseHigh=impulseHigh,BlockLow=low,BlockHigh=high,
                InvalidExtreme=d==1?bars[origin].Low:bars[origin].High,Anchors=anchors,AnchorOpenUtc=opens,AnchorConfirmedUtc=confirmed };
        }
    }
}

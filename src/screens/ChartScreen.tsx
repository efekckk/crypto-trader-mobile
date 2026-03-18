import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { WebView } from 'react-native-webview'
import { fetchTickers, TUNNEL_URL, API_KEY } from '../services/api'

// Micro-api call (direct, no auth wrapper needed for same tunnel)
async function fetchMicrostructure(symbol: string, tunnelUrl: string, apiKey: string) {
  try {
    const r = await fetch(`${tunnelUrl}/api/v1/analysis/microstructure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({ symbol, depth: 10 }),
    })
    const d = await r.json()
    return d?.data ?? null
  } catch { return null }
}

const C = {
  bg: '#111111', card: '#1a1a1a', border: '#2a2a2a',
  green: '#26a69a', red: '#ef5350', cyan: '#00d4ff',
  text: '#e0e8f0', muted: '#555566', orange: '#ff9800',
}

const TIMEFRAMES = ['15m', '1h', '4h', '1d']
const { width: W } = Dimensions.get('window')

const ALL_COINS = [
  { sym: 'BTC/USDT', label: 'BTC' },
  { sym: 'ETH/USDT', label: 'ETH' },
  { sym: 'BNB/USDT', label: 'BNB' },
  { sym: 'SOL/USDT', label: 'SOL' },
  { sym: 'ADA/USDT', label: 'ADA' },
  { sym: 'XRP/USDT', label: 'XRP' },
  { sym: 'DOGE/USDT',label: 'DOGE'},
  { sym: 'LINK/USDT',label: 'LINK'},
  { sym: 'DOT/USDT', label: 'DOT' },
  { sym: 'AVAX/USDT',label: 'AVAX'},
  { sym: 'LTC/USDT', label: 'LTC' },
  { sym: 'MATIC/USDT',label:'MATIC'},
]

interface Props {
  route: { params: { symbol: string } }
  navigation: any
}

interface Signal {
  type: 'long' | 'short'
  entry: number; sl: number; tp1: number; tp2: number; rr: number
}

interface MicroData {
  vamp:        number
  micro_price: number
  mid_price:   number
  ofi: {
    best_level: number
    integrated: number
  }
  pressure: {
    direction: 'buy' | 'sell' | 'neutral'
    score:     number   // -1 … +1
  }
  static_obi:      number
  liquidity_ratio: number
}

// ── MicroBar component ────────────────────────────────────────────────────────
function MicroBar({ data }: { data: MicroData }) {
  const score  = data.pressure.score       // −1 … +1
  const dir    = data.pressure.direction
  const pct    = Math.round((score + 1) / 2 * 100)  // 0-100 for bar width
  const barCol = dir === 'buy' ? C.green : dir === 'sell' ? C.red : C.muted
  const vamp   = data.vamp
  const mid    = data.mid_price
  const vampDiff = mid > 0 ? ((vamp - mid) / mid * 100) : 0
  const obi    = data.static_obi

  return (
    <View style={mb.wrap}>
      {/* OFI Pressure */}
      <View style={mb.section}>
        <Text style={mb.label}>OFI PRESSURE</Text>
        <View style={mb.barTrack}>
          {/* Center marker */}
          <View style={mb.centerMark} />
          {/* Fill from center */}
          {score >= 0 ? (
            <View style={[mb.barFill, {
              left: '50%',
              width: `${Math.abs(score) * 50}%` as any,
              backgroundColor: C.green,
            }]} />
          ) : (
            <View style={[mb.barFill, {
              right: '50%',
              width: `${Math.abs(score) * 50}%` as any,
              backgroundColor: C.red,
            }]} />
          )}
        </View>
        <Text style={[mb.val, { color: barCol }]}>
          {dir === 'buy' ? '▲ BUY' : dir === 'sell' ? '▼ SELL' : '─ NEUTRAL'}
          {' '}{score >= 0 ? '+' : ''}{(score * 100).toFixed(0)}
        </Text>
      </View>

      {/* VAMP vs Mid */}
      <View style={mb.divider} />
      <View style={mb.section}>
        <Text style={mb.label}>VAMP vs MID</Text>
        <Text style={[mb.val, { color: vampDiff > 0.01 ? C.green : vampDiff < -0.01 ? C.red : C.muted }]}>
          {vampDiff > 0 ? '+' : ''}{vampDiff.toFixed(3)}%
        </Text>
        <Text style={mb.subval}>${vamp.toFixed(vamp >= 1000 ? 2 : 4)}</Text>
      </View>

      {/* Static OBI */}
      <View style={mb.divider} />
      <View style={mb.section}>
        <Text style={mb.label}>OBI</Text>
        <Text style={[mb.val, { color: obi > 0.1 ? C.green : obi < -0.1 ? C.red : C.muted }]}>
          {obi >= 0 ? '+' : ''}{(obi * 100).toFixed(1)}%
        </Text>
        <Text style={mb.subval}>bid/ask</Text>
      </View>

      {/* Integrated OFI */}
      <View style={mb.divider} />
      <View style={mb.section}>
        <Text style={mb.label}>INT. OFI</Text>
        <Text style={[mb.val, { color: data.ofi.integrated > 0 ? C.green : data.ofi.integrated < 0 ? C.red : C.muted }]}>
          {data.ofi.integrated >= 0 ? '+' : ''}{data.ofi.integrated.toFixed(3)}
        </Text>
        <Text style={mb.subval}>PCA</Text>
      </View>
    </View>
  )
}

const mb = StyleSheet.create({
  wrap:      { flexDirection: 'row', backgroundColor: '#161616', borderTopWidth: 1, borderTopColor: C.border, paddingVertical: 5, paddingHorizontal: 4 },
  section:   { flex: 1, alignItems: 'center', paddingHorizontal: 2 },
  divider:   { width: 1, backgroundColor: C.border, marginVertical: 2 },
  label:     { fontSize: 7, color: C.muted, letterSpacing: 0.5, marginBottom: 2 },
  val:       { fontSize: 10, fontWeight: '700', fontVariant: ['tabular-nums'] as any },
  subval:    { fontSize: 8, color: C.muted, marginTop: 1 },
  barTrack:  { width: '100%', height: 4, backgroundColor: C.border, borderRadius: 2, position: 'relative', overflow: 'hidden', marginBottom: 2 },
  centerMark:{ position: 'absolute', left: '50%', top: 0, width: 1, height: 4, backgroundColor: C.muted },
  barFill:   { position: 'absolute', top: 0, height: 4, borderRadius: 2 },
})

// ── Build the full HTML page that renders our chart ──────────────────────────
function buildChartHTML(symbol: string, timeframe: string, apiUrl: string, apiKey: string): string {
  const binSym = symbol.replace('/', '')
  const tfMap: Record<string, string> = { '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1d' }
  const interval = tfMap[timeframe] ?? '1h'

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#111111; color:#e0e8f0; font-family:monospace; overflow:hidden; }
  #chart { width:100vw; height:100vh; position:relative; }
  #canvas-overlay { position:absolute; top:0; left:0; pointer-events:none; z-index:5; }
  #status { position:absolute; top:6px; left:8px; font-size:10px; color:#334455; z-index:10; }
  #legend { position:absolute; bottom:4px; left:8px; display:flex; gap:10px; z-index:10; flex-wrap:wrap; }
  .leg { display:flex; align-items:center; gap:4px; font-size:9px; color:#2a3d52; }
  .leg-box { width:9px; height:9px; border:1.5px solid; }
  .leg-line { width:14px; height:0; }
</style>
</head>
<body>
<div id="chart">
  <canvas id="canvas-overlay"></canvas>
  <div id="status">Loading...</div>
  <div id="legend">
    <div class="leg"><div class="leg-box" style="border-color:#00e5ff;background:rgba(0,229,255,0.1)"></div>Accum</div>
    <div class="leg"><div class="leg-box" style="border-color:#ff9800;background:rgba(255,152,0,0.1)"></div>Manip</div>
    <div class="leg"><div class="leg-box" style="border-color:#ef5350;background:rgba(239,83,80,0.1)"></div>Distrib</div>
    <div class="leg"><div class="leg-line" style="border-bottom:1.5px dashed #ff4444"></div>SL</div>
    <div class="leg"><div class="leg-line" style="border-bottom:1.5px dashed #26a69a"></div>TP1</div>
    <div class="leg"><div class="leg-line" style="border-bottom:1.5px dashed #00e676"></div>TP2</div>
  </div>
</div>
<script src="https://unpkg.com/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js"></script>
<script>
const TUNNEL = '${apiUrl}';
const API_KEY = '${apiKey}';
const SYMBOL = '${symbol}';
const BIN_SYM = '${binSym}';
const INTERVAL = '${interval}';

const PHASE_COLORS = {
  accumulation: { fill:'rgba(0,229,255,0.10)', border:'rgba(0,229,255,0.65)', label:'A' },
  manipulation: { fill:'rgba(255,152,0,0.10)',  border:'rgba(255,152,0,0.75)',  label:'M' },
  distribution: { fill:'rgba(239,83,80,0.10)',  border:'rgba(239,83,80,0.75)',  label:'D' },
};

// ── Create chart ──────────────────────────────────────────────────────────────
const chartEl = document.getElementById('chart');
const chart = LightweightCharts.createChart(chartEl, {
  layout: { background: { type:'Solid', color:'#111111' }, textColor:'#888899', fontSize:10 },
  grid:   { vertLines:{ color:'#222222' }, horzLines:{ color:'#222222' } },
  crosshair: { vertLine:{ color:'#444444', labelBackgroundColor:'#2a2a2a' }, horzLine:{ color:'#444444', labelBackgroundColor:'#2a2a2a' } },
  rightPriceScale: { borderColor:'#2a2a2a', scaleMargins:{ top:0.08, bottom:0.12 } },
  timeScale: { borderColor:'#2a2a2a', timeVisible:true, secondsVisible:false, rightOffset:6, barSpacing:6 },
  width:  chartEl.clientWidth,
  height: chartEl.clientHeight,
});

const candle = chart.addCandlestickSeries({
  upColor:'#26a69a', downColor:'#ef5350', borderVisible:false,
  wickUpColor:'#26a69a', wickDownColor:'#ef5350',
});
const vol = chart.addHistogramSeries({ priceFormat:{type:'volume'}, priceScaleId:'vol' });
chart.priceScale('vol').applyOptions({ scaleMargins:{ top:0.88, bottom:0 } });

// Canvas overlay for AMD zones
const canvas = document.getElementById('canvas-overlay');
let zones = [];
let pricelines = [];

function drawZones() {
  canvas.width  = chartEl.clientWidth;
  canvas.height = chartEl.clientHeight;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const ts = chart.timeScale();
  zones.forEach(zone => {
    const cfg = PHASE_COLORS[zone.phase]; if (!cfg) return;
    try {
      const x1 = ts.timeToCoordinate(Math.floor(new Date(zone.start_time).getTime()/1000));
      const x2 = ts.timeToCoordinate(Math.floor(new Date(zone.end_time).getTime()/1000));
      const y1 = candle.priceToCoordinate(zone.zone_high);
      const y2 = candle.priceToCoordinate(zone.zone_low);
      if (x1==null||x2==null||y1==null||y2==null) return;
      const rx=Math.min(x1,x2)-2, ry=Math.min(y1,y2), rw=Math.abs(x2-x1)+4, rh=Math.abs(y2-y1);
      if (rw<2||rh<2) return;
      // Fill
      ctx.fillStyle = cfg.fill; ctx.fillRect(rx,ry,rw,rh);
      // Border
      ctx.strokeStyle = cfg.border; ctx.lineWidth=1; ctx.strokeRect(rx,ry,rw,rh);
      // Label badge
      const lbl = zone.label ?? cfg.label;
      const lblW = Math.min(lbl.length * 6 + 8, rw - 2);
      if (lblW > 8 && rh > 10) {
        ctx.fillStyle = cfg.border;
        ctx.fillRect(rx+1, ry+1, lblW, 13);
        ctx.fillStyle = '#000';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(lbl, rx+4, ry+7.5);
      }
    } catch(_) {}
  });
}

chart.timeScale().subscribeVisibleTimeRangeChange(drawZones);
chart.subscribeCrosshairMove(drawZones);
new ResizeObserver(() => {
  chart.applyOptions({ width: chartEl.clientWidth, height: chartEl.clientHeight });
  drawZones();
}).observe(chartEl);

// ── Helpers ──────────────────────────────────────────────────────────────────
function snapTime(ts, times) {
  let best=times[0], diff=Math.abs(ts-best);
  times.forEach(t => { const d=Math.abs(ts-t); if(d<diff){diff=d;best=t;} });
  return best;
}
function fp(n) {
  if(n>=1000) return '$'+n.toLocaleString('en-US',{maximumFractionDigits:0});
  if(n>=1)    return '$'+n.toFixed(4);
  return '$'+n.toFixed(6);
}
function calcATR(bars, n=14) {
  const s = bars.slice(-Math.min(n+1,bars.length));
  const trs = s.map((b,i) => {
    if(i===0) return b.high-b.low;
    const pc=s[i-1].close;
    return Math.max(b.high-b.low,Math.abs(b.high-pc),Math.abs(b.low-pc));
  });
  return trs.reduce((a,v)=>a+v,0)/trs.length;
}

function clearPriceLines() {
  pricelines.forEach(pl => { try{candle.removePriceLine(pl);}catch(_){} });
  pricelines=[];
}

function drawSignalLines(sig) {
  clearPriceLines();
  const isShort = sig.type==='short';
  const defs = [
    { price:sig.sl,    color:'#ff4444', title:'SL  '+fp(sig.sl),    style:2, width:1 },
    { price:sig.entry, color:isShort?'#ffaa00':'#00ccff', title:(isShort?'▼':'▲')+' Entry '+fp(sig.entry), style:0, width:2 },
    { price:sig.tp1,   color:'#26a69a', title:'TP1 '+fp(sig.tp1),   style:2, width:1 },
    { price:sig.tp2,   color:'#00e676', title:'TP2 '+fp(sig.tp2),   style:3, width:1 },
    { price:sig.obHigh,color:isShort?'rgba(255,68,68,0.4)':'rgba(0,200,136,0.4)', title:'OB↑', style:4, width:1 },
    { price:sig.obLow, color:isShort?'rgba(255,68,68,0.4)':'rgba(0,200,136,0.4)', title:'OB↓', style:4, width:1 },
  ];
  defs.forEach(d => {
    const pl = candle.createPriceLine({ price:d.price, color:d.color, lineWidth:d.width, lineStyle:d.style, axisLabelVisible:true, title:d.title });
    pricelines.push(pl);
  });
}

function buildSignalFromOBs(obs, cp, atr) {
  const bullish = obs.filter(o=>o.type==='bullish');
  const bearish = obs.filter(o=>o.type==='bearish');
  for(const ob of bearish) {
    if(cp>ob.low*0.97&&cp<ob.high*1.04) {
      const entry=(ob.high+ob.low)/2, sl=ob.high+atr*0.8, d=sl-entry; if(d<=0) continue;
      const near=bullish.find(o=>(o.high+o.low)/2<entry);
      const tp1=near?(near.high+near.low)/2:entry-d*1.5, tp2=entry-d*3;
      return {type:'short',entry,sl,tp1,tp2,obHigh:ob.high,obLow:ob.low,rr:Math.abs(tp1-entry)/d};
    }
  }
  for(const ob of bullish) {
    if(cp>ob.low*0.96&&cp<ob.high*1.06) {
      const entry=(ob.high+ob.low)/2, sl=ob.low-atr*0.8, d=entry-sl; if(d<=0) continue;
      const near=bearish.find(o=>(o.high+o.low)/2>entry);
      const tp1=near?(near.high+near.low)/2:entry+d*1.5, tp2=entry+d*3;
      return {type:'long',entry,sl,tp1,tp2,obHigh:ob.high,obLow:ob.low,rr:Math.abs(tp1-entry)/d};
    }
  }
  if(obs.length>0) {
    const near=obs.reduce((p,c)=>Math.abs((c.high+c.low)/2-cp)<Math.abs((p.high+p.low)/2-cp)?c:p);
    const isS=near.type==='bearish';
    const entry=(near.high+near.low)/2, sl=isS?near.high+atr*0.8:near.low-atr*0.8, d=Math.abs(sl-entry);
    if(d>0){const tp1=isS?entry-d*1.5:entry+d*1.5,tp2=isS?entry-d*3:entry+d*3;
      return {type:isS?'short':'long',entry,sl,tp1,tp2,obHigh:near.high,obLow:near.low,rr:Math.abs(tp1-entry)/d};}
  }
  return null;
}

// ── Fetch & render ────────────────────────────────────────────────────────────
let initialLoad = true;
let bars = [];

async function loadData() {
  document.getElementById('status').textContent = 'Loading klines...';
  try {
    // 1. Klines
    const kr = await fetch(TUNNEL+'/api/v1/prices/klines/'+BIN_SYM+'?interval='+INTERVAL+'&limit=300', {
      headers:{'X-API-Key':API_KEY}
    });
    const kd = await kr.json();
    bars = kd.data ?? [];
    if(!bars.length) throw new Error('No klines');

    const candles = bars.map(b=>({ time:Math.floor(new Date(b.timestamp).getTime()/1000), open:b.open, high:b.high, low:b.low, close:b.close }));
    const vols    = bars.map(b=>({ time:Math.floor(new Date(b.timestamp).getTime()/1000), value:b.volume, color:b.close>=b.open?'rgba(38,166,154,0.3)':'rgba(239,83,80,0.3)' }));
    candle.setData(candles);
    vol.setData(vols);
    if(initialLoad){ chart.timeScale().fitContent(); initialLoad=false; }

    const times = candles.map(c=>c.time);
    const cp    = candles[candles.length-1].close;
    const atr   = calcATR(bars);

    document.getElementById('status').textContent = SYMBOL+' · '+INTERVAL;

    // 2. AMD
    const ar = await fetch(TUNNEL+'/api/v1/analysis/amd', {
      method:'POST', headers:{'Content-Type':'application/json','X-API-Key':API_KEY},
      body:JSON.stringify({symbol:SYMBOL, timeframe:INTERVAL})
    });
    const ad = await ar.json();
    const data = ad.data ?? {};
    const obs  = data.order_blocks ?? [];

    // Markers
    const markers = [];
    obs.forEach(ob => {
      const t = snapTime(Math.floor(new Date(ob.open_time).getTime()/1000), times);
      markers.push({
        time:t,
        position: ob.type==='bearish'?'aboveBar':'belowBar',
        color:    ob.type==='bearish'?'#ef5350':'#26a69a',
        shape:    ob.type==='bearish'?'arrowDown':'arrowUp',
        text:     ob.type==='bearish'?'OB Short':'OB Long',
        size: Math.min(ob.strength??2,3),
      });
    });
    (data.fair_value_gaps??[]).slice(0,4).forEach(f=>{
      const t=snapTime(Math.floor(new Date(f.timestamp).getTime()/1000),times);
      markers.push({time:t,position:f.direction==='up'?'belowBar':'aboveBar',color:f.direction==='up'?'#00b8d9':'#ff8800',shape:'circle',text:'FVG'+(f.direction==='up'?'↑':'↓'),size:1});
    });
    markers.sort((a,b)=>a.time-b.time);
    candle.setMarkers(markers);

    // ── AMD zones on canvas ────────────────────────────────────────────
    // phase_history is no longer produced by the new detector.
    // Instead, build zones from: Asia range, Judas Swing, Order Blocks, FVGs.
    zones = [];

    // 1. Asia Range → accumulation zone (horizontal band, last 8 bars wide)
    const asiaRange = data.asia_range;
    if (asiaRange && asiaRange.high && asiaRange.low) {
      // span: use last 16 candle timestamps as width
      const span = candles.slice(-16);
      if (span.length >= 2) {
        zones.push({
          phase:      'accumulation',
          start_time: new Date(span[0].time * 1000).toISOString(),
          end_time:   new Date((candles[candles.length-1].time + 3600) * 1000).toISOString(),
          zone_high:  asiaRange.high,
          zone_low:   asiaRange.low,
          label:      'Asia Range',
        });
      }
    }

    // 2. Judas Swing → manipulation zone (spike candle region)
    const judas = data.judas_swing;
    if (judas && judas.sweep_time && asiaRange) {
      const sweepTs = Math.floor(new Date(judas.sweep_time).getTime() / 1000);
      const endTs   = sweepTs + 3600 * 3;  // 3 candles wide
      const sweepExtreme = judas.direction === 'down'
        ? judas.sweep_price  // below Asia low
        : judas.sweep_price; // above Asia high
      const [zHigh, zLow] = judas.direction === 'down'
        ? [asiaRange.low, sweepExtreme]
        : [sweepExtreme, asiaRange.high];
      zones.push({
        phase:      'manipulation',
        start_time: new Date(sweepTs * 1000).toISOString(),
        end_time:   new Date(endTs   * 1000).toISOString(),
        zone_high:  zHigh,
        zone_low:   zLow,
        label:      'Judas ' + (judas.direction === 'down' ? 'SSL' : 'BSL'),
      });
    }

    // 3. Order Blocks → distribution-colored boxes
    obs.forEach(ob => {
      if (!ob.open_time) return;
      const obTs  = Math.floor(new Date(ob.open_time).getTime() / 1000);
      const endTs = obTs + 3600 * 4;  // 4 candles wide
      zones.push({
        phase:      ob.type === 'bearish' ? 'distribution' : 'accumulation',
        start_time: new Date(obTs  * 1000).toISOString(),
        end_time:   new Date(endTs * 1000).toISOString(),
        zone_high:  ob.high,
        zone_low:   ob.low,
        label:      'OB',
      });
    });

    // 4. FVGs → semi-transparent manipulation color
    (data.fair_value_gaps ?? []).slice(0, 4).forEach(f => {
      if (!f.timestamp) return;
      const fTs  = Math.floor(new Date(f.timestamp).getTime() / 1000);
      const endTs = fTs + 3600 * 2;
      zones.push({
        phase:      'manipulation',
        start_time: new Date(fTs  * 1000).toISOString(),
        end_time:   new Date(endTs * 1000).toISOString(),
        zone_high:  f.gap_high,
        zone_low:   f.gap_low,
        label:      'FVG',
      });
    });

    drawZones();

    // Signal lines
    const sig = buildSignalFromOBs(obs, cp, atr);
    if(sig) {
      drawSignalLines(sig);
      // Post signal back to React Native
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({type:'signal', signal:sig, phase:data.current_phase??''}));
    }

    // Live WS update (only last candle)
    if(!window._wsStarted) {
      window._wsStarted = true;
      const ws = new WebSocket('wss://stream.binance.com:9443/ws/'+BIN_SYM.toLowerCase()+'@kline_'+INTERVAL);
      ws.onmessage = e => {
        const m=JSON.parse(e.data), k=m.k;
        if(!k) return;
        candle.update({time:Math.floor(k.t/1000),open:parseFloat(k.o),high:parseFloat(k.h),low:parseFloat(k.l),close:parseFloat(k.c)});
        vol.update({time:Math.floor(k.t/1000),value:parseFloat(k.v),color:parseFloat(k.c)>=parseFloat(k.o)?'rgba(38,166,154,0.3)':'rgba(239,83,80,0.3)'});
        drawZones();
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({type:'price',price:parseFloat(k.c)}));
      };
    }

  } catch(e) {
    document.getElementById('status').textContent = 'Error: '+e.message;
  }
}

loadData();
// Refresh AMD every 5 min (not klines — WS handles live)
setInterval(loadData, 300000);
</script>
</body>
</html>`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ChartScreen({ route, navigation }: Props) {
  const initSym = route.params?.symbol ?? 'BTC/USDT'
  const [symbol,    setSymbol]    = useState(initSym)
  const [tfIndex,   setTfIndex]   = useState(1)
  const [signal,    setSignal]    = useState<Signal | null>(null)
  const [phase,     setPhase]     = useState('')
  const [price,     setPrice]     = useState<number | null>(null)
  const [change24h, setChange24h] = useState<number | null>(null)
  const [micro,     setMicro]     = useState<MicroData | null>(null)
  const microTimer                = useRef<ReturnType<typeof setInterval> | null>(null)

  const tf = TIMEFRAMES[tfIndex]
  // KEY forces full WebView remount on symbol or timeframe change — fixes 4h blank bug
  const webviewKey = `${symbol}-${tf}`

  // Ticker
  useEffect(() => {
    fetchTickers().then(tickers => {
      const t = tickers[symbol]
      if (t) { setPrice(t.price); setChange24h(t.change_24h_pct) }
    }).catch(() => {})
    const id = setInterval(() => {
      fetchTickers().then(tickers => {
        const t = tickers[symbol]
        if (t) setPrice(t.price)
      }).catch(() => {})
    }, 5000)
    return () => clearInterval(id)
  }, [symbol])

  // Microstructure — fetch on symbol change, refresh every 30s
  useEffect(() => {
    setMicro(null)
    const load = () =>
      fetchMicrostructure(symbol, TUNNEL_URL, API_KEY).then(d => d && setMicro(d))
    load()
    if (microTimer.current) clearInterval(microTimer.current)
    microTimer.current = setInterval(load, 30000)
    return () => { if (microTimer.current) clearInterval(microTimer.current) }
  }, [symbol])

  const onMessage = useCallback((e: any) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data)
      if (msg.type === 'signal') {
        setSignal(msg.signal)
        setPhase(msg.phase ?? '')
      } else if (msg.type === 'price') {
        setPrice(msg.price)
      }
    } catch (_) {}
  }, [])

  const fp = (n: number) => {
    if (n >= 1000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })
    if (n >= 1)    return '$' + n.toFixed(2)
    return '$' + n.toFixed(4)
  }

  const isUp    = (change24h ?? 0) >= 0
  const isShort = signal?.type === 'short'

  const PHASE_COLOR: Record<string, string> = {
    accumulation: C.cyan, manipulation: C.orange, distribution: C.red,
  }

  const html = buildChartHTML(symbol, tf, TUNNEL_URL, API_KEY)

  return (
    <View style={s.root}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.sym}>{symbol}</Text>
          {price !== null &&
            <Text style={s.priceVal} numberOfLines={1}>{fp(price)}</Text>
          }
        </View>
        <View style={{ alignItems: 'flex-end', gap: 3, marginLeft: 8 }}>
          {change24h !== null &&
            <View style={[s.badge, { backgroundColor: isUp ? 'rgba(38,166,154,0.2)' : 'rgba(239,83,80,0.2)' }]}>
              <Text style={[s.badgeTxt, { color: isUp ? C.green : C.red }]}>
                {isUp ? '+' : ''}{change24h.toFixed(2)}%
              </Text>
            </View>
          }
          {phase && phase !== 'none' &&
            <View style={[s.phaseBadge, { borderColor: PHASE_COLOR[phase] ?? C.muted }]}>
              <Text style={[s.phaseTxt, { color: PHASE_COLOR[phase] ?? C.muted }]}>
                {phase === 'accumulation' ? '● A' : phase === 'manipulation' ? '▲ M' : '▼ D'}
              </Text>
            </View>
          }
        </View>
      </View>

      {/* Coin Selector — compact pill row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={s.coinScroll}
        contentContainerStyle={s.coinContent}>
        {ALL_COINS.map(c => (
          <TouchableOpacity key={c.sym}
            style={[s.coinBtn, c.sym === symbol && s.coinBtnActive]}
            onPress={() => { setSymbol(c.sym); setSignal(null) }}>
            <Text style={[s.coinTxt, c.sym === symbol && s.coinTxtActive]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Timeframe — inline with coin row to save vertical space */}
      <View style={s.tfRow}>
        {TIMEFRAMES.map((t, i) => (
          <TouchableOpacity key={t} style={[s.tfBtn, i === tfIndex && s.tfActive]} onPress={() => setTfIndex(i)}>
            <Text style={[s.tfTxt, i === tfIndex && s.tfActiveTxt]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* WebView Chart — key forces remount on symbol/tf change */}
      <WebView
        key={webviewKey}
        style={{ flex: 1, backgroundColor: C.bg }}
        originWhitelist={['*']}
        source={{ html, baseUrl: TUNNEL_URL }}
        javaScriptEnabled
        domStorageEnabled
        onMessage={onMessage}
        startInLoadingState
        renderLoading={() => (
          <View style={s.loader}>
            <ActivityIndicator color={C.cyan} size="large" />
          </View>
        )}
      />

      {/* Signal Bar */}
      {signal && (
        <View style={[s.sigBar, { borderLeftColor: isShort ? C.red : C.green }]}>
          <View style={[s.sigBadge, { backgroundColor: isShort ? C.red : C.green }]}>
            <Text style={s.sigBadgeTxt}>{isShort ? '▼ SHORT' : '▲ LONG'}</Text>
          </View>
          {[
            { l: 'Entry', v: signal.entry, c: isShort ? C.orange : C.cyan },
            { l: 'SL',    v: signal.sl,    c: C.red },
            { l: 'TP1',   v: signal.tp1,   c: C.green },
            { l: 'TP2',   v: signal.tp2,   c: '#00e676' },
          ].map(item => (
            <View key={item.l} style={s.sigLevel}>
              <Text style={s.sigLabel}>{item.l}</Text>
              <Text style={[s.sigVal, { color: item.c }]}>{fp(item.v)}</Text>
            </View>
          ))}
          <View style={s.sigLevel}>
            <Text style={s.sigLabel}>R:R</Text>
            <Text style={[s.sigVal, { color: C.text }]}>1:{signal.rr.toFixed(1)}</Text>
          </View>
        </View>
      )}

      {/* OFI + VAMP Microstructure Bar */}
      {micro && <MicroBar data={micro} />}

    </View>
  )
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  loader: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg } as any,

  // Header — compact, safe area top
  header:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 52, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: C.border },
  back:      { paddingRight: 10 },
  backTxt:   { color: C.cyan, fontSize: 20 },
  sym:       { color: C.text, fontSize: 13, fontWeight: '700' },
  priceVal:  { color: '#e8eef4', fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  badge:     { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeTxt:  { fontSize: 10, fontWeight: '700' },
  phaseBadge:{ paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  phaseTxt:  { fontSize: 9, fontWeight: '600' },

  // Coin selector — pill shaped, very compact
  coinScroll:  { borderBottomWidth: 1, borderBottomColor: C.border, flexGrow: 0 },
  coinContent: { paddingHorizontal: 8, paddingVertical: 5, gap: 5, flexDirection: 'row', alignItems: 'center' },
  coinBtn:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  coinBtnActive:{ backgroundColor: C.cyan, borderColor: C.cyan },
  coinTxt:     { color: C.muted, fontSize: 11, fontWeight: '600' },
  coinTxtActive:{ color: '#000' },

  // Timeframe — minimal height
  tfRow:      { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: C.border, gap: 6 },
  tfBtn:      { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  tfActive:   { backgroundColor: C.cyan, borderColor: C.cyan },
  tfTxt:      { color: C.muted, fontSize: 11, fontWeight: '600' },
  tfActiveTxt:{ color: '#000' },

  // Signal bar — compact
  sigBar:     { flexDirection: 'row', alignItems: 'center', borderLeftWidth: 3, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border },
  sigBadge:   { paddingHorizontal: 8, paddingVertical: 6, alignSelf: 'stretch', justifyContent: 'center', minWidth: 64 },
  sigBadgeTxt:{ color: '#fff', fontSize: 10, fontWeight: '800', textAlign: 'center' },
  sigLevel:   { flex: 1, paddingVertical: 4, paddingHorizontal: 2, alignItems: 'center' },
  sigLabel:   { color: C.muted, fontSize: 8, marginBottom: 1 },
  sigVal:     { fontSize: 10, fontWeight: '700', fontVariant: ['tabular-nums'] },
})

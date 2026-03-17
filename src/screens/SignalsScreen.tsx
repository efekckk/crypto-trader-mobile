import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native'
import TradeConfirmModal from '../components/TradeConfirmModal'
import {
  ConfluenceData, fetchConfluence,
  fetchSignalPerformance, fetchTickers, Signal, Stats,
} from '../services/api'
import {
  registerForPushNotifications,
  sendSignalNotification,
} from '../services/notifications'

const C = {
  bg:'#111111', card:'#1a1a1a', border:'#2a2a2a',
  green:'#26a69a', red:'#ef5350', cyan:'#00d4ff',
  text:'#e0e8f0', muted:'#555566', orange:'#ff9800',
}

const ALL_COINS = ['BTC','ETH','BNB','SOL','ADA','XRP','DOGE','LINK','DOT','AVAX','LTC','MATIC']
const TIMEFRAMES = ['1h','4h','1d']

function fp(n: number) {
  if (n >= 1000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (n >= 1)    return '$' + n.toFixed(2)
  return '$' + n.toFixed(4)
}

function scoreColor(s: number) {
  return s >= 70 ? C.green : s >= 45 ? C.orange : C.red
}

function strengthLabel(s: string) {
  return s === 'strong' ? '●●●●' : s === 'moderate' ? '●●●○' : s === 'weak' ? '●●○○' : '●○○○'
}

// ── Confluence Header Card ────────────────────────────────────────────────────
function ConfluenceCard({
  data, loading,
}: { data: ConfluenceData | null; loading: boolean }) {
  if (loading) {
    return (
      <View style={cs.card}>
        <ActivityIndicator color={C.cyan} size="small" />
        <Text style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>
          Running engines…
        </Text>
      </View>
    )
  }
  if (!data) return null

  const sc  = data.confluence_score
  const col = scoreColor(sc)
  const dir = data.direction
  const dirColor = dir === 'long' ? C.green : dir === 'short' ? C.red : C.muted
  const dirLabel = dir === 'long' ? '▲ LONG' : dir === 'short' ? '▼ SHORT' : '○ NEUTRAL'

  return (
    <View style={cs.card}>
      {/* Top row */}
      <View style={cs.topRow}>
        <View>
          <Text style={cs.label}>CONFLUENCE SCORE</Text>
          <Text style={[cs.bigScore, { color: col }]}>{sc}<Text style={{ fontSize: 14, color: C.muted }}>/100</Text></Text>
          <Text style={[cs.strengthDots, { color: col }]}>{strengthLabel(data.signal_strength)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <View style={[cs.dirBadge, { backgroundColor: dirColor + '22', borderColor: dirColor }]}>
            <Text style={[cs.dirTxt, { color: dirColor }]}>{dirLabel}</Text>
          </View>
          {data.should_notify && (
            <View style={cs.notifBadge}>
              <Text style={cs.notifTxt}>🔔 HIGH CONFIDENCE</Text>
            </View>
          )}
        </View>
      </View>

      {/* Engine breakdown bar */}
      <View style={cs.engRow}>
        {data.engines.map(e => (
          <View key={e.name} style={cs.engCell}>
            <Text style={[cs.engName, { color: scoreColor(e.score) }]}>{e.name}</Text>
            <Text style={[cs.engScore, { color: scoreColor(e.score) }]}>{Math.round(e.score)}</Text>
            {/* Mini bar */}
            <View style={cs.barBg}>
              <View style={[cs.barFill, { width: `${e.score}%` as any, backgroundColor: scoreColor(e.score) }]} />
            </View>
          </View>
        ))}
      </View>

      {/* Entry levels if available */}
      {data.entry_price && (
        <View style={cs.levelsRow}>
          {[
            { l: 'Entry', v: data.entry_price,   c: C.cyan  },
            { l: 'SL',    v: data.stop_loss,      c: C.red   },
            { l: 'TP1',   v: data.take_profit_1,  c: C.green },
            { l: 'TP2',   v: data.take_profit_2,  c: '#00e676' },
          ].filter(x => x.v).map(item => (
            <View key={item.l} style={cs.levelCell}>
              <Text style={cs.levelLbl}>{item.l}</Text>
              <Text style={[cs.levelVal, { color: item.c }]}>{fp(item.v!)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

const cs = StyleSheet.create({
  card:        { margin: 14, backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14 },
  topRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  label:       { fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 2 },
  bigScore:    { fontSize: 36, fontWeight: '800', fontVariant: ['tabular-nums'] as any },
  strengthDots:{ fontSize: 13, letterSpacing: 2, marginTop: 2 },
  dirBadge:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  dirTxt:      { fontSize: 12, fontWeight: '700' },
  notifBadge:  { backgroundColor: C.orange + '22', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  notifTxt:    { color: C.orange, fontSize: 9, fontWeight: '700' },
  engRow:      { flexDirection: 'row', gap: 6, marginBottom: 10 },
  engCell:     { flex: 1, alignItems: 'center' },
  engName:     { fontSize: 8, fontWeight: '700', marginBottom: 2 },
  engScore:    { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] as any },
  barBg:       { height: 3, width: '100%', backgroundColor: C.border, borderRadius: 2, marginTop: 3 },
  barFill:     { height: 3, borderRadius: 2 },
  levelsRow:   { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10, gap: 4 },
  levelCell:   { flex: 1, alignItems: 'center' },
  levelLbl:    { fontSize: 9, color: C.muted, marginBottom: 2 },
  levelVal:    { fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] as any },
})

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function SignalsScreen() {
  const [symbol,      setSymbol]      = useState('BTC')
  const [timeframe,   setTimeframe]   = useState('1h')
  const [signals,     setSignals]     = useState<Signal[]>([])
  const [stats,       setStats]       = useState<Stats | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [tickers,     setTickers]     = useState<Record<string, any>>({})
  const [expanded,    setExpanded]    = useState<number | null>(null)
  const [tradeModal,  setTradeModal]  = useState(false)
  const [tradeSig,    setTradeSig]    = useState<Signal | null>(null)

  // Confluence state
  const [confluence,     setConfluence]     = useState<ConfluenceData | null>(null)
  const [confluenceLoad, setConfluenceLoad] = useState(false)

  const notifRegistered = useRef(false)
  const notifiedIds     = useRef<Set<number>>(new Set())

  // Push notification registration
  useEffect(() => {
    if (!notifRegistered.current) {
      notifRegistered.current = true
      registerForPushNotifications().catch(() => {})
    }
  }, [])

  // Live tickers
  useEffect(() => {
    fetchTickers().then(setTickers).catch(() => {})
    const id = setInterval(() => fetchTickers().then(setTickers).catch(() => {}), 5000)
    return () => clearInterval(id)
  }, [])

  // Confluence — reload on coin or timeframe change
  const loadConfluence = useCallback(async (sym: string, tf: string) => {
    setConfluenceLoad(true)
    try {
      const data = await fetchConfluence(`${sym}USDT`, tf)
      setConfluence(data)
      // Push notification if should_notify
      if (data?.should_notify && data.confluence_score >= 75) {
        sendSignalNotification({
          symbol:          `${sym}/USDT`,
          direction:       data.direction as any,
          confluenceScore: data.confluence_score,
          entryPrice:      data.entry_price,
          stopLoss:        data.stop_loss,
          takeProfit1:     data.take_profit_1,
          sources:         data.sources,
        }).catch(() => {})
      }
    } catch { setConfluence(null) }
    finally  { setConfluenceLoad(false) }
  }, [])

  // Signals
  const load = useCallback(async (sym: string, tf: string) => {
    setLoading(true); setError(null)
    try {
      const r = await fetchSignalPerformance(`${sym}USDT`, tf, 300)
      const reversed = [...(r.signals ?? [])].reverse()
      setSignals(reversed)
      setStats(r.stats)

      // Local notif for high-score AMD signals not yet seen
      for (const sig of reversed) {
        const score = (sig as any).confluence_score ?? 0
        if (sig.outcome === 'open' && score >= 65 && !notifiedIds.current.has(sig.id)) {
          notifiedIds.current.add(sig.id)
          sendSignalNotification({
            symbol:          `${sym}/USDT`,
            direction:       sig.type === 'long' ? 'long' : 'short',
            confluenceScore: score,
            entryPrice:      sig.entry,
            stopLoss:        sig.sl,
            takeProfit1:     sig.tp1,
            sources:         (sig as any).sources ?? [],
          }).catch(() => {})
        }
      }
    } catch { setError(`Failed to load signals for ${sym}`) }
    finally  { setLoading(false) }
  }, [])

  useEffect(() => {
    load(symbol, timeframe)
    loadConfluence(symbol, timeframe)
  }, [symbol, timeframe])

  const currentPnl = (sig: Signal) => {
    if (sig.outcome !== 'open') return null
    const ticker = tickers[`${symbol}/USDT`]
    if (!ticker) return null
    const cp  = ticker.price
    const pnl = sig.type === 'long'
      ? ((cp - sig.entry) / sig.entry) * 100
      : ((sig.entry - cp) / sig.entry) * 100
    return { pnl, price: cp }
  }

  const openSignals = signals.filter(s => s.outcome === 'open')

  return (
    <ScrollView style={s.root} contentContainerStyle={{ paddingBottom: 40 }}>

      {/* Header */}
      <View style={s.hdr}>
        <Text style={s.hdrTitle}>Signals</Text>
        {confluence && (
          <Text style={{ color: scoreColor(confluence.confluence_score), fontSize: 13, fontWeight: '700' }}>
            {confluence.confluence_score}/100
          </Text>
        )}
      </View>

      {/* Coin selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={s.coinScroll} contentContainerStyle={s.coinContent}>
        {ALL_COINS.map(c => (
          <TouchableOpacity key={c}
            style={[s.chip, c === symbol && s.chipActive]}
            onPress={() => setSymbol(c)}>
            <Text style={[s.chipTxt, c === symbol && s.chipTxtActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Timeframe */}
      <View style={s.tfRow}>
        {TIMEFRAMES.map(tf => (
          <TouchableOpacity key={tf}
            style={[s.tfBtn, tf === timeframe && s.tfActive]}
            onPress={() => setTimeframe(tf)}>
            <Text style={[s.tfTxt, tf === timeframe && s.tfActiveTxt]}>{tf}</Text>
          </TouchableOpacity>
        ))}
        {/* Refresh confluence manually */}
        <TouchableOpacity
          style={[s.tfBtn, { marginLeft: 'auto' as any }]}
          onPress={() => loadConfluence(symbol, timeframe)}
          disabled={confluenceLoad}>
          <Text style={{ color: confluenceLoad ? C.muted : C.cyan, fontSize: 11, fontWeight: '600' }}>
            {confluenceLoad ? '…' : '↻ Analysis'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Confluence Card ── */}
      <ConfluenceCard data={confluence} loading={confluenceLoad} />

      {loading ? (
        <View style={s.centered}><ActivityIndicator color={C.cyan} size="large" /></View>
      ) : error ? (
        <View style={s.centered}>
          <Text style={{ color: C.red, fontSize: 13 }}>{error}</Text>
        </View>
      ) : (
        <>
          {/* ── Active Positions ── */}
          {openSignals.length > 0 && (
            <View style={s.section}>
              <Text style={s.secTitle}>Active Positions</Text>
              {openSignals.map(sig => {
                const live   = currentPnl(sig)
                const isLong = sig.type === 'long'
                const score  = (sig as any).confluence_score ?? 0
                return (
                  <View key={sig.id} style={[s.activeCard, { borderLeftColor: isLong ? C.green : C.red }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={[s.dirBadge, { backgroundColor: isLong ? C.green : C.red }]}>
                          <Text style={s.dirTxt}>{isLong ? '▲ LONG' : '▼ SHORT'}</Text>
                        </View>
                        <Text style={s.activeSym}>{symbol}/USDT</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 3 }}>
                        {live && (
                          <Text style={[s.livePnl, { color: live.pnl >= 0 ? C.green : C.red }]}>
                            {live.pnl >= 0 ? '+' : ''}{live.pnl.toFixed(2)}%
                          </Text>
                        )}
                        {score > 0 && (
                          <Text style={{ color: scoreColor(score), fontSize: 11, fontWeight: '700' }}>
                            {score}/100
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={s.levelRow}>
                      {[
                        { l:'Entry', v:sig.entry, c: isLong ? C.cyan : C.orange },
                        { l:'Now',   v:live?.price ?? sig.entry, c: C.text },
                        { l:'SL',    v:sig.sl,    c: C.red },
                        { l:'TP1',   v:sig.tp1,   c: C.green },
                      ].map(it => (
                        <View key={it.l} style={s.levelItem}>
                          <Text style={s.levelLbl}>{it.l}</Text>
                          <Text style={[s.levelVal, { color: it.c }]}>{fp(it.v)}</Text>
                        </View>
                      ))}
                    </View>
                    {(sig as any).sources?.length > 0 && (
                      <View style={{ marginTop: 6 }}>
                        <Text style={{ color: C.muted, fontSize: 9, marginBottom: 3 }}>AMD ANALYSIS</Text>
                        {(sig as any).sources.map((src: string, i: number) => (
                          <Text key={i} style={{ color: C.muted, fontSize: 10 }}>• {src}</Text>
                        ))}
                      </View>
                    )}
                    <TouchableOpacity
                      style={[s.tradeBtn, { backgroundColor: isLong ? C.green : C.red }]}
                      onPress={() => { setTradeSig(sig); setTradeModal(true) }}>
                      <Text style={s.tradeBtnTxt}>{isLong ? '▲ BUY' : '▼ SELL'} {symbol}</Text>
                    </TouchableOpacity>
                  </View>
                )
              })}
            </View>
          )}

          {/* ── Performance Stats ── */}
          {stats && (
            <View style={s.section}>
              <Text style={s.secTitle}>Performance  {symbol} {timeframe}</Text>
              <View style={s.statsGrid}>
                {[
                  { l:'Total',         v: String(stats.total),                                              c: C.text },
                  { l:'Win Rate',      v: `${stats.win_rate}%`,                                             c: stats.win_rate >= 50 ? C.green : C.red },
                  { l:'Total PnL',     v: `${stats.total_pnl >= 0 ? '+' : ''}${stats.total_pnl}%`,         c: stats.total_pnl >= 0 ? C.green : C.red },
                  { l:'Profit Factor', v: String(stats.profit_factor),                                     c: stats.profit_factor >= 1.5 ? C.green : C.orange },
                  { l:'Avg Win',       v: `+${stats.avg_win}%`,                                            c: C.green },
                  { l:'Avg Loss',      v: `${stats.avg_loss}%`,                                            c: C.red },
                ].map(item => (
                  <View key={item.l} style={s.statCell}>
                    <Text style={s.statLbl}>{item.l}</Text>
                    <Text style={[s.statVal, { color: item.c }]}>{item.v}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Signal History ── */}
          <View style={s.section}>
            <Text style={s.secTitle}>Signal History</Text>
            {signals.length === 0 ? (
              <View style={s.emptyCard}>
                <Text style={{ color: C.muted, fontSize: 13 }}>No signals for {symbol} {timeframe}</Text>
              </View>
            ) : signals.map(sig => {
              const isLong = sig.type === 'long'
              const live   = currentPnl(sig)
              const isExp  = expanded === sig.id
              const score  = (sig as any).confluence_score ?? 0
              const sCol   = scoreColor(score)

              return (
                <TouchableOpacity key={sig.id} activeOpacity={0.85}
                  onPress={() => setExpanded(isExp ? null : sig.id)}
                  style={[s.sigCard, { borderLeftColor: isLong ? C.green : C.red }]}>

                  <View style={s.sigRow1}>
                    <Text style={s.sigDate}>
                      {new Date(sig.timestamp).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                      {'\n'}
                      {new Date(sig.timestamp).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}
                    </Text>

                    <View style={[s.dirBadge2, { backgroundColor: isLong ? C.green+'22' : C.red+'22', marginLeft: 4 }]}>
                      <Text style={[s.dirTxt2, { color: isLong ? C.green : C.red }]}>
                        {isLong ? '▲ LONG' : '▼ SHORT'}
                      </Text>
                    </View>

                    <View style={{ flex: 1, paddingLeft: 8 }}>
                      <Text style={s.sigEntryLbl}>Entry</Text>
                      <Text style={s.sigEntryVal}>{fp(sig.entry)}</Text>
                      <Text style={s.sigSlTp}>SL -{sig.sl_pct?.toFixed(1)}%  TP +{sig.tp1_pct?.toFixed(1)}%</Text>
                    </View>

                    <View style={{ alignItems: 'flex-end', gap: 3 }}>
                      <View style={[s.scoreBadge, { borderColor: sCol }]}>
                        <Text style={[s.scoreTxt, { color: sCol }]}>{score}</Text>
                      </View>
                      <View style={[s.outBadge, {
                        backgroundColor: sig.outcome === 'tp1' || sig.outcome === 'tp2' ? C.green+'22'
                          : sig.outcome === 'sl' ? C.red+'22' : C.orange+'22',
                      }]}>
                        <Text style={[s.outTxt, {
                          color: sig.outcome === 'tp1' || sig.outcome === 'tp2' ? C.green
                            : sig.outcome === 'sl' ? C.red : C.orange,
                        }]}>
                          {sig.outcome === 'tp1' ? 'TP1 ✓' : sig.outcome === 'tp2' ? 'TP2 ✓'
                            : sig.outcome === 'sl' ? 'SL ✗' : 'Open'}
                        </Text>
                      </View>
                      <Text style={[s.pnlTxt, { color: sig.pnl_pct >= 0 ? C.green : C.red }]}>
                        {sig.pnl_pct >= 0 ? '+' : ''}{sig.pnl_pct.toFixed(2)}%
                      </Text>
                    </View>
                  </View>

                  {isExp && (
                    <View style={s.expandedBox}>
                      <View style={s.levelRow}>
                        {[
                          { l:'SL',  v:fp(sig.sl),   c:C.red },
                          { l:'TP1', v:fp(sig.tp1),  c:C.green },
                          { l:'TP2', v:fp(sig.tp2),  c:'#00e676' },
                          { l:'R:R', v:`1:${sig.rr}`, c:C.text },
                        ].map(it => (
                          <View key={it.l} style={s.levelItem}>
                            <Text style={s.levelLbl}>{it.l}</Text>
                            <Text style={[s.levelVal, { color: it.c }]}>{it.v}</Text>
                          </View>
                        ))}
                      </View>

                      {(sig as any).sources?.length > 0 && (
                        <View style={{ marginTop: 8 }}>
                          <Text style={{ color: C.muted, fontSize: 9, marginBottom: 3 }}>CONFLUENCE SOURCES</Text>
                          {(sig as any).sources.map((src: string, i: number) => (
                            <Text key={i} style={{ color: C.muted, fontSize: 10, marginBottom: 2 }}>• {src}</Text>
                          ))}
                        </View>
                      )}

                      {live && (
                        <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ color: C.muted, fontSize: 10 }}>Now: {fp(live.price)}</Text>
                          <Text style={[{ fontSize: 11, fontWeight: '700' }, { color: live.pnl >= 0 ? C.green : C.red }]}>
                            {live.pnl >= 0 ? '+' : ''}{live.pnl.toFixed(2)}%
                          </Text>
                        </View>
                      )}

                      {sig.outcome === 'open' && (
                        <TouchableOpacity
                          style={[s.tradeBtn, { backgroundColor: isLong ? C.green : C.red, marginTop: 8 }]}
                          onPress={() => { setTradeSig(sig); setTradeModal(true) }}>
                          <Text style={s.tradeBtnTxt}>{isLong ? '▲ BUY' : '▼ SELL'} {symbol}/USDT</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              )
            })}
          </View>
        </>
      )}

      <TradeConfirmModal
        visible={tradeModal}
        signal={tradeSig}
        symbol={symbol}
        onClose={() => { setTradeModal(false); setTradeSig(null) }}
        onSuccess={() => {}}
      />
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: C.bg },
  hdr:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  hdrTitle: { fontSize: 22, fontWeight: '700', color: C.text },
  centered: { paddingVertical: 60, alignItems: 'center' },

  coinScroll:   { borderBottomWidth: 1, borderBottomColor: C.border },
  coinContent:  { paddingHorizontal: 12, paddingVertical: 7, gap: 6, flexDirection: 'row' },
  chip:         { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  chipActive:   { backgroundColor: C.cyan, borderColor: C.cyan },
  chipTxt:      { color: C.muted, fontSize: 11, fontWeight: '600' },
  chipTxtActive:{ color: '#000' },

  tfRow:      { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border, gap: 6, alignItems: 'center' },
  tfBtn:      { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 6, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  tfActive:   { backgroundColor: C.cyan, borderColor: C.cyan },
  tfTxt:      { color: C.muted, fontSize: 12, fontWeight: '600' },
  tfActiveTxt:{ color: '#000' },

  section:    { marginHorizontal: 14, marginTop: 14 },
  secTitle:   { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 8 },

  activeCard: { backgroundColor: C.card, borderRadius: 10, borderLeftWidth: 3, borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderTopColor: C.border, borderRightColor: C.border, borderBottomColor: C.border, padding: 12, marginBottom: 8 },
  dirBadge:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  dirTxt:     { fontSize: 11, fontWeight: '800', color: '#fff' },
  dirBadge2:  { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 },
  dirTxt2:    { fontSize: 10, fontWeight: '700' },
  activeSym:  { color: C.text, fontSize: 13, fontWeight: '600' },
  livePnl:    { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] as any },
  levelRow:   { flexDirection: 'row', marginTop: 8, gap: 4 },
  levelItem:  { flex: 1, alignItems: 'center' },
  levelLbl:   { color: C.muted, fontSize: 9, marginBottom: 2 },
  levelVal:   { color: C.text, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] as any },

  statsGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCell:   { flex: 1, minWidth: '44%', backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.border, padding: 10 },
  statLbl:    { fontSize: 10, color: C.muted, marginBottom: 3 },
  statVal:    { fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] as any },

  sigCard:    { backgroundColor: C.card, borderLeftWidth: 3, borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderTopColor: C.border, borderRightColor: C.border, borderBottomColor: C.border, borderRadius: 8, padding: 10, marginBottom: 6 },
  sigRow1:    { flexDirection: 'row', alignItems: 'center' },
  sigDate:    { color: C.muted, fontSize: 10, width: 56, lineHeight: 14 },
  sigEntryLbl:{ color: C.muted, fontSize: 9 },
  sigEntryVal:{ color: C.text, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] as any },
  sigSlTp:    { color: C.muted, fontSize: 9 },
  scoreBadge: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  scoreTxt:   { fontSize: 9, fontWeight: '700' },
  outBadge:   { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  outTxt:     { fontSize: 10, fontWeight: '600' },
  pnlTxt:     { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] as any },
  expandedBox:{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border },
  emptyCard:  { backgroundColor: C.card, borderRadius: 8, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  tradeBtn:   { marginTop: 10, borderRadius: 7, paddingVertical: 9, alignItems: 'center' },
  tradeBtnTxt:{ color: '#000', fontSize: 13, fontWeight: '800' },
})

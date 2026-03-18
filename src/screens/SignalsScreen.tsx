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

// ── Cache ─────────────────────────────────────────────────────────────────────
// Module-level: hayatta kalır, tab değişimlerinde kaybolmaz
interface CacheEntry<T> {
  data:      T
  fetchedAt: number   // ms
}

const SIGNAL_CACHE   = new Map<string, CacheEntry<{ signals: Signal[]; stats: Stats | null }>>()
const CONFLUENCE_CACHE = new Map<string, CacheEntry<ConfluenceData>>()

const SIGNAL_TTL     = 5 * 60 * 1000    // 5 dakika — sinyaller sık değişmez
const CONFLUENCE_TTL = 3 * 60 * 1000    // 3 dakika — confluence daha dinamik
const BG_REFRESH_MS  = 4 * 60 * 1000    // 4 dakikada bir arka planda refresh

function cacheKey(sym: string, tf: string) { return `${sym}_${tf}` }

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
  data, loading, stale,
}: { data: ConfluenceData | null; loading: boolean; stale?: boolean }) {
  if (loading && !data) {
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

  const sc       = data.confluence_score
  const col      = scoreColor(sc)
  const dir      = data.direction
  const dirColor = dir === 'long' ? C.green : dir === 'short' ? C.red : C.muted
  const dirLabel = dir === 'long' ? '▲ LONG' : dir === 'short' ? '▼ SHORT' : '○ NEUTRAL'

  return (
    <View style={[cs.card, stale && { opacity: 0.85 }]}>
      <View style={cs.topRow}>
        <View>
          <Text style={cs.label}>
            CONFLUENCE SCORE{stale ? '  ·  refreshing…' : ''}
          </Text>
          <Text style={[cs.bigScore, { color: col }]}>
            {sc}<Text style={{ fontSize: 14, color: C.muted }}>/100</Text>
          </Text>
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

      <View style={cs.engRow}>
        {data.engines.map(e => (
          <View key={e.name} style={cs.engCell}>
            <Text style={[cs.engName, { color: scoreColor(e.score) }]}>{e.name}</Text>
            <Text style={[cs.engScore, { color: scoreColor(e.score) }]}>{Math.round(e.score)}</Text>
            <View style={cs.barBg}>
              <View style={[cs.barFill, { width: `${e.score}%` as any, backgroundColor: scoreColor(e.score) }]} />
            </View>
          </View>
        ))}
      </View>

      {data.entry_price && (
        <View style={cs.levelsRow}>
          {[
            { l: 'Entry', v: data.entry_price,   c: C.cyan    },
            { l: 'SL',    v: data.stop_loss,      c: C.red     },
            { l: 'TP1',   v: data.take_profit_1,  c: C.green   },
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
  card:         { margin: 14, backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14 },
  topRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  label:        { fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 2 },
  bigScore:     { fontSize: 36, fontWeight: '800', fontVariant: ['tabular-nums'] as any },
  strengthDots: { fontSize: 13, letterSpacing: 2, marginTop: 2 },
  dirBadge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  dirTxt:       { fontSize: 12, fontWeight: '700' },
  notifBadge:   { backgroundColor: C.orange + '22', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  notifTxt:     { color: C.orange, fontSize: 9, fontWeight: '700' },
  engRow:       { flexDirection: 'row', gap: 6, marginBottom: 10 },
  engCell:      { flex: 1, alignItems: 'center' },
  engName:      { fontSize: 8, fontWeight: '700', marginBottom: 2 },
  engScore:     { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] as any },
  barBg:        { height: 3, width: '100%', backgroundColor: C.border, borderRadius: 2, marginTop: 3 },
  barFill:      { height: 3, borderRadius: 2 },
  levelsRow:    { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10, gap: 4 },
  levelCell:    { flex: 1, alignItems: 'center' },
  levelLbl:     { fontSize: 9, color: C.muted, marginBottom: 2 },
  levelVal:     { fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] as any },
})

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function SignalsScreen() {
  const [symbol,     setSymbol]     = useState('BTC')
  const [timeframe,  setTimeframe]  = useState('1h')
  const [signals,    setSignals]    = useState<Signal[]>([])
  const [stats,      setStats]      = useState<Stats | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [sigStale,   setSigStale]   = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [tickers,    setTickers]    = useState<Record<string, any>>({})
  const [expanded,   setExpanded]   = useState<number | null>(null)
  const [tradeModal, setTradeModal] = useState(false)
  const [tradeSig,   setTradeSig]   = useState<Signal | null>(null)

  const [confluence,     setConfluence]     = useState<ConfluenceData | null>(null)
  const [confluenceLoad, setConfluenceLoad] = useState(false)
  const [confStale,      setConfStale]      = useState(false)

  const notifRegistered = useRef(false)
  const notifiedIds     = useRef<Set<number>>(new Set())
  const bgTimer         = useRef<ReturnType<typeof setInterval> | null>(null)
  const isMounted       = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  // Push notification — bir kez
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

  // ── Signal fetch (cache-first) ─────────────────────────────────────────────
  const fetchSignals = useCallback(async (sym: string, tf: string, background = false) => {
    const key     = cacheKey(sym, tf)
    const cached  = SIGNAL_CACHE.get(key)
    const now     = Date.now()
    const isStale = !cached || (now - cached.fetchedAt) > SIGNAL_TTL

    // Cache varsa hemen göster
    if (cached) {
      if (!background) {
        setSignals(cached.data.signals)
        setStats(cached.data.stats)
        setLoading(false)
        setError(null)
      }
      // Stale değilse fetch etme
      if (!isStale) { setSigStale(false); return }
    }

    // Fetch (loading sadece ilk yüklemede göster)
    if (!background && !cached) setLoading(true)
    setSigStale(background && !!cached)

    try {
      // ~1 ay: 1h=720, 4h=180, 1d=90 — good balance of data vs speed
      const limits: Record<string, number> = { '1h': 720, '4h': 180, '1d': 90 }
      const r = await fetchSignalPerformance(`${sym}USDT`, tf, limits[tf] ?? 720)
      const reversed = [...(r.signals ?? [])].reverse()

      // Cache'e yaz
      SIGNAL_CACHE.set(key, {
        data:      { signals: reversed, stats: r.stats },
        fetchedAt: Date.now(),
      })

      if (!isMounted.current) return

      // Sadece hâlâ bu coin/tf görüntüleniyorsa state'i güncelle
      setSignals(prev => {
        // Background refresh — farklı coindeyse güncelleme, cache zaten yazıldı
        return reversed
      })
      setStats(r.stats)
      setError(null)
      setSigStale(false)

      // Push notification — yeni açık sinyaller
      for (const sig of reversed) {
        const score = (sig as any).confluence_score ?? 0
        if (sig.outcome === 'open' && score >= 65 && !notifiedIds.current.has(sig.id)) {
          notifiedIds.current.add(sig.id)
          sendSignalNotification({
            symbol: `${sym}/USDT`, direction: sig.type === 'long' ? 'long' : 'short',
            confluenceScore: score, entryPrice: sig.entry, stopLoss: sig.sl,
            takeProfit1: sig.tp1, sources: (sig as any).sources ?? [],
          }).catch(() => {})
        }
      }
    } catch (e) {
      if (!isMounted.current) return
      if (!cached) setError(`Failed to load signals for ${sym}`)
      setSigStale(false)
    } finally {
      if (!isMounted.current) return
      setLoading(false)
    }
  }, [])

  // ── Confluence fetch (cache-first) ─────────────────────────────────────────
  const fetchConf = useCallback(async (sym: string, tf: string, background = false) => {
    const key     = cacheKey(sym, tf) + '_conf'
    const cached  = CONFLUENCE_CACHE.get(key)
    const now     = Date.now()
    const isStale = !cached || (now - cached.fetchedAt) > CONFLUENCE_TTL

    if (cached) {
      if (!background) { setConfluence(cached.data); setConfluenceLoad(false) }
      if (!isStale) { setConfStale(false); return }
    }

    if (!background && !cached) setConfluenceLoad(true)
    setConfStale(background && !!cached)

    try {
      const data = await fetchConfluence(`${sym}USDT`, tf)
      if (!data || !isMounted.current) return

      CONFLUENCE_CACHE.set(key, { data, fetchedAt: Date.now() })
      setConfluence(data)
      setConfStale(false)

      if (data.should_notify && data.confluence_score >= 75) {
        sendSignalNotification({
          symbol: `${sym}/USDT`, direction: data.direction as any,
          confluenceScore: data.confluence_score, entryPrice: data.entry_price,
          stopLoss: data.stop_loss, takeProfit1: data.take_profit_1,
          sources: data.sources,
        }).catch(() => {})
      }
    } catch {
      if (!isMounted.current) return
      setConfStale(false)
    } finally {
      if (!isMounted.current) return
      setConfluenceLoad(false)
    }
  }, [])

  // ── Coin/timeframe değişince: cache'den anında yükle, sonra background fetch ─
  useEffect(() => {
    // Önce cache'den göster
    const sigKey  = cacheKey(symbol, timeframe)
    const confKey = sigKey + '_conf'
    const sigC    = SIGNAL_CACHE.get(sigKey)
    const confC   = CONFLUENCE_CACHE.get(confKey)

    if (sigC) {
      setSignals(sigC.data.signals)
      setStats(sigC.data.stats)
      setLoading(false)
      setError(null)
    } else {
      setLoading(true)
      setSignals([])
      setStats(null)
    }

    if (confC) {
      setConfluence(confC.data)
      setConfluenceLoad(false)
    } else {
      setConfluence(null)
    }

    // Fetch (background eğer cache varsa)
    fetchSignals(symbol, timeframe, !!sigC)
    fetchConf(symbol, timeframe, !!confC)
  }, [symbol, timeframe])

  // ── Background refresh timer — tüm 12 coin'i sırayla önbellekle ──────────
  useEffect(() => {
    // Her 4 dakikada bir aktif coin'i refresh et
    bgTimer.current = setInterval(() => {
      fetchSignals(symbol, timeframe, true)
      fetchConf(symbol, timeframe, true)
    }, BG_REFRESH_MS)

    return () => { if (bgTimer.current) clearInterval(bgTimer.current) }
  }, [symbol, timeframe])

  // ── Arka planda diğer coinleri de önbellekle (prefetch) ───────────────────
  useEffect(() => {
    // Uygulama açılışında BTC/ETH/BNB/SOL'u önden yükle
    const PREFETCH = ['BTC', 'ETH', 'SOL', 'BNB']
    const delay    = 3000  // ilk yüklemeden 3 sn sonra başla

    const t = setTimeout(() => {
      PREFETCH.filter(c => c !== symbol).forEach((coin, i) => {
        setTimeout(() => {
          const key = cacheKey(coin, timeframe)
          if (!SIGNAL_CACHE.has(key)) fetchSignals(coin, timeframe, true)
        }, i * 2000)  // 2'şer saniye arayla
      })
    }, delay)

    return () => clearTimeout(t)
  }, [timeframe])

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

  // ── Collect ALL open signals across all cached coins ──────────
  const allOpenSignals: { coin: string; signal: Signal; live: { pnl: number; price: number } | null }[] = []
  for (const coin of ALL_COINS) {
    const key = cacheKey(coin, timeframe)
    const cached = SIGNAL_CACHE.get(key)
    if (!cached) continue
    const opens = cached.data.signals.filter((sg: Signal) => sg.outcome === 'open')
    for (const sig of opens) {
      const ticker = tickers[`${coin}/USDT`]
      let live = null
      if (ticker) {
        const cp = ticker.price
        const pnl = sig.type === 'long'
          ? ((cp - sig.entry) / sig.entry) * 100
          : ((sig.entry - cp) / sig.entry) * 100
        live = { pnl, price: cp }
      }
      allOpenSignals.push({ coin, signal: sig, live })
    }
  }
  // Sort: newest first
  allOpenSignals.sort((a, b) => new Date(b.signal.timestamp).getTime() - new Date(a.signal.timestamp).getTime())

  return (
    <ScrollView style={s.root} contentContainerStyle={{ paddingBottom: 40 }}>

      {/* Header */}
      <View style={s.hdr}>
        <Text style={s.hdrTitle}>Signals</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {sigStale && <ActivityIndicator size="small" color={C.muted} />}
          {allOpenSignals.length > 0 && (
            <View style={s.openCountBadge}>
              <Text style={s.openCountTxt}>{allOpenSignals.length} open</Text>
            </View>
          )}
          {confluence && (
            <Text style={{ color: scoreColor(confluence.confluence_score), fontSize: 13, fontWeight: '700' }}>
              {confluence.confluence_score}/100
            </Text>
          )}
        </View>
      </View>

      {/* ── ALL OPEN POSITIONS (cross-coin) ── */}
      {allOpenSignals.length > 0 && (
        <View style={s.openSection}>
          <Text style={s.openTitle}>Open Positions</Text>
          {allOpenSignals.map((item, idx) => {
            const { coin, signal: sig, live } = item
            const isLong = sig.type === 'long'
            const score  = (sig as any).confluence_score ?? 0
            return (
              <TouchableOpacity
                key={`${coin}-${sig.id}-${idx}`}
                style={[s.openCard, { borderLeftColor: isLong ? C.green : C.red }]}
                activeOpacity={0.8}
                onPress={() => { setSymbol(coin); setTradeSig(sig); setTradeModal(true) }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
                  <View style={[s.openDirBadge, { backgroundColor: isLong ? C.green : C.red }]}>
                    <Text style={s.openDirTxt}>{isLong ? '▲' : '▼'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.openCoin}>{coin}/USDT</Text>
                    <Text style={s.openEntry}>Entry {fp(sig.entry)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    {live && (
                      <Text style={[s.openPnl, { color: live.pnl >= 0 ? C.green : C.red }]}>
                        {live.pnl >= 0 ? '+' : ''}{live.pnl.toFixed(2)}%
                      </Text>
                    )}
                    {score > 0 && (
                      <Text style={{ color: scoreColor(score), fontSize: 10, fontWeight: '600' }}>
                        {score}/100
                      </Text>
                    )}
                    <Text style={{ color: C.muted, fontSize: 9 }}>
                      {new Date(sig.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            )
          })}
        </View>
      )}

      {/* Coin selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={s.coinScroll} contentContainerStyle={s.coinContent}>
        {ALL_COINS.map(c => {
          // Önbellekte var mı — yeşil nokta göster
          const hasCache = SIGNAL_CACHE.has(cacheKey(c, timeframe))
          return (
            <TouchableOpacity key={c}
              style={[s.chip, c === symbol && s.chipActive]}
              onPress={() => setSymbol(c)}>
              <Text style={[s.chipTxt, c === symbol && s.chipTxtActive]}>{c}</Text>
              {hasCache && c !== symbol && (
                <View style={s.cacheDot} />
              )}
            </TouchableOpacity>
          )
        })}
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
        <TouchableOpacity
          style={[s.tfBtn, { marginLeft: 'auto' as any }]}
          onPress={() => {
            // Manuel refresh — cache'i sil
            SIGNAL_CACHE.delete(cacheKey(symbol, timeframe))
            CONFLUENCE_CACHE.delete(cacheKey(symbol, timeframe) + '_conf')
            fetchSignals(symbol, timeframe, false)
            fetchConf(symbol, timeframe, false)
          }}
          disabled={loading || confluenceLoad}>
          <Text style={{ color: loading ? C.muted : C.cyan, fontSize: 11, fontWeight: '600' }}>
            {loading ? '…' : '↻ Refresh'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Confluence Card */}
      <ConfluenceCard data={confluence} loading={confluenceLoad} stale={confStale} />

      {/* Content */}
      {loading && signals.length === 0 ? (
        <View style={s.centered}>
          <ActivityIndicator color={C.cyan} size="large" />
          <Text style={{ color: C.muted, marginTop: 10, fontSize: 12 }}>Loading {symbol} signals…</Text>
        </View>
      ) : error && signals.length === 0 ? (
        <View style={s.centered}>
          <Text style={{ color: C.red, fontSize: 13 }}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => {
            SIGNAL_CACHE.delete(cacheKey(symbol, timeframe))
            fetchSignals(symbol, timeframe, false)
          }}>
            <Text style={{ color: C.cyan, fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Active Positions */}
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
                        { l:'Entry', v:sig.entry,       c: isLong ? C.cyan : C.orange },
                        { l:'Now',   v:live?.price ?? sig.entry, c: C.text },
                        { l:'SL',    v:sig.sl,           c: C.red },
                        { l:'TP1',   v:sig.tp1,          c: C.green },
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

          {/* Stats */}
          {stats && (
            <View style={s.section}>
              <Text style={s.secTitle}>
                Performance  {symbol} {timeframe}
                {sigStale ? '  ·  updating…' : ''}
              </Text>

              {/* Simulation banner */}
              {stats.sim_balance != null && (
                <View style={[s.simCard, {
                  borderColor: stats.total_pnl >= 0 ? C.green : C.red,
                }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.simLbl}>Bileşik Getiri (compound)</Text>
                    <Text style={[s.simBalance, {
                      color: stats.total_pnl >= 0 ? C.green : C.red,
                    }]}>
                      ${(100 + stats.total_pnl).toFixed(2)}
                    </Text>
                    <Text style={s.simDesc}>
                      $100 başlangıç · her trade bakiye ile
                    </Text>
                    <Text style={{ color: C.muted, fontSize: 10, marginTop: 4 }}>
                      {stats.wins}W / {stats.losses}L / {stats.open} açık
                      {' · '}Sharpe {stats.sharpe}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[s.simReturn, {
                      color: stats.total_pnl >= 0 ? C.green : C.red,
                    }]}>
                      {stats.total_pnl >= 0 ? '+' : ''}{stats.total_pnl}%
                    </Text>
                    <Text style={{ color: C.muted, fontSize: 10, marginTop: 6 }}>
                      Max DD %{stats.max_drawdown}
                    </Text>
                  </View>
                </View>
              )}

              {/* Grid stats */}
              <View style={s.statsGrid}>
                {[
                  { l:'Total Sinyal',   v: String(stats.total),              c: C.text },
                  { l:'Win Rate',       v: `${stats.win_rate}%`,             c: stats.win_rate >= 50 ? C.green : C.red },
                  { l:'Profit Factor',  v: String(stats.profit_factor),      c: stats.profit_factor >= 1.5 ? C.green : C.orange },
                  { l:'Ort. Kazanç',    v: `+${stats.avg_win}%`,            c: C.green },
                  { l:'Ort. Kayıp',     v: `${stats.avg_loss}%`,            c: C.red },
                  { l:'Sabit $100/trade', v: `$${stats.sim_balance?.toFixed(2) ?? '—'}`, c: stats.sim_total_return >= 0 ? C.green : C.red },
                ].map(item => (
                  <View key={item.l} style={s.statCell}>
                    <Text style={s.statLbl}>{item.l}</Text>
                    <Text style={[s.statVal, { color: item.c }]}>{item.v}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Signal History */}
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
                          { l:'SL',  v:fp(sig.sl),    c:C.red },
                          { l:'TP1', v:fp(sig.tp1),   c:C.green },
                          { l:'TP2', v:fp(sig.tp2),   c:'#00e676' },
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
  hdr:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  hdrTitle:      { fontSize: 22, fontWeight: '700', color: C.text },
  openCountBadge:{ backgroundColor: C.orange + '22', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  openCountTxt:  { color: C.orange, fontSize: 11, fontWeight: '700' },
  centered:      { paddingVertical: 60, alignItems: 'center' },
  retryBtn:      { marginTop: 14, paddingHorizontal: 20, paddingVertical: 8, borderWidth: 1, borderColor: C.cyan, borderRadius: 6 },

  openSection:  { marginHorizontal: 14, marginTop: 10 },
  openTitle:    { fontSize: 13, fontWeight: '700', color: C.orange, marginBottom: 6 },
  openCard:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 8, borderLeftWidth: 3, borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderTopColor: C.border, borderRightColor: C.border, borderBottomColor: C.border, padding: 10, marginBottom: 6 },
  openDirBadge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  openDirTxt:   { color: '#fff', fontSize: 12, fontWeight: '800' },
  openCoin:     { color: C.text, fontSize: 13, fontWeight: '700' },
  openEntry:    { color: C.muted, fontSize: 10, marginTop: 1 },
  openPnl:      { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] as any },

  coinScroll:    { borderBottomWidth: 1, borderBottomColor: C.border },
  coinContent:   { paddingHorizontal: 12, paddingVertical: 7, gap: 6, flexDirection: 'row' },
  chip:          { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  chipActive:    { backgroundColor: C.cyan, borderColor: C.cyan },
  chipTxt:       { color: C.muted, fontSize: 11, fontWeight: '600' },
  chipTxtActive: { color: '#000' },
  cacheDot:      { position: 'absolute', top: 2, right: 2, width: 5, height: 5, borderRadius: 3, backgroundColor: C.green },

  tfRow:       { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border, gap: 6, alignItems: 'center' },
  tfBtn:       { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 6, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  tfActive:    { backgroundColor: C.cyan, borderColor: C.cyan },
  tfTxt:       { color: C.muted, fontSize: 12, fontWeight: '600' },
  tfActiveTxt: { color: '#000' },

  section:  { marginHorizontal: 14, marginTop: 14 },
  secTitle: { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 8 },

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

  simCard:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 10, borderWidth: 1.5, padding: 14, marginBottom: 10 },
  simLbl:     { fontSize: 10, color: C.muted, marginBottom: 4 },
  simDesc:    { fontSize: 9, color: C.muted, marginTop: 2, fontStyle: 'italic' },
  simBalance: { fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] as any },
  simReturn:  { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] as any },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCell:  { flex: 1, minWidth: '44%', backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.border, padding: 10 },
  statLbl:   { fontSize: 10, color: C.muted, marginBottom: 3 },
  statVal:   { fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] as any },

  sigCard:     { backgroundColor: C.card, borderLeftWidth: 3, borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderTopColor: C.border, borderRightColor: C.border, borderBottomColor: C.border, borderRadius: 8, padding: 10, marginBottom: 6 },
  sigRow1:     { flexDirection: 'row', alignItems: 'center' },
  sigDate:     { color: C.muted, fontSize: 10, width: 56, lineHeight: 14 },
  sigEntryLbl: { color: C.muted, fontSize: 9 },
  sigEntryVal: { color: C.text, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] as any },
  sigSlTp:     { color: C.muted, fontSize: 9 },
  scoreBadge:  { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  scoreTxt:    { fontSize: 9, fontWeight: '700' },
  outBadge:    { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  outTxt:      { fontSize: 10, fontWeight: '600' },
  pnlTxt:      { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] as any },
  expandedBox: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border },
  emptyCard:   { backgroundColor: C.card, borderRadius: 8, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  tradeBtn:    { marginTop: 10, borderRadius: 7, paddingVertical: 9, alignItems: 'center' },
  tradeBtnTxt: { color: '#000', fontSize: 13, fontWeight: '800' },
})

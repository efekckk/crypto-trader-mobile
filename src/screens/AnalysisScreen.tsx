import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native'
import { ConfluenceData, fetchConfluence } from '../services/api'

const C = {
  bg:'#111111', card:'#1a1a1a', border:'#2a2a2a',
  green:'#26a69a', red:'#ef5350', cyan:'#00d4ff',
  text:'#e0e8f0', muted:'#555566', orange:'#ff9800',
}

const COINS    = ['BTC','ETH','BNB','SOL','ADA','XRP','DOGE','LINK','DOT','AVAX','LTC','MATIC']
const TIMEFRAMES = ['1h','4h','1d']

function scoreColor(s: number) {
  return s >= 70 ? C.green : s >= 45 ? C.orange : C.red
}
function dirColor(d: string) {
  return d === 'long' ? C.green : d === 'short' ? C.red : C.muted
}
function dirLabel(d: string) {
  return d === 'long' ? '▲' : d === 'short' ? '▼' : '─'
}
function strengthBar(s: string) {
  const filled = s === 'strong' ? 4 : s === 'moderate' ? 3 : s === 'weak' ? 2 : 1
  return Array.from({ length: 4 }, (_, i) => i < filled ? '●' : '○').join('')
}

// ── Single row in the dashboard table ─────────────────────────────────────────
function CoinRow({
  coin, data, loading,
  onPress,
}: {
  coin:    string
  data:    ConfluenceData | null
  loading: boolean
  onPress: () => void
}) {
  return (
    <TouchableOpacity style={r.row} onPress={onPress} activeOpacity={0.75}>
      <Text style={r.coin}>{coin}</Text>

      {loading ? (
        <ActivityIndicator size="small" color={C.muted} style={{ flex: 1 }} />
      ) : !data ? (
        <Text style={{ flex: 1, color: C.muted, fontSize: 11, textAlign: 'center' }}>—</Text>
      ) : (
        <>
          {/* Score circle */}
          <View style={[r.scoreDot, { borderColor: scoreColor(data.confluence_score) }]}>
            <Text style={[r.scoreNum, { color: scoreColor(data.confluence_score) }]}>
              {Math.round(data.confluence_score)}
            </Text>
          </View>

          {/* Direction */}
          <Text style={[r.dir, { color: dirColor(data.direction) }]}>
            {dirLabel(data.direction)}
          </Text>

          {/* Strength */}
          <Text style={[r.strength, { color: scoreColor(data.confluence_score) }]}>
            {strengthBar(data.signal_strength)}
          </Text>

          {/* Engine mini-scores */}
          <View style={r.engines}>
            {data.engines.map(e => (
              <View key={e.name} style={r.engCell}>
                <Text style={[r.engScore, { color: scoreColor(e.score) }]}>
                  {Math.round(e.score)}
                </Text>
                <Text style={r.engName}>{e.name.slice(0,4)}</Text>
              </View>
            ))}
          </View>

          {/* Notify bell */}
          {data.should_notify && (
            <Text style={{ fontSize: 12, marginLeft: 4 }}>🔔</Text>
          )}
        </>
      )}
    </TouchableOpacity>
  )
}

const r = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border, gap: 6 },
  coin:     { width: 44, fontSize: 12, fontWeight: '700', color: C.text },
  scoreDot: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  scoreNum: { fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] as any },
  dir:      { width: 16, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  strength: { width: 44, fontSize: 10, letterSpacing: 1, textAlign: 'center' },
  engines:  { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  engCell:  { alignItems: 'center' },
  engScore: { fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] as any },
  engName:  { fontSize: 8, color: C.muted, marginTop: 1 },
})

// ── Detail panel (expanded card for one coin) ─────────────────────────────────
function DetailCard({ data }: { data: ConfluenceData }) {
  const sc = data.confluence_score
  return (
    <View style={dc.card}>
      {/* Engine breakdown */}
      <Text style={dc.secTitle}>Engine Breakdown</Text>
      {data.engines.map(e => (
        <View key={e.name} style={dc.engRow}>
          <Text style={dc.engName}>{e.name}</Text>
          <View style={dc.barBg}>
            <View style={[dc.barFill, {
              width: `${e.score}%` as any,
              backgroundColor: scoreColor(e.score),
            }]} />
          </View>
          <Text style={[dc.engScore, { color: scoreColor(e.score) }]}>
            {Math.round(e.score)}
          </Text>
          <Text style={[dc.dir, { color: dirColor(e.direction) }]}>
            {dirLabel(e.direction)}
          </Text>
        </View>
      ))}

      {/* Entry levels */}
      {data.entry_price && (
        <>
          <Text style={[dc.secTitle, { marginTop: 12 }]}>Signal Levels</Text>
          <View style={dc.levelsRow}>
            {[
              { l:'Entry', v:data.entry_price,  c:C.cyan  },
              { l:'SL',    v:data.stop_loss,     c:C.red   },
              { l:'TP1',   v:data.take_profit_1, c:C.green },
              { l:'TP2',   v:data.take_profit_2, c:'#00e676'},
            ].filter(x => x.v).map(item => (
              <View key={item.l} style={dc.levelCell}>
                <Text style={dc.levelLbl}>{item.l}</Text>
                <Text style={[dc.levelVal, { color: item.c }]}>
                  ${(item.v!).toLocaleString('en-US',{maximumFractionDigits:2})}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Top sources */}
      {data.sources.length > 0 && (
        <>
          <Text style={[dc.secTitle, { marginTop: 12 }]}>Analysis Sources</Text>
          {data.sources.slice(0, 8).map((s, i) => (
            <Text key={i} style={dc.source}>• {s}</Text>
          ))}
        </>
      )}
    </View>
  )
}

const dc = StyleSheet.create({
  card:      { marginHorizontal: 14, marginBottom: 4, backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 14 },
  secTitle:  { fontSize: 10, color: C.muted, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  engRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  engName:   { width: 90, fontSize: 12, fontWeight: '600', color: C.text },
  barBg:     { flex: 1, height: 4, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden' },
  barFill:   { height: 4, borderRadius: 2 },
  engScore:  { width: 28, fontSize: 12, fontWeight: '700', textAlign: 'right', fontVariant: ['tabular-nums'] as any },
  dir:       { width: 16, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  levelsRow: { flexDirection: 'row', gap: 4 },
  levelCell: { flex: 1, alignItems: 'center', backgroundColor: C.bg, borderRadius: 6, padding: 8 },
  levelLbl:  { fontSize: 9, color: C.muted, marginBottom: 3 },
  levelVal:  { fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] as any },
  source:    { fontSize: 10, color: C.muted, marginBottom: 3, paddingLeft: 4 },
})

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function AnalysisScreen() {
  const [timeframe,  setTimeframe]  = useState('1h')
  const [results,    setResults]    = useState<Record<string, ConfluenceData | null>>({})
  const [loading,    setLoading]    = useState<Record<string, boolean>>({})
  const [expanded,   setExpanded]   = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadCoin = useCallback(async (coin: string, tf: string) => {
    setLoading(prev => ({ ...prev, [coin]: true }))
    try {
      const data = await fetchConfluence(`${coin}USDT`, tf)
      setResults(prev => ({ ...prev, [coin]: data }))
    } catch {
      setResults(prev => ({ ...prev, [coin]: null }))
    } finally {
      setLoading(prev => ({ ...prev, [coin]: false }))
    }
  }, [])

  const loadAll = useCallback(async (tf: string) => {
    // Load 3 at a time to avoid rate limiting
    for (let i = 0; i < COINS.length; i += 3) {
      const batch = COINS.slice(i, i + 3)
      await Promise.all(batch.map(c => loadCoin(c, tf)))
    }
  }, [loadCoin])

  useEffect(() => {
    setResults({})
    loadAll(timeframe)
  }, [timeframe])

  const onRefresh = () => {
    setRefreshing(true)
    setResults({})
    loadAll(timeframe).finally(() => setRefreshing(false))
  }

  // Sort by confluence score descending
  const sorted = [...COINS].sort((a, b) => {
    const sa = results[a]?.confluence_score ?? -1
    const sb = results[b]?.confluence_score ?? -1
    return sb - sa
  })

  const loadedCount  = Object.values(results).filter(v => v !== null && v !== undefined).length
  const strongCount  = Object.values(results).filter(v => v && v.confluence_score >= 70).length
  const notifyCount  = Object.values(results).filter(v => v?.should_notify).length

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.cyan} colors={[C.cyan]} />
      }
    >
      {/* Header */}
      <View style={s.hdr}>
        <View>
          <Text style={s.hdrTitle}>Analysis</Text>
          <Text style={{ color: C.muted, fontSize: 11 }}>
            {loadedCount}/{COINS.length} loaded
            {strongCount > 0 ? `  ·  ${strongCount} strong` : ''}
            {notifyCount > 0 ? `  ·  🔔 ${notifyCount}` : ''}
          </Text>
        </View>
        <TouchableOpacity style={s.refreshBtn} onPress={onRefresh}>
          <Text style={{ color: C.cyan, fontSize: 12, fontWeight: '600' }}>↻ Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Timeframe selector */}
      <View style={s.tfRow}>
        {TIMEFRAMES.map(tf => (
          <TouchableOpacity key={tf}
            style={[s.tfBtn, tf === timeframe && s.tfActive]}
            onPress={() => setTimeframe(tf)}>
            <Text style={[s.tfTxt, tf === timeframe && s.tfActiveTxt]}>{tf}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Table header */}
      <View style={s.tableHeader}>
        <Text style={[s.thCell, { width: 44 }]}>Coin</Text>
        <Text style={[s.thCell, { width: 34 }]}>Score</Text>
        <Text style={[s.thCell, { width: 16 }]}>Dir</Text>
        <Text style={[s.thCell, { width: 44 }]}>Strength</Text>
        <Text style={[s.thCell, { flex: 1 }]}>Engines (AMD/OFI/Micro/Stat)</Text>
      </View>

      {/* Coin rows */}
      {sorted.map(coin => (
        <React.Fragment key={coin}>
          <CoinRow
            coin={coin}
            data={results[coin] ?? null}
            loading={loading[coin] ?? false}
            onPress={() => setExpanded(expanded === coin ? null : coin)}
          />
          {expanded === coin && results[coin] && (
            <DetailCard data={results[coin]!} />
          )}
        </React.Fragment>
      ))}

      {/* Summary footer */}
      {loadedCount === COINS.length && (
        <View style={s.summary}>
          <Text style={{ color: C.muted, fontSize: 11, textAlign: 'center' }}>
            {timeframe} analysis complete · {COINS.length} coins
          </Text>
        </View>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: C.bg },
  hdr:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  hdrTitle: { fontSize: 22, fontWeight: '700', color: C.text },
  refreshBtn:{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },

  tfRow:    { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border, gap: 8 },
  tfBtn:    { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 6, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  tfActive: { backgroundColor: C.cyan, borderColor: C.cyan },
  tfTxt:    { color: C.muted, fontSize: 12, fontWeight: '600' },
  tfActiveTxt:{ color: '#000' },

  tableHeader:{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#161616', borderBottomWidth: 1, borderBottomColor: C.border, gap: 6 },
  thCell:     { fontSize: 9, color: C.muted, fontWeight: '600', letterSpacing: 0.5 },

  summary:  { marginTop: 20, paddingVertical: 10 },
})

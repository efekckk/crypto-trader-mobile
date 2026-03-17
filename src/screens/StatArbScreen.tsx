import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native'
import { API_KEY, TUNNEL_URL } from '../services/api'

const C = {
  bg:'#111111', card:'#1a1a1a', border:'#2a2a2a',
  green:'#26a69a', red:'#ef5350', cyan:'#00d4ff',
  text:'#e0e8f0', muted:'#555566', orange:'#ff9800',
}

const INTERVALS = ['1h','4h','1d']

interface PairResult {
  pair:         string
  symbol_a:     string
  symbol_b:     string
  timestamp:    string
  cointegration:{
    is_cointegrated: boolean
    hedge_ratio:     number
    p_value:         number
    half_life_bars:  number
    hurst_exponent:  number
    strength:        string
  }
  kalman:{ hedge_ratio: number; spread_mean: number }
  spread:{ current: number; mean: number; std: number; z_score: number }
  signal:{ type: string; confidence: number; tradeable: boolean }
  prices: Record<string, number>
  error?: string
}

async function fetchScan(interval: string): Promise<PairResult[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120000) // 2 min timeout
  try {
    const r = await fetch(`${TUNNEL_URL}/api/v1/analysis/statarb`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
      body: JSON.stringify({ scan: true, interval }),
      signal: controller.signal,
    })
    const text = await r.text()
    // Guard against HTML error pages from Cloudflare
    if (!text.startsWith('{')) {
      throw new Error(`Backend returned non-JSON response (${r.status})`)
    }
    const d = JSON.parse(text)
    return d?.data?.results ?? []
  } finally {
    clearTimeout(timeout)
  }
}

function zColor(z: number) {
  const a = Math.abs(z)
  return a >= 3 ? C.red : a >= 2 ? C.orange : a >= 1 ? C.cyan : C.muted
}

function sigLabel(t: string) {
  if (t === 'LONG_A_SHORT_B')  return '▲A ▼B'
  if (t === 'SHORT_A_LONG_B') return '▼A ▲B'
  if (t === 'CLOSE')          return '✕ Close'
  return '─ Hold'
}

export default function StatArbScreen() {
  const [interval,   setInterval]   = useState('1h')
  const [results,    setResults]    = useState<PairResult[]>([])
  const [loading,    setLoading]    = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [expanded,   setExpanded]   = useState<string | null>(null)
  const [error,      setError]      = useState<string | null>(null)

  const load = useCallback(async (iv: string) => {
    setLoading(true); setError(null)
    try {
      const data = await fetchScan(iv)
      // Sort: cointegrated + tradeable first, then by |z_score|
      data.sort((a, b) => {
        const aT = a.signal?.tradeable ? 1 : 0
        const bT = b.signal?.tradeable ? 1 : 0
        if (bT !== aT) return bT - aT
        return Math.abs(b.spread?.z_score ?? 0) - Math.abs(a.spread?.z_score ?? 0)
      })
      setResults(data)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(interval) }, [interval])

  const onRefresh = () => { setRefreshing(true); load(interval).finally(() => setRefreshing(false)) }

  const cointegrated = results.filter(r => r.cointegration?.is_cointegrated)
  const tradeable    = results.filter(r => r.signal?.tradeable)

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
          <Text style={s.hdrTitle}>StatArb</Text>
          <Text style={{ color: C.muted, fontSize: 11 }}>
            {results.length} pairs · {cointegrated.length} cointegrated · {tradeable.length} tradeable
          </Text>
        </View>
        <TouchableOpacity style={s.refreshBtn} onPress={onRefresh} disabled={loading}>
          <Text style={{ color: loading ? C.muted : C.cyan, fontSize: 12, fontWeight: '600' }}>
            {loading ? '…' : '↻'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Interval selector */}
      <View style={s.tfRow}>
        {INTERVALS.map(iv => (
          <TouchableOpacity key={iv}
            style={[s.tfBtn, iv === interval && s.tfActive]}
            onPress={() => setInterval(iv)}>
            <Text style={[s.tfTxt, iv === interval && s.tfActiveTxt]}>{iv}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Summary cards */}
      {!loading && results.length > 0 && (
        <View style={s.summaryRow}>
          <View style={s.sumCard}>
            <Text style={s.sumNum}>{results.length}</Text>
            <Text style={s.sumLbl}>Pairs Scanned</Text>
          </View>
          <View style={s.sumCard}>
            <Text style={[s.sumNum, { color: cointegrated.length > 0 ? C.green : C.muted }]}>
              {cointegrated.length}
            </Text>
            <Text style={s.sumLbl}>Cointegrated</Text>
          </View>
          <View style={s.sumCard}>
            <Text style={[s.sumNum, { color: tradeable.length > 0 ? C.orange : C.muted }]}>
              {tradeable.length}
            </Text>
            <Text style={s.sumLbl}>Tradeable</Text>
          </View>
        </View>
      )}

      {loading && !refreshing ? (
        <View style={s.centered}>
          <ActivityIndicator color={C.cyan} size="large" />
          <Text style={{ color: C.muted, marginTop: 10, fontSize: 12 }}>
            Scanning {results.length ? results.length : '10'} pairs…
          </Text>
        </View>
      ) : error ? (
        <View style={s.centered}>
          <Text style={{ color: C.red, fontSize: 13 }}>{error}</Text>
        </View>
      ) : results.length === 0 ? (
        <View style={s.centered}>
          <Text style={{ color: C.muted, fontSize: 13 }}>No data · pull to refresh</Text>
        </View>
      ) : (
        <View style={{ marginTop: 8 }}>
          {results.map(pair => {
            if (pair.error) return null
            const coint  = pair.cointegration
            const sp     = pair.spread
            const sig    = pair.signal
            const isExp  = expanded === pair.pair
            const isTradeble = sig?.tradeable
            const zc     = zColor(sp?.z_score ?? 0)

            return (
              <React.Fragment key={pair.pair}>
                <TouchableOpacity
                  style={[s.pairCard, isTradeble && s.pairCardActive]}
                  onPress={() => setExpanded(isExp ? null : pair.pair)}
                  activeOpacity={0.8}
                >
                  {/* Row 1 */}
                  <View style={s.pairRow1}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.pairSyms}>
                        {pair.symbol_a} <Text style={{ color: C.muted }}>↔</Text> {pair.symbol_b}
                      </Text>
                      {coint?.is_cointegrated && (
                        <View style={s.cointBadge}>
                          <Text style={s.cointTxt}>
                            ✓ Cointegrated · p={coint.p_value.toFixed(3)} · t½={coint.half_life_bars.toFixed(1)}b
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Z-score */}
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={[s.zScore, { color: zc }]}>
                        z={sp?.z_score >= 0 ? '+' : ''}{sp?.z_score.toFixed(2)}
                      </Text>
                      {isTradeble && (
                        <View style={s.tradeBadge}>
                          <Text style={s.tradeTxt}>⚡ {sigLabel(sig.type)}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Z-score bar */}
                  <View style={s.zBarTrack}>
                    <View style={s.zBarCenter} />
                    {(sp?.z_score ?? 0) >= 0 ? (
                      <View style={[s.zBarFill, {
                        left: '50%',
                        width: `${Math.min(Math.abs(sp?.z_score ?? 0) / 4 * 50, 50)}%` as any,
                        backgroundColor: (sp?.z_score ?? 0) >= 2 ? C.orange : C.cyan,
                      }]} />
                    ) : (
                      <View style={[s.zBarFill, {
                        right: '50%',
                        width: `${Math.min(Math.abs(sp?.z_score ?? 0) / 4 * 50, 50)}%` as any,
                        backgroundColor: Math.abs(sp?.z_score ?? 0) >= 2 ? C.orange : C.cyan,
                      }]} />
                    )}
                    {/* Threshold lines at ±2 */}
                    <View style={[s.threshLine, { left: '25%' }]} />
                    <View style={[s.threshLine, { right: '25%' }]} />
                  </View>
                </TouchableOpacity>

                {/* Expanded detail */}
                {isExp && (
                  <View style={s.detailCard}>
                    {/* Prices */}
                    <View style={s.detailRow}>
                      {Object.entries(pair.prices).map(([sym, price]) => (
                        <View key={sym} style={s.priceCell}>
                          <Text style={s.detailLbl}>{sym}</Text>
                          <Text style={s.detailVal}>
                            ${price.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* Spread stats */}
                    <View style={s.detailRow}>
                      {[
                        { l: 'Spread',  v: sp?.current.toFixed(4) },
                        { l: 'Mean',    v: sp?.mean.toFixed(4) },
                        { l: 'Std',     v: sp?.std.toFixed(4) },
                        { l: 'Z-score', v: `${sp?.z_score >= 0 ? '+' : ''}${sp?.z_score.toFixed(3)}` },
                      ].map(item => (
                        <View key={item.l} style={s.priceCell}>
                          <Text style={s.detailLbl}>{item.l}</Text>
                          <Text style={s.detailVal}>{item.v}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Kalman + cointegration */}
                    <View style={s.detailRow}>
                      {[
                        { l: 'Kalman β',  v: pair.kalman?.hedge_ratio.toFixed(4) },
                        { l: 'OLS β',     v: coint?.hedge_ratio.toFixed(4) },
                        { l: 'Hurst',     v: coint?.hurst_exponent.toFixed(3) },
                        { l: 'Strength',  v: coint?.strength },
                      ].map(item => (
                        <View key={item.l} style={s.priceCell}>
                          <Text style={s.detailLbl}>{item.l}</Text>
                          <Text style={[s.detailVal, {
                            color: item.l === 'Strength'
                              ? item.v === 'Strong' ? C.green : item.v === 'Moderate' ? C.orange : C.red
                              : C.text,
                          }]}>{item.v}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Signal */}
                    {sig && (
                      <View style={[s.sigBox, {
                        borderColor: isTradeble ? C.orange : C.border,
                        backgroundColor: isTradeble ? C.orange + '11' : C.card,
                      }]}>
                        <Text style={[s.sigType, { color: isTradeble ? C.orange : C.muted }]}>
                          {sigLabel(sig.type)}
                        </Text>
                        <Text style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
                          Confidence {(sig.confidence * 100).toFixed(0)}%
                          {isTradeble ? '  · Tradeable signal' : ''}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </React.Fragment>
            )
          })}
        </View>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: C.bg },
  hdr:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  hdrTitle: { fontSize: 22, fontWeight: '700', color: C.text },
  refreshBtn:{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  centered: { paddingVertical: 60, alignItems: 'center' },

  tfRow:    { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border, gap: 8 },
  tfBtn:    { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 6, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  tfActive: { backgroundColor: C.cyan, borderColor: C.cyan },
  tfTxt:    { color: C.muted, fontSize: 12, fontWeight: '600' },
  tfActiveTxt:{ color: '#000' },

  summaryRow:{ flexDirection: 'row', marginHorizontal: 14, marginTop: 14, gap: 8 },
  sumCard:   { flex: 1, backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.border, padding: 10, alignItems: 'center' },
  sumNum:    { fontSize: 22, fontWeight: '800', color: C.text, fontVariant: ['tabular-nums'] as any },
  sumLbl:    { fontSize: 10, color: C.muted, marginTop: 2 },

  pairCard:      { marginHorizontal: 14, marginTop: 8, backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 12 },
  pairCardActive:{ borderColor: C.orange, borderWidth: 1.5 },
  pairRow1:      { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  pairSyms:      { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 4 },
  cointBadge:    { backgroundColor: C.green + '18', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  cointTxt:      { color: C.green, fontSize: 9, fontWeight: '600' },
  zScore:        { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] as any },
  tradeBadge:    { backgroundColor: C.orange + '22', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  tradeTxt:      { color: C.orange, fontSize: 10, fontWeight: '700' },

  zBarTrack:  { height: 6, backgroundColor: C.border, borderRadius: 3, position: 'relative', overflow: 'visible' },
  zBarCenter: { position: 'absolute', left: '50%', top: 0, width: 1, height: 6, backgroundColor: C.muted },
  zBarFill:   { position: 'absolute', top: 0, height: 6, borderRadius: 3 },
  threshLine: { position: 'absolute', top: -2, width: 1, height: 10, backgroundColor: C.muted + '66' },

  detailCard: { marginHorizontal: 14, marginTop: 1, backgroundColor: '#161616', borderWidth: 1, borderTopWidth: 0, borderColor: C.border, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, padding: 12 },
  detailRow:  { flexDirection: 'row', gap: 4, marginBottom: 10 },
  priceCell:  { flex: 1, alignItems: 'center', backgroundColor: C.card, borderRadius: 6, padding: 8 },
  detailLbl:  { fontSize: 9, color: C.muted, marginBottom: 3 },
  detailVal:  { fontSize: 11, fontWeight: '700', color: C.text, fontVariant: ['tabular-nums'] as any },

  sigBox:     { borderRadius: 7, borderWidth: 1, padding: 10, alignItems: 'center', marginTop: 4 },
  sigType:    { fontSize: 14, fontWeight: '800' },
})

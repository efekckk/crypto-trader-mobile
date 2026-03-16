import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { LineChart } from 'react-native-chart-kit'
import { fetchSignalPerformance, Signal, Stats } from '../services/api'

const C = {
  bg:     '#0b1120',
  card:   '#0d1628',
  border: '#0f1c2e',
  green:  '#26a69a',
  red:    '#ef5350',
  cyan:   '#00d4ff',
  text:   '#c8d8e8',
  muted:  '#334455',
}

const SYMBOLS    = ['BTC', 'ETH', 'SOL', 'BNB']
const TIMEFRAMES = ['1h', '4h', '1d']
const { width: SCREEN_W } = Dimensions.get('window')

interface PerformanceData {
  signals:      Signal[]
  stats:        Stats | null
  equity_curve: { equity: number }[]
}

export default function SignalsScreen() {
  const [symbol,    setSymbol]    = useState('BTC')
  const [timeframe, setTimeframe] = useState('1h')
  const [data,      setData]      = useState<PerformanceData | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  const load = useCallback(async (sym: string, tf: string) => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchSignalPerformance(`${sym}USDT`, tf, 300)
      setData(result)
    } catch {
      setError('Failed to load signal performance')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(symbol, timeframe)
  }, [symbol, timeframe])

  const formatPct = (v: number | undefined) => {
    if (v == null) return '—'
    return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
  }

  const formatNum = (v: number | undefined, dec = 2) => {
    if (v == null) return '—'
    return v.toFixed(dec)
  }

  const outcomeColor = (o: string) => {
    if (o === 'tp1' || o === 'tp2') return C.green
    if (o === 'sl') return C.red
    return '#f0a500'
  }

  const outcomeLabel = (o: string) => {
    if (o === 'tp1') return 'TP1 ✓'
    if (o === 'tp2') return 'TP2 ✓'
    if (o === 'sl')  return 'SL ✗'
    return 'Open'
  }

  const equityCurveData = (): number[] => {
    if (!data?.equity_curve?.length) return [100]
    const vals = data.equity_curve.map((e: any) => typeof e.equity === 'number' ? e.equity : e)
    return vals.length > 0 ? vals : [100]
  }

  const stats = data?.stats
  const signals = (data?.signals ?? []).slice(0, 30)

  const statItems = [
    { label: 'Total Signals', value: formatNum(stats?.total, 0) },
    { label: 'Win Rate',      value: stats?.win_rate != null ? `${(stats.win_rate * 100).toFixed(1)}%` : '—' },
    { label: 'Total PnL',     value: formatPct(stats?.total_pnl) },
    { label: 'Profit Factor', value: formatNum(stats?.profit_factor) },
    { label: 'Avg Win',       value: formatPct(stats?.avg_win) },
    { label: 'Avg Loss',      value: formatPct(stats?.avg_loss) },
  ]

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Signals</Text>
      </View>

      {/* Symbol Selector */}
      <View style={styles.selectorRow}>
        {SYMBOLS.map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.selectorBtn, symbol === s && styles.selectorBtnActive]}
            onPress={() => setSymbol(s)}
          >
            <Text style={[styles.selectorText, symbol === s && styles.selectorTextActive]}>
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Timeframe Selector */}
      <View style={styles.selectorRow}>
        {TIMEFRAMES.map(tf => (
          <TouchableOpacity
            key={tf}
            style={[styles.selectorBtn, timeframe === tf && styles.tfBtnActive]}
            onPress={() => setTimeframe(tf)}
          >
            <Text style={[styles.selectorText, timeframe === tf && styles.tfTextActive]}>
              {tf}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.cyan} />
          <Text style={styles.loadingText}>Loading signals…</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <>
          {/* Stats Grid */}
          {stats && (
            <View style={styles.statsGrid}>
              {statItems.map(item => (
                <View key={item.label} style={styles.statCell}>
                  <Text style={styles.statLabel}>{item.label}</Text>
                  <Text style={[
                    styles.statValue,
                    item.label === 'Win Rate'    ? { color: C.green } :
                    item.label === 'Total PnL'   ? { color: stats.total_pnl >= 0 ? C.green : C.red } :
                    item.label === 'Avg Win'      ? { color: C.green } :
                    item.label === 'Avg Loss'     ? { color: C.red } : {},
                  ]}>
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Equity Curve */}
          {equityCurveData().length > 1 && (
            <View style={styles.equitySection}>
              <Text style={styles.sectionTitle}>Equity Curve</Text>
              <View style={styles.chartWrap}>
                <LineChart
                  data={{
                    labels:   [],
                    datasets: [{ data: equityCurveData() }],
                  }}
                  width={SCREEN_W - 32}
                  height={160}
                  withDots={false}
                  withInnerLines={true}
                  withOuterLines={false}
                  withHorizontalLabels={true}
                  withVerticalLabels={false}
                  chartConfig={{
                    backgroundGradientFrom: C.card,
                    backgroundGradientTo:   C.card,
                    color: (opacity = 1) => `rgba(38, 166, 154, ${opacity})`,
                    labelColor: () => C.muted,
                    strokeWidth: 2,
                    propsForBackgroundLines: {
                      stroke:          C.border,
                      strokeDasharray: '',
                    },
                  }}
                  bezier
                  style={{ borderRadius: 10 }}
                />
              </View>
            </View>
          )}

          {/* Signal List */}
          <View style={styles.signalSection}>
            <Text style={styles.sectionTitle}>Signal History</Text>
            {signals.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No signals found for {symbol} {timeframe}</Text>
              </View>
            ) : (
              signals.map(sig => (
                <View key={sig.id} style={styles.sigRow}>
                  <View style={styles.sigCol}>
                    <Text style={styles.sigDate}>
                      {new Date(sig.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                    <Text style={styles.sigTime}>
                      {new Date(sig.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>

                  <View style={[
                    styles.typeBadge,
                    { backgroundColor: sig.type === 'long' ? C.green + '22' : C.red + '22' },
                  ]}>
                    <Text style={[
                      styles.typeText,
                      { color: sig.type === 'long' ? C.green : C.red },
                    ]}>
                      {sig.type === 'long' ? '▲' : '▼'} {sig.type.toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.priceCol}>
                    <Text style={styles.sigPriceLabel}>Entry</Text>
                    <Text style={styles.sigPrice}>${sig.entry.toLocaleString('en-US', { maximumFractionDigits: 2 })}</Text>
                    <Text style={styles.sigSlTp}>
                      SL {sig.sl_pct != null ? `${sig.sl_pct.toFixed(1)}%` : '—'} / TP {sig.tp1_pct != null ? `${sig.tp1_pct.toFixed(1)}%` : '—'}
                    </Text>
                  </View>

                  <View style={styles.outcomeCol}>
                    <View style={[styles.outcomeBadge, { backgroundColor: outcomeColor(sig.outcome) + '22' }]}>
                      <Text style={[styles.outcomeText, { color: outcomeColor(sig.outcome) }]}>
                        {outcomeLabel(sig.outcome)}
                      </Text>
                    </View>
                    {sig.pnl_pct !== 0 && (
                      <Text style={[styles.pnlText, { color: sig.pnl_pct > 0 ? C.green : C.red }]}>
                        {formatPct(sig.pnl_pct)}
                      </Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  content: {
    paddingBottom: 32,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop:        56,
    paddingBottom:     12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: {
    fontSize:   22,
    fontWeight: '700',
    color:      C.text,
  },
  selectorRow: {
    flexDirection:     'row',
    paddingHorizontal: 16,
    paddingVertical:   8,
    gap:               8,
  },
  selectorBtn: {
    paddingHorizontal: 14,
    paddingVertical:   6,
    borderRadius:      6,
    backgroundColor:   C.card,
    borderWidth:       1,
    borderColor:       C.border,
  },
  selectorBtnActive: {
    backgroundColor: C.cyan + '22',
    borderColor:     C.cyan,
  },
  tfBtnActive: {
    backgroundColor: C.cyan + '22',
    borderColor:     C.cyan,
  },
  selectorText: {
    color:      C.muted,
    fontSize:   13,
    fontWeight: '600',
  },
  selectorTextActive: {
    color: C.cyan,
  },
  tfTextActive: {
    color: C.cyan,
  },
  centered: {
    paddingVertical: 60,
    alignItems:      'center',
    gap:             12,
  },
  loadingText: {
    color:    C.muted,
    fontSize: 14,
  },
  errorText: {
    color:    C.red,
    fontSize: 14,
  },
  statsGrid: {
    flexDirection:     'row',
    flexWrap:          'wrap',
    paddingHorizontal: 16,
    gap:               8,
    marginBottom:      8,
  },
  statCell: {
    flex:            1,
    minWidth:        '44%',
    backgroundColor: C.card,
    borderRadius:    8,
    borderWidth:     1,
    borderColor:     C.border,
    padding:         12,
  },
  statLabel: {
    fontSize:     11,
    color:        C.muted,
    marginBottom: 4,
  },
  statValue: {
    fontSize:   18,
    fontWeight: '700',
    color:      C.text,
    fontVariant: ['tabular-nums'],
  },
  equitySection: {
    marginHorizontal: 16,
    marginBottom:     12,
  },
  sectionTitle: {
    fontSize:     15,
    fontWeight:   '700',
    color:        C.text,
    marginBottom: 8,
    marginTop:    4,
  },
  chartWrap: {
    borderRadius:    10,
    overflow:        'hidden',
    backgroundColor: C.card,
    borderWidth:     1,
    borderColor:     C.border,
  },
  signalSection: {
    marginHorizontal: 16,
  },
  emptyCard: {
    backgroundColor: C.card,
    borderRadius:    8,
    borderWidth:     1,
    borderColor:     C.border,
    padding:         20,
    alignItems:      'center',
  },
  emptyText: {
    color:    C.muted,
    fontSize: 13,
  },
  sigRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: C.card,
    borderRadius:    8,
    borderWidth:     1,
    borderColor:     C.border,
    padding:         10,
    marginBottom:    6,
    gap:             8,
  },
  sigCol: {
    width: 56,
  },
  sigDate: {
    fontSize: 11,
    color:    C.text,
  },
  sigTime: {
    fontSize: 10,
    color:    C.muted,
    marginTop: 2,
  },
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical:   3,
    borderRadius:      5,
  },
  typeText: {
    fontSize:   11,
    fontWeight: '700',
  },
  priceCol: {
    flex: 1,
  },
  sigPriceLabel: {
    fontSize:  10,
    color:     C.muted,
  },
  sigPrice: {
    fontSize:   12,
    color:      C.text,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  sigSlTp: {
    fontSize:  10,
    color:     C.muted,
    marginTop: 2,
  },
  outcomeCol: {
    alignItems: 'flex-end',
    gap:         4,
  },
  outcomeBadge: {
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderRadius:      4,
  },
  outcomeText: {
    fontSize:   11,
    fontWeight: '600',
  },
  pnlText: {
    fontSize:   12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
})

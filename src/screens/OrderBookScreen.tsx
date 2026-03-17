import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { fetchOrderBook, OrderLevel } from '../services/api'

const C = {
  bg:     '#111111',
  card:   '#1a1a1a',
  border: '#2a2a2a',
  green:  '#26a69a',
  red:    '#ef5350',
  cyan:   '#00d4ff',
  text:   '#e0e8f0',
  muted:  '#555566',
}

const ALL_COINS = ['BTC','ETH','BNB','SOL','ADA','XRP','DOGE','LINK','DOT','AVAX','LTC','MATIC']
const SYMBOLS   = ALL_COINS
const LEVELS    = 15

// Dynamic WS URL — works for any coin
const wsUrl  = (sym: string) => `wss://stream.binance.com:9443/ws/${sym.toLowerCase()}usdt@depth20@100ms`
const restSym = (sym: string) => `${sym}USDT`

interface BookState {
  bids: OrderLevel[]
  asks: OrderLevel[]
}

export default function OrderBookScreen() {
  const [symbol,  setSymbol]  = useState('BTC')
  const [book,    setBook]    = useState<BookState>({ bids: [], asks: [] })
  const [midPrice, setMid]    = useState<number | null>(null)
  const [spread,  setSpread]  = useState<number | null>(null)
  const [wsLive,  setWsLive]  = useState(false)
  const [loading, setLoading] = useState(true)
  const wsRef                 = useRef<WebSocket | null>(null)
  const restIntervalRef       = useRef<ReturnType<typeof setInterval> | null>(null)

  const parseWsBook = (data: any): BookState => {
    const bids: OrderLevel[] = (data.bids ?? []).slice(0, LEVELS).map((b: string[]) => ({
      price: parseFloat(b[0]),
      qty:   parseFloat(b[1]),
    }))
    const asks: OrderLevel[] = (data.asks ?? []).slice(0, LEVELS).map((a: string[]) => ({
      price: parseFloat(a[0]),
      qty:   parseFloat(a[1]),
    }))
    return { bids, asks }
  }

  const computeMidSpread = (bids: OrderLevel[], asks: OrderLevel[]) => {
    if (bids.length > 0 && asks.length > 0) {
      const bestBid = bids[0].price
      const bestAsk = asks[0].price
      setMid((bestBid + bestAsk) / 2)
      setSpread(bestAsk - bestBid)
    }
  }

  const loadRest = useCallback(async () => {
    try {
      const data = await fetchOrderBook(restSym(symbol), LEVELS)
      const bids = (data.bids ?? []).slice(0, LEVELS)
      const asks = (data.asks ?? []).slice(0, LEVELS)
      setBook({ bids, asks })
      computeMidSpread(bids, asks)
      if (data.spread != null) setSpread(data.spread)
    } catch {}
    finally { setLoading(false) }
  }, [symbol])

  const connectWS = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    const url = wsUrl(symbol)
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setWsLive(true)
      setLoading(false)
    }

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data)
        const parsed = parseWsBook(data)
        setBook(parsed)
        computeMidSpread(parsed.bids, parsed.asks)
      } catch {}
    }

    ws.onerror = () => {
      setWsLive(false)
      // Fall back to REST polling
      loadRest()
      restIntervalRef.current = setInterval(() => loadRest(), 2000)
    }

    ws.onclose = () => {
      setWsLive(false)
    }
  }, [symbol, loadRest])

  useEffect(() => {
    setLoading(true)
    setBook({ bids: [], asks: [] })
    setMid(null)
    setSpread(null)

    // Clear any old REST interval
    if (restIntervalRef.current) {
      clearInterval(restIntervalRef.current)
      restIntervalRef.current = null
    }

    connectWS()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      if (restIntervalRef.current) {
        clearInterval(restIntervalRef.current)
        restIntervalRef.current = null
      }
    }
  }, [symbol])

  // Compute max cumulative qty for depth bar scaling
  const maxBidQty = book.bids.reduce((acc, b) => acc + b.qty, 0) || 1
  const maxAskQty = book.asks.reduce((acc, a) => acc + a.qty, 0) || 1
  const totalLiqBid = maxBidQty
  const totalLiqAsk = maxAskQty
  const totalLiq    = totalLiqBid + totalLiqAsk
  const bidPct      = totalLiq > 0 ? (totalLiqBid / totalLiq) * 100 : 50
  const askPct      = totalLiq > 0 ? (totalLiqAsk / totalLiq) * 100 : 50

  const formatPrice = (p: number) => {
    if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    if (p >= 1)    return p.toFixed(4)
    return p.toFixed(6)
  }

  const formatQty = (q: number) => {
    if (q >= 1000) return q.toFixed(0)
    if (q >= 1)    return q.toFixed(3)
    return q.toFixed(4)
  }

  let cumulativeAsk = 0
  let cumulativeBid = 0

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Order Book</Text>
        <View style={styles.connRow}>
          <View style={[styles.connDot, { backgroundColor: wsLive ? C.green : C.muted }]} />
          <Text style={[styles.connLabel, { color: wsLive ? C.green : C.muted }]}>
            {wsLive ? 'WS' : 'REST'}
          </Text>
        </View>
      </View>

      {/* Symbol Selector — horizontal scroll for all 12 coins */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ borderBottomWidth: 1, borderBottomColor: C.border }}
        contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 6, gap: 6 }}>
        {SYMBOLS.map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.symBtn, symbol === s && styles.symBtnActive]}
            onPress={() => setSymbol(s)}
          >
            <Text style={[styles.symText, symbol === s && styles.symTextActive]}>
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Mid Price + Spread */}
      <View style={styles.midRow}>
        <View style={styles.midBlock}>
          <Text style={styles.midLabel}>Mid Price</Text>
          <Text style={styles.midValue}>
            {midPrice != null ? `$${formatPrice(midPrice)}` : '—'}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.midBlock}>
          <Text style={styles.midLabel}>Spread</Text>
          <Text style={styles.spreadValue}>
            {spread != null ? `$${spread.toFixed(4)}` : '—'}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={C.cyan} />
          <Text style={styles.loadingText}>Connecting…</Text>
        </View>
      ) : (
        <ScrollView style={styles.bookScroll} showsVerticalScrollIndicator={false}>
          {/* Column Headers */}
          <View style={styles.colHeader}>
            <Text style={[styles.colLabel, { flex: 1.2, textAlign: 'left' }]}>Price</Text>
            <Text style={[styles.colLabel, { flex: 1, textAlign: 'right' }]}>Amount</Text>
            <Text style={[styles.colLabel, { flex: 1, textAlign: 'right' }]}>Total</Text>
          </View>

          {/* Asks (reversed so lowest ask is closest to mid) */}
          {[...book.asks].reverse().map((ask, i) => {
            cumulativeAsk += ask.qty
            const depthPct = Math.min((cumulativeAsk / maxAskQty) * 100, 100)
            return (
              <View key={`ask-${i}`} style={styles.levelRow}>
                <View style={[styles.depthBarAsk, { width: `${depthPct}%` }]} />
                <Text style={[styles.levelPrice, { color: C.red, flex: 1.2 }]}>
                  {formatPrice(ask.price)}
                </Text>
                <Text style={[styles.levelQty, { flex: 1 }]}>
                  {formatQty(ask.qty)}
                </Text>
                <Text style={[styles.levelQty, { flex: 1, color: C.muted }]}>
                  {formatQty(cumulativeAsk)}
                </Text>
              </View>
            )
          })}

          {/* Mid Separator */}
          <View style={styles.midSeparator}>
            <Text style={styles.midSepText}>
              {midPrice != null ? `$${formatPrice(midPrice)}` : '—'}
            </Text>
          </View>

          {/* Bids */}
          {book.bids.map((bid, i) => {
            cumulativeBid += bid.qty
            const depthPct = Math.min((cumulativeBid / maxBidQty) * 100, 100)
            return (
              <View key={`bid-${i}`} style={styles.levelRow}>
                <View style={[styles.depthBarBid, { width: `${depthPct}%` }]} />
                <Text style={[styles.levelPrice, { color: C.green, flex: 1.2 }]}>
                  {formatPrice(bid.price)}
                </Text>
                <Text style={[styles.levelQty, { flex: 1 }]}>
                  {formatQty(bid.qty)}
                </Text>
                <Text style={[styles.levelQty, { flex: 1, color: C.muted }]}>
                  {formatQty(cumulativeBid)}
                </Text>
              </View>
            )
          })}
        </ScrollView>
      )}

      {/* Bid/Ask Pressure Bar */}
      {!loading && (
        <View style={styles.pressureContainer}>
          <View style={styles.pressureLabels}>
            <Text style={[styles.pressureLabel, { color: C.green }]}>
              Bid {bidPct.toFixed(1)}%
            </Text>
            <Text style={[styles.pressureLabel, { color: C.red }]}>
              Ask {askPct.toFixed(1)}%
            </Text>
          </View>
          <View style={styles.pressureBar}>
            <View style={[styles.pressureBid, { flex: bidPct }]} />
            <View style={[styles.pressureAsk, { flex: askPct }]} />
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
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
  connRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:            6,
  },
  connDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
  },
  connLabel: {
    fontSize:   12,
    fontWeight: '600',
  },
  symbolRow: {
    flexDirection:     'row',
    paddingHorizontal: 16,
    paddingVertical:   8,
    gap:               8,
  },
  symBtn: {
    paddingHorizontal: 14,
    paddingVertical:   6,
    borderRadius:      6,
    backgroundColor:   C.card,
    borderWidth:       1,
    borderColor:       C.border,
  },
  symBtnActive: {
    backgroundColor: C.cyan + '22',
    borderColor:     C.cyan,
  },
  symText: {
    color:      C.muted,
    fontSize:   13,
    fontWeight: '600',
  },
  symTextActive: {
    color: C.cyan,
  },
  midRow: {
    flexDirection:     'row',
    marginHorizontal:  16,
    marginBottom:      8,
    backgroundColor:   C.card,
    borderRadius:      8,
    borderWidth:       1,
    borderColor:       C.border,
    padding:           12,
    alignItems:        'center',
  },
  midBlock: {
    flex:       1,
    alignItems: 'center',
  },
  divider: {
    width:           1,
    height:          32,
    backgroundColor: C.border,
  },
  midLabel: {
    fontSize:     11,
    color:        C.muted,
    marginBottom: 4,
  },
  midValue: {
    fontSize:   16,
    fontWeight: '700',
    color:      C.cyan,
    fontVariant: ['tabular-nums'],
  },
  spreadValue: {
    fontSize:   14,
    fontWeight: '600',
    color:      C.text,
    fontVariant: ['tabular-nums'],
  },
  centered: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            10,
  },
  loadingText: {
    color:    C.muted,
    fontSize: 13,
  },
  bookScroll: {
    flex:              1,
    marginHorizontal:  16,
  },
  colHeader: {
    flexDirection:  'row',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginBottom:   2,
  },
  colLabel: {
    fontSize:   11,
    color:      C.muted,
    fontWeight: '600',
  },
  levelRow: {
    flexDirection:   'row',
    alignItems:      'center',
    height:          26,
    paddingHorizontal: 4,
    position:        'relative',
    overflow:        'hidden',
  },
  depthBarAsk: {
    position:        'absolute',
    right:           0,
    top:             0,
    bottom:          0,
    backgroundColor: C.red + '1a',
  },
  depthBarBid: {
    position:        'absolute',
    right:           0,
    top:             0,
    bottom:          0,
    backgroundColor: C.green + '1a',
  },
  levelPrice: {
    fontSize:   12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  levelQty: {
    fontSize:   12,
    color:      C.text,
    textAlign:  'right',
    fontVariant: ['tabular-nums'],
  },
  midSeparator: {
    paddingVertical:   6,
    paddingHorizontal: 4,
    borderTopWidth:    1,
    borderBottomWidth: 1,
    borderColor:       C.border,
    marginVertical:    2,
    alignItems:        'center',
  },
  midSepText: {
    fontSize:   13,
    fontWeight: '700',
    color:      C.cyan,
    fontVariant: ['tabular-nums'],
  },
  pressureContainer: {
    paddingHorizontal: 16,
    paddingVertical:   12,
    borderTopWidth:    1,
    borderTopColor:    C.border,
  },
  pressureLabels: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    marginBottom:   6,
  },
  pressureLabel: {
    fontSize:   12,
    fontWeight: '600',
  },
  pressureBar: {
    flexDirection: 'row',
    height:        8,
    borderRadius:  4,
    overflow:      'hidden',
  },
  pressureBid: {
    backgroundColor: C.green,
  },
  pressureAsk: {
    backgroundColor: C.red,
  },
})

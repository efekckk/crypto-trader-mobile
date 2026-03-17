import React, { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { fetchTickers, Ticker } from '../services/api'

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

const COINS: { symbol: string; name: string; color: string }[] = [
  { symbol: 'BTC/USDT', name: 'Bitcoin',      color: '#f7931a' },
  { symbol: 'ETH/USDT', name: 'Ethereum',     color: '#627eea' },
  { symbol: 'BNB/USDT', name: 'BNB',          color: '#f3ba2f' },
  { symbol: 'SOL/USDT', name: 'Solana',       color: '#9945ff' },
  { symbol: 'ADA/USDT', name: 'Cardano',      color: '#0d1e82' },
  { symbol: 'XRP/USDT', name: 'XRP',          color: '#00aae4' },
  { symbol: 'DOGE/USDT', name: 'Dogecoin',    color: '#c2a633' },
  { symbol: 'MATIC/USDT', name: 'Polygon',    color: '#8247e5' },
  { symbol: 'LINK/USDT', name: 'Chainlink',   color: '#2a5ada' },
  { symbol: 'AVAX/USDT', name: 'Avalanche',   color: '#e84142' },
  { symbol: 'DOT/USDT',  name: 'Polkadot',    color: '#e6007a' },
  { symbol: 'LTC/USDT',  name: 'Litecoin',    color: '#bfbbbb' },
]

interface CoinRow {
  symbol: string
  name:   string
  color:  string
  ticker: Ticker | null
}

interface Props {
  navigation: any
}

export default function MarketScreen({ navigation }: Props) {
  const [rows, setRows]           = useState<CoinRow[]>(
    COINS.map(c => ({ ...c, ticker: null }))
  )
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [connected, setConnected] = useState(false)
  const intervalRef               = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadTickers = async (isRefresh = false) => {
    try {
      const data = await fetchTickers()
      setRows(
        COINS.map(c => ({
          ...c,
          ticker: data[c.symbol] ?? null,
        }))
      )
      setConnected(true)
    } catch {
      setConnected(false)
    } finally {
      if (loading)   setLoading(false)
      if (isRefresh) setRefreshing(false)
    }
  }

  useEffect(() => {
    loadTickers()
    intervalRef.current = setInterval(() => loadTickers(), 3000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const onRefresh = () => {
    setRefreshing(true)
    loadTickers(true)
  }

  const formatPrice = (p: number | undefined) => {
    if (p == null) return '—'
    if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    if (p >= 1)    return p.toFixed(4)
    return p.toFixed(6)
  }

  const renderItem = ({ item }: { item: CoinRow }) => {
    const pct    = item.ticker?.change_24h_pct
    const isPos  = pct != null && pct >= 0
    const pctStr = pct != null ? `${isPos ? '+' : ''}${pct.toFixed(2)}%` : '—'

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate('Chart', { symbol: item.symbol })}
        activeOpacity={0.7}
      >
        <View style={[styles.dot, { backgroundColor: item.color }]} />

        <View style={styles.coinInfo}>
          <Text style={styles.symbol}>{item.symbol.replace('/USDT', '')}</Text>
          <Text style={styles.name}>{item.name}</Text>
        </View>

        <View style={styles.priceBlock}>
          <Text style={styles.price}>
            ${formatPrice(item.ticker?.price)}
          </Text>
          <Text style={[styles.change, { color: isPos ? C.green : C.red }]}>
            {pctStr}
          </Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Markets</Text>
        <View style={styles.connectionRow}>
          <View style={[styles.connDot, { backgroundColor: connected ? C.green : C.red }]} />
          <Text style={[styles.connText, { color: connected ? C.green : C.red }]}>
            {connected ? 'Live' : 'Offline'}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.cyan} />
          <Text style={styles.loadingText}>Loading markets…</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={item => item.symbol}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.cyan}
              colors={[C.cyan]}
            />
          }
          contentContainerStyle={styles.list}
        />
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
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop:     56,
    paddingBottom:  12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: {
    fontSize:   22,
    fontWeight: '700',
    color:      C.text,
    letterSpacing: 0.4,
  },
  connectionRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  connDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
  },
  connText: {
    fontSize:   12,
    fontWeight: '600',
  },
  list: {
    paddingBottom: 24,
  },
  row: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: 16,
    paddingVertical:   14,
    backgroundColor: C.card,
  },
  dot: {
    width:        10,
    height:       10,
    borderRadius: 5,
    marginRight:  12,
  },
  coinInfo: {
    flex: 1,
  },
  symbol: {
    fontSize:   15,
    fontWeight: '700',
    color:      C.text,
  },
  name: {
    fontSize: 12,
    color:    C.muted,
    marginTop: 2,
  },
  priceBlock: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize:   15,
    fontWeight: '600',
    color:      C.text,
    fontVariant: ['tabular-nums'],
  },
  change: {
    fontSize:   13,
    fontWeight: '500',
    marginTop:  2,
    fontVariant: ['tabular-nums'],
  },
  separator: {
    height:          1,
    backgroundColor: C.border,
  },
  centered: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            12,
  },
  loadingText: {
    color:    C.muted,
    fontSize: 14,
  },
})

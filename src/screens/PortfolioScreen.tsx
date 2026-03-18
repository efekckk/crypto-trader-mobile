import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator, FlatList, RefreshControl,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native'
import {
  AccountData, fetchAccount, fetchTradeHistory, TradeHistory,
  FuturesAccount, fetchFuturesAccount,
} from '../services/api'

const C = {
  bg:     '#111111',
  card:   '#1a1a1a',
  border: '#2a2a2a',
  green:  '#26a69a',
  red:    '#ef5350',
  cyan:   '#00d4ff',
  text:   '#e0e8f0',
  muted:  '#555566',
  orange: '#ff9800',
}

const COINS = ['BTC','ETH','BNB','SOL','ADA','XRP','DOGE','LINK','DOT','AVAX','LTC','MATIC']

function fp(n: number) {
  if (n >= 1000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
  if (n >= 1)    return '$' + n.toFixed(4)
  return '$' + n.toFixed(6)
}

export default function PortfolioScreen() {
  const [account,   setAccount]   = useState<AccountData | null>(null)
  const [futures,   setFutures]   = useState<FuturesAccount | null>(null)
  const [history,   setHistory]   = useState<TradeHistory[]>([])
  const [totalPnl,  setTotalPnl]  = useState(0)
  const [totalTrades, setTotalTrades] = useState(0)
  const [selCoin,   setSelCoin]   = useState('BTC')
  const [loading,   setLoading]   = useState(true)
  const [refreshing,setRefreshing]= useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [tab,       setTab]       = useState<'balances' | 'history'>('balances')

  const load = useCallback(async (isRefresh = false) => {
    try {
      // Fire all 3 in parallel — each can fail independently
      const [acc, fut, hist] = await Promise.allSettled([
        fetchAccount(),
        fetchFuturesAccount(),
        fetchTradeHistory(`${selCoin}USDT`, 50),
      ])
      if (acc.status === 'fulfilled')  setAccount(acc.value)
      if (fut.status === 'fulfilled')  setFutures(fut.value)
      if (hist.status === 'fulfilled' && hist.value) {
        setHistory(hist.value.trades)
        setTotalPnl(hist.value.total_pnl)
        setTotalTrades(hist.value.total_trades)
      }
      // Only error if all failed
      if (acc.status === 'rejected' && fut.status === 'rejected') {
        setError('Failed to load accounts')
      } else {
        setError(null)
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load portfolio')
    } finally {
      setLoading(false)
      if (isRefresh) setRefreshing(false)
    }
  }, [selCoin])

  useEffect(() => { load() }, [selCoin])

  const onRefresh = () => { setRefreshing(true); load(true) }

  // Only non-zero balances
  const nonZeroBalances = (account?.balances ?? []).filter(b => b.total > 0)

  // Total USDT value (rough, only shows raw total field from backend)
  const usdtBalance = nonZeroBalances.find(b => b.asset === 'USDT')

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
        <Text style={s.hdrTitle}>Portfolio</Text>
        <View style={s.connRow}>
          <View style={[s.connDot, { backgroundColor: error ? C.red : C.green }]} />
          <Text style={[s.connTxt, { color: error ? C.red : C.green }]}>
            {error ? 'Error' : 'Live'}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator color={C.cyan} size="large" />
          <Text style={{ color: C.muted, marginTop: 10 }}>Loading portfolio…</Text>
        </View>
      ) : error ? (
        <View style={s.centered}>
          <Text style={{ color: C.red, fontSize: 13, textAlign: 'center', paddingHorizontal: 20 }}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => load()}>
            <Text style={{ color: C.cyan, fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* ── Account Overview ── */}
          <View style={s.overviewRow}>
            <View style={s.overviewCard}>
              <Text style={s.overviewLbl}>Spot USDT</Text>
              <Text style={[s.overviewVal, { color: C.cyan }]}>
                {usdtBalance ? `$${usdtBalance.free.toFixed(2)}` : '$0.00'}
              </Text>
              {usdtBalance && usdtBalance.locked > 0 && (
                <Text style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>
                  Locked: ${usdtBalance.locked.toFixed(2)}
                </Text>
              )}
            </View>

            <View style={s.overviewCard}>
              <Text style={s.overviewLbl}>Trade PnL ({selCoin})</Text>
              <Text style={[s.overviewVal, { color: totalPnl >= 0 ? C.green : C.red }]}>
                {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}%
              </Text>
              <Text style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>
                {totalTrades} trades
              </Text>
            </View>
          </View>

          {/* ── Futures Overview ── */}
          {futures && (
            <View style={s.overviewRow}>
              <View style={s.overviewCard}>
                <Text style={s.overviewLbl}>Futures Balance</Text>
                <Text style={[s.overviewVal, { color: C.orange }]}>
                  ${futures.total_balance.toFixed(2)}
                </Text>
                <Text style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>
                  Available: ${futures.available_balance.toFixed(2)}
                </Text>
              </View>
              <View style={s.overviewCard}>
                <Text style={s.overviewLbl}>Unrealized PnL</Text>
                <Text style={[s.overviewVal, { color: futures.total_unrealized >= 0 ? C.green : C.red }]}>
                  {futures.total_unrealized >= 0 ? '+' : ''}${futures.total_unrealized.toFixed(2)}
                </Text>
                <Text style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>
                  {futures.positions.length} open position{futures.positions.length !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          )}

          {/* Futures positions */}
          {futures && futures.positions.length > 0 && (
            <View style={{ marginHorizontal: 14, marginTop: 6 }}>
              {futures.positions.map(p => (
                <View key={p.symbol} style={[s.balanceRow, { borderLeftWidth: 3, borderLeftColor: p.side === 'LONG' ? C.green : C.red }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.balanceAsset}>{p.symbol}</Text>
                    <Text style={{ color: p.side === 'LONG' ? C.green : C.red, fontSize: 10, fontWeight: '600' }}>
                      {p.side} {p.leverage}x · {p.size} qty
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[s.balanceFree, { color: p.unrealized_pnl >= 0 ? C.green : C.red }]}>
                      {p.unrealized_pnl >= 0 ? '+' : ''}${p.unrealized_pnl.toFixed(2)}
                    </Text>
                    <Text style={{ color: C.muted, fontSize: 10 }}>
                      Entry ${p.entry_price.toFixed(2)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── Account flags ── */}
          {account && (
            <View style={s.flagsRow}>
              <View style={[s.flag, { backgroundColor: account.can_trade ? C.green + '18' : C.red + '18', borderColor: account.can_trade ? C.green + '66' : C.red + '66' }]}>
                <Text style={{ color: account.can_trade ? C.green : C.red, fontSize: 11, fontWeight: '700' }}>
                  {account.can_trade ? '✓ Binance Spot Aktif' : '✗ Binance Spot Kapalı'}
                </Text>
                <Text style={{ color: C.muted, fontSize: 9, marginTop: 2 }}>
                  Binance hesap durumu · auto-trade ile bağımsız
                </Text>
              </View>
              <View style={s.flag}>
                <Text style={{ color: C.muted, fontSize: 10 }}>
                  Komisyon · Maker{' '}
                  <Text style={{ color: C.text, fontWeight: '700' }}>
                    %{(parseFloat(account.maker_fee) * 100).toFixed(2)}
                  </Text>
                  {'  '}Taker{' '}
                  <Text style={{ color: C.text, fontWeight: '700' }}>
                    %{(parseFloat(account.taker_fee) * 100).toFixed(2)}
                  </Text>
                </Text>
              </View>
            </View>
          )}

          {/* ── Tab Switcher ── */}
          <View style={s.tabRow}>
            {(['balances', 'history'] as const).map(t => (
              <TouchableOpacity
                key={t}
                style={[s.tabBtn, tab === t && s.tabActive]}
                onPress={() => setTab(t)}
              >
                <Text style={[s.tabTxt, tab === t && s.tabActiveTxt]}>
                  {t === 'balances' ? 'Balances' : 'Trade History'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Balances ── */}
          {tab === 'balances' && (
            <View style={s.section}>
              {nonZeroBalances.length === 0 ? (
                <View style={s.emptyCard}>
                  <Text style={{ color: C.muted, fontSize: 13 }}>No balances found</Text>
                  <Text style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>
                    Transfer funds from Funding → Spot wallet
                  </Text>
                </View>
              ) : nonZeroBalances.map(b => (
                <View key={b.asset} style={s.balanceRow}>
                  <View style={s.balanceDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.balanceAsset}>{b.asset}</Text>
                    {b.locked > 0 && (
                      <Text style={{ color: C.orange, fontSize: 10 }}>
                        Locked: {b.locked.toFixed(6)}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.balanceFree}>{b.free.toFixed(6)}</Text>
                    <Text style={{ color: C.muted, fontSize: 10 }}>
                      Total: {b.total.toFixed(6)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── Trade History ── */}
          {tab === 'history' && (
            <View style={s.section}>
              {/* Coin selector */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 10 }}
                contentContainerStyle={{ gap: 6, flexDirection: 'row' }}>
                {COINS.map(c => (
                  <TouchableOpacity key={c}
                    style={[s.chip, c === selCoin && s.chipActive]}
                    onPress={() => setSelCoin(c)}>
                    <Text style={[s.chipTxt, c === selCoin && s.chipTxtActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {history.length === 0 ? (
                <View style={s.emptyCard}>
                  <Text style={{ color: C.muted, fontSize: 13 }}>No trade history for {selCoin}</Text>
                </View>
              ) : history.map(t => {
                const isBuy = t.side === 'BUY'
                const hasPnl = t.pnl != null
                return (
                  <View key={t.id} style={[s.tradeRow, { borderLeftColor: isBuy ? C.green : C.red }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={[s.sideBadge, { backgroundColor: isBuy ? C.green + '22' : C.red + '22' }]}>
                          <Text style={{ color: isBuy ? C.green : C.red, fontSize: 11, fontWeight: '700' }}>
                            {isBuy ? '▲ BUY' : '▼ SELL'}
                          </Text>
                        </View>
                        <Text style={{ color: C.muted, fontSize: 11 }}>
                          {t.symbol}
                        </Text>
                      </View>
                      <Text style={{ color: C.muted, fontSize: 10 }}>
                        {new Date(t.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {' '}
                        {new Date(t.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', marginTop: 6, gap: 4 }}>
                      <View style={s.tradeCell}>
                        <Text style={s.tradeLbl}>Price</Text>
                        <Text style={s.tradeVal}>{fp(t.price)}</Text>
                      </View>
                      <View style={s.tradeCell}>
                        <Text style={s.tradeLbl}>Qty</Text>
                        <Text style={s.tradeVal}>{t.qty.toFixed(5)}</Text>
                      </View>
                      <View style={s.tradeCell}>
                        <Text style={s.tradeLbl}>USDT</Text>
                        <Text style={s.tradeVal}>${t.usdt.toFixed(2)}</Text>
                      </View>
                      {hasPnl && (
                        <View style={s.tradeCell}>
                          <Text style={s.tradeLbl}>PnL</Text>
                          <Text style={[s.tradeVal, { color: (t.pnl ?? 0) >= 0 ? C.green : C.red }]}>
                            {(t.pnl ?? 0) >= 0 ? '+' : ''}{(t.pnl ?? 0).toFixed(2)}%
                          </Text>
                        </View>
                      )}
                    </View>

                    <Text style={{ color: C.muted, fontSize: 9, marginTop: 4 }}>
                      Fee: {t.fee.toFixed(6)} {t.fee_asset}
                    </Text>
                  </View>
                )
              })}
            </View>
          )}
        </>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: C.bg },
  hdr:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  hdrTitle: { fontSize: 22, fontWeight: '700', color: C.text },
  connRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  connDot:  { width: 8, height: 8, borderRadius: 4 },
  connTxt:  { fontSize: 12, fontWeight: '600' },
  centered: { paddingVertical: 60, alignItems: 'center' },
  retryBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 8, borderWidth: 1, borderColor: C.cyan, borderRadius: 6 },

  overviewRow:  { flexDirection: 'row', marginHorizontal: 14, marginTop: 14, gap: 10 },
  overviewCard: { flex: 1, backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 14 },
  overviewLbl:  { fontSize: 10, color: C.muted, marginBottom: 4 },
  overviewVal:  { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] as any },

  flagsRow: { flexDirection: 'row', marginHorizontal: 14, marginTop: 10, gap: 8, flexWrap: 'wrap' },
  flag:     { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },

  tabRow:      { flexDirection: 'row', marginHorizontal: 14, marginTop: 14, gap: 8, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 0 },
  tabBtn:      { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:   { borderBottomColor: C.cyan },
  tabTxt:      { fontSize: 13, fontWeight: '600', color: C.muted },
  tabActiveTxt:{ color: C.cyan },

  section: { marginHorizontal: 14, marginTop: 14 },

  emptyCard: { backgroundColor: C.card, borderRadius: 8, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: C.border },

  balanceRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 6 },
  balanceDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: C.cyan, marginRight: 12 },
  balanceAsset: { color: C.text, fontSize: 14, fontWeight: '700' },
  balanceFree:  { color: C.text, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] as any },

  tradeRow:  { backgroundColor: C.card, borderLeftWidth: 3, borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderTopColor: C.border, borderRightColor: C.border, borderBottomColor: C.border, borderRadius: 8, padding: 10, marginBottom: 6 },
  sideBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  tradeCell: { flex: 1, alignItems: 'center' },
  tradeLbl:  { color: C.muted, fontSize: 9, marginBottom: 2 },
  tradeVal:  { color: C.text, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] as any },

  chip:        { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 6, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  chipActive:  { backgroundColor: C.cyan, borderColor: C.cyan },
  chipTxt:     { color: C.muted, fontSize: 11, fontWeight: '600' },
  chipTxtActive:{ color: '#000' },
})

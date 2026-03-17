import * as SecureStore from 'expo-secure-store'
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, Modal, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import { placeOrder, Signal } from '../services/api'

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

interface Props {
  visible:  boolean
  signal:   Signal | null
  symbol:   string          // e.g. 'BTC'
  onClose:  () => void
  onSuccess:(orderId: number) => void
}

function fp(n: number) {
  if (n >= 1000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
  if (n >= 1)    return '$' + n.toFixed(4)
  return '$' + n.toFixed(6)
}

export default function TradeConfirmModal({ visible, signal, symbol, onClose, onSuccess }: Props) {
  const [amount,   setAmount]   = useState('100')
  const [placing,  setPlacing]  = useState(false)

  // Load saved max trade amount from SecureStore
  useEffect(() => {
    SecureStore.getItemAsync('settings_max_trade_usdt').then(v => {
      if (v) setAmount(v)
    })
  }, [visible])

  if (!signal) return null

  const isLong  = signal.type === 'long'
  const side    = isLong ? 'BUY' : 'SELL'
  const sideColor = isLong ? C.green : C.red
  const fullSym = `${symbol}USDT`

  const confirmOrder = async () => {
    const usdt = parseFloat(amount)
    if (isNaN(usdt) || usdt <= 0) {
      Alert.alert('Invalid Amount', 'Enter a valid USDT amount')
      return
    }
    setPlacing(true)
    try {
      const order = await placeOrder(fullSym, side, usdt)
      if (order) {
        onSuccess(order.order_id)
        onClose()
        Alert.alert(
          'Order Placed',
          `${side} ${order.qty.toFixed(6)} ${symbol}\n@ ~${fp(order.avg_price)}\nOrder ID: ${order.order_id}`,
          [{ text: 'OK' }]
        )
      }
    } catch (e: any) {
      Alert.alert('Order Failed', e?.message ?? 'Unknown error')
    } finally {
      setPlacing(false)
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={s.sheet}>

          {/* Handle bar */}
          <View style={s.handle} />

          {/* Title */}
          <View style={s.titleRow}>
            <View style={[s.sideBadge, { backgroundColor: sideColor + '22', borderColor: sideColor }]}>
              <Text style={[s.sideTxt, { color: sideColor }]}>
                {isLong ? '▲ LONG' : '▼ SHORT'}
              </Text>
            </View>
            <Text style={s.titleSym}>{symbol}/USDT</Text>
          </View>

          {/* Signal Details */}
          <View style={s.detailsGrid}>
            {[
              { label: 'Entry',  value: fp(signal.entry),  color: C.cyan },
              { label: 'SL',     value: fp(signal.sl),     color: C.red },
              { label: 'TP1',    value: fp(signal.tp1),    color: C.green },
              { label: 'TP2',    value: fp(signal.tp2),    color: '#00e676' },
              { label: 'SL %',   value: `-${signal.sl_pct?.toFixed(2)}%`,  color: C.red },
              { label: 'TP1 %',  value: `+${signal.tp1_pct?.toFixed(2)}%`, color: C.green },
            ].map(item => (
              <View key={item.label} style={s.detailCell}>
                <Text style={s.detailLbl}>{item.label}</Text>
                <Text style={[s.detailVal, { color: item.color }]}>{item.value}</Text>
              </View>
            ))}
          </View>

          {/* Confluence score */}
          {(signal as any).confluence_score != null && (
            <View style={s.scoreRow}>
              <Text style={s.scoreLbl}>Confluence Score</Text>
              <Text style={[s.scoreVal, {
                color: (signal as any).confluence_score >= 60 ? C.green
                     : (signal as any).confluence_score >= 40 ? C.orange : C.red
              }]}>
                {(signal as any).confluence_score}/100
              </Text>
            </View>
          )}

          {/* USDT Amount */}
          <View style={s.amountSection}>
            <Text style={s.amountLbl}>Trade Amount (USDT)</Text>
            <View style={s.amountRow}>
              {['25', '50', '100', '200'].map(preset => (
                <TouchableOpacity
                  key={preset}
                  style={[s.presetBtn, amount === preset && s.presetActive]}
                  onPress={() => setAmount(preset)}
                >
                  <Text style={[s.presetTxt, amount === preset && s.presetActiveTxt]}>
                    ${preset}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={s.amountInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="Custom amount"
              placeholderTextColor={C.muted}
              selectTextOnFocus
            />
          </View>

          {/* Warning */}
          <View style={s.warnBox}>
            <Text style={s.warnTxt}>
              This places a real {side} MARKET order on Binance Spot. Funds will be debited immediately.
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={s.btnRow}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose} disabled={placing}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.confirmBtn, { backgroundColor: sideColor }, placing && { opacity: 0.6 }]}
              onPress={confirmOrder}
              disabled={placing}
            >
              {placing ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={s.confirmTxt}>{side} ${amount}</Text>
              )}
            </TouchableOpacity>
          </View>

        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent:  'flex-end',
  },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom:     36,
    paddingTop:        12,
    borderTopWidth:    1,
    borderColor:       C.border,
  },
  handle: {
    width:        40,
    height:       4,
    borderRadius: 2,
    backgroundColor: C.muted,
    alignSelf:    'center',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            10,
    marginBottom:   16,
  },
  sideBadge: {
    paddingHorizontal: 12,
    paddingVertical:    5,
    borderRadius:       6,
    borderWidth:        1,
  },
  sideTxt:  { fontSize: 13, fontWeight: '800' },
  titleSym: { fontSize: 18, fontWeight: '700', color: C.text },

  detailsGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:            8,
    marginBottom:  12,
  },
  detailCell: {
    flex:            1,
    minWidth:        '30%',
    backgroundColor: C.bg,
    borderRadius:    8,
    borderWidth:     1,
    borderColor:     C.border,
    padding:         10,
    alignItems:      'center',
  },
  detailLbl: { fontSize: 10, color: C.muted, marginBottom: 4 },
  detailVal: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] as any },

  scoreRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    backgroundColor: C.bg,
    borderRadius:    8,
    borderWidth:     1,
    borderColor:     C.border,
    paddingHorizontal: 14,
    paddingVertical:   10,
    marginBottom:      12,
  },
  scoreLbl: { fontSize: 13, color: C.muted },
  scoreVal: { fontSize: 18, fontWeight: '800' },

  amountSection: { marginBottom: 12 },
  amountLbl:     { fontSize: 12, color: C.muted, fontWeight: '600', marginBottom: 8 },
  amountRow:     { flexDirection: 'row', gap: 8, marginBottom: 8 },
  presetBtn:     { flex: 1, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 6, paddingVertical: 8, alignItems: 'center' },
  presetActive:  { borderColor: C.cyan, backgroundColor: C.cyan + '22' },
  presetTxt:     { color: C.muted, fontSize: 13, fontWeight: '600' },
  presetActiveTxt: { color: C.cyan },
  amountInput:   {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    color: C.text,
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontVariant: ['tabular-nums'] as any,
  },

  warnBox: {
    backgroundColor: C.orange + '15',
    borderRadius:     8,
    borderWidth:      1,
    borderColor:      C.orange + '44',
    padding:          10,
    marginBottom:     16,
  },
  warnTxt: { color: C.orange, fontSize: 11, lineHeight: 16 },

  btnRow:     { flexDirection: 'row', gap: 10 },
  cancelBtn:  { flex: 1, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  cancelTxt:  { color: C.muted, fontSize: 15, fontWeight: '600' },
  confirmBtn: { flex: 2, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  confirmTxt: { color: '#000', fontSize: 15, fontWeight: '800' },
})

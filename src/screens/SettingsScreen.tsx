import * as SecureStore from 'expo-secure-store'
import {
  DEFAULT_MIN_SCORE,
  getMinScore,
  registerForPushNotifications,
  setMinScore,
} from '../services/notifications'
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, ScrollView, StyleSheet, Switch,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import { fetchHealth, TUNNEL_URL } from '../services/api'

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

const KEYS = {
  MAX_TRADE:   'settings_max_trade_usdt',
  AUTO_TRADE:  'settings_auto_trade',
  TUNNEL_URL:  'settings_tunnel_url',
  API_KEY:     'settings_api_key',
  MIN_SCORE:   'notif_min_score',
}

export default function SettingsScreen() {
  const [maxTrade,   setMaxTrade]   = useState('100')
  const [autoTrade,  setAutoTrade]  = useState(false)
  const [tunnelUrl,  setTunnelUrl]  = useState(TUNNEL_URL)
  const [apiKey,     setApiKey]     = useState('')
  const [minScore,   setMinScoreState] = useState(String(DEFAULT_MIN_SCORE))
  const [testing,    setTesting]    = useState(false)
  const [testResult, setTestResult] = useState<'ok' | 'err' | null>(null)
  const [saved,      setSaved]      = useState(false)

  // Load saved settings on mount
  useEffect(() => {
    ;(async () => {
      const [mt, at, tu, ak, ms] = await Promise.all([
        SecureStore.getItemAsync(KEYS.MAX_TRADE),
        SecureStore.getItemAsync(KEYS.AUTO_TRADE),
        SecureStore.getItemAsync(KEYS.TUNNEL_URL),
        SecureStore.getItemAsync(KEYS.API_KEY),
        SecureStore.getItemAsync(KEYS.MIN_SCORE),
      ])
      if (mt) setMaxTrade(mt)
      if (at) setAutoTrade(at === 'true')
      if (tu) setTunnelUrl(tu)
      if (ak) setApiKey(ak)
      if (ms) setMinScoreState(ms)
    })()
  }, [])

  const save = async () => {
    const num = parseFloat(maxTrade)
    if (isNaN(num) || num <= 0) {
      Alert.alert('Invalid', 'Max trade amount must be a positive number')
      return
    }
    await Promise.all([
      SecureStore.setItemAsync(KEYS.MAX_TRADE,  maxTrade),
      SecureStore.setItemAsync(KEYS.AUTO_TRADE, String(autoTrade)),
      SecureStore.setItemAsync(KEYS.TUNNEL_URL, tunnelUrl),
      SecureStore.setItemAsync(KEYS.API_KEY,    apiKey),
      setMinScore(parseInt(minScore, 10) || DEFAULT_MIN_SCORE),
    ])
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      await fetchHealth()
      setTestResult('ok')
    } catch {
      setTestResult('err')
    } finally {
      setTesting(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={s.root}
        contentContainerStyle={{ paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={s.hdr}>
          <Text style={s.hdrTitle}>Settings</Text>
        </View>

        {/* ── Trading Settings ── */}
        <View style={s.section}>
          <Text style={s.secTitle}>Trading</Text>

          {/* Max Trade Amount */}
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>Max Trade Amount (USDT)</Text>
              <Text style={s.rowDesc}>Maximum USDT per trade order</Text>
            </View>
            <TextInput
              style={s.input}
              value={maxTrade}
              onChangeText={setMaxTrade}
              keyboardType="decimal-pad"
              placeholderTextColor={C.muted}
              placeholder="100"
              selectTextOnFocus
            />
          </View>

          {/* Auto Trade Toggle */}
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>Auto Trade</Text>
              <Text style={s.rowDesc}>
                {autoTrade
                  ? 'Orders placed automatically on signal'
                  : 'Confirm required before each order'}
              </Text>
            </View>
            <Switch
              value={autoTrade}
              onValueChange={setAutoTrade}
              trackColor={{ false: C.border, true: C.cyan + '88' }}
              thumbColor={autoTrade ? C.cyan : C.muted}
            />
          </View>

          {autoTrade && (
            <View style={s.warningBox}>
              <Text style={s.warningTxt}>
                ⚠ Auto trade places real orders without confirmation. Use with caution.
              </Text>
            </View>
          )}
        </View>

        {/* ── Notification Settings ── */}
        <View style={s.section}>
          <Text style={s.secTitle}>Notifications</Text>

          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>Min Confluence Score</Text>
              <Text style={s.rowDesc}>
                Only notify when score ≥ this threshold (0–100)
              </Text>
            </View>
            <TextInput
              style={s.input}
              value={minScore}
              onChangeText={setMinScoreState}
              keyboardType="number-pad"
              placeholderTextColor={C.muted}
              placeholder="75"
              selectTextOnFocus
            />
          </View>

          <TouchableOpacity
            style={s.testBtn}
            onPress={() => registerForPushNotifications().then(t =>
              Alert.alert(t ? 'Token registered' : 'Failed', t ? t.slice(0,40) + '…' : 'Check permissions')
            )}
          >
            <Text style={s.testBtnTxt}>Register Push Notifications</Text>
          </TouchableOpacity>
        </View>

        {/* ── Connection Settings ── */}
        <View style={s.section}>
          <Text style={s.secTitle}>Connection</Text>

          {/* Tunnel URL */}
          <View style={[s.row, { flexDirection: 'column', alignItems: 'flex-start', gap: 8 }]}>
            <Text style={s.rowLabel}>Backend URL</Text>
            <Text style={s.rowDesc}>Cloudflare tunnel URL (changes on restart)</Text>
            <TextInput
              style={[s.input, { width: '100%', fontSize: 11 }]}
              value={tunnelUrl}
              onChangeText={setTunnelUrl}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor={C.muted}
              placeholder="https://..."
              selectTextOnFocus
            />
          </View>

          {/* API Key */}
          <View style={[s.row, { flexDirection: 'column', alignItems: 'flex-start', gap: 8 }]}>
            <Text style={s.rowLabel}>API Key</Text>
            <Text style={s.rowDesc}>X-API-Key header for backend auth</Text>
            <TextInput
              style={[s.input, { width: '100%', fontSize: 11 }]}
              value={apiKey}
              onChangeText={setApiKey}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              placeholderTextColor={C.muted}
              placeholder="••••••••"
              selectTextOnFocus
            />
          </View>

          {/* Test Connection */}
          <TouchableOpacity style={s.testBtn} onPress={testConnection} disabled={testing}>
            {testing ? (
              <ActivityIndicator color={C.cyan} size="small" />
            ) : (
              <Text style={s.testBtnTxt}>Test Connection</Text>
            )}
          </TouchableOpacity>

          {testResult === 'ok' && (
            <View style={[s.resultBox, { borderColor: C.green }]}>
              <Text style={{ color: C.green, fontSize: 12, fontWeight: '600' }}>
                ✓ Backend reachable
              </Text>
            </View>
          )}
          {testResult === 'err' && (
            <View style={[s.resultBox, { borderColor: C.red }]}>
              <Text style={{ color: C.red, fontSize: 12, fontWeight: '600' }}>
                ✗ Cannot reach backend — check URL
              </Text>
            </View>
          )}
        </View>

        {/* ── App Info ── */}
        <View style={s.section}>
          <Text style={s.secTitle}>App</Text>
          <View style={s.infoCard}>
            {[
              { label: 'Version',         value: '1.0.1 (Build 2)' },
              { label: 'Platform',        value: Platform.OS === 'ios' ? 'iOS' : 'Android' },
              { label: 'Current Backend', value: TUNNEL_URL.replace('https://', '') },
            ].map(item => (
              <View key={item.label} style={s.infoRow}>
                <Text style={s.infoLbl}>{item.label}</Text>
                <Text style={s.infoVal} numberOfLines={1} ellipsizeMode="middle">{item.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Save ── */}
        <View style={s.saveSection}>
          <TouchableOpacity style={[s.saveBtn, saved && s.saveBtnDone]} onPress={save}>
            <Text style={s.saveTxt}>{saved ? '✓ Saved' : 'Save Settings'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Guide ── */}
        <GuideSection />

      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// ─── Guide Section ────────────────────────────────────────────────────────────

interface GuideEntry {
  id:       string
  icon:     string
  title:    string
  badge?:   { text: string; color: string }
  summary:  string          // 1 satır özet
  what:     string          // ne yapar
  signals:  { label: string; color: string; meaning: string }[]
  tip:      string
}

const GUIDE_ENTRIES: GuideEntry[] = [
  {
    id: 'confluence',
    icon: '◎',
    title: 'Confluence Score',
    badge: { text: '0–100', color: '#00d4ff' },
    summary: '4 engine\'in birleşik güven skoru. Yüksek = güçlü sinyal.',
    what: 'AMD, OFI, Microstructure ve StatArb engine\'lerinin ağırlıklı ortalamasıdır. Hiçbir tek engine tek başına güvenilir değildir — hepsinin aynı yönü göstermesi gerekir.',
    signals: [
      { label: '75–100', color: '#26a69a', meaning: 'Güçlü sinyal — bildirimi tetikler, işleme girebilirsin' },
      { label: '50–74',  color: '#ff9800', meaning: 'Orta sinyal — diğer göstergeleri de kontrol et' },
      { label: '25–49',  color: '#ef5350', meaning: 'Zayıf sinyal — gürültü olabilir, bekle' },
      { label: '0–24',   color: '#555566', meaning: 'Gürültü — işleme girme' },
    ],
    tip: 'Analysis tab\'ında tüm coinlerin skoru aynı anda görünür, en yükseği seç.',
  },
  {
    id: 'amd',
    icon: 'A',
    title: 'AMD — Akümülasyon · Manipülasyon · Dağıtım',
    badge: { text: 'Ağırlık %40', color: '#ff9800' },
    summary: 'Smart Money\'nin piyasaya giriş döngüsünü tespit eder.',
    what: 'Büyük oyuncular (smart money) önce biriktirir (accumulation), sonra perakende yatırımcıların stop\'larını sweep eder (manipulation), ardından gerçek yön başlar. AMD bu döngüyü 3 adımda tespit eder:\n\n1. Accumulation Range: Fiyat dar bant içinde konsolide olur (≥8 mum, ATR\'nin 3×\'inden dar).\n2. Manipulation Sweep: Fiyat bandın dışına çıkar (stop hunt), sonra geri döner.\n3. POI Touch: Sweep sırasında bir Order Block veya FVG\'ye dokunulur.',
    signals: [
      { label: '▲ LONG',  color: '#26a69a', meaning: 'Alt bant sweep → OB/FVG touch → yukarı hareket bekleniyor' },
      { label: '▼ SHORT', color: '#ef5350', meaning: 'Üst bant sweep → OB/FVG touch → aşağı hareket bekleniyor' },
      { label: 'OB',      color: '#00d4ff', meaning: 'Order Block: SM\'nin büyük emir verdiği mum. Fiyat geri döner' },
      { label: 'FVG',     color: '#ff9800', meaning: 'Fair Value Gap: 3 mum arasındaki boşluk. Fiyat doldurmaya gelir' },
    ],
    tip: 'Conf ≥0.85 = tam AMD döngüsü. Conf 0.52–0.60 = kısmi pattern, dikkatli ol.',
  },
  {
    id: 'ofi',
    icon: 'O',
    title: 'OFI — Order Flow Imbalance',
    badge: { text: 'Ağırlık %25', color: '#00d4ff' },
    summary: 'Alım–satım baskısını anlık order book\'tan ölçer.',
    what: 'Cont, Cucuringu & Zhang (2021) paper\'ına dayalı. Order book\'un 10 seviyesini analiz eder, PCA ile tek bir integrated OFI değerine sıkıştırır. Tek snapshot\'ta bile Static OBI (bid/ask volume dengesi) anlamlıdır.\n\nStatic OBI = (Bid Hacmi − Ask Hacmi) / Toplam Hacim\nIntegrated OFI = PCA first principal component of 10-level OFI',
    signals: [
      { label: 'OBI > +0.15', color: '#26a69a', meaning: 'Bid baskısı baskın — alıcılar daha güçlü' },
      { label: 'OBI < −0.15', color: '#ef5350', meaning: 'Ask baskısı baskın — satıcılar daha güçlü' },
      { label: 'OFI-I > 0',   color: '#26a69a', meaning: 'Kümülatif alım akışı — long yönünü destekler' },
      { label: 'OFI-I < 0',   color: '#ef5350', meaning: 'Kümülatif satım akışı — short yönünü destekler' },
    ],
    tip: 'Chart ekranında chart altındaki MicroBar\'da canlı görürsün.',
  },
  {
    id: 'micro',
    icon: 'M',
    title: 'Microstructure — VAMP & Avellaneda-Stoikov',
    badge: { text: 'Ağırlık %20', color: '#00d4ff' },
    summary: 'Gerçek orta fiyatı ve piyasa yapıcı optimal fiyatlarını hesaplar.',
    what: 'VAMP (Volume-Adjusted Mid Price): Sadece best bid/ask yerine 10 seviyeyi hacim ağırlıklı birleştirerek gerçek orta fiyatı hesaplar. Mid fiyattan sapma alım/satım baskısını gösterir.\n\nAvellaneda-Stoikov: Piyasa yapıcı modelinden türetilen optimal alım/satım fiyatları. Fiyat optimal ask\'ın üstündeyse overpriced (short bias), optimal bid\'in altındaysa underpriced (long bias).',
    signals: [
      { label: 'VAMP > Mid', color: '#26a69a', meaning: 'Ağırlıklı fiyat ortadan yüksek — alım baskısı var' },
      { label: 'VAMP < Mid', color: '#ef5350', meaning: 'Ağırlıklı fiyat ortadan düşük — satım baskısı var' },
      { label: 'A-S bid',    color: '#26a69a', meaning: 'Fiyat optimal bid\'in altında — ucuz bölge' },
      { label: 'A-S ask',    color: '#ef5350', meaning: 'Fiyat optimal ask\'ın üstünde — pahalı bölge' },
    ],
    tip: 'Chart\'ta MicroBar\'daki "VAMP vs MID" kolonunu izle.',
  },
  {
    id: 'statarb',
    icon: 'S',
    title: 'StatArb — İstatistiksel Arbitraj',
    badge: { text: 'Ağırlık %15', color: '#ff9800' },
    summary: 'Kointegre çiftleri bulur, spread Z-score ile işlem sinyali üretir.',
    what: 'İki coin arasındaki fiyat farkının (spread) uzun vadede ortalamaya döndüğünü (mean reversion) varsayar.\n\nEngle-Granger testi ile kointegrasyon kontrol edilir. Kalman filtresi ile hedge ratio anlık güncellenir. Z-score spreadın kaç standart sapma uzakta olduğunu gösterir.',
    signals: [
      { label: 'Z > +2',    color: '#ef5350', meaning: 'Spread ortalamanın 2σ üstünde → SHORT A / LONG B' },
      { label: 'Z < −2',    color: '#26a69a', meaning: 'Spread ortalamanın 2σ altında → LONG A / SHORT B' },
      { label: 'p < 0.05',  color: '#26a69a', meaning: 'Güçlü kointegrasyon — çift gerçekten birlikte hareket ediyor' },
      { label: 't½ < 20',   color: '#00d4ff', meaning: 'Hızlı mean reversion — sinyal daha güvenilir' },
    ],
    tip: 'StatArb tab\'ında tüm çiftleri Z-score bar ile görselleştirilmiş görebilirsin.',
  },
  {
    id: 'signals',
    icon: '↑',
    title: 'AMD Sinyalleri — Entry / SL / TP',
    badge: undefined,
    summary: 'AMD engine\'in ürettiği somut işlem seviyeleri.',
    what: 'Her sinyal şunları içerir:\n• Entry: İşleme giriş fiyatı (OB/FVG seviyesi)\n• SL (Stop Loss): Maksimum kayıp seviyesi\n• TP1 / TP2: Kâr alma hedefleri\n• R:R: Risk/Reward oranı (örn. 1:2 = riskin 2 katı kazanç)\n• Confluence Score: 0–100 arası sinyal gücü',
    signals: [
      { label: 'open',  color: '#ff9800', meaning: 'Aktif — fiyat henüz SL veya TP\'ye ulaşmadı' },
      { label: 'tp1 ✓', color: '#26a69a', meaning: 'TP1 hit — ilk hedef tuttu' },
      { label: 'tp2 ✓', color: '#26a69a', meaning: 'TP2 hit — tam hedef tuttu' },
      { label: 'sl ✗',  color: '#ef5350', meaning: 'Stop loss tetiklendi — zararlı kapandı' },
    ],
    tip: 'Signals tab\'ında "Trade" butonu ile doğrudan Binance Spot\'ta market emir gönderebilirsin.',
  },
  {
    id: 'portfolio',
    icon: '$',
    title: 'Portfolio — Bakiye & Geçmiş',
    badge: undefined,
    summary: 'Binance Spot bakiyelerini ve işlem geçmişini gösterir.',
    what: 'Portfolio ekranı:\n• Balances: Sıfırdan büyük tüm spot varlıklar\n• Trade History: Coin bazlı gerçekleşen işlemler\n• PnL: Her işlemde gerçekleşen kâr/zarar yüzdesi\n• Binance Spot Aktif: Hesabında spot işlem izni var mı\n• Maker/Taker: Komisyon oranları (%0.1 = 0.001)',
    signals: [
      { label: 'Maker %0.10', color: '#555566', meaning: 'Limit emir koyduğunda ödenen komisyon (likidite eklersin)' },
      { label: 'Taker %0.10', color: '#555566', meaning: 'Market emir açtığında ödenen komisyon (likidite tüketirsin)' },
      { label: '+PnL %',      color: '#26a69a', meaning: 'İşlem kârlı kapandı' },
      { label: '−PnL %',      color: '#ef5350', meaning: 'İşlem zararlı kapandı' },
    ],
    tip: 'Binance bakiyeni görmek için Funding\'den Spot cüzdanına transfer yapman gerekiyor.',
  },
]

function GuideCard({ entry }: { entry: GuideEntry }) {
  const [open, setOpen] = useState(false)

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={g.card}
      onPress={() => setOpen(v => !v)}
    >
      {/* Header row */}
      <View style={g.cardHeader}>
        <View style={g.iconBox}>
          <Text style={g.iconTxt}>{entry.icon}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={g.cardTitle}>{entry.title}</Text>
            {entry.badge && (
              <View style={[g.badge, { backgroundColor: entry.badge.color + '22', borderColor: entry.badge.color + '66' }]}>
                <Text style={[g.badgeTxt, { color: entry.badge.color }]}>{entry.badge.text}</Text>
              </View>
            )}
          </View>
          <Text style={g.summary} numberOfLines={open ? undefined : 1}>{entry.summary}</Text>
        </View>
        <Text style={g.chevron}>{open ? '▲' : '▼'}</Text>
      </View>

      {/* Expanded content */}
      {open && (
        <View style={g.body}>
          {/* What section */}
          <Text style={g.subTitle}>Nasıl Çalışır</Text>
          <Text style={g.bodyText}>{entry.what}</Text>

          {/* Signals */}
          <Text style={[g.subTitle, { marginTop: 12 }]}>Sinyal Referansı</Text>
          {entry.signals.map((sig, i) => (
            <View key={i} style={g.sigRow}>
              <View style={[g.sigBadge, { backgroundColor: sig.color + '22' }]}>
                <Text style={[g.sigLabel, { color: sig.color }]}>{sig.label}</Text>
              </View>
              <Text style={g.sigMeaning}>{sig.meaning}</Text>
            </View>
          ))}

          {/* Tip */}
          <View style={g.tipBox}>
            <Text style={g.tipIcon}>💡</Text>
            <Text style={g.tipText}>{entry.tip}</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  )
}

function GuideSection() {
  return (
    <View style={g.section}>
      <Text style={g.secTitle}>Rehber — Analiz Açıklamaları</Text>
      <Text style={g.secDesc}>Her kartı genişletmek için dokun.</Text>
      {GUIDE_ENTRIES.map(entry => (
        <GuideCard key={entry.id} entry={entry} />
      ))}
    </View>
  )
}

const g = StyleSheet.create({
  section:  { marginHorizontal: 14, marginTop: 28, marginBottom: 8 },
  secTitle: { fontSize: 12, fontWeight: '700', color: C.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  secDesc:  { fontSize: 11, color: C.muted, marginBottom: 12 },

  card:       { backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, marginBottom: 8, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  iconBox:    { width: 34, height: 34, borderRadius: 8, backgroundColor: C.border, alignItems: 'center', justifyContent: 'center' },
  iconTxt:    { fontSize: 14, fontWeight: '800', color: C.cyan },
  cardTitle:  { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 2 },
  summary:    { fontSize: 11, color: C.muted, lineHeight: 16 },
  badge:      { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  badgeTxt:   { fontSize: 9, fontWeight: '700' },
  chevron:    { fontSize: 10, color: C.muted, marginLeft: 8 },

  body:      { borderTopWidth: 1, borderTopColor: C.border, padding: 14 },
  subTitle:  { fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 },
  bodyText:  { fontSize: 12, color: C.text, lineHeight: 19 },

  sigRow:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6, gap: 8 },
  sigBadge:  { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, minWidth: 72, alignItems: 'center' },
  sigLabel:  { fontSize: 10, fontWeight: '700', fontVariant: ['tabular-nums'] as any },
  sigMeaning:{ flex: 1, fontSize: 11, color: C.text, lineHeight: 16 },

  tipBox:    { flexDirection: 'row', gap: 6, marginTop: 12, backgroundColor: C.cyan + '11', borderRadius: 7, padding: 10, alignItems: 'flex-start' },
  tipIcon:   { fontSize: 13 },
  tipText:   { flex: 1, fontSize: 11, color: C.cyan, lineHeight: 17 },
})

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: C.bg },
  hdr:      { paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  hdrTitle: { fontSize: 22, fontWeight: '700', color: C.text },

  section:  { marginHorizontal: 14, marginTop: 20 },
  secTitle: { fontSize: 12, fontWeight: '700', color: C.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },

  row:       { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 8 },
  rowLabel:  { fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 2 },
  rowDesc:   { fontSize: 11, color: C.muted },

  input: {
    backgroundColor: C.bg,
    borderWidth:     1,
    borderColor:     C.border,
    borderRadius:    6,
    color:           C.text,
    fontSize:        14,
    fontWeight:      '600',
    paddingHorizontal: 10,
    paddingVertical:   8,
    minWidth:          80,
    textAlign:         'right',
    fontVariant:       ['tabular-nums'] as any,
  },

  warningBox: { backgroundColor: C.orange + '15', borderRadius: 8, borderWidth: 1, borderColor: C.orange + '55', padding: 10, marginBottom: 8 },
  warningTxt: { color: C.orange, fontSize: 12, lineHeight: 18 },

  testBtn:    { backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.cyan, paddingVertical: 11, alignItems: 'center', marginTop: 4, marginBottom: 8 },
  testBtnTxt: { color: C.cyan, fontSize: 14, fontWeight: '600' },
  resultBox:  { borderRadius: 6, borderWidth: 1, padding: 10, alignItems: 'center', marginBottom: 4 },

  infoCard:  { backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  infoLbl:   { fontSize: 13, color: C.muted },
  infoVal:   { fontSize: 13, color: C.text, fontWeight: '600', flex: 1, textAlign: 'right', marginLeft: 16 },

  saveSection: { marginHorizontal: 14, marginTop: 24 },
  saveBtn:     { backgroundColor: C.cyan, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  saveBtnDone: { backgroundColor: C.green },
  saveTxt:     { color: '#000', fontSize: 15, fontWeight: '800' },
})

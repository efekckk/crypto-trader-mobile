import axios from 'axios'

// ─── CONFIG ──────────────────────────────────────────────────────────────────
// .env dosyasından okunur — .env.example'a bakarak kendi .env dosyanı oluştur
export const TUNNEL_URL = process.env.EXPO_PUBLIC_TUNNEL_URL
  ?? 'https://fun-sat-sewing-development.trycloudflare.com'
export const API_KEY    = process.env.EXPO_PUBLIC_API_KEY
  ?? '7Vb70Gwpy2McDXJIXQUt81MBoo-LvyQtfo7Gd_tPOw4'

const api = axios.create({
  baseURL: TUNNEL_URL,
  timeout: 45000,
  headers: {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json',
  },
})

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Ticker {
  price:          number
  change_24h:     number
  change_24h_pct: number
  high_24h:       number
  low_24h:        number
  volume_24h:     number
  bid:            number
  ask:            number
}

export interface KlineBar {
  timestamp: string
  open: number; high: number; low: number; close: number; volume: number
}

export interface Signal {
  id:         number
  timestamp:  string
  type:       'long' | 'short'
  entry:      number
  sl:         number
  tp1:        number
  tp2:        number
  sl_pct:     number
  tp1_pct:    number
  outcome:    'tp1' | 'tp2' | 'sl' | 'open'
  pnl_pct:    number
  rr:         number
}

export interface Stats {
  total:          number
  wins:           number
  losses:         number
  open:           number
  win_rate:       number
  total_pnl:      number
  avg_win:        number
  avg_loss:       number
  profit_factor:  number
  // Simulation stats
  sim_balance:      number   // $100 başlangıçla biten bakiye
  sim_total_pnl:    number   // net $ kazanç/kayıp
  sim_total_return: number   // net %
  max_drawdown:     number   // % max düşüş
  sharpe:           number
}

export interface OrderLevel { price: number; qty: number }

// ─── Symbol helpers ───────────────────────────────────────────────────────────
// 'BTC/USDT' → 'BTCUSDT'  |  'BTCUSDT' → 'BTCUSDT'
export const toBinanceSym = (s: string) => s.replace('/', '').toUpperCase()

// ─── API calls ────────────────────────────────────────────────────────────────
export const fetchTickers = async (): Promise<Record<string, Ticker>> => {
  const r = await api.get('/api/v1/prices/live')
  return r.data?.data ?? {}
}

export const fetchKlines = async (
  symbol: string,
  interval = '1h',
  limit   = 100,
): Promise<KlineBar[]> => {
  const sym = toBinanceSym(symbol)
  const r = await api.get(`/api/v1/prices/klines/${sym}`, {
    params: { interval, limit },
  })
  return r.data?.data ?? []
}

export const fetchOrderBook = async (symbol: string, limit = 12) => {
  const sym = toBinanceSym(symbol)
  const r = await api.get(`/api/v1/prices/orderbook/${sym}`, {
    params: { limit },
  })
  return r.data?.data ?? { bids: [], asks: [], spread: 0 }
}

export const fetchSignalPerformance = async (
  symbol   = 'BTCUSDT',
  interval = '1h',
  limit    = 200,
): Promise<{ signals: Signal[]; stats: Stats; equity_curve: any[] }> => {
  const sym = toBinanceSym(symbol)
  const r = await api.get('/api/v1/signals/performance', {
    params: { symbol: sym, interval, limit },
  })
  return r.data?.data ?? { signals: [], stats: null, equity_curve: [] }
}

export const fetchAMD = async (symbol: string, timeframe: string) => {
  // AMD endpoint expects 'BTC/USDT' format with slash
  const sym = symbol.includes('/') ? symbol : symbol.replace('USDT', '/USDT')
  const r = await api.post('/api/v1/analysis/amd', { symbol: sym, timeframe })
  return r.data?.data ?? {}
}

// ─── Futures Trading API ──────────────────────────────────────────────────────
export interface FuturesPosition {
  symbol:         string
  side:           'LONG' | 'SHORT' | 'NONE'
  size:           number
  entry_price:    number
  mark_price:     number
  unrealized_pnl: number
  leverage:       number
  margin_type:    string
  notional:       number
}

export interface FuturesAccount {
  total_balance:     number
  available_balance: number
  total_unrealized:  number
  total_margin:      number
  can_trade:         boolean
  positions:         FuturesPosition[]
}

export const fetchFuturesAccount = async (): Promise<FuturesAccount | null> => {
  const r = await api.get('/api/v1/futures/account')
  if (r.data?.status !== 'success') return null
  return r.data.data
}

export const setFuturesLeverage = async (
  symbol: string, leverage: number
): Promise<any> => {
  const r = await api.post('/api/v1/futures/leverage', {
    symbol: toBinanceSym(symbol), leverage: Math.min(leverage, 3),
  })
  return r.data
}

export const placeFuturesOrder = async (
  symbol:      string,
  side:        'BUY' | 'SELL',
  usdt_amount: number,
  leverage:    number = 1,
): Promise<any> => {
  const r = await api.post('/api/v1/futures/order', {
    symbol:      toBinanceSym(symbol),
    side,
    usdt_amount,
    leverage:    Math.min(leverage, 3),
  })
  if (r.data?.status !== 'success') throw new Error(r.data?.message ?? 'Order failed')
  return r.data.data
}

export const closeFuturesPosition = async (symbol: string): Promise<any> => {
  const r = await api.post('/api/v1/futures/close', {
    symbol: toBinanceSym(symbol),
  })
  if (r.data?.status !== 'success') throw new Error(r.data?.message ?? 'Close failed')
  return r.data.data
}

export const fetchHealth = async () => {
  const r = await api.get('/health')
  return r.data
}

// ─── Confluence API ───────────────────────────────────────────────────────────
export interface ConfluenceEngine {
  name:      string
  score:     number
  weighted:  number
  direction: 'long' | 'short' | 'neutral'
  sources:   string[]
}

export interface ConfluenceData {
  symbol:           string
  timestamp:        string
  confluence_score: number
  direction:        'long' | 'short' | 'neutral'
  signal_strength:  'strong' | 'moderate' | 'weak' | 'noise'
  should_notify:    boolean
  engines:          ConfluenceEngine[]
  sources:          string[]
  entry_price:      number | null
  stop_loss:        number | null
  take_profit_1:    number | null
  take_profit_2:    number | null
}

export const fetchConfluence = async (
  symbol    = 'BTC/USDT',
  timeframe = '1h',
): Promise<ConfluenceData | null> => {
  const r = await api.post('/api/v1/analysis/confluence', {
    symbol: toBinanceSym(symbol).replace('USDT', '/USDT'),
    timeframe,
  })
  if (r.data?.status !== 'success') return null
  return r.data.data
}

// ─── Trading API ──────────────────────────────────────────────────────────────
export interface Balance {
  asset:  string
  free:   number
  locked: number
  total:  number
}

export interface AccountData {
  balances:   Balance[]
  can_trade:  boolean
  maker_fee:  string
  taker_fee:  string
  update_time: number
}

export interface TradeOrder {
  order_id:   number
  symbol:     string
  side:       'BUY' | 'SELL'
  status:     string
  qty:        number
  usdt_spent: number
  avg_price:  number
  timestamp:  number
}

export interface TradeHistory {
  id:        number
  symbol:    string
  side:      'BUY' | 'SELL'
  price:     number
  qty:       number
  usdt:      number
  fee:       number
  fee_asset: string
  time:      number
  pnl:       number | null
}

export const fetchAccount = async (): Promise<AccountData | null> => {
  const r = await api.get('/api/v1/trade/account')
  if (r.data?.status !== 'success') return null
  return r.data.data
}

export const placeOrder = async (
  symbol:      string,
  side:        'BUY' | 'SELL',
  usdt_amount: number,
): Promise<TradeOrder | null> => {
  const r = await api.post('/api/v1/trade/order', {
    symbol:      toBinanceSym(symbol),
    side,
    usdt_amount,
    order_type: 'MARKET',
  })
  if (r.data?.status !== 'success') throw new Error(r.data?.message ?? 'Order failed')
  return r.data.data
}

export const fetchTradeHistory = async (
  symbol = 'BTCUSDT',
  limit  = 50,
): Promise<{ trades: TradeHistory[]; total_pnl: number; total_trades: number }> => {
  const r = await api.get('/api/v1/trade/history', {
    params: { symbol: toBinanceSym(symbol), limit },
  })
  return r.data?.data ?? { trades: [], total_pnl: 0, total_trades: 0 }
}

export default api

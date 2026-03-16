import axios from 'axios'

// ─── CONFIG ──────────────────────────────────────────────────────────────────
// .env dosyasından okunur — .env.example'a bakarak kendi .env dosyanı oluştur
export const TUNNEL_URL = process.env.EXPO_PUBLIC_TUNNEL_URL
  ?? 'https://fun-sat-sewing-development.trycloudflare.com'
export const API_KEY    = process.env.EXPO_PUBLIC_API_KEY
  ?? '7Vb70Gwpy2McDXJIXQUt81MBoo-LvyQtfo7Gd_tPOw4'

const api = axios.create({
  baseURL: TUNNEL_URL,
  timeout: 10000,
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
  total: number; wins: number; losses: number; open: number
  win_rate: number; total_pnl: number; avg_win: number; avg_loss: number
  profit_factor: number
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

export const fetchHealth = async () => {
  const r = await api.get('/health')
  return r.data
}

export default api

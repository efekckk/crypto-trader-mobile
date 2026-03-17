/**
 * Push Notification Service
 * - Registers device with Expo Push service
 * - Stores push token in SecureStore
 * - Sends local notification for high-confluence signals
 */

import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

// ─── Config ───────────────────────────────────────────────────────────────────
const TOKEN_KEY        = 'expo_push_token'
const MIN_SCORE_KEY    = 'notif_min_score'
export const DEFAULT_MIN_SCORE = 75   // only notify if confluence ≥ this

// ─── Notification behaviour (foreground) ──────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

// ─── Registration ─────────────────────────────────────────────────────────────

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('[Notifications] Push notifications require a physical device.')
    return null
  }

  // iOS permission
  const { status: existing } = await Notifications.getPermissionsAsync()
  let finalStatus = existing
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') {
    console.warn('[Notifications] Permission not granted.')
    return null
  }

  // Android channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('signals', {
      name:        'Trading Signals',
      importance:  Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor:  '#00d4ff',
      sound:       'default',
    })
  }

  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data
    await SecureStore.setItemAsync(TOKEN_KEY, token)
    console.log('[Notifications] Push token registered:', token.slice(0, 30) + '…')
    return token
  } catch (err) {
    console.error('[Notifications] Token error:', err)
    return null
  }
}

export async function getStoredPushToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY)
}

// ─── Local notification helpers ───────────────────────────────────────────────

export interface SignalNotifPayload {
  symbol:          string
  direction:       'long' | 'short' | 'neutral'
  confluenceScore: number
  entryPrice?:     number | null
  stopLoss?:       number | null
  takeProfit1?:    number | null
  sources?:        string[]
}

export async function sendSignalNotification(payload: SignalNotifPayload) {
  const minScore = await getMinScore()
  if (payload.confluenceScore < minScore) return

  const dir     = payload.direction === 'long' ? '▲ LONG' : payload.direction === 'short' ? '▼ SHORT' : '○'
  const score   = payload.confluenceScore
  const ep      = payload.entryPrice   ? ` @ $${payload.entryPrice.toFixed(2)}`  : ''
  const slLine  = payload.stopLoss     ? `SL $${payload.stopLoss.toFixed(2)}`    : ''
  const tp1Line = payload.takeProfit1  ? `TP1 $${payload.takeProfit1.toFixed(2)}` : ''
  const levels  = [slLine, tp1Line].filter(Boolean).join('  ')

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${dir} ${payload.symbol}  [${score}/100]`,
      body:  `Confluence ${score}/100${ep}${levels ? '\n' + levels : ''}`,
      data:  payload as any,
      sound: 'default',
    },
    trigger: null,   // immediate
  })
}

// ─── Settings helpers ─────────────────────────────────────────────────────────

export async function getMinScore(): Promise<number> {
  const v = await SecureStore.getItemAsync(MIN_SCORE_KEY)
  return v ? parseInt(v, 10) : DEFAULT_MIN_SCORE
}

export async function setMinScore(score: number) {
  await SecureStore.setItemAsync(MIN_SCORE_KEY, String(score))
}

import { Ionicons } from '@expo/vector-icons'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { StatusBar } from 'expo-status-bar'
import React from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import ChartScreen from './src/screens/ChartScreen'
import MarketScreen from './src/screens/MarketScreen'
import OrderBookScreen from './src/screens/OrderBookScreen'
import SignalsScreen from './src/screens/SignalsScreen'

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

// ─── Stack for Markets → Chart ─────────────────────────────────────────────
const MarketStack = createStackNavigator()

function MarketStackScreen() {
  return (
    <MarketStack.Navigator screenOptions={{ headerShown: false }}>
      <MarketStack.Screen name="MarketList" component={MarketScreen} />
      <MarketStack.Screen name="Chart"      component={ChartScreen as any} />
    </MarketStack.Navigator>
  )
}

// ─── Stack for Chart tab (default BTC/USDT) ─────────────────────────────────
const ChartStack = createStackNavigator()

function ChartStackScreen() {
  return (
    <ChartStack.Navigator screenOptions={{ headerShown: false }}>
      <ChartStack.Screen
        name="ChartMain"
        component={ChartScreen as any}
        initialParams={{ symbol: 'BTC/USDT' }}
      />
    </ChartStack.Navigator>
  )
}

// ─── Bottom Tabs ─────────────────────────────────────────────────────────────
const Tab = createBottomTabNavigator()

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor={C.bg} />
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown:     false,
            tabBarStyle: {
              backgroundColor: C.bg,
              borderTopColor:  C.border,
              borderTopWidth:  1,
              height:          60,
              paddingBottom:   8,
              paddingTop:      4,
            },
            tabBarActiveTintColor:   C.cyan,
            tabBarInactiveTintColor: C.muted,
            tabBarLabelStyle: {
              fontSize:   11,
              fontWeight: '600',
            },
            tabBarIcon: ({ color, size }) => {
              let iconName: keyof typeof Ionicons.glyphMap = 'bar-chart'

              if (route.name === 'Markets') {
                iconName = 'bar-chart'
              } else if (route.name === 'Chart') {
                iconName = 'trending-up'
              } else if (route.name === 'Signals') {
                iconName = 'analytics'
              } else if (route.name === 'Order Book') {
                iconName = 'list'
              }

              return <Ionicons name={iconName} size={size} color={color} />
            },
          })}
        >
          <Tab.Screen name="Markets"    component={MarketStackScreen} />
          <Tab.Screen name="Chart"      component={ChartStackScreen} />
          <Tab.Screen name="Signals"    component={SignalsScreen} />
          <Tab.Screen name="Order Book" component={OrderBookScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  )
}

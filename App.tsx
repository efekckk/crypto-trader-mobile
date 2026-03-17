import { Ionicons } from '@expo/vector-icons'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { StatusBar } from 'expo-status-bar'
import React from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import AnalysisScreen from './src/screens/AnalysisScreen'
import ChartScreen from './src/screens/ChartScreen'
import PortfolioScreen from './src/screens/PortfolioScreen'
import SettingsScreen from './src/screens/SettingsScreen'
import SignalsScreen from './src/screens/SignalsScreen'
import StatArbScreen from './src/screens/StatArbScreen'

const C = {
  bg:     '#111111',
  card:   '#1a1a1a',
  border: '#2a2a2a',
  cyan:   '#00d4ff',
  muted:  '#555566',
}

// ─── Stack for Chart tab ─────────────────────────────────────────────────────
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

// Icon map
const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Portfolio: 'wallet',
  Chart:     'trending-up',
  Signals:   'analytics',
  Analysis:  'pulse',
  StatArb:   'git-compare',
  Settings:  'settings',
}

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
              height:          56,
              paddingBottom:   6,
              paddingTop:      4,
            },
            tabBarActiveTintColor:   C.cyan,
            tabBarInactiveTintColor: C.muted,
            tabBarLabelStyle: {
              fontSize:   9,
              fontWeight: '600',
            },
            tabBarIcon: ({ color, size }) => (
              <Ionicons
                name={ICONS[route.name] ?? 'ellipse'}
                size={size - 2}
                color={color}
              />
            ),
          })}
        >
          <Tab.Screen name="Portfolio" component={PortfolioScreen} />
          <Tab.Screen name="Chart"     component={ChartStackScreen} />
          <Tab.Screen name="Signals"   component={SignalsScreen} />
          <Tab.Screen name="Analysis"  component={AnalysisScreen} />
          <Tab.Screen name="StatArb"   component={StatArbScreen} />
          <Tab.Screen name="Settings"  component={SettingsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  )
}

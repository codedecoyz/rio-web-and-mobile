import React, { useEffect } from 'react'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  useFonts as useBricolageFonts,
} from '@expo-google-fonts/bricolage-grotesque'
import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
  useFonts as useInstrumentFonts,
} from '@expo-google-fonts/instrument-sans'
import { AuthProvider } from '@/lib/auth-context'
import { colors, fonts } from '@/theme/tokens'

SplashScreen.preventAutoHideAsync().catch(() => {})

export default function RootLayout() {
  const [bricolageLoaded] = useBricolageFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_500Medium,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
  })
  const [instrumentLoaded] = useInstrumentFonts({
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
  })

  const ready = bricolageLoaded && instrumentLoaded

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {})
    }
  }, [ready])

  if (!ready) return null

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.stone },
            headerTintColor: colors.forest,
            headerTitleStyle: {
              fontFamily: fonts.displaySemiBold,
              color: colors.ink,
              fontSize: 18,
            },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.stone },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="auth/login" options={{ title: 'Sign in' }} />
          <Stack.Screen name="auth/signup" options={{ title: 'Create account' }} />
          <Stack.Screen name="auth/forgot-password" options={{ title: 'Reset password' }} />
          <Stack.Screen name="items/[id]/index" options={{ title: 'Listing' }} />
          <Stack.Screen name="items/[id]/edit" options={{ title: 'Edit listing' }} />
          <Stack.Screen name="rentals/[id]" options={{ title: 'Rental' }} />
          <Stack.Screen name="disputes/index" options={{ title: 'Disputes' }} />
          <Stack.Screen name="disputes/new" options={{ title: 'Report a problem' }} />
          <Stack.Screen name="disputes/[id]" options={{ title: 'Dispute' }} />
          <Stack.Screen name="saved" options={{ title: 'Saved items' }} />
          <Stack.Screen name="settings" options={{ title: 'Account settings' }} />
          <Stack.Screen name="warden" options={{ title: 'Warden dashboard' }} />
          <Stack.Screen name="staff" options={{ title: 'Staff custody' }} />
          <Stack.Screen name="admin/roles" options={{ title: 'Roles & access' }} />
          <Stack.Screen name="how-it-works" options={{ title: 'How RIO works' }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  )
}

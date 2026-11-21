import React from 'react'
import { View } from 'react-native'
import { Tabs } from 'expo-router'
import { ArrowLeftRight, LayoutDashboard, PlusCircle, ScanLine, Store } from 'lucide-react-native'
import { AppHeader } from '@/components/shell/AppHeader'
import { colors, fonts } from '@/theme/tokens'

export default function TabsLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.stone }}>
      <AppHeader />
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.stone },
          tabBarActiveTintColor: colors.forest,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: {
            backgroundColor: colors.chalk,
            borderTopColor: colors.line,
            borderTopWidth: 1,
            height: 62,
            paddingBottom: 6,
            paddingTop: 6,
          },
          tabBarLabelStyle: {
            fontFamily: fonts.sansMedium,
            fontSize: 11,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => <LayoutDashboard size={size - 2} color={color} />,
          }}
        />
        <Tabs.Screen
          name="marketplace"
          options={{
            title: 'Market',
            tabBarIcon: ({ color, size }) => <Store size={size - 2} color={color} />,
          }}
        />
        <Tabs.Screen
          name="sell"
          options={{
            title: 'Sell',
            tabBarIcon: ({ color, size }) => <PlusCircle size={size - 2} color={color} />,
          }}
        />
        <Tabs.Screen
          name="handover"
          options={{
            title: 'Handover',
            tabBarIcon: ({ color, size }) => <ScanLine size={size - 2} color={color} />,
          }}
        />
        <Tabs.Screen
          name="activity"
          options={{
            title: 'Activity',
            tabBarIcon: ({ color, size }) => <ArrowLeftRight size={size - 2} color={color} />,
          }}
        />
      </Tabs>
    </View>
  )
}

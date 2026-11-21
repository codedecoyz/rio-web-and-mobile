import React from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { PlusCircle } from 'lucide-react-native'
import { ListingForm } from '@/components/listings/ListingForm'
import { Card, EmptyState } from '@/components/ui/Feedback'
import { useAuth } from '@/lib/auth-context'
import { createListing } from '@/lib/data/listings'
import { colors, fonts, textStyles } from '@/theme/tokens'

export default function SellScreen() {
  const router = useRouter()
  const { viewer } = useAuth()

  if (!viewer) {
    return (
      <View style={styles.gate}>
        <EmptyState
          icon={<PlusCircle size={24} color={colors.forest} />}
          title="Sign in to list an item"
          message="Set a starting price, your floor, and when you leave campus. RIO lowers the price smoothly until it sells."
          actionLabel="Sign in"
          onAction={() => router.push('/auth/login')}
        />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={textStyles.h1}>List an item</Text>
        <Text style={styles.subtitle}>
          Set a starting price, the lowest youâ€™ll accept, and when you leave. Buyers see the live price; it never drops below your floor.
        </Text>

        <Card style={styles.card}>
          <ListingForm
            submitLabel="Publish listing"
            onSubmit={async (payload) => {
              const res = await createListing(viewer.id, payload)
              router.replace({
                pathname: '/items/[id]/edit',
                params: { id: res.id, notice: res.uploadErrors.length ? 'created-partial' : 'created' },
              })
            }}
          />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  gate: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  container: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  subtitle: {
    fontFamily: fonts.sansRegular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
  },
  card: {
    marginTop: 6,
    padding: 18,
  },
})

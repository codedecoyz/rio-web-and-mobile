import React, { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Heart } from 'lucide-react-native'
import { ListingCard } from '@/components/listings/ListingCard'
import { EmptyState, Notice, Skeleton } from '@/components/ui/Feedback'
import { useAuth } from '@/lib/auth-context'
import { getSavedListings, toggleSaved, type ListingCardData } from '@/lib/data/listings'
import { colors, textStyles } from '@/theme/tokens'

export default function SavedScreen() {
  const router = useRouter()
  const { viewer } = useAuth()
  const [items, setItems] = useState<ListingCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!viewer) {
      setLoading(false)
      return
    }
    try {
      setError(null)
      setItems(await getSavedListings())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldnâ€™t load saved items.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [viewer])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  if (!viewer) {
    return (
      <View style={styles.gate}>
        <EmptyState
          icon={<Heart size={24} color={colors.forest} />}
          title="Sign in to see your saved items"
          actionLabel="Sign in"
          onAction={() => router.push('/auth/login')}
        />
      </View>
    )
  }

  const now = Date.now()

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true)
            void load()
          }}
          tintColor={colors.forest}
        />
      }
    >
      <Text style={textStyles.h1}>Saved items</Text>
      <Text style={textStyles.bodyMuted}>
        Only you can see this list. Prices keep falling while you decide, and an item can be claimed by someone else first.
      </Text>

      {error ? <Notice tone="error" title={error} /> : null}

      {loading ? (
        <Skeleton height={240} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Heart size={24} color={colors.forest} />}
          title="Nothing saved yet"
          message="Tap the heart on any listing to keep it here."
          actionLabel="Browse the marketplace"
          onAction={() => router.replace('/(tabs)/marketplace')}
        />
      ) : (
        <View style={{ gap: 14 }}>
          {items.map((item) => (
            <ListingCard
              key={item.id}
              item={item}
              now={now}
              showStatus={item.status !== 'ACTIVE'}
              saved
              onPress={() => router.push({ pathname: '/items/[id]', params: { id: item.id } })}
              onToggleSave={async () => {
                setItems((prev) => prev.filter((x) => x.id !== item.id))
                try {
                  await toggleSaved(item.id, true)
                } catch {
                  void load()
                }
              }}
            />
          ))}
        </View>
      )}
    </ScrollView>
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
    paddingBottom: 36,
    gap: 14,
  },
})

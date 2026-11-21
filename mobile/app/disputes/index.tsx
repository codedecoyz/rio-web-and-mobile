import React, { useCallback, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Gavel } from 'lucide-react-native'
import { StatusBadge } from '@/components/ui/Badges'
import { Card, EmptyState, Notice, Skeleton } from '@/components/ui/Feedback'
import { useAuth } from '@/lib/auth-context'
import { getDisputes, type DisputeRow } from '@/lib/data/disputes'
import { formatDateTime } from '@/lib/format'
import { colors, fonts, textStyles } from '@/theme/tokens'

export default function DisputesListScreen() {
  const router = useRouter()
  const { viewer } = useAuth()
  const [disputes, setDisputes] = useState<DisputeRow[]>([])
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
      setDisputes(await getDisputes())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Disputes couldnâ€™t be loaded.')
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
          icon={<Gavel size={24} color={colors.forest} />}
          title="Sign in to view disputes"
          actionLabel="Sign in"
          onAction={() => router.push('/auth/login')}
        />
      </View>
    )
  }

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
      <Text style={textStyles.h1}>Disputes</Text>
      <Text style={textStyles.bodyMuted}>
        Problems with a purchase or rental. To report a new one, open the transaction from Activity and choose â€œReport a problemâ€.
      </Text>

      {error ? <Notice tone="error" title={error} /> : null}

      {loading ? (
        <Skeleton height={140} />
      ) : disputes.length === 0 ? (
        <EmptyState
          icon={<Gavel size={24} color={colors.forest} />}
          title="No disputes"
          message="Nothing has been reported on transactions you can see."
        />
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {disputes.map((d, idx) => (
            <Pressable
              key={d.id}
              onPress={() => router.push({ pathname: '/disputes/[id]', params: { id: d.id } })}
              style={[styles.row, idx > 0 && styles.border]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.title}>{d.listing.title}</Text>
                <Text style={textStyles.caption} numberOfLines={1}>
                  {d.claim_id ? 'Purchase' : 'Rental'} dispute opened {formatDateTime(d.created_at)}
                </Text>
              </View>
              <StatusBadge status={d.status} />
            </Pressable>
          ))}
        </Card>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
  },
  border: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  title: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.ink,
  },
})

import React, { useCallback, useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ListingForm } from '@/components/listings/ListingForm'
import { StatusBadge } from '@/components/ui/Badges'
import { Button } from '@/components/ui/Button'
import { Card, Notice, Skeleton } from '@/components/ui/Feedback'
import { useAuth } from '@/lib/auth-context'
import { deleteListingPhoto, getListing, updateListing, type ListingDetail } from '@/lib/data/listings'
import { listingMediaUrl } from '@/lib/env'
import { toISTLocalInput } from '@/lib/format'
import { colors, radii, textStyles } from '@/theme/tokens'

export default function EditListingScreen() {
  const router = useRouter()
  const { id, notice: paramNotice } = useLocalSearchParams<{ id: string; notice?: string }>()
  const { viewer } = useAuth()
  const [listing, setListing] = useState<ListingDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(
    paramNotice === 'created'
      ? 'Your listing is live on the marketplace.'
      : paramNotice === 'created-partial'
        ? 'Your listing is live, but some photos didn’t upload. Try adding them below.'
        : null,
  )

  const load = useCallback(async () => {
    if (!id) return
    try {
      const data = await getListing(id)
      setListing(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t load listing.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Skeleton height={44} />
        <Skeleton height={300} />
      </ScrollView>
    )
  }

  if (!listing || !viewer || listing.owner_id !== viewer.id) {
    return (
      <View style={styles.container}>
        <Notice tone="error" title={error ?? 'You can’t edit this listing.'} />
      </View>
    )
  }

  const editable = listing.status === 'ACTIVE' || listing.status === 'WITHDRAWN'

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <Text style={textStyles.h1}>Edit listing</Text>
          <StatusBadge status={listing.status} />
        </View>

        <Button
          label="View listing"
          variant="secondary"
          size="sm"
          onPress={() => router.replace({ pathname: '/items/[id]', params: { id: listing.id } })}
          style={{ alignSelf: 'flex-start' }}
        />

        {banner ? <Notice tone={paramNotice === 'created-partial' ? 'warning' : 'success'} title={banner} /> : null}
        {error ? <Notice tone="error" title={error} /> : null}

        {listing.media.length > 0 ? (
          <View style={{ gap: 10 }}>
            <Text style={textStyles.h2}>Current photos</Text>
            <View style={styles.photoGrid}>
              {listing.media.map((m) => (
                <View key={m.id} style={styles.photoItem}>
                  <Image source={{ uri: listingMediaUrl(m.thumb_path ?? m.storage_path) }} style={styles.photoImg} contentFit="cover" />
                  {editable ? (
                    <Button
                      label="Remove"
                      variant="ghost"
                      size="sm"
                      onPress={async () => {
                        try {
                          await deleteListingPhoto(m.id)
                          setBanner('Photo removed.')
                          await load()
                        } catch (e) {
                          setError(e instanceof Error ? e.message : 'Couldn’t remove photo.')
                        }
                      }}
                    />
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <Card style={{ padding: 18 }}>
          {editable ? (
            <ListingForm
              submitLabel="Save changes"
              existingPhotos={listing.media.length}
              defaults={{
                title: listing.title,
                description: listing.description ?? '',
                category: listing.category_slug,
                condition: listing.condition,
                startRupees: String(listing.start_price_paise / 100),
                floorRupees: String(listing.floor_price_paise / 100),
                departure: listing.departure_at ? toISTLocalInput(listing.departure_at) : '',
                noDeparture: !listing.departure_at,
                rentable: listing.is_rentable,
              }}
              onSubmit={async (payload) => {
                const res = await updateListing(viewer.id, listing.id, payload)
                setBanner(
                  res.uploadErrors.length
                    ? `Saved, but some photos failed: ${res.uploadErrors.join(' ')}`
                    : 'Changes saved. If you changed a price or the departure, the auction restarted from now.',
                )
                await load()
              }}
            />
          ) : (
            <Notice tone="info" title="This listing is in a transaction and can’t be edited." />
          )}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoItem: {
    width: '30%',
    gap: 4,
  },
  photoImg: {
    aspectRatio: 1,
    width: '100%',
    borderRadius: radii.media,
    backgroundColor: colors.forestTint,
  },
})

import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import { Heart, MapPin, Repeat } from 'lucide-react-native'
import { CategoryArt } from '@/components/brand/CategoryArt'
import { PriceTag } from '@/components/brand/PriceTag'
import { Badge, StatusBadge } from '@/components/ui/Badges'
import { CONDITIONS } from '@/domain/catalog'
import type { ListingCardData } from '@/lib/data/listings'
import { listingMediaUrl } from '@/lib/env'
import { colors, fonts, radii } from '@/theme/tokens'

export function ListingCard({
  item,
  now,
  showStatus = false,
  saved,
  onPress,
  onToggleSave,
}: {
  item: ListingCardData
  now: number
  showStatus?: boolean
  saved?: boolean
  onPress: () => void
  onToggleSave?: () => void
}) {
  const imageUri = item.cover_path ? listingMediaUrl(item.cover_thumb_path ?? item.cover_path) : null

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={item.title}
    >
      <View style={styles.mediaBox}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} contentFit="cover" transition={150} />
        ) : (
          <CategoryArt slug={item.category_slug} label={item.category_name} style={styles.image} />
        )}
        {showStatus ? (
          <View style={styles.topLeft}>
            <StatusBadge status={item.status} />
          </View>
        ) : null}
        {onToggleSave ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation()
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
              onToggleSave()
            }}
            hitSlop={8}
            style={styles.heartBtn}
            accessibilityRole="button"
            accessibilityLabel={saved ? `Remove ${item.title} from saved` : `Save ${item.title}`}
          >
            <Heart
              size={19}
              color={saved ? colors.clay : colors.ink}
              fill={saved ? colors.clay : 'none'}
            />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{item.category_name}</Text>
          <Text style={styles.metaDot}>Â·</Text>
          <Text style={styles.metaText}>{CONDITIONS[item.condition].label}</Text>
          {item.hostel_name ? (
            <>
              <Text style={styles.metaDot}>Â·</Text>
              <View style={styles.hostelWrap}>
                <MapPin size={13} color={colors.muted} />
                <Text style={styles.metaText}>{item.hostel_name}</Text>
              </View>
            </>
          ) : null}
        </View>

        {item.is_rentable ? (
          <Badge tone="forest" Icon={Repeat}>
            Also for rent
          </Badge>
        ) : null}

        <PriceTag
          currentPaise={item.current_price_paise}
          startPaise={item.start_price_paise}
          floorPaise={item.floor_price_paise}
          listedAt={item.listed_at}
          departureAt={item.departure_at}
          now={now}
          style={{ marginTop: 4 }}
        />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.chalk,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  cardPressed: {
    borderColor: colors.lineStrong,
  },
  mediaBox: {
    backgroundColor: colors.forestTint,
    aspectRatio: 4 / 3,
    width: '100%',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  topLeft: {
    position: 'absolute',
    top: 10,
    left: 10,
  },
  heartBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: 'rgba(250, 248, 243, 0.94)',
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: 14,
    gap: 10,
  },
  title: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 18,
    lineHeight: 23,
    color: colors.ink,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.muted,
  },
  metaDot: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.lineStrong,
  },
  hostelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
})

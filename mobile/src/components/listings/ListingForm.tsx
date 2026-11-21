import React, { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { Camera, ImagePlus, Trash2 } from 'lucide-react-native'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Feedback'
import { CheckboxRow, ChipSelect, Field, TextInputField } from '@/components/ui/Field'
import { CATEGORIES, CATEGORY_BY_SLUG, CONDITIONS, CONDITION_KEYS, type Condition } from '@/domain/catalog'
import { formatINR } from '@/domain/money'
import { RENTAL_PERIODS, RENTAL_PERIOD_KEYS, quoteRental } from '@/domain/rental'
import { MAX_PHOTOS, type ListingMutationPayload, type PickedPhoto } from '@/lib/data/listings'
import { fromISTLocalInput, toISTLocalInput } from '@/lib/format'
import { colors, fonts, radii } from '@/theme/tokens'

export interface ListingFormDefaults {
  title?: string
  description?: string
  category?: string
  condition?: Condition
  startRupees?: string
  floorRupees?: string
  departure?: string
  noDeparture?: boolean
  rentable?: boolean
}

export function ListingForm({
  defaults = {},
  submitLabel,
  existingPhotos = 0,
  onSubmit,
}: {
  defaults?: ListingFormDefaults
  submitLabel: string
  existingPhotos?: number
  onSubmit: (payload: ListingMutationPayload) => Promise<void>
}) {
  const [title, setTitle] = useState(defaults.title ?? '')
  const [category, setCategory] = useState(defaults.category ?? '')
  const [condition, setCondition] = useState<Condition>(defaults.condition ?? 'good')
  const [description, setDescription] = useState(defaults.description ?? '')
  const [startRupees, setStartRupees] = useState(defaults.startRupees ?? '')
  const [floorRupees, setFloorRupees] = useState(defaults.floorRupees ?? '')
  const [noDeparture, setNoDeparture] = useState(defaults.noDeparture ?? false)
  const [departure, setDeparture] = useState(
    defaults.departure || toISTLocalInput(new Date(Date.now() + 7 * 86_400_000).toISOString()),
  )
  const [rentable, setRentable] = useState(defaults.rentable ?? false)
  const [photoAlt, setPhotoAlt] = useState('')
  const [photos, setPhotos] = useState<PickedPhoto[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const remainingSlots = Math.max(0, MAX_PHOTOS - existingPhotos - photos.length)
  const cat = CATEGORY_BY_SLUG.get(category)
  const parsedStart = Number(startRupees)
  const startPaise = Number.isInteger(parsedStart) && parsedStart > 0 ? parsedStart * 100 : null

  const applyDepartureOffsetDays = (days: number) => {
    setDeparture(toISTLocalInput(new Date(Date.now() + days * 86_400_000).toISOString()))
  }

  const pickFromLibrary = async () => {
    if (remainingSlots <= 0) return
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      setFormError('Photo library permission is needed to attach images.')
      return
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remainingSlots,
      quality: 0.9,
    })
    if (!res.canceled) {
      setPhotos((prev) => [...prev, ...res.assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height }))].slice(0, MAX_PHOTOS - existingPhotos))
    }
  }

  const takePhoto = async () => {
    if (remainingSlots <= 0) return
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) {
      setFormError('Camera permission is needed to take a photo.')
      return
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    })
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0]
      setPhotos((prev) => [...prev, { uri: a.uri, width: a.width, height: a.height }].slice(0, MAX_PHOTOS - existingPhotos))
    }
  }

  const handleSubmit = async () => {
    setFormError(null)
    const errs: Record<string, string> = {}
    const trimmedTitle = title.trim()
    if (trimmedTitle.length < 3 || trimmedTitle.length > 80) {
      errs.title = 'Give it a title between 3 and 80 characters.'
    }
    if (!category || !CATEGORY_BY_SLUG.has(category)) {
      errs.category = 'Choose a category.'
    }
    const startNum = Number(startRupees)
    const floorNum = Number(floorRupees)
    if (!Number.isInteger(startNum) || startNum < 1 || startNum > 100_000) {
      errs.startRupees = 'Use whole rupees between â‚¹1 and â‚¹1,00,000.'
    }
    if (!Number.isInteger(floorNum) || floorNum < 1 || floorNum > 100_000) {
      errs.floorRupees = 'Use whole rupees between â‚¹1 and â‚¹1,00,000.'
    } else if (Number.isInteger(startNum) && floorNum >= startNum) {
      errs.floorRupees = 'The floor must be lower than the starting price.'
    }

    let departureIso: string | null = null
    if (!noDeparture) {
      const d = fromISTLocalInput(departure)
      if (!d) {
        errs.departure = 'Use YYYY-MM-DDTHH:mm in IST (e.g. 2026-12-01T18:00).'
      } else if (d.getTime() < Date.now() + 3 * 3_600_000) {
        errs.departure = 'Departure must be at least 3 hours from now.'
      } else if (d.getTime() > Date.now() + 366 * 86_400_000) {
        errs.departure = 'Departure must be within the next year.'
      } else {
        departureIso = d.toISOString()
      }
    }

    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSubmitting(true)
    try {
      await onSubmit({
        title: trimmedTitle,
        description: description.trim() || null,
        category_slug: category,
        condition,
        start_price_paise: startNum * 100,
        floor_price_paise: floorNum * 100,
        departure_at: departureIso,
        is_rentable: rentable,
        photoAlt: photoAlt.trim(),
        photos,
      })
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View style={styles.form}>
      {formError ? <Notice tone="error" title={formError} /> : null}

      <View style={styles.section}>
        <Text style={styles.legend}>The item</Text>
        <Field label="Title" hint="What a buyer would search for, e.g. â€œSymphony air cooler, 40Lâ€." error={fieldErrors.title}>
          <TextInputField
            value={title}
            onChangeText={setTitle}
            placeholder="Symphony air cooler, 40L"
            maxLength={80}
            invalid={Boolean(fieldErrors.title)}
          />
        </Field>

        <Field label="Category" error={fieldErrors.category}>
          <ChipSelect
            value={category}
            onChange={(slug) => {
              setCategory(slug)
              const selected = CATEGORY_BY_SLUG.get(slug)
              if (selected && !startRupees && !floorRupees) {
                setStartRupees(String(selected.defaultStartPaise / 100))
                setFloorRupees(String(selected.defaultFloorPaise / 100))
              }
            }}
            options={CATEGORIES.map((c) => ({ value: c.slug, label: c.name }))}
          />
        </Field>

        <Field label="Condition" hint={CONDITIONS[condition].description}>
          <ChipSelect
            value={condition}
            onChange={setCondition}
            options={CONDITION_KEYS.map((k) => ({ value: k, label: CONDITIONS[k].label }))}
          />
        </Field>

        <Field
          label="Description"
          optional
          hint="Size, brand, age, any faults. Donâ€™t include your room number: youâ€™ll arrange the meeting after a claim."
        >
          <TextInputField
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={2000}
            placeholder="Working condition, cleaned before packing..."
          />
        </Field>
      </View>

      <View style={styles.section}>
        <Text style={styles.legend}>Price and timing</Text>
        <Text style={styles.muted}>
          Your price drops in a straight line from the starting price to your floor, reaching the floor 2 hours before you leave.
          {cat && cat.embodiedCo2eKg > 0
            ? ` Typical for this category: ${formatINR(cat.defaultStartPaise)} start, ${formatINR(cat.defaultFloorPaise)} floor.`
            : ''}
        </Text>
        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <Field label="Starting price (â‚¹)" error={fieldErrors.startRupees}>
              <TextInputField
                value={startRupees}
                onChangeText={setStartRupees}
                keyboardType="numeric"
                placeholder="1800"
                invalid={Boolean(fieldErrors.startRupees)}
              />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Floor price (â‚¹)" error={fieldErrors.floorRupees}>
              <TextInputField
                value={floorRupees}
                onChangeText={setFloorRupees}
                keyboardType="numeric"
                placeholder="500"
                invalid={Boolean(fieldErrors.floorRupees)}
              />
            </Field>
          </View>
        </View>

        <CheckboxRow
          label="No departure date: keep a fixed price"
          checked={noDeparture}
          onChange={setNoDeparture}
        />

        {!noDeparture ? (
          <Field
            label="When do you leave campus? (IST)"
            hint="At least 3 hours from now. In your final hour, unsold items go to campus staff."
            error={fieldErrors.departure}
          >
            <View style={styles.presetRow}>
              {[
                { label: '+2d', days: 2 },
                { label: '+5d', days: 5 },
                { label: '+10d', days: 10 },
                { label: '+30d', days: 30 },
              ].map((p) => (
                <Pressable key={p.label} onPress={() => applyDepartureOffsetDays(p.days)} style={styles.presetChip}>
                  <Text style={styles.presetText}>{p.label}</Text>
                </Pressable>
              ))}
            </View>
            <TextInputField
              value={departure}
              onChangeText={setDeparture}
              placeholder="2026-12-01T18:00"
              autoCapitalize="none"
              invalid={Boolean(fieldErrors.departure)}
            />
          </Field>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.legend}>Renting</Text>
        <CheckboxRow label="Also let people rent it" checked={rentable} onChange={setRentable} />
        {rentable ? (
          <View style={styles.quoteBox}>
            {startPaise ? (
              RENTAL_PERIOD_KEYS.map((p) => {
                const q = quoteRental(startPaise, p)
                return (
                  <Text key={p} style={styles.quoteLine}>
                    <Text style={{ fontFamily: fonts.sansSemiBold }}>{RENTAL_PERIODS[p].label}: </Text>
                    {formatINR(q.rentPaise)} rent + {formatINR(q.depositPaise)} deposit
                  </Text>
                )
              })
            ) : (
              <Text style={styles.muted}>Enter a starting price to see what renters will pay.</Text>
            )}
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.legend}>Photos</Text>
        <Text style={styles.muted}>
          {remainingSlots > 0
            ? `Up to ${MAX_PHOTOS} photos (${remainingSlots} slot${remainingSlots === 1 ? '' : 's'} left). Compressed automatically.`
            : `Youâ€™ve added the maximum of ${MAX_PHOTOS} photos.`}
        </Text>
        {remainingSlots > 0 ? (
          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Button label="Gallery" variant="secondary" icon={<ImagePlus size={16} color={colors.ink} />} onPress={pickFromLibrary} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Camera" variant="secondary" icon={<Camera size={16} color={colors.ink} />} onPress={takePhoto} />
            </View>
          </View>
        ) : null}

        {photos.length > 0 ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRow}>
              {photos.map((p, idx) => (
                <View key={`${p.uri}-${idx}`} style={styles.thumbCard}>
                  <Image source={{ uri: p.uri }} style={styles.thumbImg} contentFit="cover" />
                  <Pressable
                    onPress={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                    style={styles.removeBtn}
                    accessibilityLabel="Remove queued photo"
                  >
                    <Trash2 size={14} color={colors.chalk} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
            <Field label="Photo description" optional hint="Used as accessible alt text.">
              <TextInputField value={photoAlt} onChangeText={setPhotoAlt} maxLength={200} placeholder="Front view in hostel room" />
            </Field>
          </>
        ) : null}
      </View>

      <Button label={submitting ? 'Savingâ€¦' : submitLabel} size="lg" loading={submitting} onPress={handleSubmit} />
    </View>
  )
}

const styles = StyleSheet.create({
  form: {
    gap: 24,
  },
  section: {
    gap: 12,
  },
  legend: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 22,
    color: colors.ink,
  },
  muted: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
  },
  row2: {
    flexDirection: 'row',
    gap: 10,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.stone,
  },
  presetText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.forest,
  },
  quoteBox: {
    backgroundColor: 'rgba(238, 235, 227, 0.7)',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.media,
    padding: 12,
    gap: 4,
  },
  quoteLine: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  thumbRow: {
    flexDirection: 'row',
    gap: 10,
  },
  thumbCard: {
    width: 96,
    height: 96,
    borderRadius: radii.media,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.forestTint,
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: 'rgba(27, 36, 32, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
})

import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Star } from 'lucide-react-native'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Feedback'
import { TextInputField } from '@/components/ui/Field'
import { rateTransaction } from '@/lib/data/transactions'
import { colors, fonts } from '@/theme/tokens'

export function RatingForm({
  claimId,
  rentalId,
  onSubmitted,
}: {
  claimId?: string
  rentalId?: string
  onSubmitted?: () => void
}) {
  const [stars, setStars] = useState<number>(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (done) {
    return <Notice tone="success" title="Thanks for rating. It helps other students trust good sellers." />
  }

  const handleSubmit = async () => {
    if (stars < 1 || stars > 5) {
      setError('Choose between 1 and 5 stars.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await rateTransaction({ claimId, rentalId }, stars, comment)
      setDone(true)
      onSubmitted?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldnâ€™t save rating.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View style={styles.wrap}>
      {error ? <Notice tone="error" title={error} /> : null}
      <Text style={styles.label}>Rate the seller</Text>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setStars(n)} style={styles.starBtn} accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`}>
            <Star size={26} color={colors.clay} fill={n <= stars ? colors.clay : 'none'} />
          </Pressable>
        ))}
      </View>
      <Text style={styles.commentLabel}>
        Comment <Text style={{ color: colors.muted, fontFamily: fonts.sansRegular }}>(optional, shown publicly without your name)</Text>
      </Text>
      <TextInputField value={comment} onChangeText={setComment} maxLength={300} placeholder="Smooth handover, item matched description" />
      <Button label={submitting ? 'Savingâ€¦' : 'Submit rating'} size="sm" loading={submitting} onPress={handleSubmit} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 12,
    gap: 10,
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.ink,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  starBtn: {
    padding: 4,
  },
  commentLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.ink,
  },
})

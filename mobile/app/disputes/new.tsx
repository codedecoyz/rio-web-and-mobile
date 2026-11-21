import React, { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ImagePlus, Trash2 } from 'lucide-react-native'
import { Button } from '@/components/ui/Button'
import { Card, Notice } from '@/components/ui/Feedback'
import { Field, TextInputField } from '@/components/ui/Field'
import { useAuth } from '@/lib/auth-context'
import { openDispute } from '@/lib/data/disputes'
import { colors, radii, textStyles } from '@/theme/tokens'

export default function NewDisputeScreen() {
  const router = useRouter()
  const { claim, rental } = useLocalSearchParams<{ claim?: string; rental?: string }>()
  const { viewer } = useAuth()
  const [reason, setReason] = useState('')
  const [evidenceUri, setEvidenceUri] = useState<string | undefined>(undefined)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pickEvidence = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      setError('Photo library permission is needed to attach evidence.')
      return
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    })
    if (!res.canceled && res.assets[0]) {
      setEvidenceUri(res.assets[0].uri)
    }
  }

  const handleSubmit = async () => {
    setError(null)
    if (!viewer) {
      router.push('/auth/login')
      return
    }
    if (!claim && !rental) {
      setError('Choose the transaction this is about.')
      return
    }
    if (reason.trim().length < 10) {
      setError('Describe the problem in at least 10 characters.')
      return
    }
    setSubmitting(true)
    try {
      const disputeId = await openDispute(viewer.id, {
        claimId: claim || undefined,
        rentalId: rental || undefined,
        reason,
        evidenceUri,
      })
      router.replace({ pathname: '/disputes/[id]', params: { id: disputeId } })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open dispute.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={textStyles.h1}>Report a problem</Text>
        <Text style={textStyles.bodyMuted}>The transaction pauses while a warden from this hostel reviews your report.</Text>

        <Card style={{ gap: 16 }}>
          {error ? <Notice tone="error" title={error} /> : null}
          <Field
            label="What went wrong?"
            hint="Be specific: what you expected, what happened, and what youâ€™d like the warden to do."
          >
            <TextInputField
              value={reason}
              onChangeText={setReason}
              multiline
              maxLength={1000}
              placeholder="Explain what happened (at least 10 characters)"
            />
          </Field>

          <Field
            label="Evidence"
            optional
            hint="A photo, compressed automatically. Only the people involved and your hostelâ€™s warden can see it."
          >
            {evidenceUri ? (
              <View style={{ gap: 10 }}>
                <Image source={{ uri: evidenceUri }} style={styles.preview} contentFit="cover" />
                <Button
                  label="Remove photo"
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 size={15} color={colors.forest} />}
                  onPress={() => setEvidenceUri(undefined)}
                />
              </View>
            ) : (
              <Button
                label="Attach photo"
                variant="secondary"
                icon={<ImagePlus size={16} color={colors.ink} />}
                onPress={pickEvidence}
              />
            )}
          </Field>

          <Notice tone="info" title="What happens next">
            The transaction is paused and any sandbox money stays held. A warden from the itemâ€™s hostel who isnâ€™t involved will decide.
          </Notice>

          <Button label={submitting ? 'Submittingâ€¦' : 'Open dispute'} size="lg" loading={submitting} onPress={handleSubmit} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  preview: {
    width: '100%',
    height: 190,
    borderRadius: radii.media,
    backgroundColor: colors.forestTint,
  },
})

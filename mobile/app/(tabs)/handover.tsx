import React, { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Camera, ScanLine } from 'lucide-react-native'
import { QrScannerModal } from '@/components/handover/QrScannerModal'
import { Button } from '@/components/ui/Button'
import { Card, EmptyState, Notice } from '@/components/ui/Feedback'
import { CheckboxRow, Field, TextInputField } from '@/components/ui/Field'
import { useAuth } from '@/lib/auth-context'
import { consumeHandoverToken, type ConsumeResult } from '@/lib/data/transactions'
import { colors, fonts, textStyles } from '@/theme/tokens'

export default function HandoverScreen() {
  const router = useRouter()
  const { viewer, refreshBalance } = useAuth()
  const [code, setCode] = useState('')
  const [reportDamage, setReportDamage] = useState(false)
  const [damageNote, setDamageNote] = useState('')
  const [scanning, setScanning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ConsumeResult | null>(null)

  const submitCode = async (rawCode: string) => {
    setError(null)
    setResult(null)
    setSubmitting(true)
    try {
      const res = await consumeHandoverToken(rawCode, reportDamage, damageNote)
      setResult(res)
      setCode('')
      setReportDamage(false)
      setDamageNote('')
      await refreshBalance()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Handover failed.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!viewer) {
    return (
      <View style={styles.gate}>
        <EmptyState
          icon={<ScanLine size={24} color={colors.forest} />}
          title="Sign in to scan a handover code"
          message="Only the expected buyer, renter, owner, or campus staff can confirm a handover code."
          actionLabel="Sign in"
          onAction={() => router.push('/auth/login')}
        />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={textStyles.h1}>Scan a handover code</Text>
        <Text style={styles.subtitle}>
          The person giving you the item shows a QR code. Scan it, or type the code under it, to confirm youâ€™ve received it. Each code works once and
          expires after 10 minutes.
        </Text>

        <Card style={styles.formCard}>
          {result ? (
            <View style={{ gap: 12 }}>
              <Notice tone="success" title="Handover complete">
                {result.message}
              </Notice>
              <View style={styles.resultLinks}>
                {result.listingId ? (
                  <Button
                    label="View the item"
                    variant="secondary"
                    size="sm"
                    onPress={() => router.push({ pathname: '/items/[id]', params: { id: result.listingId } })}
                  />
                ) : null}
                <Button label="Go to my activity" size="sm" onPress={() => router.push('/(tabs)/activity')} />
              </View>
            </View>
          ) : null}

          {error ? <Notice tone="error" title={error} /> : null}

          <Button
            label="Scan with camera"
            variant="secondary"
            icon={<Camera size={17} color={colors.ink} />}
            onPress={() => setScanning(true)}
          />

          <Field
            label="Handover code"
            hint="16 letters and numbers, shown under the other personâ€™s QR code. Dashes and case donâ€™t matter."
          >
            <TextInputField
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              placeholder="ABCD-EFGH-JKMN-PQRS"
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.codeInput}
            />
          </Field>

          <View style={styles.damageBox}>
            <Text style={styles.damageLegend}>Receiving a rental back?</Text>
            <CheckboxRow label="The item came back damaged" checked={reportDamage} onChange={setReportDamage} />
            {reportDamage ? (
              <Field label="Whatâ€™s damaged?" hint="A warden reviews this. The deposit stays held until they decide.">
                <TextInputField
                  value={damageNote}
                  onChangeText={setDamageNote}
                  multiline
                  maxLength={1000}
                  placeholder="Describe the damage (at least 10 characters)"
                />
              </Field>
            ) : null}
          </View>

          <Button
            label={submitting ? 'Confirmingâ€¦' : 'Confirm handover'}
            size="lg"
            loading={submitting}
            onPress={() => void submitCode(code)}
          />
        </Card>

        <Card style={styles.guideCard}>
          <Text style={styles.guideHeading}>Who scans what</Text>
          <GuideRow term="Buying" desc="The seller shows a code; you scan it once you have the item. That releases payment." />
          <GuideRow term="Collecting a rental" desc="The owner shows a pickup code; you scan it." />
          <GuideRow term="Getting your item back" desc="The renter shows a return code; you scan it and can report damage." />
          <GuideRow term="Campus staff" desc="The departing student shows a custody code; staff or the warden scans it." />
          <Text style={textStyles.caption}>Showing a code instead? Open the transaction from Activity.</Text>
        </Card>
      </ScrollView>

      <QrScannerModal
        visible={scanning}
        onClose={() => setScanning(false)}
        onCode={(formatted) => {
          setScanning(false)
          setCode(formatted)
          if (!reportDamage) {
            void submitCode(formatted)
          }
        }}
      />
    </KeyboardAvoidingView>
  )
}

function GuideRow({ term, desc }: { term: string; desc: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={styles.guideTerm}>{term}</Text>
      <Text style={styles.guideDesc}>{desc}</Text>
    </View>
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
    gap: 16,
  },
  subtitle: {
    fontFamily: fonts.sansRegular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
  },
  formCard: {
    gap: 16,
  },
  codeInput: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 20,
    letterSpacing: 1.4,
    fontVariant: ['tabular-nums'],
  },
  damageBox: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  damageLegend: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.ink,
  },
  resultLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  guideCard: {
    gap: 12,
  },
  guideHeading: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.ink,
  },
  guideTerm: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.ink,
  },
  guideDesc: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
  },
})

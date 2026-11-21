import React, { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Button } from '@/components/ui/Button'
import { Card, EmptyState, Notice, Skeleton } from '@/components/ui/Feedback'
import { ChipSelect, Field, TextInputField } from '@/components/ui/Field'
import { useAuth } from '@/lib/auth-context'
import { getAllHostels, getProfilePrivate, saveSettings, type Hostel } from '@/lib/data/warden'
import { fromISTLocalInput, toISTLocalInput } from '@/lib/format'
import { colors, fonts, textStyles } from '@/theme/tokens'

export default function SettingsScreen() {
  const router = useRouter()
  const { viewer, refreshViewer, signOut } = useAuth()
  const [hostels, setHostels] = useState<Hostel[]>([])
  const [fullName, setFullName] = useState('')
  const [hostelId, setHostelId] = useState('')
  const [block, setBlock] = useState('')
  const [room, setRoom] = useState('')
  const [phone, setPhone] = useState('')
  const [departure, setDeparture] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!viewer) {
      setLoading(false)
      return
    }
    setFullName(viewer.fullName)
    setHostelId(viewer.hostelId ?? '')
    Promise.all([getAllHostels(), getProfilePrivate(viewer.id)])
      .then(([h, p]) => {
        setHostels(h)
        if (p) {
          setBlock(p.block ?? '')
          setRoom(p.room ?? '')
          setPhone(p.phone ?? '')
          setDeparture(p.departure_at ? toISTLocalInput(p.departure_at) : '')
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Couldn’t load settings.'))
      .finally(() => setLoading(false))
  }, [viewer])

  if (!viewer) {
    return (
      <View style={styles.gate}>
        <EmptyState title="Sign in to edit settings" actionLabel="Sign in" onAction={() => router.push('/auth/login')} />
      </View>
    )
  }

  const handleSave = async () => {
    setError(null)
    setSuccess(null)
    if (fullName.trim().length < 2) {
      setError('Enter your name.')
      return
    }
    if (phone.trim() && !/^[0-9+() -]{7,20}$/.test(phone.trim())) {
      setError('Phone: use digits, spaces, + or -, 7–20 characters.')
      return
    }
    let departureAt: string | null = null
    if (departure.trim()) {
      const parsed = fromISTLocalInput(departure)
      if (!parsed) {
        setError('Departure: use YYYY-MM-DDTHH:mm in IST (e.g. 2026-12-01T18:00).')
        return
      }
      departureAt = parsed.toISOString()
    }
    setSaving(true)
    try {
      await saveSettings(viewer.id, {
        fullName,
        hostelId: hostelId || null,
        block: block || null,
        room: room || null,
        phone: phone || null,
        departureAt,
      })
      await refreshViewer()
      setSuccess('Settings saved.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t save settings.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={textStyles.h1}>Account settings</Text>

        {loading ? (
          <Skeleton height={240} />
        ) : (
          <>
            <Card style={styles.summaryCard}>
              <View style={{ flex: 1 }}>
                <Text style={textStyles.caption}>Email</Text>
                <Text style={styles.val}>{viewer.email ?? 'Not available'}</Text>
              </View>
              <View>
                <Text style={textStyles.caption}>Role</Text>
                <Text style={[styles.val, { textTransform: 'capitalize' }]}>{viewer.role}</Text>
              </View>
            </Card>

            <Card style={{ gap: 16, padding: 18 }}>
              {error ? <Notice tone="error" title={error} /> : null}
              {success ? <Notice tone="success" title={success} /> : null}

              <Text style={textStyles.h2}>Profile</Text>
              <Field label="Full name">
                <TextInputField value={fullName} onChangeText={setFullName} maxLength={80} />
              </Field>

              <Field label="Hostel" hint="Your listings show this hostel, and its warden handles your disputes.">
                <ChipSelect
                  value={hostelId}
                  onChange={setHostelId}
                  options={[
                    { value: '', label: 'Not set' },
                    ...hostels.map((h) => ({ value: h.id, label: h.campus ? `${h.name}, ${h.campus}` : h.name })),
                  ]}
                />
              </Field>

              <Text style={textStyles.h2}>Private details</Text>
              <Text style={textStyles.caption}>Only you and your hostel’s warden can see these. They are never shown on listings.</Text>

              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Field label="Block" optional>
                    <TextInputField value={block} onChangeText={setBlock} maxLength={40} placeholder="A" />
                  </Field>
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Room" optional>
                    <TextInputField value={room} onChangeText={setRoom} maxLength={20} placeholder="204" />
                  </Field>
                </View>
              </View>

              <Field label="Phone" optional>
                <TextInputField value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} />
              </Field>

              <Field label="Planned departure (IST)" optional hint="Format: YYYY-MM-DDTHH:mm. Used for your warden’s no-dues check.">
                <TextInputField value={departure} onChangeText={setDeparture} autoCapitalize="none" placeholder="2026-12-10T18:00" />
              </Field>

              <Button label={saving ? 'Saving…' : 'Save settings'} size="lg" loading={saving} onPress={handleSave} />
            </Card>

            <Button
              label="Sign out"
              variant="danger"
              onPress={async () => {
                await signOut()
                router.replace('/(tabs)')
              }}
            />
          </>
        )}
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
    gap: 16,
  },
  summaryCard: {
    flexDirection: 'row',
    gap: 16,
  },
  val: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.ink,
    marginTop: 2,
  },
  row2: {
    flexDirection: 'row',
    gap: 10,
  },
})

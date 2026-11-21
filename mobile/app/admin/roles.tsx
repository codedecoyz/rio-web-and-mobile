import React, { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { ShieldAlert } from 'lucide-react-native'
import { Badge } from '@/components/ui/Badges'
import { Button } from '@/components/ui/Button'
import { Card, EmptyState, Notice, Skeleton } from '@/components/ui/Feedback'
import { CheckboxRow, ChipSelect, Field } from '@/components/ui/Field'
import { useAuth, type Role } from '@/lib/auth-context'
import { adminSetRole, getAdminRolesData, type Hostel } from '@/lib/data/warden'
import { formatDateTime } from '@/lib/format'
import { colors, fonts, textStyles } from '@/theme/tokens'

export default function AdminRolesScreen() {
  const { viewer } = useAuth()
  const [hostels, setHostels] = useState<Hostel[]>([])
  const [people, setPeople] = useState<{ id: string; full_name: string; role: Role }[]>([])
  const [assignments, setAssignments] = useState<{ user_id: string; hostel_id: string }[]>([])
  const [audit, setAudit] = useState<{ id: string; entity_id: string | null; details: { from?: string; to?: string }; created_at: string }[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState<Role>('warden')
  const [selectedHostels, setSelectedHostels] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!viewer || viewer.role !== 'admin') {
      setLoading(false)
      return
    }
    try {
      setError(null)
      const data = await getAdminRolesData(viewer.id)
      setHostels(data.hostels)
      setPeople(data.people)
      setAssignments(data.assignments)
      setAudit(data.audit)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldnâ€™t load roles.')
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

  if (!viewer || viewer.role !== 'admin') {
    return (
      <View style={styles.gate}>
        <EmptyState icon={<ShieldAlert size={24} color={colors.clay} />} title="Restricted to campus administrators" />
      </View>
    )
  }

  const hostelName = new Map(hostels.map((h) => [h.id, h.name]))
  const scopes = new Map<string, string[]>()
  for (const a of assignments) {
    scopes.set(a.user_id, [...(scopes.get(a.user_id) ?? []), hostelName.get(a.hostel_id) ?? '?'])
  }
  const privileged = people.filter((p) => p.role !== 'student')
  const nameOf = new Map(people.map((p) => [p.id, p.full_name]))

  const handleSave = async () => {
    setError(null)
    setNotice(null)
    if (!selectedUserId) {
      setError('Choose a person.')
      return
    }
    if ((selectedRole === 'warden' || selectedRole === 'staff') && selectedHostels.length === 0) {
      setError('Wardens and staff need at least one hostel, so their access is scoped.')
      return
    }
    setSaving(true)
    try {
      await adminSetRole(selectedUserId, selectedRole, selectedHostels)
      setNotice('Role updated.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Role update failed.')
    } finally {
      setSaving(false)
    }
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
      <Text style={textStyles.h1}>Roles and access</Text>
      <Text style={textStyles.bodyMuted}>
        Everyone who signs up is a student. Only administrators can grant warden, staff or administrator access, always scoped to hostels.
      </Text>

      {notice ? <Notice tone="success" title={notice} /> : null}
      {error ? <Notice tone="error" title={error} /> : null}

      {loading ? (
        <Skeleton height={220} />
      ) : (
        <>
          <Card style={{ gap: 16 }}>
            <Text style={textStyles.h2}>Change a role</Text>
            <Field label="Person">
              <ChipSelect
                value={selectedUserId}
                onChange={setSelectedUserId}
                options={people.map((p) => ({ value: p.id, label: `${p.full_name} (${p.role})` }))}
              />
            </Field>
            <Field label="New role">
              <ChipSelect
                value={selectedRole}
                onChange={(r) => setSelectedRole(r as Role)}
                options={[
                  { value: 'student', label: 'Student' },
                  { value: 'warden', label: 'Warden' },
                  { value: 'staff', label: 'Staff' },
                  { value: 'admin', label: 'Administrator' },
                ]}
              />
            </Field>
            <Field label="Hostels this person can act on">
              {hostels.map((h) => {
                const checked = selectedHostels.includes(h.id)
                return (
                  <CheckboxRow
                    key={h.id}
                    label={h.name}
                    checked={checked}
                    onChange={(next) =>
                      setSelectedHostels((prev) => (next ? [...prev, h.id] : prev.filter((x) => x !== h.id)))
                    }
                  />
                )
              })}
            </Field>
            <Button label={saving ? 'Updatingâ€¦' : 'Update role'} loading={saving} onPress={handleSave} />
          </Card>

          <View style={{ gap: 10 }}>
            <Text style={textStyles.h2}>Wardens, staff and administrators</Text>
            {privileged.length === 0 ? (
              <Text style={textStyles.bodyMuted}>Nobody else has elevated access.</Text>
            ) : (
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {privileged.map((p, idx) => (
                  <View key={p.id} style={[styles.row, idx > 0 && styles.border]}>
                    <Text style={styles.name}>{p.full_name}</Text>
                    <View style={styles.roleRight}>
                      <Badge tone="forest">{p.role}</Badge>
                      <Text style={textStyles.caption}>
                        {(scopes.get(p.id) ?? []).join(', ') || (p.role === 'admin' ? 'All hostels' : 'No hostels')}
                      </Text>
                    </View>
                  </View>
                ))}
              </Card>
            )}
          </View>

          <View style={{ gap: 10 }}>
            <Text style={textStyles.h2}>Recent role changes</Text>
            {audit.length === 0 ? (
              <Text style={textStyles.bodyMuted}>No changes recorded yet.</Text>
            ) : (
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {audit.map((e, idx) => (
                  <View key={e.id} style={[styles.row, idx > 0 && styles.border]}>
                    <Text style={[textStyles.body, { flex: 1 }]}>
                      {nameOf.get(e.entity_id ?? '') ?? 'A user'}: {e.details.from} to {e.details.to}
                    </Text>
                    <Text style={[textStyles.caption, { fontVariant: ['tabular-nums'] }]}>{formatDateTime(e.created_at)}</Text>
                  </View>
                ))}
              </Card>
            )}
          </View>
        </>
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
    paddingBottom: 40,
    gap: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  border: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  name: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.ink,
  },
  roleRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
})

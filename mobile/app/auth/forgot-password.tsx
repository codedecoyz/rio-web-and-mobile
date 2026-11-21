import React, { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Button } from '@/components/ui/Button'
import { Card, Notice } from '@/components/ui/Feedback'
import { Field, TextInputField } from '@/components/ui/Field'
import { supabase } from '@/lib/supabase'
import { textStyles } from '@/theme/tokens'

export default function ForgotPasswordScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSend = async () => {
    setError(null)
    if (!email.includes('@')) {
      setError('Enter your email address.')
      return
    }
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase())
      if (err && err.status === 429) {
        setError('Too many requests. Please wait a minute and try again.')
        return
      }
      setSent(true)
    } catch {
      setError('Could not connect. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 6 }}>
          <Text style={textStyles.h1}>Reset password</Text>
          <Text style={textStyles.bodyMuted}>We’ll send a password reset link if that email has an account.</Text>
        </View>
        <Card style={styles.card}>
          {sent ? (
            <>
              <Notice tone="success" title="Reset link sent">
                Check your inbox at {email.trim().toLowerCase()}.
              </Notice>
              <Button label="Back to sign in" variant="secondary" onPress={() => router.replace('/auth/login')} />
            </>
          ) : (
            <>
              {error ? <Notice tone="error" title={error} /> : null}
              <Field label="Email">
                <TextInputField
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="priya@campus.edu"
                />
              </Field>
              <Button label={loading ? 'Sending…' : 'Send reset link'} size="lg" loading={loading} onPress={handleSend} />
            </>
          )}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 16,
  },
  card: {
    padding: 20,
    gap: 16,
  },
})

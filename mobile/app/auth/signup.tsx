import React, { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'
import { Card, Notice } from '@/components/ui/Feedback'
import { Field, TextInputField } from '@/components/ui/Field'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { colors, fonts, textStyles } from '@/theme/tokens'

export default function SignupScreen() {
  const router = useRouter()
  const { refreshViewer } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentEmail, setSentEmail] = useState<string | null>(null)

  const handleSignup = async () => {
    setError(null)
    if (fullName.trim().length < 2) {
      setError('Enter your full name.')
      return
    }
    if (!email.includes('@')) {
      setError('Enter a valid email address.')
      return
    }
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must be at least 8 characters, with a letter and a number.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { full_name: fullName.trim() },
        },
      })
      if (err) {
        setError(err.message || 'We couldn’t create your account. Please try again.')
        return
      }
      if (!data.session) {
        setSentEmail(email.trim().toLowerCase())
        return
      }
      await refreshViewer()
      router.replace('/(tabs)')
    } catch {
      setError('Could not connect. Check your network and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Logo size={30} />
        <View style={styles.head}>
          <Text style={textStyles.h1}>Create account</Text>
          <Text style={textStyles.bodyMuted}>Join your hostel’s circular marketplace.</Text>
        </View>

        {sentEmail ? (
          <Card style={styles.card}>
            <Notice tone="success" title="Check your email">
              We sent a confirmation link to {sentEmail}. Confirm your email, then come back and sign in.
            </Notice>
            <Button label="Go to sign in" onPress={() => router.replace('/auth/login')} />
          </Card>
        ) : (
          <Card style={styles.card}>
            {error ? <Notice tone="error" title={error} /> : null}
            <Field label="Full name">
              <TextInputField value={fullName} onChangeText={setFullName} maxLength={80} placeholder="Priya Sharma" />
            </Field>
            <Field label="Email" hint="Use the address you check: we’ll send a confirmation link.">
              <TextInputField
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholder="priya@campus.edu"
              />
            </Field>
            <Field label="Password" hint="At least 8 characters, with a letter and a number.">
              <TextInputField value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />
            </Field>
            <Field label="Confirm password">
              <TextInputField value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="••••••••" />
            </Field>
            <Text style={textStyles.caption}>
              New accounts are student accounts. Wardens and staff are set up by a campus administrator.
            </Text>
            <Button label={loading ? 'Creating account…' : 'Create account'} size="lg" loading={loading} onPress={handleSignup} />
          </Card>
        )}

        <View style={styles.footer}>
          <Text style={textStyles.bodyMuted}>Already have an account? </Text>
          <Pressable onPress={() => router.replace('/auth/login')}>
            <Text style={styles.link}>Sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    gap: 18,
  },
  head: {
    gap: 6,
  },
  card: {
    padding: 20,
    gap: 16,
  },
  link: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.forest,
    textDecorationLine: 'underline',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
})

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

export default function LoginScreen() {
  const router = useRouter()
  const { refreshViewer } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async () => {
    setError(null)
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (err) {
        if (err.code === 'email_not_confirmed') {
          setError('Please confirm your email first — check your inbox for the link.')
        } else {
          setError('That email and password combination didn’t work.')
        }
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
          <Text style={textStyles.h1}>Sign in</Text>
          <Text style={textStyles.bodyMuted}>Sign in with your campus email and password.</Text>
        </View>

        <Card style={styles.card}>
          {error ? <Notice tone="error" title={error} /> : null}
          <Field label="Email">
            <TextInputField
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              placeholder="priya.demo@rio.test"
            />
          </Field>
          <Field label="Password">
            <TextInputField
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              placeholder="••••••••"
            />
          </Field>
          <Pressable onPress={() => router.push('/auth/forgot-password')} style={{ alignSelf: 'flex-end' }}>
            <Text style={styles.link}>Forgot password?</Text>
          </Pressable>
          <Button label={loading ? 'Signing in…' : 'Sign in'} size="lg" loading={loading} onPress={handleLogin} />
        </Card>

        <View style={styles.footer}>
          <Text style={textStyles.bodyMuted}>New to RIO? </Text>
          <Pressable onPress={() => router.replace('/auth/signup')}>
            <Text style={styles.link}>Create account</Text>
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

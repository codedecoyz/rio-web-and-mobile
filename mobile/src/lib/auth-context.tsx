import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type Role = 'student' | 'warden' | 'staff' | 'admin'

export interface Viewer {
  id: string
  email: string | null
  fullName: string
  role: Role
  hostelId: string | null
  hostelName: string | null
  avatarUrl: string | null
}

interface AuthContextValue {
  session: Session | null
  viewer: Viewer | null
  balance: number | null
  loading: boolean
  refreshViewer: () => Promise<void>
  refreshBalance: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [viewer, setViewer] = useState<Viewer | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const loadUserData = useCallback(async (nextSession: Session | null) => {
    if (!nextSession?.user) {
      setViewer(null)
      setBalance(null)
      return
    }
    const uid = nextSession.user.id
    const [profileRes, walletRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, role, hostel_id, avatar_url, hostels:hostels!hostel_id(name)')
        .eq('id', uid)
        .maybeSingle(),
      supabase.from('wallet_accounts').select('balance_paise').eq('user_id', uid).maybeSingle(),
    ])
    if (profileRes.data) {
      const p = profileRes.data
      const hostel = p.hostels as unknown as { name: string } | null
      setViewer({
        id: p.id,
        email: nextSession.user.email ?? null,
        fullName: p.full_name,
        role: p.role as Role,
        hostelId: p.hostel_id,
        hostelName: hostel?.name ?? null,
        avatarUrl: p.avatar_url,
      })
    } else {
      setViewer(null)
    }
    setBalance(walletRes.data ? Number(walletRes.data.balance_paise) : null)
  }, [])

  useEffect(() => {
    let active = true
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!active) return
        setSession(data.session)
        await loadUserData(data.session)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      void loadUserData(nextSession)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadUserData])

  const refreshViewer = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    setSession(data.session)
    await loadUserData(data.session)
  }, [loadUserData])

  const refreshBalance = useCallback(async () => {
    if (!session?.user) return
    const { data } = await supabase.from('wallet_accounts').select('balance_paise').eq('user_id', session.user.id).maybeSingle()
    setBalance(data ? Number(data.balance_paise) : null)
  }, [session])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setViewer(null)
    setBalance(null)
  }, [])

  return (
    <AuthContext.Provider value={{ session, viewer, balance, loading, refreshViewer, refreshBalance, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function hasRole(viewer: Viewer, roles: readonly Role[]): boolean {
  return viewer.role === 'admin' || roles.includes(viewer.role)
}

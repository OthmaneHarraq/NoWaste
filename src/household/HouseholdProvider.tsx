import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth'
import type { Household } from '@/types/db'

type HouseholdContextValue = {
  /** The fridge the user is currently looking at (their first one for now). */
  household: Household | null
  households: Household[]
  loading: boolean
  createHousehold: (name: string) => Promise<{ error: string | null }>
  joinHousehold: (code: string) => Promise<{ error: string | null }>
  leaveHousehold: () => Promise<{ error: string | null }>
  refresh: () => Promise<void>
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null)

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [households, setHouseholds] = useState<Household[]>([])
  const [loading, setLoading] = useState(true)

  // RLS only returns households this user belongs to
  const refresh = useCallback(async () => {
    if (!user) {
      setHouseholds([])
      setLoading(false)
      return
    }
    const { data } = await supabase.from('households').select('*').order('created_at')
    setHouseholds(data ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    setLoading(true)
    refresh()
  }, [refresh])

  async function createHousehold(name: string) {
    const { error } = await supabase.from('households').insert({ name: name.trim() || 'My fridge' })
    if (!error) await refresh()
    return { error: error?.message ?? null }
  }

  async function joinHousehold(code: string) {
    const { error } = await supabase.rpc('join_household', { p_code: code })
    if (!error) await refresh()
    return { error: error ? (error.message.includes('invalid code') ? 'That code does not match any fridge.' : error.message) : null }
  }

  async function leaveHousehold() {
    const current = households[0]
    if (!current || !user) return { error: null }
    const { error } = await supabase
      .from('household_members')
      .delete()
      .eq('household_id', current.id)
      .eq('user_id', user.id)
    if (!error) await refresh()
    return { error: error?.message ?? null }
  }

  return (
    <HouseholdContext.Provider
      value={{
        household: households[0] ?? null,
        households,
        loading,
        createHousehold,
        joinHousehold,
        leaveHousehold,
        refresh,
      }}
    >
      {children}
    </HouseholdContext.Provider>
  )
}

export function useHousehold(): HouseholdContextValue {
  const ctx = useContext(HouseholdContext)
  if (!ctx) throw new Error('useHousehold must be used inside <HouseholdProvider>')
  return ctx
}

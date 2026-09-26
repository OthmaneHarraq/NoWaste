import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import * as authService from './authService'

type AuthContextValue = {
    session: Session | null
    user: User | null
    /** True until the stored session has been restored on app start. */
    loading: boolean
    signIn: typeof authService.signIn
    signUp: typeof authService.signUp
    signOut: typeof authService.signOut
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        authService.getSession().then(s => {
            setSession(s)
            setLoading(false)
        })
        return authService.onAuthChange(setSession)
    }, [])

    return (
        <AuthContext.Provider
            value={{
                session,
                user: session?.user ?? null,
                loading,
                signIn: authService.signIn,
                signUp: authService.signUp,
                signOut: authService.signOut,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
    return ctx
}

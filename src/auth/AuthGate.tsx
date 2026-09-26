import type { ReactNode } from 'react'
import { useAuth } from './AuthProvider'
import AuthScreen from './AuthScreen'

/**
 * Renders `children` only when a user is signed in; otherwise shows the login screen.
 * Must be placed inside <AuthProvider>.
 */
export function AuthGate({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
    const { session, loading } = useAuth()
    if (loading) return <>{fallback}</>
    if (!session) return <AuthScreen />
    return <>{children}</>
}

import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

/**
 * The ONLY file in the app that talks to `supabase.auth` directly.
 * Everything else goes through these functions or the `useAuth()` hook.
 */

export type AuthResult = { error: string | null }

export async function signIn(email: string, password: string): Promise<AuthResult> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    // Deliberately vague so we don't reveal whether an email is registered
    return { error: error ? 'Incorrect email or password. Please try again.' : null }
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
    const { error } = await supabase.auth.signUp({ email, password })
    return { error: error ? error.message : null }
}

export async function signOut(): Promise<AuthResult> {
    const { error } = await supabase.auth.signOut()
    return { error: error ? error.message : null }
}

export async function getSession(): Promise<Session | null> {
    const { data: { session } } = await supabase.auth.getSession()
    return session
}

/** Id of the signed-in user, or null. Use this in data hooks instead of reading the session. */
export async function getCurrentUserId(): Promise<string | null> {
    const session = await getSession()
    return session?.user.id ?? null
}

export async function getCurrentUser(): Promise<User | null> {
    const session = await getSession()
    return session?.user ?? null
}

/** Subscribe to sign-in / sign-out events. Returns an unsubscribe function. */
export function onAuthChange(callback: (session: Session | null) => void): () => void {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        callback(session)
    })
    return () => subscription.unsubscribe()
}

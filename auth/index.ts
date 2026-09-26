/**
 * Auth module — the public API. Import from '../auth' (or './auth'), never from the files inside.
 *
 *   <AuthProvider>            restores the session and tracks sign-in/out
 *     <AuthGate>              shows <AuthScreen/> until the user is signed in
 *       ...app...
 *
 *   useAuth()                 { session, user, loading, signIn, signUp, signOut } in components
 *   getCurrentUserId()        the signed-in user's id in non-React code (data hooks, stores)
 */
export { AuthProvider, useAuth } from './AuthProvider'
export { AuthGate } from './AuthGate'
export { default as AuthScreen } from './AuthScreen'
export { ProfileMenu } from './ProfileMenu'
export {
    signIn,
    signUp,
    signOut,
    getSession,
    getCurrentUser,
    getCurrentUserId,
    onAuthChange,
    type AuthResult,
} from './authService'
export * from './validation'

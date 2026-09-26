# auth/

Everything to do with logging in lives here. The rest of the app imports from `./auth` only.

| File | What it does |
|---|---|
| `authService.ts` | The only code that calls `supabase.auth`: `signIn`, `signUp`, `signOut`, `getSession`, `getCurrentUserId`, `onAuthChange` |
| `AuthProvider.tsx` | React context: restores the saved session on launch and tracks sign-in/out. `useAuth()` exposes `{ session, user, loading, signIn, signUp, signOut }` |
| `AuthGate.tsx` | Shows `AuthScreen` until a user is signed in, then renders its children |
| `AuthScreen.tsx` | Sign in / sign up form with validation and a password-strength bar. Takes an optional `title` prop |
| `ProfileMenu.tsx` | Avatar button + profile card with Sign Out. `onSignedOut` / `onError` callbacks |
| `validation.ts` | Pure email/password rules and strength scoring (no React, no Supabase) |
| `index.ts` | Public exports |

## Usage

```tsx
import { AuthProvider, AuthGate } from './auth'

export default function App() {
  return (
    <AuthProvider>
      <AuthGate>
        <MainApp />
      </AuthGate>
    </AuthProvider>
  )
}
```

In components: `const { user, signOut } = useAuth()`.
In data hooks / stores (non-React): `const userId = await getCurrentUserId(); if (!userId) return`.

## Reusing in another project

Copy this folder plus `lib/supabase.ts`. It needs `@supabase/supabase-js`,
`@react-native-async-storage/async-storage`, `react-native` and the
`EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` env vars.

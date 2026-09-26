// Dashboard settings, read from .env (EXPO_PUBLIC_* vars are inlined at build time,
// so restart with `npx expo start --clear` after changing them).

/** true = seeded demo data + simulated camera, no Supabase or sign-in. */
export const USE_MOCK_DATA = process.env.EXPO_PUBLIC_USE_MOCK_DATA === 'true'

/** How long a taken-out item waits (put back? or done with it?) before it counts as used. */
export const PENDING_GRACE_MINUTES = Number(process.env.EXPO_PUBLIC_PENDING_GRACE_MINUTES) || 10

/** Items this many days (or fewer) from their date are "expiring soon". */
export const EXPIRING_SOON_DAYS = 2

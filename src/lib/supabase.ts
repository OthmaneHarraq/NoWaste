import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { USE_MOCK_DATA } from '@/fridge/config'

// Mock mode never talks to Supabase, so it runs without any keys.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || (USE_MOCK_DATA ? 'http://localhost' : undefined)
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || (USE_MOCK_DATA ? 'mock' : undefined)

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase settings. Copy .env.example to .env, fill in EXPO_PUBLIC_SUPABASE_URL and ' +
      'EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart with `npx expo start --clear`.'
  )
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
})

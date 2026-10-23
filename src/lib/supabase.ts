import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// This project URL is public configuration. Supply the publishable key through
// EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY; never place a secret/service-role key here.
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://dvgluivslmdrqsvlscmj.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
  SUPABASE_PUBLISHABLE_KEY &&
  !SUPABASE_PUBLISHABLE_KEY.includes('your-')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY as string, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

// Edge Function base URL used by the Android AI tutor and account deletion.
export const SUPABASE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

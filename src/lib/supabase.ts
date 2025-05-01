import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing. Please check your .env file.');
}

// Create a Supabase client with persistSession set to true and improved configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: 'deals-app-auth',
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit'
  }
});

// Add function to debug auth state
export const checkAuthState = async () => {
  const { data, error } = await supabase.auth.getSession();
  console.log('Current auth state:', { data, error });
  return { data, error };
};

// Helper to check if credentials are valid before attempting login
export const validateCredentials = (email: string, password: string) => {
  if (!email || !email.includes('@') || !password || password.length < 6) {
    return false;
  }
  return true;
};
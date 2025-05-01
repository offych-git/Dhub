
import { supabase } from '../lib/supabase';

// Функция для проверки и вывода текущего состояния сессии
export const checkAuthStatus = async () => {
  try {
    // Проверяем текущую сессию
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    console.log('Current session:', sessionData, sessionError);
    
    // Проверяем хранилище локальных токенов
    const storedTokenInfo = localStorage.getItem('deals-app-auth');
    console.log('Stored tokens:', storedTokenInfo ? '✓ Present' : '✗ None');
    
    return { 
      hasSession: !!sessionData?.session,
      sessionError
    };
  } catch (err) {
    console.error('Auth debug error:', err);
    return { hasSession: false, error: err };
  }
};

// Функция для полного выхода из системы и очистки хранилища
export const forceSignOut = async () => {
  try {
    // Очищаем локальное хранилище
    localStorage.removeItem('deals-app-auth');
    
    // Выполняем выход на стороне Supabase
    await supabase.auth.signOut({ scope: 'global' });
    
    console.log('Force sign out completed');
    return { success: true };
  } catch (err) {
    console.error('Force sign out error:', err);
    return { success: false, error: err };
  }
};

// Функция для проверки корректности настроек Supabase
export const validateSupabaseConfig = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  console.log('Supabase URL configured:', !!supabaseUrl);
  console.log('Supabase Key configured:', !!supabaseKey);
  
  // Проверяем, что URL подходит по формату
  if (supabaseUrl && !supabaseUrl.includes('.supabase.co')) {
    console.warn('Supabase URL might be invalid:', supabaseUrl);
  }
  
  return {
    isValid: !!supabaseUrl && !!supabaseKey,
    url: supabaseUrl ? `${supabaseUrl.substring(0, 8)}...` : null
  };
};

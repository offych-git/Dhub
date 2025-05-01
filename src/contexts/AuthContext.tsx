import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, AuthError } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signInWithFacebook: async () => {},
  signOut: async () => {},
  resetPassword: async () => {},
  updatePassword: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for changes on auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      // First clear any existing sessions to avoid conflicts
      await supabase.auth.signOut({ scope: 'local' });

      // Validate email and password format before sending request
      if (!email || !email.includes('@')) {
        throw new Error('Please enter a valid email address');
      }

      if (!password || password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      console.log('Attempting to sign in with:', { email });

      // Try to sign in with clean credentials
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim()
      });

      if (error) {
        console.error('Sign in error details:', error);

        // Provide more specific error messages
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('The email or password you entered is incorrect. Please try again.');
        }

        throw error;
      }

      // Verify we have a valid session
      if (!data.session) {
        throw new Error('Authentication succeeded but no session was created');
      }

      console.log('Sign in successful, session established');
      navigate('/');
      return data;
    } catch (err) {
      console.error('Authentication error:', err);
      throw err;
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      // First clear any existing auth state
      await supabase.auth.signOut({ scope: 'local' });

      // Basic validation
      if (!email || !email.includes('@')) {
        throw new Error('Please enter a valid email address');
      }

      if (!password || password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      // Check if a user with this email already exists in auth
      const { data: { users } } = await supabase.auth.admin.listUsers({
        filters: {
          email: email.trim()
        }
      }).catch(() => ({ data: { users: [] } }));

      if (users && users.length > 0) {
        throw new Error('User already registered with this email. Please sign in instead.');
      }

      console.log('Registering new user with email:', email);

      // Register the new user with clean credentials
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            email: email.trim(),
          }
        },
      });

      if (error) {
        console.error('SignUp error details:', error);

        if (error.message.includes('already registered')) {
          throw new Error('This email is already registered. Please sign in instead.');
        }

        throw error;
      }

      // Check registration result
      if (!data.user) {
        throw new Error('Registration failed - no user account was created');
      }

      console.log('Registration successful, user created:', data.user.id);

      return data;
    } catch (err) {
      console.error('Registration error:', err);
      throw err;
    }
  };

  const signInWithFacebook = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    try {
      // First check if we have a session
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // If no session exists, just clear the user state and redirect
        setUser(null);
        navigate('/auth');
        return;
      }

      // If we have a session, attempt to sign out
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setUser(null);
      navigate('/auth');
    } catch (error) {
      console.error('Sign out error:', error);
      // Even if there's an error, we should clear the local state and redirect
      setUser(null);
      navigate('/auth');
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('Password reset error:', error);
      throw error;
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      // После успешного обновления пароля получаем новую сессию
      await refreshSession();
    } catch (error: any) {
      console.error('Password update error:', error);
      throw error;
    }
  };

  const refreshSession = async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (data?.session) {
        setUser(data.session.user);
      }
    } catch (error) {
      console.error('Session refresh error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signIn,
      signUp,
      signInWithFacebook,
      signOut,
      resetPassword,
      updatePassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
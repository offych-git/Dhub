import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Facebook, ArrowRight, KeyRound, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { checkAuthStatus, validateSupabaseConfig } from '../utils/authDebug';

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { signIn, signUp, signInWithFacebook, resetPassword } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [configValid, setConfigValid] = useState(true);
  
  // Проверяем настройки Supabase при загрузке страницы
  useEffect(() => {
    const validateConfig = async () => {
      const configResult = validateSupabaseConfig();
      setConfigValid(configResult.isValid);
      
      if (!configResult.isValid) {
        setError('Supabase configuration is missing or invalid. Please check your environment variables.');
        return;
      }
      
      // Проверяем текущее состояние авторизации
      const authStatus = await checkAuthStatus();
      console.log('Auth status check:', authStatus);
    };
    
    validateConfig();
  }, []);

  const validateForm = () => {
    // Trim the email and password to avoid whitespace issues
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address');
      return false;
    }

    if (!isResetPassword && (!trimmedPassword || trimmedPassword.length < 6)) {
      setError('Password must be at least 6 characters long');
      return false;
    }

    // Update state with trimmed values
    setEmail(trimmedEmail);
    if (!isResetPassword) {
      setPassword(trimmedPassword);
    }

    return true;
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Add debug information
      console.log(`Attempting to ${isResetPassword ? 'reset password' : isSignUp ? 'sign up' : 'sign in'} with email: ${email}`);
      
      if (isResetPassword) {
        await resetPassword(email);
        setSuccessMessage('Password reset instructions have been sent to your email');
        setIsResetPassword(false);
      } else if (isSignUp) {
        try {
          const result = await signUp(email, password);
          console.log('Sign up result:', result);
          
          // Check for specific signup outcomes
          if (result?.user?.identities?.length === 0) {
            // User already exists
            setError('An account with this email already exists. Please sign in instead.');
            setIsSignUp(false);
          } else if (result?.user?.confirmed_at) {
            // Email already confirmed (rare case)
            setSuccessMessage('Account created and verified successfully!');
            setTimeout(() => navigate('/'), 2000);
          } else if (result?.user) {
            // Standard case - email confirmation needed
            setSuccessMessage('Account created! Please check your email to verify your account before signing in.');
          } else {
            throw new Error('Registration failed with an unknown error');
          }
        } catch (signupErr: any) {
          if (signupErr.message?.includes('already registered') || 
              signupErr.message?.includes('already exists')) {
            setError('This email is already registered. Please use the Sign In option instead.');
            setIsSignUp(false);
          } else {
            throw signupErr; // Re-throw for the outer catch block
          }
        }
      } else {
        // Sign In flow
        try {
          const signInResult = await signIn(email, password);
          console.log('Sign in successful:', signInResult);
        } catch (signInErr: any) {
          console.error('Specific sign in error:', signInErr);
          
          if (signInErr.message?.includes('incorrect') || 
              signInErr.code === 'invalid_credentials' ||
              signInErr.message?.includes('Invalid login credentials')) {
            setError('Invalid email or password. Please check your credentials and try again.');
          } else {
            throw signInErr; // Re-throw for the outer catch block
          }
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      
      // Handle errors not caught in inner try/catch blocks
      if (err.code === 'invalid_credentials' || 
          err.message?.includes('invalid_credentials') ||
          err.message?.includes('Invalid login credentials')) {
        setError('The email or password you entered is incorrect. Please try again.');
      } else if (err.message?.includes('already exists') || 
                err.message?.includes('already registered')) {
        setError('An account with this email already exists. Please sign in instead.');
        setIsSignUp(false);
      } else if (err.message?.includes('password')) {
        setError('Password must be at least 6 characters. Please try a stronger password.');
      } else {
        setError(err.message || 'An error occurred. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookAuth = async () => {
    try {
      await signInWithFacebook();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const clearMessages = () => {
    setError(null);
    setSuccessMessage(null);
  };

  return (
    <div className="min-h-screen bg-gray-900 px-4 py-8">
      <div className="max-w-md mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-400 hover:text-white mb-6"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back
        </button>

        <h1 className="text-3xl font-bold text-white text-center mb-8">
          {isResetPassword ? 'Reset Password' : isSignUp ? 'Create Account' : 'Welcome Back'}
        </h1>

        {error && (
          <div className="bg-red-500 text-white px-4 py-3 rounded-md mb-4">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="bg-green-500 text-white px-4 py-3 rounded-md mb-4">
            {successMessage}
          </div>
        )}

        {!isResetPassword && (
          <button
            onClick={handleFacebookAuth}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md font-medium flex items-center justify-center mb-4"
          >
            <Facebook className="h-5 w-5 mr-2" />
            Continue with Facebook
          </button>
        )}

        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-700"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-gray-900 text-gray-400">
              {isResetPassword ? 'Enter your email' : 'Or continue with'}
            </span>
          </div>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearMessages();
              }}
              className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3"
              required
            />
          </div>

          {!isResetPassword && (
            <div>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearMessages();
                }}
                className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3"
                required
                minLength={6}
              />
            </div>
          )}

          {!isResetPassword && (
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="remember-me"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-orange-500 rounded border-gray-700 bg-gray-800"
                />
                <label htmlFor="remember-me" className="ml-2 text-gray-400">
                  Remember me
                </label>
              </div>
              {!isSignUp && (
                <button
                  type="button"
                  onClick={() => {
                    setIsResetPassword(true);
                    clearMessages();
                  }}
                  className="text-orange-500 hover:text-orange-400"
                >
                  Forgot password?
                </button>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 text-white py-3 rounded-md font-medium flex items-center justify-center"
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                {isResetPassword ? 'Send Reset Instructions' : isSignUp ? 'Sign Up' : 'Sign In'}
                <ArrowRight className="h-5 w-5 ml-2" />
              </>
            )}
          </button>
        </form>

        {!isResetPassword && (
          <p className="text-center text-gray-400 mt-4">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                clearMessages();
              }}
              className="text-orange-500 font-medium"
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        )}

        {isResetPassword && (
          <button
            onClick={() => {
              setIsResetPassword(false);
              clearMessages();
            }}
            className="text-orange-500 font-medium mt-4 w-full text-center"
          >
            Back to Sign In
          </button>
        )}

        <p className="text-center text-gray-400 mt-4 text-sm">
          By continuing, you agree to our{' '}
          <Link to="/privacy-policy" className="text-orange-500 hover:text-orange-400">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
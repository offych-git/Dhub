
import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Mail, Facebook, ArrowRight, KeyRound, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { checkAuthStatus, validateSupabaseConfig } from '../utils/authDebug';
import { supabase } from '../lib/supabase';

interface AuthPageProps {
  isResetPasswordPage?: boolean;
}

const AuthPage: React.FC<AuthPageProps> = ({ isResetPasswordPage = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp, signInWithFacebook, resetPassword, updatePassword } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(isResetPasswordPage);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [configValid, setConfigValid] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  
  // Check for recovery token or signup confirmation on page load
  useEffect(() => {
    const checkForSpecialFlows = async () => {
      // Parse URL for tokens and types
      const searchParams = new URLSearchParams(window.location.search);
      const token = searchParams.get('token');
      const type = searchParams.get('type');
      
      console.log('Auth flow check:', { 
        fullUrl: window.location.href,
        search: window.location.search,
        token: token ? `${token.substring(0, 10)}...` : 'none',
        type: type || 'none',
        isResetPage: isResetPasswordPage
      });
      
      // If this is a signup confirmation
      if (type === 'signup') {
        try {
          console.log('Detected signup confirmation flow');
          
          // Wait a short delay to make sure the auth state is updated
          setTimeout(() => {
            // Show success message
            setSuccessMessage('Регистрация успешно завершена! Переход на страницу профиля...');
            
            // Redirect to profile page after a short delay to show the success message
            setTimeout(() => {
              navigate('/profile', { replace: true });
            }, 1500);
          }, 500);
          
          return; // Exit early - no need to check other flows
        } catch (err) {
          console.error('Error handling signup flow:', err);
          setError('Произошла ошибка при подтверждении регистрации.');
        }
      }
      // If we have a recovery token
      else if (token && type === 'recovery') {
        try {
          // Set immediately to show appropriate UI
          setIsResetPassword(true);
          setAccessToken(token);
          
          // If not already on the reset password page, navigate there
          if (!isResetPasswordPage) {
            console.log('Redirecting to reset password page with token');
            navigate('/auth/reset-password', { 
              replace: true,
              state: { token, type }
            });
          }
        } catch (err) {
          console.error('Error handling recovery flow:', err);
          setError('Произошла ошибка при обработке ссылки сброса пароля.');
        }
      }
      // Check for hash params (OAuth flow)
      else if (window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        
        if (accessToken) {
          console.log('Found OAuth token in hash');
          // Handle OAuth token if needed
        }
      }
    };
    
    checkForSpecialFlows();
  }, [location, navigate, isResetPasswordPage]);
  
  // Also check state for tokens passed during navigation
  useEffect(() => {
    if (location.state?.token) {
      console.log('Found token in navigation state');
      setAccessToken(location.state.token);
      setIsResetPassword(true);
    }
  }, [location.state]);
  
  // Validate Supabase config
  useEffect(() => {
    const validateConfig = async () => {
      const configResult = validateSupabaseConfig();
      setConfigValid(configResult.isValid);
      
      if (!configResult.isValid) {
        setError('Supabase configuration is missing or invalid. Please check your environment variables.');
        return;
      }
      
      // Check auth status
      const authStatus = await checkAuthStatus();
      console.log('Auth status check:', authStatus);
    };
    
    validateConfig();
  }, []);

  const validateForm = () => {
    // Trim the email and password to avoid whitespace issues
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    
    // For password reset with token
    if (isResetPassword && accessToken) {
      if (!trimmedPassword || trimmedPassword.length < 6) {
        setError('Пароль должен содержать не менее 6 символов');
        return false;
      }
      
      if (trimmedPassword !== confirmPassword.trim()) {
        setError('Пароли не совпадают');
        return false;
      }
      
      return true;
    }
    
    // For other flows
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Пожалуйста, введите корректный email адрес');
      return false;
    }

    if (!isResetPassword && (!trimmedPassword || trimmedPassword.length < 6)) {
      setError('Пароль должен содержать не менее 6 символов');
      return false;
    }

    // Update state with trimmed values
    setEmail(trimmedEmail);
    if (!isResetPassword) {
      setPassword(trimmedPassword);
    }

    return true;
  };

  const handleUpdatePassword = async () => {
    setError(null);
    setSuccessMessage(null);
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      console.log('Attempting to update password with token');
      await updatePassword(password);
      setSuccessMessage('Ваш пароль был успешно обновлен');
      
      // Redirect to login page after password update
      setTimeout(() => {
        setIsResetPassword(false);
        setAccessToken(null);
        navigate('/auth', { replace: true });
      }, 2000);
    } catch (err: any) {
      console.error('Password update error:', err);
      setError('Не удалось обновить пароль. Пожалуйста, попробуйте снова или запросите новую ссылку для сброса пароля.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    
    // If we have a token and are on reset password page
    if (isResetPassword && accessToken) {
      handleUpdatePassword();
      return;
    }
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Debug information
      console.log(`Attempting to ${isResetPassword ? 'reset password' : isSignUp ? 'sign up' : 'sign in'} with email: ${email}`);
      
      if (isResetPassword && !accessToken) {
        await resetPassword(email);
        setSuccessMessage('Инструкции по сбросу пароля отправлены на ваш email');
        setIsResetPassword(false);
      } else if (isSignUp) {
        try {
          const result = await signUp(email, password);
          console.log('Sign up result:', result);
          
          // Check for specific signup outcomes
          if (result?.user?.identities?.length === 0) {
            // User already exists
            setError('Аккаунт с этим email уже существует. Пожалуйста, выполните вход.');
            setIsSignUp(false);
          } else if (result?.user?.confirmed_at) {
            // Email already confirmed (rare case)
            setSuccessMessage('Аккаунт создан и подтвержден успешно!');
            setTimeout(() => navigate('/'), 2000);
          } else if (result?.user) {
            // Standard case - email confirmation needed
            setSuccessMessage('Аккаунт создан! Пожалуйста, проверьте ваш email для подтверждения аккаунта перед входом.');
          } else {
            throw new Error('Регистрация не удалась с неизвестной ошибкой');
          }
        } catch (signupErr: any) {
          if (signupErr.message?.includes('already registered') || 
              signupErr.message?.includes('already exists')) {
            setError('Этот email уже зарегистрирован. Пожалуйста, используйте опцию Вход.');
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
            setError('Неверный email или пароль. Пожалуйста, проверьте данные и попробуйте снова.');
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
        setError('Email или пароль, которые вы ввели, неверны. Пожалуйста, попробуйте снова.');
      } else if (err.message?.includes('already exists') || 
                err.message?.includes('already registered')) {
        setError('Аккаунт с этим email уже существует. Пожалуйста, выполните вход.');
        setIsSignUp(false);
      } else if (err.message?.includes('password')) {
        setError('Пароль должен содержать не менее 6 символов. Пожалуйста, используйте более надежный пароль.');
      } else {
        setError(err.message || 'Произошла ошибка. Пожалуйста, попробуйте позже.');
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
          {accessToken ? 'Создание нового пароля' : isResetPassword ? 'Сброс пароля' : isSignUp ? 'Создание аккаунта' : 'Добро пожаловать'}
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
            Продолжить с Facebook
          </button>
        )}

        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-700"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-gray-900 text-gray-400">
              {isResetPassword ? 'Введите ваш email' : 'Или продолжить с'}
            </span>
          </div>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          {/* Show email field only if we don't have a token */}
          {(!accessToken || !isResetPassword) && (
            <div>
              <input
                type="email"
                placeholder="Email адрес"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearMessages();
                }}
                className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3"
                required
              />
            </div>
          )}

          {/* Show password field if not resetting password without token */}
          {(!isResetPassword || accessToken) && (
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder={isSignUp ? "Пароль" : "Пароль"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearMessages();
                }}
                className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3 pr-10"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path>
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path>
                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path>
                    <line x1="2" x2="22" y1="2" y2="22"></line>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
          )}
          
          {/* Additional field to confirm password when resetting with token */}
          {accessToken && (
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Подтвердите новый пароль"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  clearMessages();
                }}
                className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3 pr-10"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path>
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path>
                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path>
                    <line x1="2" x2="22" y1="2" y2="22"></line>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
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
                  Запомнить меня
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
                  Забыли пароль?
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
                {accessToken ? 'Обновить пароль' : isResetPassword ? 'Отправить инструкции' : isSignUp ? 'Регистрация' : 'Вход'}
                <ArrowRight className="h-5 w-5 ml-2" />
              </>
            )}
          </button>
        </form>

        {!isResetPassword && (
          <p className="text-center text-gray-400 mt-4">
            {isSignUp ? 'Уже есть аккаунт?' : "Нет аккаунта?"}{' '}
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                clearMessages();
              }}
              className="text-orange-500 font-medium"
            >
              {isSignUp ? 'Вход' : 'Регистрация'}
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
            Вернуться к входу
          </button>
        )}

        <p className="text-center text-gray-400 mt-4 text-sm">
          Продолжая, вы соглашаетесь с нашей{' '}
          <Link to="/privacy-policy" className="text-orange-500 hover:text-orange-400">
            Политикой конфиденциальности
          </Link>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;

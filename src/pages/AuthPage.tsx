import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link, useLocation, useSearchParams } from 'react-router-dom';
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
  const [searchParams] = useSearchParams();
  const { signIn, signUp, signInWithFacebook, resetPassword, updatePassword, user } = useAuth();

  // --- ЭТИ ПЕРЕМЕННЫЕ ДОЛЖНЫ БЫТЬ ОБЪЯВЛЕНЫ СРАЗУ ПОСЛЕ ВЫЗОВА ВСЕХ ХУКОВ (useLocation, useSearchParams, useAuth) ---
  const redirectTo = searchParams.get('redirect');
  const redirectTitle = searchParams.get('redirectTitle');
  const decodedRedirectTo = redirectTo ? decodeURIComponent(redirectTo) : '/';
  const finalRedirectTitle = redirectTitle ? decodeURIComponent(redirectTitle) : '';
  // --- КОНЕЦ ОБЯЗАТЕЛЬНЫХ ОБЪЯВЛЕНИЙ ПЕРЕМЕННЫХ ---


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


  // useEffect для управления заголовком страницы авторизации с очисткой
  useEffect(() => {
    const originalTitle = document.title;
    console.log(`[AUTH_PAGE_TITLE] Начальное состояние - document.title: "${originalTitle}"`);

    let newAuthPageTitle = 'Авторизация';
    if (isSignUp) {
      newAuthPageTitle = 'Регистрация';
    } else if (isResetPassword) {
      newAuthPageTitle = 'Сброс пароля';
    } else if (accessToken) {
      newAuthPageTitle = 'Создание нового пароля';
    }
    document.title = newAuthPageTitle;
    console.log(`[AUTH_PAGE_TITLE] Title установлен на: "${newAuthPageTitle}" (isSignUp: ${isSignUp}, isResetPassword: ${isResetPassword}, accessToken: ${!!accessToken})`);

    console.log(`[AUTH_PAGE_NAV] Текущий URL: ${window.location.href}`);
    console.log(`[AUTH_PAGE_NAV] Decoded redirect URL: ${decodedRedirectTo}`);

    // Логика ReactNativeWebView удалена
    // let timerId: NodeJS.Timeout | undefined;
    // if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
    //   timerId = setTimeout(() => {
    //     console.log('[WEBSITE /auth LOG] Отправка APP_CONTENT_READY из AuthPage');
    //     window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'APP_CONTENT_READY' }));
    //   }, 150);
    // }

    return () => {
      document.title = originalTitle;
      // if (timerId) {
      //   clearTimeout(timerId);
      // }
      console.log(`[AUTH_PAGE_TITLE] AuthPage unmounted. Title restored to: "${originalTitle}"`);
    };
  }, [isSignUp, isResetPassword, accessToken, decodedRedirectTo]);

  // Главный useEffect для обработки специальных потоков (сброс пароля, OAuth callback)
  useEffect(() => {
    const checkForSpecialFlowsAndRedirect = async () => {
      console.log('[AUTH_FLOW_CHECK] Запуск checkForSpecialFlowsAndRedirect.');
      const currentSearchParams = new URLSearchParams(window.location.search);
      const tokenFromQuery = currentSearchParams.get('token');
      const typeFromQuery = currentSearchParams.get('type');

      console.log(`[AUTH_FLOW_CHECK] Query Params: token=${tokenFromQuery ? '***' : 'none'}, type=${typeFromQuery || 'none'}`);

      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const recoveryTypeFromHash = hashParams.get('type');
      const access_token = hashParams.get('access_token');
      const refresh_token = hashParams.get('refresh_token');
      const errorFromHash = hashParams.get('error_description');
      const errorCodeFromHash = hashParams.get('error_code');

      console.log(`[AUTH_FLOW_CHECK] Hash Params: recoveryType=${recoveryTypeFromHash || 'none'}, access_token=${access_token ? '***' : 'none'}, refresh_token=${refresh_token ? '***' : 'none'}, error=${errorFromHash || 'none'}, errorCode=${errorCodeFromHash || 'none'}`);


      // --- ШАГ 1: ПЕРВЫМ ДЕЛОМ ОБРАБАТЫВАЕМ ОШИБКИ ИЗ URL ---
      if (errorFromHash) {
          console.error(`[AUTH_FLOW_ERROR] Supabase Error detected in hash: ${decodeURIComponent(errorFromHash)} (Code: ${errorCodeFromHash})`);
          setError(decodeURIComponent(errorFromHash));
          window.history.replaceState({}, document.title, window.location.pathname);
          console.log('[AUTH_FLOW_ERROR] URL hash очищен от ошибки.');
          return;
      }


      // --- ШАГ 2: ПРИОРИТЕТНАЯ ОБРАБОТКА СБРОСА ПАРОЛЯ ---
      if (recoveryTypeFromHash === 'recovery') {
        console.log('[AUTH_FLOW_RECOVERY] Detected password recovery flow from hash.');

        if (!access_token || !refresh_token) {
          console.warn("[AUTH_FLOW_RECOVERY] Missing access_token or refresh_token in hash for recovery. Displaying error.");
          setError("Ссылка для сброса пароля недействительна или устарела.");
          return;
        }

        try {
          console.log('[AUTH_FLOW_RECOVERY] Attempting to set Supabase session for recovery...');
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });

          if (error) {
            console.error("[AUTH_FLOW_RECOVERY] Failed to restore session with provided tokens:", error);
            setError("Не удалось восстановить сессию. Ссылка недействительна или устарела.");
            return;
          }

          console.log('[AUTH_FLOW_RECOVERY] Supabase session successfully set for recovery. Setting states.');
          setIsResetPassword(true);
          setAccessToken(access_token);

          window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
          console.log('[AUTH_FLOW_RECOVERY] URL hash очищен после recovery.');

          if (!isResetPasswordPage) {
            console.log('[WEBSITE /auth LOG] Redirecting to reset password page with token');
            navigate(
              `/auth/reset-password?redirect=${encodeURIComponent(decodedRedirectTo)}&redirectTitle=${encodeURIComponent(finalRedirectTitle)}`,
              {
                replace: true,
                state: { token: access_token, type: 'recovery' },
              }
            );
          } else {
            console.log('[WEBSITE /auth LOG] Already on reset password page, processing recovery token.');
          }
        } catch (err) {
          console.error("[AUTH_FLOW_RECOVERY] Exception during recovery flow:", err);
          setError("Ошибка при восстановлении доступа. Попробуйте снова.");
        }

        return;
      }

      // Логика для SignUp confirmation
      if (typeFromQuery === 'signup' || (recoveryTypeFromHash && recoveryTypeFromHash === 'signup')) {
          console.log('[AUTH_FLOW_SIGNUP] Detected signup confirmation flow.');
          setSuccessMessage('Регистрация успешно завершена! Переход на страницу профиля...');
          if (finalRedirectTitle) {
            document.title = finalRedirectTitle;
            console.log(`[AUTH_FLOW_SIGNUP] Document title updated to: "${finalRedirectTitle}"`);
          }
          setTimeout(() => {
            console.log('[AUTH_FLOW_SIGNUP] Navigating to /profile after signup confirmation.');
            navigate('/profile', { replace: true });
          }, 1500);
          window.history.replaceState({}, document.title, window.location.pathname);
          console.log('[AUTH_FLOW_SIGNUP] URL search/hash очищен после signup confirmation.');
          return;
      }

      // --- ШАГ 3: ОБРАБОТКА ОБЫЧНОГО OAuth callback ---
      if (access_token) {
          console.log('[AUTH_FLOW_OAUTH] Found OAuth access_token in hash, attempting to verify session.');
          setLoading(true);
          setTimeout(async () => {
              console.log('[AUTH_FLOW_OAUTH] Timeout expired. Calling supabase.auth.getSession()...');
              const { data: { session }, error: sessionError } = await supabase.auth.getSession();
              
              if (session && session.user) {
                  console.log('[AUTH_FLOW_OAUTH] Supabase session successfully established from OAuth callback. User:', session.user.id);
                  setSuccessMessage('Вход через Facebook успешно выполнен!');
                  window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
                  console.log('[AUTH_FLOW_OAUTH] URL hash очищен после успешного OAuth.');
                  if (finalRedirectTitle) {
                    document.title = finalRedirectTitle;
                    console.log(`[AUTH_FLOW_OAUTH] Document title updated to: "${finalRedirectTitle}"`);
                  }
                  console.log(`[AUTH_FLOW_OAUTH] Navigating to decodedRedirectTo: ${decodedRedirectTo}`);
                  navigate(decodedRedirectTo, { replace: true });
              } else if (sessionError) {
                  console.error('[AUTH_FLOW_OAUTH] Error getting Supabase session after OAuth:', sessionError);
                  setError('Ошибка при установке сессии после Facebook входа: ' + sessionError.message);
                  window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
                  console.log('[AUTH_FLOW_OAUTH] URL hash очищен, перенаправление на /auth из-за ошибки сессии.');
                  navigate('/auth', { replace: true });
              } else {
                  console.warn('[AUTH_FLOW_OAUTH] OAuth token found, but Supabase session not immediately established. No session or user in data.');
                  setError('Вход через Facebook не удался. Пожалуйста, попробуйте снова.');
                  window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
                  console.log('[AUTH_FLOW_OAUTH] URL hash очищен, перенаправление на /auth из-за отсутствия сессии.');
                  navigate('/auth', { replace: true });
              }
              setLoading(false);
              console.log('[AUTH_FLOW_OAUTH] Loading state set to false.');
          }, 100);
          return;
      }
      console.log('[AUTH_FLOW_CHECK] No special flow detected (query, hash, or OAuth).');
    };

    checkForSpecialFlowsAndRedirect();
  }, [location, navigate, isResetPasswordPage, user, searchParams, decodedRedirectTo, finalRedirectTitle, supabase]);

  useEffect(() => {
    console.log('[AUTH_NAV_STATE] useEffect for location.state triggered. State:', location.state);
    if (location.state?.token) {
      console.log('[AUTH_NAV_STATE] Found token in navigation state. Setting accessToken and isResetPassword.');
      setAccessToken(location.state.token);
      setIsResetPassword(true);
    }
  }, [location.state]);

  useEffect(() => {
    const initializeProfileForNewUser = async () => {
      console.log('[AUTH_PROFILE_INIT] Initializing profile check...');
      if (!user?.id) {
        console.log('[AUTH_PROFILE_INIT] Пользователь не залогинен или ID отсутствует, пропускаем инициализацию профиля.');
        return;
      }

      console.log(`[AUTH_PROFILE_INIT] *** Запуск инициализации профиля для user.id: ${user.id} ***`);
      console.log('[AUTH_PROFILE_INIT] Полный user объект:', user);
      console.log('[AUTH_PROFILE_INIT] user.user_metadata:', user.user_metadata);
      console.log('[AUTH_PROFILE_INIT] user.email:', user.email);

      try {
        console.log(`[AUTH_PROFILE_INIT] Fetching profile for user ${user.id} from Supabase...`);
        const { data: profileData, error: profileFetchError } = await supabase
          .from('profiles')
          .select('id, display_name, email, user_status, notification_preferences')
          .eq('id', user.id)
          .maybeSingle();

        if (profileFetchError && profileFetchError.code) {
          console.error('[AUTH_PROFILE_INIT] Ошибка при получении профиля из БД:', profileFetchError);
          return;
        }

        if (profileData) {
          console.log('[AUTH_PROFILE_INIT] Профиль уже существует для пользователя:', user.id, 'Данные:', profileData);
          return;
        }

        console.log('[AUTH_PROFILE_INIT] Профиль НЕ найден, создаем новый...');

        const nameFromFacebook = user.user_metadata?.full_name || user.user_metadata?.name;
        const nameFromEmail = user.email?.split('@')[0];
        let initialDisplayName = 'Пользователь';

        if (nameFromFacebook) {
          initialDisplayName = nameFromFacebook;
          console.log('[AUTH_PROFILE_INIT] Имя для профиля: из Facebook.');
        } else if (nameFromEmail) {
          initialDisplayName = nameFromEmail;
          console.log('[AUTH_PROFILE_INIT] Имя для профиля: из Email.');
        } else {
          console.log('[AUTH_PROFILE_INIT] Имя для профиля: по умолчанию.');
        }

        if (!user.email) {
            console.error('[AUTH_PROFILE_INIT] ОШИБКА: Email пользователя отсутствует для создания профиля. Отмена создания.');
            return;
        }

        const defaultNotificationPreferences = {
          replies: true,
          mentions: true,
          subscriptions: true,
          email_notifications: true
        };
        console.log('[AUTH_PROFILE_INIT] Установлены настройки уведомлений по умолчанию:', defaultNotificationPreferences);

        console.log(`[AUTH_PROFILE_INIT] UPSERT: id=${user.id}, display_name="${initialDisplayName}", email="${user.email}"`);

        const { error: upsertError } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            display_name: initialDisplayName,
            email: user.email,
            notification_preferences: defaultNotificationPreferences
          }, { onConflict: 'id' });

        if (upsertError) {
          console.error('[AUTH_PROFILE_INIT] ОШИБКА UPSERT при создании профиля:', upsertError);
        } else {
          console.log('[AUTH_PROFILE_INIT] *** Профиль успешно создан в базе данных с настройками уведомлений! ***');
        }

      } catch (err: any) {
        console.error('[AUTH_PROFILE_INIT] КРИТИЧЕСКАЯ ОШИБКА инициализации профиля (Общий Catch):', err);
      }
    };

    initializeProfileForNewUser();

  }, [user, supabase]);

  useEffect(() => {
    const validateConfig = async () => {
      console.log('[AUTH_CONFIG_VALIDATION] Running Supabase config validation...');
      const configResult = validateSupabaseConfig();
      setConfigValid(configResult.isValid);

      if (!configResult.isValid) {
        console.error('[AUTH_CONFIG_VALIDATION] Supabase config is invalid.');
        setError('Supabase configuration is missing or invalid. Please check your environment variables.');
        return;
      }
      const authStatus = await checkAuthStatus();
      console.log('[AUTH_CONFIG_VALIDATION] Auth status check (validateConfig):', authStatus);
    };
    validateConfig();
  }, []);

  const validateForm = useCallback(() => {
    console.log('[AUTH_FORM_VALIDATION] Validating form...');
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (isResetPassword && accessToken) {
      console.log('[AUTH_FORM_VALIDATION] Validation for password reset with token.');
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

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Пожалуйста, введите корректный email адрес');
      return false;
    }
    if (!isResetPassword && (!trimmedPassword || trimmedPassword.length < 6)) {
      setError('Пароль должен содержать не менее 6 символов');
      return false;
    }
    setEmail(trimmedEmail);
    if (!isResetPassword) {
      setPassword(trimmedPassword);
    }
    console.log('[AUTH_FORM_VALIDATION] Form validation successful.');
    return true;
  }, [email, password, confirmPassword, isResetPassword, accessToken]);

  const handleUpdatePassword = async () => {
    console.log('[AUTH_PASSWORD_UPDATE] Attempting to update password...');
    setError(null);
    setSuccessMessage(null);
    if (!validateForm()) {
      console.log('[AUTH_PASSWORD_UPDATE] Form validation failed for password update.');
      return;
    }
    setLoading(true);
    try {
      console.log('[AUTH_PASSWORD_UPDATE] Calling updatePassword with new password.');
      await updatePassword(password);
      setSuccessMessage('Ваш пароль был успешно обновлен');
      setTimeout(() => {
        console.log('[AUTH_PASSWORD_UPDATE] Password updated successfully. Redirecting...');
        setIsResetPassword(false);
        setAccessToken(null);
        if (finalRedirectTitle) {
          document.title = finalRedirectTitle;
        }
        navigate(decodedRedirectTo, { replace: true });
      }, 2000);
    } catch (err: any) {
      console.error('[AUTH_PASSWORD_UPDATE] Ошибка обновления пароля:', err);
      setError('Не удалось обновить пароль. Пожалуйста, попробуйте снова или запросите новую ссылку для сброса пароля.');
    } finally {
      setLoading(false);
      console.log('[AUTH_PASSWORD_UPDATE] Loading state set to false.');
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[AUTH_EMAIL_AUTH] Handling email/password authentication submit...');
    setError(null);
    setSuccessMessage(null);
    if (isResetPassword && accessToken) {
      console.log('[AUTH_EMAIL_AUTH] Delegating to handleUpdatePassword.');
      handleUpdatePassword();
      return;
    }
    if (!validateForm()) {
      console.log('[AUTH_EMAIL_AUTH] Form validation failed for email/password auth.');
      return;
    }
    setLoading(true);
    try {
      console.log(`[AUTH_EMAIL_AUTH] Processing: ${isResetPassword ? 'Password Reset' : isSignUp ? 'Sign Up' : 'Sign In'} for email: ${email}`);
      if (isResetPassword && !accessToken) {
        console.log('[AUTH_EMAIL_AUTH] Calling resetPassword...');
        await resetPassword(email);
        setSuccessMessage('Инструкции по сбросу пароля отправлены на ваш email');
        setIsResetPassword(false);
      } else if (isSignUp) {
        console.log('[AUTH_EMAIL_AUTH] Calling signUp...');
        try {
          const result = await signUp(email, password);
          console.log('[AUTH_EMAIL_AUTH] Результат регистрации:', result);
          if (result?.user?.identities?.length === 0) {
            setError('Аккаунт с этим email уже существует. Пожалуйста, выполните вход.');
            setIsSignUp(false);
            console.warn('[AUTH_EMAIL_AUTH] SignUp failed: Account already exists.');
          } else if (result?.user?.confirmed_at) {
            setSuccessMessage('Аккаунт создан и подтвержден успешно!');
            if (finalRedirectTitle) {
              document.title = finalRedirectTitle;
            }
            console.log('[AUTH_EMAIL_AUTH] SignUp successful and confirmed. Redirecting to /');
            setTimeout(() => navigate(decodedRedirectTo, { replace: true }), 2000);
          } else if (result?.user) {
            setSuccessMessage('Аккаунт создан! Пожалуйста, проверьте ваш email для подтверждения аккаунта перед входом.');
            console.log('[AUTH_EMAIL_AUTH] SignUp successful, but email confirmation pending.');
          } else {
            throw new Error('Регистрация не удалась с неизвестной ошибкой');
          }
        } catch (signupErr: any) {
          console.error('[AUTH_EMAIL_AUTH] Error during signUp:', signupErr);
          if (signupErr.message?.includes('already registered') ||
              signupErr.message?.includes('already exists')) {
            setError('Этот email уже зарегистрирован. Пожалуйста, используйте опцию Вход.');
            setIsSignUp(false);
          } else {
            throw signupErr;
          }
        }
      } else {
        console.log('[AUTH_EMAIL_AUTH] Calling signIn...');
        try {
          const signInResult = await signIn(email, password);
          console.log('[AUTH_EMAIL_AUTH] Вход успешно выполнен:', signInResult);
          if (finalRedirectTitle) {
            document.title = finalRedirectTitle;
          }
          navigate(decodedRedirectTo, { replace: true });
          console.log(`[AUTH_EMAIL_AUTH] Redirecting to: ${decodedRedirectTo}`);
        } catch (signInErr: any) {
          console.error('[AUTH_EMAIL_AUTH] Специфическая ошибка входа:', signInErr);
          if (signInErr.message?.includes('incorrect') ||
              signInErr.code === 'invalid_credentials' ||
              signInErr.message?.includes('Invalid login credentials')) {
            setError('Неверный email или пароль. Пожалуйста, проверьте данные и попробуйте снова.');
          } else {
            throw signInErr;
          }
        }
      }
    } catch (err: any) {
      console.error('[AUTH_EMAIL_AUTH] Общая ошибка аутентификации (catch-all):', err);
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
      console.log('[AUTH_EMAIL_AUTH] Loading state set to false.');
    }
  };

  const handleFacebookAuth = async () => {
    console.log('[AUTH_FACEBOOK_AUTH] Нажата кнопка "Продолжить с Facebook".');
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      console.log('[AUTH_FACEBOOK_AUTH] Вызов signInWithFacebook()...');
      await signInWithFacebook();
    } catch (err: any) {
      console.error('[AUTH_FACEBOOK_AUTH] Ошибка инициации аутентификации через Facebook:', err);
      setError(err.message || 'Не удалось начать аутентификацию через Facebook.');
      setLoading(false);
    }
  };

  const clearMessages = useCallback(() => {
    if (error || successMessage) {
      console.log('[AUTH_MESSAGES] Clearing error/success messages.');
    }
    setError(null);
    setSuccessMessage(null);
  }, [error, successMessage]);

  return (
    <div className="min-h-screen bg-gray-900 px-4 py-8">
      <div className="max-w-md mx-auto">
        <button
          onClick={() => {
            console.log(`[AUTH_UI_INTERACTION] "Back" button clicked. Navigating to: ${decodedRedirectTo}`);
            navigate(decodedRedirectTo);
          }}
          className="flex items-center text-gray-400 hover:text-white mb-6"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back
        </button>

        <h1
          className="text-3xl font-bold text-white text-center mb-8">
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
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md font-medium flex items-center justify-center mb-4"
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <Facebook className="h-5 w-5 mr-2" />
                Продолжить с Facebook
              </>
            )}
          </button>
        )}

        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div
              className="w-full border-t border-gray-700"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-gray-900 text-gray-400">
              {isResetPassword ?
'Введите ваш email' : 'Или продолжить с'}
            </span>
          </div>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          {(!accessToken || !isResetPassword) && (
            <div>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                pattern="[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
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

          {(!isResetPassword || accessToken) && (
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete={isSignUp ? "new-password" : "current-password"}
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
                {showPassword ?
                  (
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

          {accessToken && (
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
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
                 {showPassword ?
                  (
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
                  onChange={(e) => {
                    setRememberMe(e.target.checked);
                    console.log(`[AUTH_UI_INTERACTION] "Remember Me" checkbox toggled to: ${e.target.checked}`);
                  }}
                  className="h-4 w-4 text-orange-500 rounded border-gray-700 bg-gray-800"
                />
                <label htmlFor="remember-me" className="ml-2 text-gray-400">
                  Запомнить меня
                </label>
              </div>
              {!isSignUp &&
                (
                <button
                  type="button"
                  onClick={() => {
                    setIsResetPassword(true);
                    clearMessages();
                    console.log('[AUTH_UI_INTERACTION] "Forgot password?" clicked. Setting isResetPassword to true.');
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
            {loading ?
              (
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
                console.log(`[AUTH_UI_INTERACTION] Toggle sign up/in clicked. isSignUp now: ${!isSignUp}`);
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
              console.log('[AUTH_UI_INTERACTION] "Back to login" clicked. Setting isResetPassword to false.');
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
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

  const redirectTo = searchParams.get('redirect');
  const redirectTitle = searchParams.get('redirectTitle');
  const decodedRedirectTo = redirectTo ? decodeURIComponent(redirectTo) : '/';
  const finalRedirectTitle = redirectTitle ? decodeURIComponent(redirectTitle) : '';

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

  // useEffect для управления заголовком страницы
  useEffect(() => {
    const originalTitle = document.title;
    let newAuthPageTitle = 'Авторизация';
    if (isSignUp) newAuthPageTitle = 'Регистрация';
    else if (isResetPassword) newAuthPageTitle = 'Сброс пароля';
    else if (accessToken) newAuthPageTitle = 'Создание нового пароля';
    document.title = newAuthPageTitle;

    return () => {
      document.title = originalTitle;
    };
  }, [isSignUp, isResetPassword, accessToken]);


  // --- НОВОЕ ИСПРАВЛЕНИЕ: Надежный обработчик для OAuth (Facebook, и др.) ---
  // Этот useEffect будет слушать изменения состояния аутентификации
  useEffect(() => {
    // Устанавливаем слушатель
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Это событие надежно срабатывает, когда пользователь успешно
      // возвращается от OAuth провайдера (например, Facebook)
      if (event === 'SIGNED_IN' && session) {
        console.log('[AUTH_STATE_CHANGE] Успешный вход (SIGNED_IN). Сессия:', session);
        setSuccessMessage('Вход успешно выполнен!');

        // Очищаем URL от токенов, которые больше не нужны
        window.history.replaceState({}, document.title, window.location.pathname);

        if (finalRedirectTitle) {
            document.title = finalRedirectTitle;
        }
        console.log(`[AUTH_STATE_CHANGE] Перенаправление на: ${decodedRedirectTo}`);
        navigate(decodedRedirectTo, { replace: true });
      }
    });

    // Отписываемся от слушателя при размонтировании компонента, чтобы избежать утечек памяти
    return () => {
      subscription.unsubscribe();
      console.log('[AUTH_STATE_CHANGE] Слушатель onAuthStateChange отписан.');
    };
  }, [navigate, decodedRedirectTo, finalRedirectTitle, supabase]);


  // Главный useEffect для обработки специальных потоков (сброс пароля)
  useEffect(() => {
    const checkForSpecialFlowsAndRedirect = async () => {
      console.log('[AUTH_FLOW_CHECK] Запуск checkForSpecialFlowsAndRedirect.');

      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const recoveryTypeFromHash = hashParams.get('type');
      const access_token_from_hash = hashParams.get('access_token');
      const refresh_token_from_hash = hashParams.get('refresh_token');
      const errorFromHash = hashParams.get('error_description');

      // --- ШАГ 1: Обработка ошибок из URL ---
      if (errorFromHash) {
          setError(decodeURIComponent(errorFromHash));
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
      }

      // --- ШАГ 2: Обработка сброса пароля ---
      if (recoveryTypeFromHash === 'recovery') {
        console.log('[AUTH_FLOW_RECOVERY] Detected password recovery flow.');
        if (!access_token_from_hash || !refresh_token_from_hash) {
          setError("Ссылка для сброса пароля недействительна или устарела.");
          return;
        }

        const { error: sessionError } = await supabase.auth.setSession({
          access_token: access_token_from_hash,
          refresh_token: refresh_token_from_hash,
        });

        if (sessionError) {
          setError("Не удалось восстановить сессию. Ссылка недействительна или устарела.");
          return;
        }

        setAccessToken(access_token_from_hash);
        setIsResetPassword(true);
        window.history.replaceState({}, document.title, '/auth/reset-password');
        navigate('/auth/reset-password', { replace: true });
        return;
      }

      // --- ШАГ 3: Логика для SignUp confirmation ---
      const typeFromQuery = searchParams.get('type');
      if (typeFromQuery === 'signup') {
          setSuccessMessage('Регистрация успешно завершена! Переход на страницу профиля...');
          setTimeout(() => navigate('/profile', { replace: true }), 1500);
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
      }

      // --- СТАРАЯ ЛОГИКА OAuth УДАЛЕНА ОТСЮДА ---
      // Теперь она обрабатывается в отдельном, надежном useEffect с onAuthStateChange
    };

    checkForSpecialFlowsAndRedirect();
  }, [location, navigate, searchParams, supabase]); // Зависимости обновлены

  // ... (остальной код вашего компонента остается без изменений) ...
  // --- КОНЕЦ БЛОКА С ИЗМЕНЕНИЯМИ ---

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
      try {
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
        } else if (nameFromEmail) {
          initialDisplayName = nameFromEmail;
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
      const configResult = validateSupabaseConfig();
      setConfigValid(configResult.isValid);

      if (!configResult.isValid) {
        setError('Supabase configuration is missing or invalid. Please check your environment variables.');
        return;
      }
      await checkAuthStatus();
    };
    validateConfig();
  }, []);

  const validateForm = useCallback(() => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

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
    return true;
  }, [email, password, confirmPassword, isResetPassword, accessToken]);

  const handleUpdatePassword = async () => {
    setError(null);
    setSuccessMessage(null);
    if (!validateForm()) {
      return;
    }
    setLoading(true);
    try {
      await updatePassword(password);
      setSuccessMessage('Ваш пароль был успешно обновлен');
      setTimeout(() => {
        setIsResetPassword(false);
        setAccessToken(null);
        if (finalRedirectTitle) {
          document.title = finalRedirectTitle;
        }
        navigate(decodedRedirectTo, { replace: true });
      }, 2000);
    } catch (err: any) {
      setError('Не удалось обновить пароль. Пожалуйста, попробуйте снова или запросите новую ссылку для сброса пароля.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    if (isResetPassword && accessToken) {
      handleUpdatePassword();
      return;
    }
    if (!validateForm()) {
      return;
    }
    setLoading(true);
    try {
      if (isResetPassword && !accessToken) {
        await resetPassword(email);
        setSuccessMessage('Инструкции по сбросу пароля отправлены на ваш email');
        setIsResetPassword(false);
      } else if (isSignUp) {
        try {
          const result = await signUp(email, password);
          if (result?.user?.identities?.length === 0) {
            setError('Аккаунт с этим email уже существует. Пожалуйста, выполните вход.');
            setIsSignUp(false);
          } else if (result?.user?.confirmed_at) {
            setSuccessMessage('Аккаунт создан и подтвержден успешно!');
            if (finalRedirectTitle) {
              document.title = finalRedirectTitle;
            }
            setTimeout(() => navigate(decodedRedirectTo, { replace: true }), 2000);
          } else if (result?.user) {
            setSuccessMessage('Аккаунт создан! Пожалуйста, проверьте ваш email для подтверждения аккаунта перед входом.');
          } else {
            throw new Error('Регистрация не удалась с неизвестной ошибкой');
          }
        } catch (signupErr: any) {
          if (signupErr.message?.includes('already registered') || signupErr.message?.includes('already exists')) {
            setError('Этот email уже зарегистрирован. Пожалуйста, используйте опцию Вход.');
            setIsSignUp(false);
          } else {
            throw signupErr;
          }
        }
      } else {
        try {
          await signIn(email, password);
          if (finalRedirectTitle) {
            document.title = finalRedirectTitle;
          }
          navigate(decodedRedirectTo, { replace: true });
        } catch (signInErr: any) {
          if (signInErr.message?.includes('incorrect') || signInErr.code === 'invalid_credentials' || signInErr.message?.includes('Invalid login credentials')) {
            setError('Неверный email или пароль. Пожалуйста, проверьте данные и попробуйте снова.');
          } else {
            throw signInErr;
          }
        }
      }
    } catch (err: any) {
      if (err.code === 'invalid_credentials' || err.message?.includes('invalid_credentials') || err.message?.includes('Invalid login credentials')) {
        setError('Email или пароль, которые вы ввели, неверны. Пожалуйста, попробуйте снова.');
      } else if (err.message?.includes('already exists') || err.message?.includes('already registered')) {
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
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await signInWithFacebook();
    } catch (err: any) {
      setError(err.message || 'Не удалось начать аутентификацию через Facebook.');
      setLoading(false);
    }
  };

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccessMessage(null);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 px-4 py-8">
      <div className="max-w-md mx-auto">
        <button
          onClick={() => navigate(decodedRedirectTo)}
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
            <div className="w-full border-t border-gray-700"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-gray-900 text-gray-400">
              {isResetPassword ? 'Введите ваш email' : 'Или продолжить с'}
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
                placeholder="Пароль"
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
                {/* SVG иконки */}
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
                {/* SVG иконки */}
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
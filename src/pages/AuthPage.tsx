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

  const redirectTo = searchParams.get('redirect');
  const decodedRedirectTo = redirectTo ? decodeURIComponent(redirectTo) : '/';

  // Сохраняем предыдущий заголовок, чтобы иметь возможность его восстановить
  const [originalDocumentTitle, setOriginalDocumentTitle] = useState(document.title);

  // useEffect для управления заголовком страницы
  useEffect(() => {
    let newTitle = 'Авторизация'; // Заголовок по умолчанию для страницы Auth
    if (isSignUp) {
      newTitle = 'Регистрация';
    } else if (isResetPassword) {
      newTitle = 'Сброс пароля';
    } else if (accessToken) {
      newTitle = 'Создание нового пароля';
    }
    document.title = newTitle;
    console.log(`[WEBSITE /auth LOG] Title установлен на: "${newTitle}"`);

    // При размонтировании компонента (или перед новым рендером, если зависимости меняются)
    // можно сбросить заголовок или восстановить его
    return () => {
        // Мы хотим, чтобы заголовок сбрасывался только после успешной авторизации,
        // а не просто при навигации с этой страницы.
        // Поэтому здесь мы ничего не делаем, а управляем сбросом в handleEmailAuth
    };
  }, [isSignUp, isResetPassword, accessToken]); // Зависимости для динамического заголовка

  // useEffect для обработки специальных потоков (сброс пароля, OAuth callback)
  // и для перенаправления авторизованных пользователей
  useEffect(() => {
    const checkForSpecialFlowsAndRedirect = async () => {
      const currentSearchParams = new URLSearchParams(window.location.search);
      const token = currentSearchParams.get('token');
      const type = currentSearchParams.get('type');

      console.log('[WEBSITE /auth LOG] Auth flow check (checkForSpecialFlowsAndRedirect):', {
        fullUrl: window.location.href,
        search: window.location.search,
        token: token ? `${token.substring(0, 10)}...` : 'none',
        type: type || 'none',
        isResetPage: isResetPasswordPage,
        userStatus: user ? 'logged in' : 'not logged in',
        redirectTo: decodedRedirectTo
      });

      // Логика для SignUp confirmation (если Supabase отправляет на эту же страницу с type=signup)
      if (type === 'signup') {
        try {
          console.log('[WEBSITE /auth LOG] Detected signup confirmation flow');
          setSuccessMessage('Регистрация успешно завершена! Переход на страницу профиля...');
          // Сбросить заголовок перед перенаправлением
          document.title = originalDocumentTitle; // Восстанавливаем оригинальный заголовок или устанавливаем пустой
          setTimeout(() => {
            navigate('/profile', { replace: true });
          }, 1500);
          return;
        } catch (err) {
          console.error('[WEBSITE /auth LOG] Error handling signup flow:', err);
          setError('Произошла ошибка при подтверждении регистрации.');
        }
      } else if (token && type === 'recovery') {
        try {
          setIsResetPassword(true);
          setAccessToken(token);
          if (!isResetPasswordPage) {
            console.log('[WEBSITE /auth LOG] Redirecting to reset password page with token');
            navigate(`/auth/reset-password?redirect=${encodeURIComponent(decodedRedirectTo)}`, {
              replace: true,
              state: { token, type }
            });
          }
        } catch (err) {
          console.error('[WEBSITE /auth LOG] Error handling recovery flow:', err);
          setError('Произошла ошибка при обработке ссылки сброса пароля.');
        }
      } else if (window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const oauthAccessToken = hashParams.get('access_token');

        if (oauthAccessToken) {
          console.log('[WEBSITE /auth LOG] Found OAuth token in hash, attempting to verify session.');
          setLoading(true);
          setTimeout(async () => {
              const { data: { session }, error: sessionError } = await supabase.auth.getSession();
              
              if (session && session.user) {
                  console.log('[WEBSITE /auth LOG] Supabase session successfully established from OAuth callback.');
                  setSuccessMessage('Вход через Facebook успешно выполнен!');
                  window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
                  document.title = originalDocumentTitle; // Сбросить заголовок после успешного OAuth
                  navigate(decodedRedirectTo, { replace: true });
              } else if (sessionError) {
                  console.error('[WEBSITE /auth LOG] Error getting Supabase session after OAuth:', sessionError);
                  setError('Ошибка при установке сессии после Facebook входа: ' + sessionError.message);
                  window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
                  navigate('/auth', { replace: true });
              } else {
                  console.warn('[WEBSITE /auth LOG] OAuth token found, but Supabase session not immediately established.');
                  setError('Вход через Facebook не удался. Пожалуйста, попробуйте снова.');
                  window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
                  navigate('/auth', { replace: true });
              }
              setLoading(false);
          }, 100);
        }
      }
    };

    checkForSpecialFlowsAndRedirect();
  }, [location, navigate, isResetPasswordPage, user, searchParams, decodedRedirectTo, originalDocumentTitle]); // Добавили originalDocumentTitle в зависимости

  useEffect(() => {
    const initializeProfileForNewUser = async () => {
      if (!user?.id) {
        console.log('[AUTH_PAGE_INIT] Пользователь не залогинен или ID отсутствует, пропускаем инициализацию профиля.');
        return;
      }

      console.log(`[AUTH_PAGE_INIT] *** Запуск инициализации профиля для user.id: ${user.id} ***`);
      console.log('[AUTH_PAGE_INIT] Полный user объект:', user);
      console.log('[AUTH_PAGE_INIT] user.user_metadata:', user.user_metadata);
      console.log('[AUTH_PAGE_INIT] user.email:', user.email);

      try {
        const { data: profileData, error: profileFetchError } = await supabase
          .from('profiles')
          .select('id, display_name, email, user_status, notification_preferences')
          .eq('id', user.id)
          .maybeSingle();

        if (profileFetchError && profileFetchError.code) {
          console.error('[AUTH_PAGE_INIT] Ошибка при получении профиля из БД:', profileFetchError);
          return;
        }

        if (profileData) {
          console.log('[AUTH_PAGE_INIT] Профиль уже существует для пользователя:', user.id, 'Данные:', profileData);
          return;
        }

        console.log('[AUTH_PAGE_INIT] Профиль НЕ найден, создаем новый...');

        const nameFromFacebook = user.user_metadata?.full_name || user.user_metadata?.name;
        const nameFromEmail = user.email?.split('@')[0];
        let initialDisplayName = 'Пользователь';

        if (nameFromFacebook) {
          initialDisplayName = nameFromFacebook;
          console.log('[AUTH_PAGE_INIT] Имя для профиля: из Facebook.');
        } else if (nameFromEmail) {
          initialDisplayName = nameFromEmail;
          console.log('[AUTH_PAGE_INIT] Имя для профиля: из Email.');
        } else {
          console.log('[AUTH_PAGE_INIT] Имя для профиля: по умолчанию.');
        }

        if (!user.email) {
            console.error('[AUTH_PAGE_INIT] ОШИБКА: Email пользователя отсутствует для создания профиля. Отмена создания.');
            return;
        }

        const defaultNotificationPreferences = {
          replies: true,
          mentions: true,
          subscriptions: true,
          email_notifications: true
        };
        console.log('[AUTH_PAGE_INIT] Установлены настройки уведомлений по умолчанию:', defaultNotificationPreferences);

        console.log(`[AUTH_PAGE_INIT] UPSERT: id=${user.id}, display_name="${initialDisplayName}", email="${user.email}"`);

        const { error: upsertError } = await supabase
          .from('profiles')
          .upsert({ 
            id: user.id, 
            display_name: initialDisplayName, 
            email: user.email,
            notification_preferences: defaultNotificationPreferences
          }, { onConflict: 'id' });

        if (upsertError) {
          console.error('[AUTH_PAGE_INIT] ОШИБКА UPSERT при создании профиля:', upsertError);
        } else {
          console.log('[AUTH_PAGE_INIT] *** Профиль успешно создан в базе данных с настройками уведомлений! ***');
        }

      } catch (err: any) {
        console.error('[AUTH_PAGE_INIT] КРИТИЧЕСКАЯ ОШИБКА инициализации профиля (Общий Catch):', err);
      }
    };

    initializeProfileForNewUser();

  }, [user, supabase]);

  useEffect(() => {
    if (location.state?.token) {
      console.log('[WEBSITE /auth LOG] Found token in navigation state');
      setAccessToken(location.state.token);
      setIsResetPassword(true);
    }
  }, [location.state]);

  useEffect(() => {
    const validateConfig = async () => {
      const configResult = validateSupabaseConfig();
      setConfigValid(configResult.isValid);

      if (!configResult.isValid) {
        setError('Supabase configuration is missing or invalid. Please check your environment variables.');
        return;
      }
      const authStatus = await checkAuthStatus();
      console.log('[WEBSITE /auth LOG] Auth status check (validateConfig):', authStatus);
    };
    validateConfig();
  }, []);

  const validateForm = () => {
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
  };

  const handleUpdatePassword = async () => {
    setError(null);
    setSuccessMessage(null);
    if (!validateForm()) {
      return;
    }
    setLoading(true);
    try {
      console.log('[AUTH_PAGE] Попытка обновить пароль с токеном');
      await updatePassword(password);
      setSuccessMessage('Ваш пароль был успешно обновлен');
      setTimeout(() => {
        setIsResetPassword(false);
        setAccessToken(null);
        document.title = originalDocumentTitle; // Сбросить заголовок
        navigate(decodedRedirectTo, { replace: true });
      }, 2000);
    } catch (err: any) {
      console.error('[AUTH_PAGE] Ошибка обновления пароля:', err);
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
      console.log(`[AUTH_PAGE] Попытка ${isResetPassword ? 'сброса пароля' : isSignUp ? 'регистрации' : 'входа'} с email: ${email}`);
      if (isResetPassword && !accessToken) {
        await resetPassword(email);
        setSuccessMessage('Инструкции по сбросу пароля отправлены на ваш email');
        setIsResetPassword(false);
      } else if (isSignUp) {
        try {
          const result = await signUp(email, password);
          console.log('[AUTH_PAGE] Результат регистрации:', result);
          if (result?.user?.identities?.length === 0) {
            setError('Аккаунт с этим email уже существует. Пожалуйста, выполните вход.');
            setIsSignUp(false);
          } else if (result?.user?.confirmed_at) {
            setSuccessMessage('Аккаунт создан и подтвержден успешно!');
            document.title = originalDocumentTitle; // Сбросить заголовок
            setTimeout(() => navigate(decodedRedirectTo), 2000);
          } else if (result?.user) {
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
            throw signupErr;
          }
        }
      } else { // Блок для входа (signIn)
        try {
          const signInResult = await signIn(email, password);
          console.log('[AUTH_PAGE] Вход успешно выполнен:', signInResult);
          document.title = originalDocumentTitle; // Сбросить заголовок после успешного входа
          navigate(decodedRedirectTo, { replace: true }); 
        } catch (signInErr: any) {
          console.error('[AUTH_PAGE] Специфическая ошибка входа:', signInErr);
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
      console.error('[AUTH_PAGE] Ошибка аутентификации:', err);
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
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      console.log('[AUTH_PAGE] Запуск аутентификации через Facebook...');
      await signInWithFacebook();
    } catch (err: any) {
      console.error('[AUTH_PAGE] Ошибка инициации аутентификации через Facebook:', err);
      setError(err.message || 'Не удалось начать аутентификацию через Facebook.');
      setLoading(false);
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
          onClick={() => navigate(decodedRedirectTo)} // Кнопка "Назад" также ведет на предыдущую страницу.
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
                  onChange={(e) => setRememberMe(e.target.checked)}
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
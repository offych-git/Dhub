import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { Mail, Facebook, ArrowRight, KeyRound, ArrowLeft } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { checkAuthStatus, validateSupabaseConfig } from "../utils/authDebug";
import { supabase } from "../lib/supabase"; // Убедитесь, что путь правильный

interface AuthPageProps {
  isResetPasswordPage?: boolean;
}

const AuthPage: React.FC<AuthPageProps> = ({ isResetPasswordPage = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    signIn,
    signUp,
    signInWithFacebook,
    resetPassword,
    updatePassword,
    user,
  } = useAuth(); // Получаем user из AuthContext
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(isResetPasswordPage);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [configValid, setConfigValid] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Лог: AuthPage монтируется
  useEffect(() => {
    const newTitle = "Страница Авторизации";
    document.title = newTitle;
    console.log(
      `[AUTH_PAGE] Компонент AuthPage.tsx смонтирован. Title установлен на: "${newTitle}"`,
    );

    if (
      window.ReactNativeWebView &&
      typeof window.ReactNativeWebView.postMessage === "function"
    ) {
      const timerId = setTimeout(() => {
        console.log("[AUTH_PAGE] Отправка APP_CONTENT_READY из AuthPage");
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ type: "APP_CONTENT_READY" }),
        );
      }, 150);
    }
    return () =>
      console.log("[AUTH_PAGE] Компонент AuthPage.tsx размонтирован.");
  }, []);

  // Лог: user изменился (для отладки AuthContext)
  useEffect(() => {
    console.log(
      `[AUTH_PAGE] useEffect: user изменился. user.id: ${user?.id || "null"}, user.email: ${user?.email || "null"}`,
    );
    if (user && user.id) {
      console.log("[AUTH_PAGE] Полный user объект:", user);
    }
  }, [user]); // Зависимость от user

  // useEffect для проверки специальных потоков (сброс пароля, OAuth callback)
  useEffect(() => {
    const checkForSpecialFlows = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const token = searchParams.get("token");
      const type = searchParams.get("type");
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const oauthAccessToken = hashParams.get("access_token");

      console.log(
        "[AUTH_PAGE] Auth flow check (checkForSpecialFlows) - НАЧАЛО. Hash params:",
        window.location.hash,
      );
      console.log("[AUTH_PAGE] checkForSpecialFlows - параметры:", {
        fullUrl: window.location.href,
        search: window.location.search,
        token: token ? `${token.substring(0, 10)}...` : "none",
        type: type || "none",
        isResetPage: isResetPasswordPage,
        hasOAuthAccessTokenInHash: !!oauthAccessToken, // Проверка, есть ли токен OAuth в хеше
      });

      // Логика подтверждения регистрации
      if (type === "signup") {
        console.log(
          "[AUTH_PAGE] Обнаружен поток подтверждения регистрации (type=signup)",
        );
        try {
          setTimeout(() => {
            setSuccessMessage(
              "Регистрация успешно завершена! Переход на страницу профиля...",
            );
            setTimeout(() => {
              navigate("/profile", { replace: true });
            }, 1500);
          }, 500);
          return;
        } catch (err) {
          console.error(
            "[AUTH_PAGE] Ошибка при обработке потока регистрации:",
            err,
          );
          setError("Произошла ошибка при подтверждении регистрации.");
        }
      }
      // Логика сброса пароля
      else if (token && type === "recovery") {
        console.log(
          "[AUTH_PAGE] Обнаружен поток сброса пароля (type=recovery)",
        );
        try {
          setIsResetPassword(true);
          setAccessToken(token);
          if (!isResetPasswordPage) {
            console.log(
              "[AUTH_PAGE] Перенаправление на страницу сброса пароля с токеном",
            );
            navigate("/auth/reset-password", {
              replace: true,
              state: { token, type },
            });
          }
        } catch (err) {
          console.error(
            "[AUTH_PAGE] Ошибка при обработке потока восстановления:",
            err,
          );
          setError("Произошла ошибка при обработке ссылки сброса пароля.");
        }
      }
      // ОБНОВЛЕННАЯ ЛОГИКА ДЛЯ ОБРАБОТКИ OAUTH CALLBACK
      else if (window.location.hash && oauthAccessToken) {
        // Убедимся, что есть хеш и access_token в нем
        console.log(
          "[AUTH_PAGE] Обнаружен OAuth токен в хеше URL. Попытка верификации сессии.",
        );
        setLoading(true);
        try {
          // Задержка здесь для того, чтобы дать Supabase SDK время прочитать хэш и установить сессию.
          // Увеличим задержку для надежности.
          setTimeout(async () => {
            console.log(
              "[AUTH_PAGE] Внутри setTimeout для проверки сессии после OAuth.",
            );
            const {
              data: { session },
              error: sessionError,
            } = await supabase.auth.getSession();

            if (session && session.user) {
              console.log(
                "[AUTH_PAGE] Supabase сессия успешно установлена из OAuth callback. User ID:",
                session.user.id,
              );
              setSuccessMessage("Вход через Facebook успешно выполнен!");
              // Очищаем хэш URL после успешной обработки
              window.history.replaceState(
                {},
                document.title,
                window.location.pathname + window.location.search,
              );
              navigate("/", { replace: true }); // Перенаправляем на главную
            } else if (sessionError) {
              console.error(
                "[AUTH_PAGE] Ошибка получения сессии Supabase после OAuth:",
                sessionError,
              );
              setError(
                "Ошибка при установке сессии после Facebook входа: " +
                  sessionError.message,
              );
              window.history.replaceState(
                {},
                document.title,
                window.location.pathname + window.location.search,
              );
              navigate("/auth", { replace: true });
            } else {
              console.warn(
                "[AUTH_PAGE] OAuth токен найден, но сессия Supabase не установлена немедленно. Сессия:",
                session,
              );
              setError(
                "Вход через Facebook не удался. Пожалуйста, попробуйте снова.",
              );
              window.history.replaceState(
                {},
                document.title,
                window.location.pathname + window.location.search,
              );
              navigate("/auth", { replace: true });
            }
            setLoading(false);
          }, 500); // Увеличил задержку до 500 мс для надежности
        } catch (err: any) {
          console.error("[AUTH_PAGE] Ошибка обработки OAuth токена:", err);
          setError(
            "Произошла ошибка при входе через Facebook: " +
              (err.message || "Неизвестная ошибка"),
          );
          setLoading(false);
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname + window.location.search,
          );
          navigate("/auth", { replace: true });
        }
      } else {
        console.log(
          "[AUTH_PAGE] Нет специальных потоков для обработки или нет OAuth токена в хеше.",
        );
      }
    };

    checkForSpecialFlows();
  }, [location, navigate, isResetPasswordPage, user]); // user в зависимостях все еще нужен для перезапуска при изменении user

  // --- НОВЫЙ useEffect ДЛЯ ИНИЦИАЛИЗАЦИИ ПРОФИЛЯ ---
  // Этот useEffect будет срабатывать, когда user объект станет доступен
  useEffect(() => {
    const initializeProfileForNewUser = async () => {
      // Лог: Проверка user.id в начале инициализации
      if (!user?.id) {
        console.log(
          "[AUTH_PAGE_INIT] Пользователь не залогинен или ID отсутствует, пропускаем инициализацию профиля.",
        );
        return;
      }

      console.log(
        `[AUTH_PAGE_INIT] *** Запуск инициализации профиля для user.id: ${user.id} ***`,
      );
      console.log("[AUTH_PAGE_INIT] Полный user объект:", user); // Логируем полный user объект
      console.log("[AUTH_PAGE_INIT] user.user_metadata:", user.user_metadata);
      console.log("[AUTH_PAGE_INIT] user.email:", user.email);

      try {
        // 1. Попытка получить профиль: Используем .maybeSingle() для обработки отсутствия записи
        const { data: profileData, error: profileFetchError } = await supabase
          .from("profiles")
          .select("id, display_name, email, user_status") // Запрашиваем поля, которые могут пригодиться
          .eq("id", user.id)
          .maybeSingle(); // ИЗМЕНЕНИЕ ЗДЕСЬ: используем maybeSingle()

        // Ошибка .maybeSingle() будет null, если 0 строк. Проверяем только настоящие ошибки.
        if (profileFetchError && profileFetchError.code) {
          // Проверяем, что error не просто {code: 'PGRST116'}
          console.error(
            "[AUTH_PAGE_INIT] Ошибка при получении профиля из БД:",
            profileFetchError,
          );
          // Здесь можно добавить логику отображения ошибки, если она критична
          return; // Прерываем инициализацию при ошибке
        }

        // 2. Если профиль уже существует, выходим (не нужно создавать заново)
        if (profileData) {
          console.log(
            "[AUTH_PAGE_INIT] Профиль уже существует для пользователя:",
            user.id,
            "Данные:",
            profileData,
          );
          // Возможно, здесь можно обновить displayName/email в AuthContext, если это необходимо
          return;
        }

        // 3. Профиль не найден, создаем новый
        console.log("[AUTH_PAGE_INIT] Профиль НЕ найден, создаем новый...");

        const nameFromFacebook =
          user.user_metadata?.full_name || user.user_metadata?.name;
        const nameFromEmail = user.email?.split("@")[0];
        let initialDisplayName = "Пользователь";

        if (nameFromFacebook) {
          initialDisplayName = nameFromFacebook;
          console.log("[AUTH_PAGE_INIT] Имя для профиля: из Facebook.");
        } else if (nameFromEmail) {
          initialDisplayName = nameFromEmail;
          console.log("[AUTH_PAGE_INIT] Имя для профиля: из Email.");
        } else {
          console.log("[AUTH_PAGE_INIT] Имя для профиля: по умолчанию.");
        }

        // Убедимся, что email есть, так как он NOT NULL
        if (!user.email) {
          console.error(
            "[AUTH_PAGE_INIT] ОШИБКА: Email пользователя отсутствует для создания профиля. Отмена создания.",
          );
          return;
        }

        console.log(
          `[AUTH_PAGE_INIT] UPSERT: id=${user.id}, display_name="${initialDisplayName}", email="${user.email}"`,
        );

        const { error: upsertError } = await supabase.from("profiles").upsert(
          {
            id: user.id,
            display_name: initialDisplayName,
            email: user.email,
          },
          { onConflict: "id" },
        ); // onConflict 'id' для создания, если нет, и обновления, если есть

        if (upsertError) {
          console.error(
            "[AUTH_PAGE_INIT] ОШИБКА UPSERT при создании профиля:",
            upsertError,
          );
          // Можно добавить логику для отображения ошибки пользователю
        } else {
          console.log(
            "[AUTH_PAGE_INIT] *** Профиль успешно создан в базе данных! ***",
          );
        }
      } catch (err: any) {
        console.error(
          "[AUTH_PAGE_INIT] КРИТИЧЕСКАЯ ОШИБКА инициализации профиля (Общий Catch):",
          err,
        );
        // Этот catch поймает любые неожиданные ошибки в процессе
      }
    };

    // Вызываем функцию инициализации при изменении user
    initializeProfileForNewUser();
  }, [user, supabase]); // Зависимость от user объекта и клиента Supabase

  // useEffect для получения токена из navigation state
  useEffect(() => {
    if (location.state?.token) {
      console.log("[AUTH_PAGE] Found token in navigation state");
      setAccessToken(location.state.token);
      setIsResetPassword(true);
    }
  }, [location.state]);

  // useEffect для валидации конфигурации Supabase и проверки статуса аутентификации
  useEffect(() => {
    const validateConfig = async () => {
      const configResult = validateSupabaseConfig();
      setConfigValid(configResult.isValid);

      if (!configResult.isValid) {
        setError(
          "Supabase configuration is missing or invalid. Please check your environment variables.",
        );
        return;
      }
      const authStatus = await checkAuthStatus();
      console.log(
        "[AUTH_PAGE] Auth status check (validateConfig):",
        authStatus,
      );
    };
    validateConfig();
  }, []);

  const validateForm = () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (isResetPassword && accessToken) {
      if (!trimmedPassword || trimmedPassword.length < 6) {
        setError("Пароль должен содержать не менее 6 символов");
        return false;
      }
      if (trimmedPassword !== confirmPassword.trim()) {
        setError("Пароли не совпадают");
        return false;
      }
      return true;
    }

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Пожалуйста, введите корректный email адрес");
      return false;
    }
    if (!isResetPassword && (!trimmedPassword || trimmedPassword.length < 6)) {
      setError("Пароль должен содержать не менее 6 символов");
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
      console.log("[AUTH_PAGE] Попытка обновить пароль с токеном");
      await updatePassword(password);
      setSuccessMessage("Ваш пароль был успешно обновлен");
      setTimeout(() => {
        setIsResetPassword(false);
        setAccessToken(null);
        navigate("/auth", { replace: true });
      }, 2000);
    } catch (err: any) {
      console.error("[AUTH_PAGE] Ошибка обновления пароля:", err);
      setError(
        "Не удалось обновить пароль. Пожалуйста, попробуйте снова или запросите новую ссылку для сброса пароля.",
      );
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
      console.log(
        `[AUTH_PAGE] Попытка ${isResetPassword ? "сброса пароля" : isSignUp ? "регистрации" : "входа"} с email: ${email}`,
      );
      if (isResetPassword && !accessToken) {
        await resetPassword(email);
        setSuccessMessage(
          "Инструкции по сбросу пароля отправлены на ваш email",
        );
        setIsResetPassword(false);
      } else if (isSignUp) {
        try {
          const result = await signUp(email, password);
          console.log("[AUTH_PAGE] Результат регистрации:", result);
          if (result?.user?.identities?.length === 0) {
            setError(
              "Аккаунт с этим email уже существует. Пожалуйста, выполните вход.",
            );
            setIsSignUp(false);
          } else if (result?.user?.confirmed_at) {
            setSuccessMessage("Аккаунт создан и подтвержден успешно!");
            setTimeout(() => navigate("/"), 2000);
          } else if (result?.user) {
            setSuccessMessage(
              "Аккаунт создан! Пожалуйста, проверьте ваш email для подтверждения аккаунта перед входом.",
            );
          } else {
            throw new Error("Регистрация не удалась с неизвестной ошибкой");
          }
        } catch (signupErr: any) {
          if (
            signupErr.message?.includes("already registered") ||
            signupErr.message?.includes("already exists")
          ) {
            setError(
              "Этот email уже зарегистрирован. Пожалуйста, используйте опцию Вход.",
            );
            setIsSignUp(false);
          } else {
            throw signupErr;
          }
        }
      } else {
        try {
          const signInResult = await signIn(email, password);
          console.log("[AUTH_PAGE] Вход успешно выполнен:", signInResult);
        } catch (signInErr: any) {
          console.error("[AUTH_PAGE] Специфическая ошибка входа:", signInErr);
          if (
            signInErr.message?.includes("incorrect") ||
            signInErr.code === "invalid_credentials" ||
            signInErr.message?.includes("Invalid login credentials")
          ) {
            setError(
              "Неверный email или пароль. Пожалуйста, проверьте данные и попробуйте снова.",
            );
          } else {
            throw signInErr;
          }
        }
      }
    } catch (err: any) {
      console.error("[AUTH_PAGE] Ошибка аутентификации:", err);
      if (
        err.code === "invalid_credentials" ||
        err.message?.includes("invalid_credentials") ||
        err.message?.includes("Invalid login credentials")
      ) {
        setError(
          "Email или пароль, которые вы ввели, неверны. Пожалуйста, попробуйте снова.",
        );
      } else if (
        err.message?.includes("already exists") ||
        err.message?.includes("already registered")
      ) {
        setError(
          "Аккаунт с этим email уже существует. Пожалуйста, выполните вход.",
        );
        setIsSignUp(false);
      } else if (err.message?.includes("password")) {
        setError(
          "Пароль должен содержать не менее 6 символов. Пожалуйста, используйте более надежный пароль.",
        );
      } else {
        setError(
          err.message || "Произошла ошибка. Пожалуйста, попробуйте позже.",
        );
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
      console.log("[AUTH_PAGE] Запуск аутентификации через Facebook...");
      await signInWithFacebook();
      // После вызова signInWithFacebook(), Supabase перенаправит пользователя.
      // Дальнейшая логика обработки будет в useEffect, когда пользователь вернется.
    } catch (err: any) {
      console.error(
        "[AUTH_PAGE] Ошибка инициации аутентификации через Facebook:",
        err,
      );
      setError(
        err.message || "Не удалось начать аутентификацию через Facebook.",
      );
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
          onClick={() => navigate("/")}
          className="flex items-center text-gray-400 hover:text-white mb-6"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back
        </button>

        <h1 className="text-3xl font-bold text-white text-center mb-8">
          {accessToken
            ? "Создание нового пароля"
            : isResetPassword
              ? "Сброс пароля"
              : isSignUp
                ? "Создание аккаунта"
                : "Добро пожаловать"}
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
              {isResetPassword ? "Введите ваш email" : "Или продолжить с"}
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
                {showPassword ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path>
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path>
                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path>
                    <line x1="2" x2="22" y1="2" y2="22"></line>
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
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
                {showPassword ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path>
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path>
                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path>
                    <line x1="2" x2="22" y1="2" y2="22"></line>
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
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
                {accessToken
                  ? "Обновить пароль"
                  : isResetPassword
                    ? "Отправить инструкции"
                    : isSignUp
                      ? "Регистрация"
                      : "Вход"}
                <ArrowRight className="h-5 w-5 ml-2" />
              </>
            )}
          </button>
        </form>

        {!isResetPassword && (
          <p className="text-center text-gray-400 mt-4">
            {isSignUp ? "Уже есть аккаунт?" : "Нет аккаунта?"}{" "}
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                clearMessages();
              }}
              className="text-orange-500 font-medium"
            >
              {isSignUp ? "Вход" : "Регистрация"}
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
          Продолжая, вы соглашаетесь с нашей{" "}
          <Link
            to="/privacy-policy"
            className="text-orange-500 hover:text-orange-400"
          >
            Политикой конфиденциальности
          </Link>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;

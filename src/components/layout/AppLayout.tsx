// Расширяем Window, если это не сделано в глобальном файле d.ts
declare global {
  interface Window {
    isNativeApp?: boolean;
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
    nativeAppResumed?: () => void;
    // Функции для обновления данных, которые вы определите или уже используете
    // Эти функции должны быть определены в вашем коде и, в идеале, использовать operationWithRetry
    refreshDeals?: () => Promise<void>;
    refreshPromoCodes?: () => Promise<void>;
    refreshModerationData?: () => Promise<void>;
    // ... другие функции обновления
  }
}

// --- ОБНОВЛЕННАЯ ФУНКЦИЯ window.nativeAppResumed ---
window.nativeAppResumed = async function () {
  console.log(
    "[WEB] App resumed signal received. Waiting briefly before data refresh...",
  );

  // Добавляем небольшую задержку (например, 50 мс), чтобы дать сети "проснуться"
  await new Promise((resolve) => setTimeout(resolve, 50)); // Можете подобрать это значение

  if (!navigator.onLine) {
    console.warn(
      "[WEB] Network is offline after resume delay. Skipping data refresh.",
    );
    // Можно отправить сообщение в RN, чтобы показать пользователю уведомление о сети, если нужно
    // if (window.ReactNativeWebView) {
    //   window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'NETWORK_STATUS', payload: { online: false } }));
    // }
    return;
  }

  console.log(
    "[WEB] Network is online. Attempting to refresh critical data after resume delay...",
  );

  try {
    // Вызовите здесь ваши функции для перезагрузки/обновления данных.
    // Убедитесь, что эти функции существуют и доступны в window или импортированы и вызваны корректно.
    // Они должны использовать operationWithRetry для надежности.

    // Пример:
    if (typeof window.refreshDeals === "function") {
      console.log("[WEB] Calling refreshDeals() on resume...");
      await window.refreshDeals();
    }
    if (typeof window.refreshPromoCodes === "function") {
      console.log("[WEB] Calling refreshPromoCodes() on resume...");
      await window.refreshPromoCodes();
    }
    if (typeof window.refreshModerationData === "function") {
      console.log("[WEB] Calling refreshModerationData() on resume...");
      await window.refreshModerationData();
    }
    // Добавьте вызовы других функций обновления данных, которые подвержены ошибкам при возобновлении

    console.log("[WEB] Data refresh on resume attempted/completed.");
  } catch (error) {
    console.error(
      "[WEB] Error during data refresh triggered by nativeAppResumed:",
      error,
    );
  }
};
// --- КОНЕЦ ОБНОВЛЕННОЙ ФУНКЦИИ ---

// Остальной код вашего AppLayout.tsx из артефакта web_applayout_app_content_ready_v1
// (импорты, сам компонент AppLayout и т.д.)
// Важно: Убедитесь, что useEffect, который отправлял APP_CONTENT_READY из AppLayout,
// либо удален, либо его задержка (veryShortDelay) значительно меньше, чем у этого nativeAppResumed,
// и он не будет конфликтовать. Идеально - если APP_CONTENT_READY шлют сами страницы.
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Outlet, Link, useLocation } from "react-router-dom";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import Header from "../ui/Header";
import Navigation from "../ui/Navigation";
import ScrollToTop from "../ui/ScrollToTop";
import { LogIn, LogOut, Sun, Moon } from "lucide-react";
import { triggerNativeHaptic } from "../../utils/nativeBridge";

const AppLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showSiteChrome, setShowSiteChrome] = useState(true);
  const contentReadySentRef = useRef(false);

  const { t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const activeScreenPath = location.pathname + location.search;

  useEffect(() => {
    const checkEnvironment = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isLikelyGenericWebView =
        userAgent.includes("wv") ||
        userAgent.includes("fbav") ||
        userAgent.includes("instagram") ||
        userAgent.includes("snapchat") ||
        (userAgent.includes("iphone") && !userAgent.includes("safari"));

      const isEmbeddedViaParam = new URLSearchParams(
        window.location.search,
      ).has("embedded");

      if (isLikelyGenericWebView || isEmbeddedViaParam) {
        setShowSiteChrome(false);
      } else {
        // В режиме isNativeApp, CSS будет скрывать хром.
        // showSiteChrome=true позволит JS-логике компонентов хедера/футера работать (если они не проверяют window.isNativeApp напрямую для отключения)
        // и сохранит вашу логику отступов pt-28.
        setShowSiteChrome(true);
      }
      if (window.isNativeApp) {
        console.log(
          "[AppLayout Website] Detected OUR RN app (isNativeApp=true). CSS will hide chrome. showSiteChrome for JS logic remains true (unless other conditions met).",
        );
      }
    };
    checkEnvironment();
  }, []);

  // Этот useEffect может быть не нужен, если конкретные страницы (DealsPage и т.д.)
  // будут сами отправлять APP_CONTENT_READY. Если он остается как fallback,
  // убедитесь, что он не конфликтует с сигналами от дочерних страниц.
  useEffect(() => {
    contentReadySentRef.current = false;
    if (
      window.isNativeApp &&
      window.ReactNativeWebView &&
      !contentReadySentRef.current // Проверка, чтобы отправить только один раз за этот цикл рендера/зависимостей
    ) {
      const initialLayoutReadyDelay = 150; // Очень короткая задержка

      const timer = setTimeout(() => {
        // Дополнительная проверка, так как дочерний компонент мог уже отправить сообщение
        if (!contentReadySentRef.current) {
          console.log(
            `[AppLayout Website - Fallback/Initial Shell] Sending APP_CONTENT_READY after ${initialLayoutReadyDelay}ms for path:`,
            activeScreenPath,
          );
          window.ReactNativeWebView?.postMessage(
            JSON.stringify({ type: "APP_CONTENT_READY" }),
          );
          contentReadySentRef.current = true; // Помечаем, что AppLayout отправил (или попытался)
        }
      }, initialLayoutReadyDelay);

      return () => clearTimeout(timer);
    }
  }, [user, theme, activeScreenPath]);

  const handleAuthClick = async () => {
    setIsSidebarOpen(false);
    if (!user) {
      navigate("/auth");
      return;
    }
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  return (
    <div className={`min-h-screen relative`}>
      <div className="site-header-wrapper">
        <Header onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />
      </div>

      <div
        className={`content-area-for-padding ${showSiteChrome ? "pt-28" : "pt-0"}`}
      >
        <Outlet />
      </div>

      <div className="site-navigation-wrapper">
        <Navigation />
      </div>

      <ScrollToTop />

      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <div
        className={`fixed top-0 left-0 h-full w-64 bg-gray-800 z-30 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {user && (
          <div className="p-4 border-b border-gray-700 flex-shrink-0">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden">
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.email || "User")}&background=random`}
                  alt={user.email || "User Avatar"}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="ml-3">
                <div className="text-white font-medium">
  {user.user_metadata?.display_name || user.email?.split("@")[0]} {/* Предполагаем, что display_name будет в user_metadata */}
</div>
<div className="text-gray-400 text-sm">{user.email}</div>
                <div className="text-gray-400 text-sm">{user.email}</div>
              </div>
            </div>
          </div>
        )}
        <div className="p-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-white text-xl font-bold">{t("common.menu")}</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          <nav className="space-y-2 p-4">
            <Link
              to="/"
              className="block py-2 px-4 text-white hover:bg-gray-700 rounded-md"
              onClick={() => setIsSidebarOpen(false)}
            >
              {t("navigation.deals")}
            </Link>
            <Link
              to="/promos"
              className="block py-2 px-4 text-white hover:bg-gray-700 rounded-md"
              onClick={() => setIsSidebarOpen(false)}
            >
              {t("navigation.promos")}
            </Link>
            <Link
              to="/sweepstakes"
              className="block py-2 px-4 text-white hover:bg-gray-700 rounded-md"
              onClick={() => setIsSidebarOpen(false)}
            >
              {t("navigation.sweepstakes")}
            </Link>
            {user && (
              <>
                <Link
                  to="/saved"
                  className="block py-2 px-4 text-white hover:bg-gray-700 rounded-md"
                  onClick={() => setIsSidebarOpen(false)}
                >
                  {t("navigation.savedItems") || "Saved Items"}
                </Link>
                <Link
                  to="/comments"
                  className="block py-2 px-4 text-white hover:bg-gray-700 rounded-md"
                  onClick={() => setIsSidebarOpen(false)}
                >
                  {t("navigation.myComments") || "My Comments"}
                </Link>
                <Link
                  to="/profile"
                  className="block py-2 px-4 text-white hover:bg-gray-700 rounded-md"
                  onClick={() => setIsSidebarOpen(false)}
                >
                  {t("navigation.profile")}
                </Link>
                <Link
                  to="/settings/notifications"
                  className="block py-2 px-4 text-white hover:bg-gray-700 rounded-md"
                  onClick={() => setIsSidebarOpen(false)}
                >
                  {t("navigation.notificationSettings") ||
                    "Notification Settings"}
                </Link>
              </>
            )}
          </nav>
        </div>
        <div className="p-4 border-t border-gray-700 flex-shrink-0 space-y-2">
          <button
            onClick={() => {
              toggleTheme();
              triggerNativeHaptic("impactMedium");
            }}
            className="w-full flex items-center justify-center py-2 px-4 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors"
          >
            {theme === "light" ? (
              <Moon className="h-5 w-5 mr-2" />
            ) : (
              <Sun className="h-5 w-5 mr-2" />
            )}
            <span>
              {theme === "light" ? t("common.darkMode") : t("common.lightMode")}
            </span>
          </button>
          <button
            onClick={handleAuthClick}
            className="w-full flex items-center justify-center py-2 px-4 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
          >
            {user ? (
              <LogOut className="h-5 w-5 mr-2" />
            ) : (
              <LogIn className="h-5 w-5 mr-2" />
            )}
            <span>{user ? t("auth.signOut") : t("auth.signIn")}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AppLayout;

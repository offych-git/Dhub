// AppLayout.tsx (веб-сайт) - Восстановлены ссылки и кнопки в сайдбаре
import React, { useState, useEffect } from "react";
import { useNavigate, Outlet, Link } from "react-router-dom";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import Header from "../ui/Header";
import Navigation from "../ui/Navigation";
import ScrollToTop from "../ui/ScrollToTop";
import { LogIn, LogOut, Sun, Moon } from "lucide-react";

// Расширяем Window
declare global {
  interface Window {
    isNativeApp?: boolean;
  }
}

const AppLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showSiteChrome, setShowSiteChrome] = useState(true); // По умолчанию показываем

  const { t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

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

      console.log("[AppLayout Website] User Agent:", userAgent);
      console.log(
        "[AppLayout Website] window.isNativeApp (установлено из RN):",
        window.isNativeApp,
      );

      if (window.isNativeApp) {
        setShowSiteChrome(false);
        console.log(
          "[AppLayout Website] Определено как НАШЕ RN приложение (isNativeApp=true). Хедер/футер сайта будут СКРЫТЫ.",
        );
      } else if (isLikelyGenericWebView || isEmbeddedViaParam) {
        setShowSiteChrome(false);
        console.log(
          "[AppLayout Website] Определено как общий WebView или embedded. Хедер/футер сайта будут скрыты.",
        );
      } else {
        setShowSiteChrome(true);
        console.log(
          "[AppLayout Website] Определено как Standalone Browser. Хедер/футер сайта будут показаны.",
        );
      }
    };

    checkEnvironment();
    const timeoutId = setTimeout(checkEnvironment, 300);

    return () => clearTimeout(timeoutId);
  }, []);

  const handleAuthClick = async () => {
    setIsSidebarOpen(false);
    if (!user) {
      navigate("/auth");
      return;
    }
    try {
      await signOut();
      navigate("/"); // или '/auth' если хотите перенаправлять на страницу входа после выхода
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  console.log("[AppLayout Website] Rendering. showSiteChrome:", showSiteChrome);

  return (
    <div className={`min-h-screen relative`}>
      <Header
        onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
        style={{ display: showSiteChrome ? "flex" : "none" }}
      />

      <div className={showSiteChrome ? "pt-28" : "pt-0"}>
        <Outlet />
      </div>

      {showSiteChrome && <Navigation />}

      <ScrollToTop />

      {/* Sidebar overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
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
                  {user.email?.split("@")[0]}
                </div>
                <div className="text-gray-400 text-sm">{user.email}</div>
              </div>
            </div>
          </div>
        )}
        <div className="p-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-white text-xl font-bold">{t("common.menu")}</h2>
        </div>
        {/* !!!!! ВОССТАНОВЛЕННЫЕ ССЫЛКИ !!!!! */}
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
            {/* Добавьте сюда другие общие ссылки, если они были */}
            {user && ( // Ссылки, доступные только авторизованным пользователям
              <>
                <Link
                  to="/saved"
                  className="block py-2 px-4 text-white hover:bg-gray-700 rounded-md"
                  onClick={() => setIsSidebarOpen(false)}
                >
                  {t("navigation.savedItems") || "Saved Items"}{" "}
                  {/* Используем t() или фолбэк */}
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
                {/* Добавьте другие ссылки для авторизованных пользователей */}
              </>
            )}
          </nav>
        </div>
        {/* !!!!! ВОССТАНОВЛЕННЫЕ КНОПКИ !!!!! */}
        <div className="p-4 border-t border-gray-700 flex-shrink-0 space-y-2">
          <button
            onClick={toggleTheme}
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

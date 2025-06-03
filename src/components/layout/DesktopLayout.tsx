import React, { useState, useEffect } from "react";
import { useNavigate, Outlet, Link, useLocation } from "react-router-dom";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import {
  LogIn,
  LogOut,
  Sun,
  Moon,
  Search,
  Bell,
  Plus,
  Menu,
} from "lucide-react";
import SearchBar from "../ui/SearchBar";
import AddDealMenu from "../deals/AddDealMenu";
import NotificationBell from "../notifications/NotificationBell";

const DesktopLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const { t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleAuthClick = async () => {
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
    // ГЛАВНОЕ ИЗМЕНЕНИЕ: Убираем min-h-screen отсюда.
    // Вместо этого, h-full для всех дочерних элементов flex.
    // Для фиксированной высоты всего приложения, лучше управлять это через глобальный CSS
    // и позволить flexbox делать свою работу.
    // Если вам нужен *фон* на весь экран, сохраните bg-gray-900 здесь.
    <div className="bg-gray-900 flex h-screen w-screen">
      {/* Sidebar */}
      {/* h-screen: Сайдбар ВСЕГДА занимает 100% высоты viewport'а.
          flex flex-col: Элементы внутри сайдбара располагаются вертикально. */}
      <div
        className={`${isSidebarOpen ? "w-64" : "w-16"} bg-gray-800 border-r border-gray-700 transition-all duration-300 flex flex-col h-screen`}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            {isSidebarOpen && (
              <h1 className="text-xl font-bold text-white">
                Deals & Discounts
              </h1>
            )}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-700"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* User Info */}
        {user && (
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden flex-shrink-0">
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.email || "User")}&background=random`}
                  alt={user.email || "User Avatar"}
                  className="w-full h-full object-cover"
                />
              </div>
              {isSidebarOpen && (
                <div className="ml-3 min-w-0">
                  <div className="text-white font-medium truncate">
                    {user.email?.split("@")[0]}
                  </div>
                  <div className="text-gray-400 text-sm truncate">
                    {user.email}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        {/* flex-1: Навигация будет занимать ВСЕ оставшееся вертикальное пространство
                     внутри сайдбара, выталкивая "Bottom Actions" на самый низ.
            overflow-y-auto: Если ссылок станет очень много, прокрутка будет только внутри навигации.
        */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <Link
            to="/"
            className={`flex items-center py-3 px-3 text-white hover:bg-gray-700 rounded-lg transition-colors ${
              location.pathname === "/" ? "bg-gray-700" : ""
            }`}
          >
            <div className="w-5 h-5 mr-3 flex-shrink-0">🔥</div>
            {isSidebarOpen && <span>{t("navigation.deals")}</span>}
          </Link>
          <Link
            to="/promos"
            className={`flex items-center py-3 px-3 text-white hover:bg-gray-700 rounded-lg transition-colors ${
              location.pathname === "/promos" ? "bg-gray-700" : ""
            }`}
          >
            <div className="w-5 h-5 mr-3 flex-shrink-0">🎫</div>
            {isSidebarOpen && <span>{t("navigation.promos")}</span>}
          </Link>
          <Link
            to="/sweepstakes"
            className={`flex items-center py-3 px-3 text-white hover:bg-gray-700 rounded-lg transition-colors ${
              location.pathname === "/sweepstakes" ? "bg-gray-700" : ""
            }`}
          >
            <div className="w-5 h-5 mr-3 flex-shrink-0">🎁</div>
            {isSidebarOpen && <span>{t("navigation.sweepstakes")}</span>}
          </Link>

          {user && (
            <>
              <div className="border-t border-gray-700 my-4"></div>
              <Link
                to="/saved"
                className={`flex items-center py-3 px-3 text-white hover:bg-gray-700 rounded-lg transition-colors ${
                  location.pathname === "/saved" ? "bg-gray-700" : ""
                }`}
              >
                <div className="w-5 h-5 mr-3 flex-shrink-0">💾</div>
                {isSidebarOpen && (
                  <span>{t("navigation.savedItems") || "Saved Items"}</span>
                )}
              </Link>
              <Link
                to="/comments"
                className={`flex items-center py-3 px-3 text-white hover:bg-gray-700 rounded-lg transition-colors ${
                  location.pathname === "/comments" ? "bg-gray-700" : ""
                }`}
              >
                <div className="w-5 h-5 mr-3 flex-shrink-0">💬</div>
                {isSidebarOpen && (
                  <span>{t("navigation.myComments") || "My Comments"}</span>
                )}
              </Link>
              <Link
                to="/profile"
                className={`flex items-center py-3 px-3 text-white hover:bg-gray-700 rounded-lg transition-colors ${
                  location.pathname === "/profile" ? "bg-gray-700" : ""
                }`}
              >
                <div className="w-5 h-5 mr-3 flex-shrink-0">👤</div>
                {isSidebarOpen && <span>{t("navigation.profile")}</span>}
              </Link>
            </>
          )}
        </nav>

        {/* Bottom Actions - Прижаты к низу сайдбара */}
        <div className="p-4 border-t border-gray-700 space-y-2">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-center py-2 px-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            {theme === "light" ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
            {isSidebarOpen && (
              <span className="ml-2">
                {theme === "light"
                  ? t("common.darkMode")
                  : t("common.lightMode")}
              </span>
            )}
          </button>
          <button
            onClick={handleAuthClick}
            className="w-full flex items-center justify-center py-2 px-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            {user ? (
              <LogOut className="h-5 w-5" />
            ) : (
              <LogIn className="h-5 w-5" />
            )}
            {isSidebarOpen && (
              <span className="ml-2">
                {user ? t("auth.signOut") : t("auth.signIn")}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      {/* flex-1: занимает оставшееся горизонтальное пространство.
          flex flex-col: его содержимое (хедер, основная область) располагается по вертикали.
          h-screen: также занимает 100% высоты viewport'а, как и сайдбар. */}
      <div className="flex-1 flex flex-col h-screen">
        {/* Top Header */}
        <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 max-w-2xl">
              <SearchBar />
            </div>
            <div className="flex items-center space-x-4 ml-6">
              {user && (
                <>
                  <NotificationBell />
                  <button
                    onClick={() => setIsAddMenuOpen(true)}
                    className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors flex items-center"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Content
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        {/* flex-1: заставляет main растянуться на всю оставшуюся ВЕРТИКАЛЬНУЮ высоту
                     внутри своего родителя (который является flex-контейнером с flex-col).
            overflow-y-auto: добавляет прокрутку только ВНУТРИ этого main элемента,
                             если его контент слишком велик. */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Add Deal Menu */}
      <AddDealMenu
        isOpen={isAddMenuOpen}
        onClose={() => setIsAddMenuOpen(false)}
      />
    </div>
  );
};

export default DesktopLayout;

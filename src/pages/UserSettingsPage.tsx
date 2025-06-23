// UserSettingsPage.tsx
import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  LogOut,
  KeyRound,
  Trash2,
  Globe2,
  Pencil,
  Check,
  X,
  Sun,
  Moon,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useTheme } from "../contexts/ThemeContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { cleanupUserData } from "../utils/accountUtils";

const UserSettingsPage: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [email, setEmail] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);

  // Существующий useEffect для загрузки профиля
  useEffect(() => {
    if (user) {
      loadUserProfile();
    } else {
      setDisplayName("");
      setOriginalName("");
      setEmail("");
    }
  }, [user]);

  // ИЗМЕНЕННЫЙ useEffect для отправки заголовка в React Native приложение
  useEffect(() => {
    const pageTitle = "Settings"; // Заголовок для этой страницы (соответствует h1)
    console.log(
      `[${pageTitle} Web Page] INFO: useEffect для отправки заголовка запущен (с небольшой задержкой).`,
    );

    const timerId = setTimeout(() => {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        console.log(
          `[${pageTitle} Web Page] INFO: Отправляю заголовок "${pageTitle}" после задержки.`,
        );
        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: "SET_NATIVE_HEADER_TITLE",
            title: pageTitle,
          }),
        );
      } else {
        console.warn(
          `[${pageTitle} Web Page] WARN: ReactNativeWebView.postMessage НЕ ДОСТУПЕН (после задержки).`,
        );
      }
    }, 50); // Небольшая задержка в 50 миллисекунд

    return () => clearTimeout(timerId); // Очистка таймера при размонтировании компонента
  }, []);

  const handleSignOut = async () => {
    try {
      setLoading(true);
      setError(null);
      await signOut();
    } catch (error) {
      console.error("Error signing out:", error);
      navigate("/auth");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) throw error;

      setSuccess("Password reset instructions have been sent to your email");
      setShowPasswordModal(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      if (!user) return;
      setLoading(true);
      setError(null);
      console.log("Начало процедуры удаления данных пользователя:", user.id);

      await cleanupUserData(user.id);

      const { error: profilesError, data: deletedProfile } = await supabase
        .from("profiles")
        .delete()
        .eq("id", user.id)
        .select();

      if (profilesError) {
        console.error("Ошибка при удалении профиля:", profilesError);
        throw profilesError;
      }
      console.log("Профиль успешно удален:", deletedProfile);

      console.log("Выход из всех сессий Supabase...");
      await supabase.auth.signOut({ scope: "global" });

      console.log("Локальный выход из AuthContext...");
      await signOut();

      setSuccess("Ваша учетная запись успешно деактивирована");
      setShowDeleteModal(false);
    } catch (error: any) {
      console.error("Ошибка при удалении аккаунта:", error);
      setError(
        error.message ||
          "Не удалось удалить аккаунт. Пожалуйста, попробуйте позже.",
      );
    } finally {
      setLoading(false);
    }
  };

  const loadUserProfile = async () => {
    if (!user?.id) return;
    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("display_name, email")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      const name = profile?.display_name || user.email?.split("@")[0] || "";
      setDisplayName(name);
      setOriginalName(name);
      setEmail(user.email || "");
    } catch (err) {
      console.error("Error loading profile:", err);
    }
  };

  const handleNameEdit = () => {
    setOriginalName(displayName);
    setIsEditingName(true);
  };

  const handleNameSave = async () => {
    if (!user || !displayName.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: displayName.trim() })
        .eq("id", user.id);

      if (error) throw error;

      setOriginalName(displayName.trim());
      setIsEditingName(false);
      setSuccess("Имя успешно обновлено");

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
      setDisplayName(originalName);
    } finally {
      setLoading(false);
    }
  };

  const handleNameCancel = () => {
    setDisplayName(originalName);
    setIsEditingName(false);
  };

  const languages = [
    { code: "en", label: "English" },
    { code: "ru", label: "Русский" },
    { code: "es", label: "Español" },
  ];

  return (
    // Убрал pt-0, если он был, так как отступ основного контента будет управляться ниже
    <div className="pb-16 bg-gray-900 min-h-screen">
      {/* ИЗМЕНЕНО: Добавлен класс web-page-header */}
      <div className="web-page-header fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 px-4 py-3 z-10">
        <div className="flex items-center">
          <button onClick={() => navigate(-1)} className="text-white">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-white font-medium ml-4">Settings</h1>
        </div>
      </div>

      {/* ИЗМЕНЕНО: Добавлен класс main-content-area и отступ pt-16 (примерно высота хедера) */}
      {/* Ваш существующий pt-4 будет действовать, если бы хедер не был fixed. 
          Так как он fixed, нужен отступ равный его высоте. */}
      <div className="main-content-area px-4 pt-0">
        {error && (
          <div className="bg-red-500/90 text-white px-4 py-2 rounded-lg mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-500/90 text-white px-4 py-2 rounded-lg mb-4">
            {success}
          </div>
        )}
        {user && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <div className="flex items-center mb-4">
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || "U")}&background=random`}
                alt="Avatar"
                className="w-12 h-12 rounded-full mr-4"
              />
              <div className="flex-1">
                <div className="flex items-center">
                  {isEditingName ? (
                    <div className="flex items-center space-x-2 w-full">
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="bg-gray-700 text-white px-2 py-1 rounded flex-1"
                        autoFocus
                        maxLength={50}
                      />
                      <button
                        onClick={handleNameSave}
                        disabled={
                          loading ||
                          !displayName.trim() ||
                          displayName === originalName
                        }
                        className="text-green-500 hover:text-green-400 disabled:opacity-50 p-1"
                      >
                        <Check className="h-5 w-5" />
                      </button>
                      <button
                        onClick={handleNameCancel}
                        className="text-red-500 hover:text-red-400 p-1"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <h2 className="text-white text-lg font-medium truncate">
                        {displayName}
                      </h2>
                      <button
                        onClick={handleNameEdit}
                        className="ml-2 text-gray-400 hover:text-orange-500 cursor-pointer transition-colors p-1"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
                <p className="text-gray-400 truncate">{email}</p>
              </div>
            </div>

            <div className="divide-y divide-gray-700">
              <div className="px-4 py-3 flex items-center">
                {theme === "light" ? (
                  <Sun className="h-5 w-5 text-orange-500 mr-3" />
                ) : (
                  <Moon className="h-5 w-5 text-orange-500 mr-3" />
                )}
                <button
                  onClick={toggleTheme}
                  className="text-white flex-1 text-left"
                >
                  Theme
                </button>
                <span className="ml-auto text-gray-400 capitalize">
                  {theme}
                </span>
              </div>
              <div className="px-4 py-3 flex items-center">
                <Globe2 className="h-5 w-5 text-orange-500 mr-3" />
                <button
                  onClick={() => setShowLanguageModal(true)}
                  className="text-white flex-1 text-left"
                >
                  Language
                </button>
                <span className="ml-auto text-gray-400">
                  {languages.find((l) => l.code === language)?.label ||
                    language}
                </span>
              </div>
              <div className="px-4 py-3 flex items-center">
                <KeyRound className="h-5 w-5 text-orange-500 mr-3" />
                <button
                  onClick={() => setShowPasswordModal(true)}
                  className="text-white flex-1 text-left"
                >
                  Change Password
                </button>
              </div>
              <div className="px-4 py-3 flex items-center">
                <Trash2 className="h-5 w-5 text-red-500 mr-3" />
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="text-white flex-1 text-left"
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        )}
        {user && (
          <button
            onClick={handleSignOut}
            disabled={loading}
            className="w-full bg-gray-800 text-white py-3 rounded-lg flex items-center justify-center disabled:opacity-50 hover:bg-gray-700"
          >
            <LogOut className="h-5 w-5 text-orange-500 mr-2" />
            <span>{(loading && "Signing out...") || "Sign Out"}</span>
          </button>
        )}
      </div>

      {showLanguageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-white text-lg font-medium mb-4">
              Select Language
            </h3>
            <div className="space-y-2">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    setLanguage(lang.code as "en" | "ru" | "es");
                    setShowLanguageModal(false);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
                    language === lang.code
                      ? "bg-orange-500 text-white font-semibold"
                      : "bg-gray-700 text-white hover:bg-gray-600"
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowLanguageModal(false)}
              className="mt-6 w-full bg-gray-600 text-gray-300 py-2 rounded-md hover:bg-gray-500 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-white text-lg font-medium mb-4">
              Change Password
            </h3>
            <p className="text-gray-300 mb-6">
              We'll send you an email with instructions to change your password.
            </p>
            {/* Отображение ошибок/успеха для смены пароля можно разместить здесь, если они специфичны для модалки */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setError(null); // Сброс общих ошибок страницы при закрытии
                  setSuccess(null);
                }}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordReset}
                disabled={loading}
                className="bg-orange-500 text-white px-4 py-2 rounded-md hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Instructions"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-white text-lg font-medium mb-4">
              Delete Account
            </h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete your account? This action cannot
              be undone. All your data will be permanently removed.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setError(null); // Сброс общих ошибок
                }}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={loading}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {loading ? "Deleting..." : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserSettingsPage;

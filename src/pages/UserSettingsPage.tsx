import React, { useState, useEffect } from 'react';
import { ArrowLeft, LogOut, KeyRound, Trash2, Globe2, Pencil, Check, X, Sun, Moon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { cleanupUserData } from '../utils/accountUtils';

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
  const [displayName, setDisplayName] = useState(''); // Added
  const [originalName, setOriginalName] = useState(''); // Для редактирования имени
  const [email, setEmail] = useState(''); // Added
  const [isEditingName, setIsEditingName] = useState(false); // Для редактирования имени


  const handleSignOut = async () => {
    try {
      setLoading(true);
      setError(null);
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      navigate('/auth');
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

      setSuccess('Password reset instructions have been sent to your email');
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

      console.log('Начало процедуры удаления данных пользователя:', user.id);

      await cleanupUserData(user.id);

      const { error: profilesError, data: deletedProfile } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id)
        .select();

      if (profilesError) {
        console.error('Ошибка при удалении профиля:', profilesError);
        throw profilesError;
      }

      console.log('Профиль успешно удален:', deletedProfile);

      console.log('Выход из всех сессий...');
      await supabase.auth.signOut({ scope: 'global' });

      console.log('Локальный выход...');
      await signOut();

      setSuccess('Ваша учетная запись успешно деактивирована');

      setTimeout(() => {
        navigate('/auth');
      }, 2000);
    } catch (error: any) {
      console.error('Ошибка при удалении аккаунта:', error);
      setError(error.message || 'Не удалось удалить аккаунт. Пожалуйста, попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  const loadUserProfile = async () => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('display_name, email')
        .eq('id', user?.id)
        .single();

      if (error) throw error;

      const name = profile?.display_name || user?.email?.split('@')[0] || '';
      setDisplayName(name);
      setOriginalName(name);
      setEmail(user?.email || '');
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  };
  
  const handleNameEdit = () => {
    setIsEditingName(true);
  };

  const handleNameSave = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: displayName.trim() })
        .eq('id', user.id);

      if (error) throw error;

      setOriginalName(displayName);
      setIsEditingName(false);
      setSuccess('Имя успешно обновлено');

      // Очистка сообщения об успехе через 3 секунды
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

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  const languages = [
    { code: 'en', label: 'English' },
    { code: 'ru', label: 'Русский' },
    { code: 'es', label: 'Español' }
  ];

  return (
    <div className="pb-16 pt-0 bg-gray-900 min-h-screen">
      <div className="fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 px-4 py-3 z-10">
        <div className="flex items-center">
          <button onClick={() => navigate(-1)} className="text-white">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-white font-medium ml-4">User Settings</h1>
        </div>
      </div>

      <div className="px-4 pt-4">
        {error && (
          <div className="bg-red-500 text-white px-4 py-2 rounded mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-500 text-white px-4 py-2 rounded mb-4">
            {success}
          </div>
        )}

        {/* User Profile Information */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`} alt="Avatar" className="w-12 h-12 rounded-full mr-4"/>
            <div className="flex-1">
              <div className="flex items-center">
                {isEditingName ? (
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="bg-gray-700 text-white px-2 py-1 rounded"
                      autoFocus
                    />
                    <button
                      onClick={handleNameSave}
                      disabled={loading || !displayName.trim()}
                      className="text-green-500 hover:text-green-400 disabled:opacity-50"
                    >
                      <Check className="h-5 w-5" />
                    </button>
                    <button
                      onClick={handleNameCancel}
                      className="text-red-500 hover:text-red-400"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <h2 className="text-white text-lg font-medium">{displayName}</h2>
                    <button
                      onClick={handleNameEdit}
                      className="ml-2 text-gray-400 hover:text-orange-500 cursor-pointer transition-colors"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
              <p className="text-gray-400">{email}</p>
            </div>
          </div>

          {/* Settings menu */}
          <div className="divide-y divide-gray-700">
            <div className="px-4 py-3 flex items-center">
              {theme === 'light' ? (
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
              <span className="ml-auto text-gray-400">
                {theme === 'light' ? 'Light' : 'Dark'}
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
                {language === 'en' ? 'English' : language === 'ru' ? 'Русский' : 'Español'}
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


        {/* Sign Out button */}
        <button
          onClick={handleSignOut}
          disabled={loading}
          className="w-full bg-gray-800 text-white py-3 rounded-lg flex items-center justify-center disabled:opacity-50"
        >
          <LogOut className="h-5 w-5 text-orange-500 mr-2" />
          <span>{loading ? 'Signing out...' : 'Sign Out'}</span>
        </button>
      </div>

      {/* Language Modal */}
      {showLanguageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-white text-lg font-medium mb-4">Select Language</h3>
            <div className="space-y-2">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    setLanguage(lang.code as 'en' | 'ru' | 'es');
                    setShowLanguageModal(false);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-md ${
                    language === lang.code
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-700 text-white hover:bg-gray-600'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowLanguageModal(false)}
              className="mt-4 w-full bg-gray-700 text-white py-2 rounded-md hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-white text-lg font-medium mb-4">Change Password</h3>
            <p className="text-gray-300 mb-4">
              We'll send you an email with instructions to change your password.
            </p>
            {error && (
              <div className="bg-red-500 text-white px-4 py-2 rounded mb-4">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-500 text-white px-4 py-2 rounded mb-4">
                {success}
              </div>
            )}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="px-4 py-2 text-white hover:text-gray-300"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordReset}
                disabled={loading}
                className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600"
              >
                {loading ? 'Sending...' : 'Send Instructions'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-white text-lg font-medium mb-4">Delete Account</h3>
            <p className="text-gray-300 mb-4">
              Are you sure you want to delete your account? This action cannot be undone.
            </p>
            {error && (
              <div className="bg-red-500 text-white px-4 py-2 rounded mb-4">
                {error}
              </div>
            )}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-white hover:text-gray-300"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={loading}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
              >
                {loading ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserSettingsPage;
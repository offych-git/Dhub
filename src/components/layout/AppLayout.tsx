import React, { useState } from 'react';
import { useNavigate, Outlet, Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import Header from '../ui/Header';
import Navigation from '../ui/Navigation';
import { LogIn, LogOut, Sun, Moon } from 'lucide-react';

const AppLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  
  const handleAuthClick = async () => {
    setIsSidebarOpen(false);
    
    if (!user) {
      navigate('/auth');
      return;
    }
    
    try {
      await signOut();
      navigate('/auth');
    } catch (error) {
      console.error('Sign out failed:', error);
      navigate('/auth');
    }
  };
  
  return (
    <div className={`min-h-screen relative`}>
      <Header onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />
      
      {/* Main content с учетом высоты Header и SearchBar */}
      <div className="pt-28">
        <Outlet />
      </div>
      
      {/* Bottom navigation */}
      <Navigation />
      
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
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* User section */}
        {user && (
          <div className="p-4 border-b border-gray-700 flex-shrink-0">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden">
                <img
                  src={`https://ui-avatars.com/api/?name=${user.email}&background=random`}
                  alt={user.email}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="ml-3">
                <div className="text-white font-medium">{user.email?.split('@')[0]}</div>
                <div className="text-gray-400 text-sm">{user.email}</div>
              </div>
            </div>
          </div>
        )}
        
        <div className="p-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-white text-xl font-bold">{t('common.menu')}</h2>
        </div>
        
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <nav className="space-y-2">
              <Link to="/" className="block py-2 px-4 text-white hover:bg-gray-700 rounded-md" onClick={() => setIsSidebarOpen(false)}>
                {t('navigation.deals')}
              </Link>
              <Link to="/promos" className="block py-2 px-4 text-white hover:bg-gray-700 rounded-md" onClick={() => setIsSidebarOpen(false)}>
                {t('navigation.promos')}
              </Link>
              <Link to="/categories" className="block py-2 px-4 text-white hover:bg-gray-700 rounded-md" onClick={() => setIsSidebarOpen(false)}>
                {t('navigation.categories')}
              </Link>
              {user && (
                <>
                  <Link to="/saved" className="block py-2 px-4 text-white hover:bg-gray-700 rounded-md" onClick={() => setIsSidebarOpen(false)}>
                    Saved Items
                  </Link>
                  <Link to="/comments" className="block py-2 px-4 text-white hover:bg-gray-700 rounded-md" onClick={() => setIsSidebarOpen(false)}>
                    My Comments
                  </Link>
                  <Link to="/profile" className="block py-2 px-4 text-white hover:bg-gray-700 rounded-md" onClick={() => setIsSidebarOpen(false)}>
                    {t('navigation.profile')}
                  </Link>
                  <Link to="/settings/notifications" className="block py-2 px-4 text-white hover:bg-gray-700 rounded-md" onClick={() => setIsSidebarOpen(false)}>
                    Notification Settings
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>

        {/* Action buttons - Fixed at bottom */}
        <div className="p-4 border-t border-gray-700 flex-shrink-0 space-y-2">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-center py-2 px-4 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors"
          >
            {theme === 'light' ? (
              <>
                <Moon className="h-5 w-5 mr-2" />
                <span>Dark Mode</span>
              </>
            ) : (
              <>
                <Sun className="h-5 w-5 mr-2" />
                <span>Light Mode</span>
              </>
            )}
          </button>
          
          <button
            onClick={handleAuthClick}
            className="w-full flex items-center justify-center py-2 px-4 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
          >
            {user ? (
              <>
                <LogOut className="h-5 w-5 mr-2" />
                <span>{t('auth.signOut')}</span>
              </>
            ) : (
              <>
                <LogIn className="h-5 w-5 mr-2" />
                <span>{t('auth.signIn')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AppLayout;
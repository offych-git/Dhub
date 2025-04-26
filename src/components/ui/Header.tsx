import React, { useState } from 'react';
import { Bell, PlusCircle, Menu, Info } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import AddDealMenu from '../deals/AddDealMenu';
import NotificationBell from '../notifications/NotificationBell';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const location = useLocation();
  const { t } = useLanguage();
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  
  const getTitle = () => {
    switch (location.pathname) {
      case '/':
        return t('navigation.deals');
      case '/promos':
        return t('navigation.promos');
      case '/discussions':
        return t('navigation.discussions');
      case '/categories':
        return t('navigation.categories');
      case '/profile':
        return t('navigation.profile');
      case '/settings/notifications':
        return t('navigation.notificationSettings');
      default:
        return t('navigation.deals');
    }
  };

  return (
    <header className="bg-gray-900 py-3 px-4 flex items-center justify-between fixed top-0 left-0 right-0 z-10">
      <div className="flex items-center w-full">
        <button onClick={onMenuClick} className="mr-4">
          <Menu className="h-6 w-6 text-white" />
        </button>
        <h1 className="text-2xl font-bold text-white flex-1">{getTitle()}</h1>
        <div className="flex items-center space-x-4">
          <NotificationBell />
          <button onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}>
            <PlusCircle className="h-6 w-6 text-white" />
          </button>
        </div>
      </div>

      <AddDealMenu 
        isOpen={isAddMenuOpen}
        onClose={() => setIsAddMenuOpen(false)}
      />
    </header>
  );
};

export default Header;
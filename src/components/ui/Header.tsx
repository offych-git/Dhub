// Header.tsx
import React, { useState, useEffect, useCallback } from "react";
import { PlusCircle, Menu, Search } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useLanguage } from "../../contexts/LanguageContext";
import AddDealMenu from "../deals/AddDealMenu";
import NotificationBell from "../notifications/NotificationBell";
import SearchBar from "./SearchBar";
import {
  registerSideMenuHandler,
  registerAddMenuHandler,
} from "../../utils/globalInteractions";
import PromoBanner from "../layout/PromoBanner"; // Убедитесь, что путь к PromoBanner верный

interface HeaderProps {
  onMenuClick: () => void;
  style?: React.CSSProperties;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, style }) => {
  const location = useLocation();
  const { t } = useLanguage();
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  const toggleAddMenuVisibility = useCallback(() => {
    setIsAddMenuOpen((prevIsOpen) => !prevIsOpen);
  }, []);

  useEffect(() => {
    registerAddMenuHandler(toggleAddMenuVisibility);
    return () => {
      registerAddMenuHandler(null);
    };
  }, [toggleAddMenuVisibility]);

  useEffect(() => {
    registerSideMenuHandler(onMenuClick);
    return () => {
      registerSideMenuHandler(null);
    };
  }, [onMenuClick]);

  const getTitle = () => {
    // Проверяем специальные пути для детальных страниц
    if (location.pathname.startsWith('/deals/') && location.pathname !== '/deals/new') {
      return t("navigation.dealDetails");
    }
    if (location.pathname.startsWith('/promos/') && !location.pathname.includes('/edit')) {
      return t("navigation.promoDetails");
    }
    if (location.pathname.startsWith('/sweepstakes/') && !location.pathname.includes('/edit')) {
      return t("navigation.sweepstakeDetails");
    }
    
    // Обычные пути
    switch (location.pathname) {
      case "/":
        return t("navigation.deals");
      case "/promos":
        return t("navigation.promos");
      case "/discussions":
        return t("navigation.discussions");
      case "/categories":
        return t("navigation.categories");
      case "/profile":
        return t("navigation.profile");
      case "/settings/notifications":
        return t("navigation.notificationSettings");
      case "/sweepstakes":
        return "Sweepstakes";
      case "/moderation":
        return t("navigation.moderation");
      case "/moderation/settings":
        return t("navigation.moderation");
      default:
        return t("navigation.deals");
    }
  };

  return (
    <header 
      className="bg-gray-900 fixed top-0 left-0 right-0 z-20"
      style={style}
    >
      <PromoBanner />

      <div className="py-2 px-4 flex flex-col">
        <div className="flex items-center w-full">
          <button onClick={onMenuClick} className="mr-4">
            <Menu className="h-6 w-6 text-white" />
          </button>
          <h1 className="text-2xl font-bold text-white flex-1">{getTitle()}</h1>
          <div className="flex items-center space-x-2">
            <button onClick={() => setIsSearchVisible(prev => !prev)} className="p-2">
              <Search className="h-6 w-6 text-white" />
            </button>
            <NotificationBell />
            <button onClick={toggleAddMenuVisibility}>
              <PlusCircle className="h-6 w-6 text-white" />
            </button>
          </div>
        </div>

        <div className={`transition-all duration-300 ease-in-out ${isSearchVisible ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
          <SearchBar />
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

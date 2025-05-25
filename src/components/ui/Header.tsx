// Header.tsx
import React, { useState, useEffect, useCallback } from "react"; // Добавили useCallback
import { Bell, PlusCircle, Menu } from "lucide-react"; // Убрал Info, если не используется
import { useLocation } from "react-router-dom";
import { useLanguage } from "../../contexts/LanguageContext";
import AddDealMenu from "../deals/AddDealMenu";
import NotificationBell from "../notifications/NotificationBell";
import SearchBar from "./SearchBar";
import {
  registerSideMenuHandler,
  registerAddMenuHandler,
} from "../../utils/globalInteractions";

interface HeaderProps {
  onMenuClick: () => void; // Предполагаем, что onMenuClick стабильна или обернута в useCallback в AppLayout
  style?: React.CSSProperties;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, style }) => {
  const location = useLocation();
  const { t } = useLanguage();
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  // Стабильная функция для переключения состояния isAddMenuOpen
  const toggleAddMenuVisibility = useCallback(() => {
    console.log("САЙТ (Header.tsx): Вызвана toggleAddMenuVisibility");
    setIsAddMenuOpen((prevIsOpen) => {
      console.log(
        "САЙТ (Header.tsx): Меняем isAddMenuOpen с",
        prevIsOpen,
        "на",
        !prevIsOpen,
      );
      return !prevIsOpen;
    });
  }, [setIsAddMenuOpen]); // setIsAddMenuOpen стабильна

  useEffect(() => {
    // Регистрация обработчика бокового меню (onMenuClick должна быть стабильной)
    // Если onMenuClick передается из AppLayout, убедитесь, что она обернута в useCallback там
    // registerSideMenuHandler(onMenuClick);

    // Регистрация обработчика меню добавления
    console.log(
      "САЙТ (Header.tsx): Регистрируем toggleAddMenuVisibility через registerAddMenuHandler",
    );
    registerAddMenuHandler(toggleAddMenuVisibility);

    return () => {
      console.log(
        "САЙТ (Header.tsx): Удаляем регистрацию toggleAddMenuVisibility",
      );
      registerAddMenuHandler(null);
      // registerSideMenuHandler(null); // Если регистрировали
    };
    // }, [onMenuClick, toggleAddMenuVisibility]);
    // Если onMenuClick может меняться, ее нужно добавить, но она должна быть стабильной.
    // Для простоты пока оставим так, но обратите внимание на стабильность onMenuClick.
    // Если onMenuClick не используется для registerSideMenuHandler внутри этого useEffect, то можно убрать.
    // Для registerSideMenuHandler лучше отдельный useEffect, если onMenuClick передается как prop.
    // Этот useEffect сейчас отвечает только за addMenu.
  }, [toggleAddMenuVisibility]);

  // Отдельный useEffect для registerSideMenuHandler, если onMenuClick приходит из props
  useEffect(() => {
    console.log(
      "САЙТ (Header.tsx): Регистрируем onMenuClick через registerSideMenuHandler",
    );
    registerSideMenuHandler(onMenuClick);
    return () => {
      console.log("САЙТ (Header.tsx): Удаляем регистрацию onMenuClick");
      registerSideMenuHandler(null);
    };
  }, [onMenuClick]); // Зависит от onMenuClick

  const getTitle = () => {
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
      className="bg-gray-900 py-3 px-4 flex flex-col fixed top-0 left-0 right-0 z-10"
      style={style}
    >
      <div className="flex items-center w-full">
        <button onClick={onMenuClick} className="mr-4">
          {" "}
          {/* Этот onMenuClick - для бокового меню */}
          <Menu className="h-6 w-6 text-white" />
        </button>
        <h1 className="text-2xl font-bold text-white flex-1">{getTitle()}</h1>
        <div className="flex items-center space-x-4">
          <NotificationBell />
          <button onClick={toggleAddMenuVisibility}>
            {" "}
            {/* Используем новую стабильную функцию */}
            <PlusCircle className="h-6 w-6 text-white" />
          </button>
        </div>
      </div>

      <SearchBar />

      <AddDealMenu
        isOpen={isAddMenuOpen}
        onClose={() => setIsAddMenuOpen(false)} // onClose также должен использовать стабильную функцию или прямое изменение
        // Здесь setIsAddMenuOpen(false) - нормально.
      />
    </header>
  );
};

export default Header;

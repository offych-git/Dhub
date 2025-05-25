// AddDealMenu.tsx
import React, { useEffect, useState } from "react"; // Добавили useEffect, useState
import ReactDOM from "react-dom"; // НУЖНО ДЛЯ ПОРТАЛА
import { Link } from "react-router-dom";
import { useLanguage } from "../../contexts/LanguageContext";

interface AddDealMenuProps {
  isOpen: boolean;
  onClose: () => void; // onClose используется для закрытия по клику на фон
}

// Расширяем Window, если это еще не сделано глобально (на случай если этот файл используется отдельно)
declare global {
  interface Window {
    isNativeApp?: boolean;
  }
}

const AddDealMenu: React.FC<AddDealMenuProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isOpen || !isClient) return null; // Не рендерим ничего, если не открыто или не на клиенте

  const menuContent = (
    // Для портальной версии id="portal-add-menu", для обычной - другой или без id
    // Классы также условные: fixed для портала, absolute для сайта
    <div
      id={window.isNativeApp ? "portal-add-menu" : "web-add-menu-dropdown"}
      className={
        window.isNativeApp
          ? "add-menu-dropdown fixed w-64 rounded-md shadow-lg z-[200000] bg-gray-800 text-white overflow-hidden" // Стили для ПОРТАЛА (top/left из RN)
          : "add-menu-dropdown absolute right-4 top-24 w-64 bg-gray-800 rounded-lg shadow-lg overflow-hidden z-50 text-white" // Стили для САЙТА (как было у вас)
      }
      // Чтобы клик по самому меню не вызывал onClose родительского div
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-4 text-2xl font-bold text-orange-500">
        {t("common.add")}
      </div>
      <div className="divide-y divide-gray-700">
        <Link
          to="/deals/new-carousel"
          onClick={onClose} // Закрываем меню при клике на ссылку
          className="block px-4 py-3 hover:bg-gray-700"
        >
          {t("common.deal")}
        </Link>
        <Link
          to="/promos/new"
          onClick={onClose}
          className="block px-4 py-3 hover:bg-gray-700"
        >
          {t("common.promoCode")}
        </Link>
        <Link
          to="/sweepstakes/new"
          onClick={onClose}
          className="block px-4 py-3 hover:bg-gray-700"
        >
          Sweepstakes{" "}
          {/* Предполагая, что для этого нет перевода или он такой */}
        </Link>
        <Link
          to="/feedback" // Убедитесь, что такой путь существует или это внешняя ссылка
          onClick={onClose}
          className="block px-4 py-3 hover:bg-gray-700"
        >
          {t("common.feedback")}
        </Link>
      </div>
    </div>
  );

  // Для сайта рендерим с фоном для закрытия, для приложения - только сам контент в портал
  if (window.isNativeApp) {
    const portalContainer = document.body; // или ваш #portal-root
    return ReactDOM.createPortal(menuContent, portalContainer);
  } else {
    // Для сайта добавляем оверлей для закрытия по клику вне
    return (
      <div className="fixed inset-0 z-40" onClick={onClose}>
        {" "}
        {/* z-index ниже чем у меню */}
        {menuContent}
      </div>
    );
  }
};

export default AddDealMenu;

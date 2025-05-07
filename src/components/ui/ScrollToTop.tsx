import React, { useState, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useLocation } from 'react-router-dom';

// Список маршрутов, на которых не нужно показывать кнопку
const HIDDEN_ROUTES = [
  '/profile',
  '/auth',
  '/auth/reset-password',
  '/user-settings',
  '/settings/notifications',
  '/privacy-policy',
  '/categories'
];

const ScrollToTop: React.FC = () => {
  const { isDark } = useTheme();
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(false);
  
  // Функция для проверки положения прокрутки
  const toggleVisibility = () => {
    // Показываем кнопку, когда пользователь прокрутил более 200px
    if (window.scrollY > 200) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  };
  
  // Добавляем слушатель события прокрутки
  useEffect(() => {
    window.addEventListener('scroll', toggleVisibility);
    
    // Очищаем слушатель при размонтировании компонента
    return () => {
      window.removeEventListener('scroll', toggleVisibility);
    };
  }, []);
  
  // Проверяем, нужно ли скрыть кнопку на текущем маршруте
  const shouldHide = HIDDEN_ROUTES.some(route => location.pathname === route);
  
  // Если мы находимся на странице из списка исключений, не отображаем кнопку
  if (shouldHide) {
    return null;
  }

  // Функция для прокрутки страницы наверх
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <div className={`fixed bottom-24 right-4 z-50 transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <button
        onClick={scrollToTop}
        className={`${
          isDark 
            ? 'bg-orange-500 hover:bg-orange-600 text-white' 
            : 'bg-orange-500 hover:bg-orange-600 text-white'
        } rounded-full p-4 shadow-lg flex items-center justify-center`}
        aria-label="Прокрутить наверх"
      >
        <ChevronUp className="h-6 w-6" />
      </button>
    </div>
  );
};

export default ScrollToTop;
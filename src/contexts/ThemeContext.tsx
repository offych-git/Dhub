import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('theme');
    return (savedTheme as Theme) || 'light';
  });

  useEffect(() => {
    // Сохраняем тему в localStorage
    localStorage.setItem('theme', theme);
    
    // Сначала удаляем все возможные классы тем
    document.documentElement.classList.remove('light', 'dark');
    
    // Затем добавляем класс текущей темы
    document.documentElement.classList.add(theme);
    
    // Принудительно обновляем CSS переменные
    if (theme === 'light') {
      document.documentElement.style.setProperty('--bg-primary', '#F3F4F6');
      document.documentElement.style.setProperty('--bg-secondary', '#FFFFFF');
      document.documentElement.style.setProperty('--text-primary', '#111827');
    } else {
      document.documentElement.style.setProperty('--bg-primary', '#111827');
      document.documentElement.style.setProperty('--bg-secondary', '#1F2937');
      document.documentElement.style.setProperty('--text-primary', '#FFFFFF');
    }
    
    // Отправляем информацию о теме в нативное приложение при инициализации
    if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
      window.ReactNativeWebView.postMessage(JSON.stringify({ 
        type: 'themeInit', 
        theme: theme 
      }));
      console.log("Отправлено начальное состояние темы в нативное приложение:", theme);
    }
  }, [theme]);

  const toggleTheme = () => {
    console.log("Переключение темы, текущая тема:", theme);
    setTheme(prevTheme => {
      const newTheme = prevTheme === 'dark' ? 'light' : 'dark';
      console.log("Новая тема:", newTheme);
      
      // Отправка сообщения в нативное приложение через WebView
      if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
        window.ReactNativeWebView.postMessage(JSON.stringify({ 
          type: 'themeChange', 
          theme: newTheme 
        }));
        console.log("Отправлено сообщение в нативное приложение о смене темы:", newTheme);
      }
      
      return newTheme;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
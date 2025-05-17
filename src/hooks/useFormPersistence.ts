
import { useState, useEffect } from 'react';

/**
 * Хук для сохранения данных формы в localStorage и их восстановления
 * @param key Уникальный ключ для идентификации данных в localStorage
 * @param initialData Начальные данные формы
 * @returns [data, setData, clearSavedData] - данные формы, функция для их обновления, функция для очистки сохранённых данных
 */
export function useFormPersistence<T>(key: string, initialData: T): [T, (data: T) => void, () => void] {
  // Загружаем данные из localStorage при инициализации
  const [data, setInternalData] = useState<T>(() => {
    try {
      const savedData = localStorage.getItem(`form_${key}`);
      return savedData ? JSON.parse(savedData) : initialData;
    } catch (error) {
      console.error('Error loading saved form data:', error);
      return initialData;
    }
  });

  // Функция для обновления данных
  const setData = (newData: T) => {
    setInternalData(newData);
    try {
      localStorage.setItem(`form_${key}`, JSON.stringify(newData));
    } catch (error) {
      console.error('Error saving form data:', error);
    }
  };

  // Функция для очистки сохранённых данных
  const clearSavedData = () => {
    try {
      localStorage.removeItem(`form_${key}`);
    } catch (error) {
      console.error('Error clearing saved form data:', error);
    }
  };

  // Сохраняем данные при переключении вкладок
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        try {
          localStorage.setItem(`form_${key}`, JSON.stringify(data));
        } catch (error) {
          console.error('Error saving form data on tab switch:', error);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [key, data]);

  return [data, setData, clearSavedData];
}

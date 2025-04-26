import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

const LanguageSelector: React.FC = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <select
      value={language}
      onChange={(e) => setLanguage(e.target.value as 'en' | 'ru' | 'es')}
      className="bg-gray-800 text-white text-sm rounded-md px-2 py-1"
    >
      <option value="en">English</option>
      <option value="ru">Русский</option>
      <option value="es">Español</option>
    </select>
  );
};

export default LanguageSelector
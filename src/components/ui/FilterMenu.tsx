import React from 'react';
import { ChevronDown } from 'lucide-react';
import { categories, stores, categoryIcons } from '../../data/mockData';
import { useLanguage } from '../../contexts/LanguageContext';

interface FilterMenuProps {
  type: 'categories' | 'stores';
  isOpen: boolean;
  onToggle: () => void;
  selectedItems: string[];
  onSelect: (id: string) => void;
  onClear: () => void;
}

const FilterMenu: React.FC<FilterMenuProps> = ({
  type,
  isOpen,
  onToggle,
  selectedItems,
  onSelect,
  onClear,
}) => {
  const { t, language } = useLanguage();
  const items = type === 'categories' ? categories : stores;
  const label = t(`filters.${type}`);

  return (
    <div className="relative">
      <button
        className="flex items-center bg-gray-800 rounded-md px-3 py-1.5 text-sm"
        onClick={onToggle}
      >
        <span>{label}</span>
        <ChevronDown className="h-4 w-4 ml-1" />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-gray-800 rounded-md shadow-lg z-20">
          <div 
            className={`px-3 py-2 cursor-pointer ${
              selectedItems.length === 0 ? 'bg-gray-700 text-orange-500' : 'text-white'
            }`}
            onClick={onClear}
          >
            {t('filters.all')} {label}
          </div>
          {items.map(item => {
            const Icon = type === 'categories' ? categoryIcons[item.name] : null;
            return (
              <div
                key={item.id}
                className={`px-3 py-2 cursor-pointer flex items-center ${
                  selectedItems.includes(item.id) ? 'bg-gray-700 text-orange-500' : 'text-white'
                }`}
                onClick={() => onSelect(item.id)}
              >
                {Icon && <Icon className="h-4 w-4 mr-2" />}
                <span>{language === 'ru' ? item.name : t(item.id)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FilterMenu;
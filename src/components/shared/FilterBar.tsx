import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { categories, stores, categoryIcons } from '../../data/mockData';
import { useLanguage } from '../../contexts/LanguageContext';

interface FilterBarProps {
  selectedCategories: string[];
  selectedStores: string[];
  onFilterChange: (type: 'categories' | 'stores', ids: string[]) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({
  selectedCategories,
  selectedStores,
  onFilterChange,
}) => {
  const { t, language } = useLanguage();
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [storeMenuOpen, setStoreMenuOpen] = useState(false);
  const [selectedMainCategory, setSelectedMainCategory] = useState<string | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setCategoryMenuOpen(false);
        setStoreMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCategorySelect = (categoryId: string) => {
    const newCategories = selectedCategories.includes(categoryId)
      ? selectedCategories.filter(id => id !== categoryId)
      : [...selectedCategories, categoryId];
    onFilterChange('categories', newCategories);
  };

  const handleStoreClick = () => {
    setCategoryMenuOpen(false);
    setStoreMenuOpen(!storeMenuOpen);
  };
  const handleStoreSelect = (storeId: string) => {
    const newStores = selectedStores.includes(storeId)
      ? selectedStores.filter(id => id !== storeId)
      : [...selectedStores, storeId];
    onFilterChange('stores', newStores);
    setStoreMenuOpen(false);
  };

  const getSelectedCategoryNames = () => {
    return selectedCategories.map(id => {
      const category = categories.find(c => c.id === id);
      return category ? (language === 'ru' ? category.name : t(category.id)) : '';
    }).filter(Boolean);
  };

  const getSelectedStoreNames = () => {
    return selectedStores.map(id => {
      const store = stores.find(s => s.id === id);
      return store ? store.name : '';
    }).filter(Boolean);
  };

  return (
    <div className="flex py-3 px-4 items-center space-x-4 bg-gray-900" ref={filterRef}>
      <span className="text-white">{t('filters.title')}</span>
      
      <div className="flex flex-wrap gap-2 flex-1">
        {/* Categories Filter */}
        <div className="relative">
          <button
            className={`flex items-center rounded-md px-3 py-1.5 text-sm ${
              selectedCategories.length > 0 ? 'bg-orange-500 text-white' : 'bg-gray-800 text-white'
            }`}
            onClick={() => {
              setCategoryMenuOpen(!categoryMenuOpen);
              setStoreMenuOpen(false);
            }}
          >
            <span className="mr-2">
              {selectedCategories.length > 0 
                ? `${t('filters.categories')} (${selectedCategories.length})`
                : t('filters.categories')
              }
            </span>
            <ChevronDown className="h-4 w-4" />
          </button>
          
          {categoryMenuOpen && (
            <div className="dropdown-menu absolute top-full left-0 mt-1 w-72 rounded-md shadow-lg z-30 max-h-[calc(100vh-200px)] overflow-y-auto">
              <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-2 flex justify-between items-center">
                <span className="text-white font-medium">{t('filters.categories')}</span>
                {selectedCategories.length > 0 && (
                  <button
                    onClick={() => {
                      onFilterChange('categories', []);
                      setSelectedMainCategory(null);
                    }}
                    className="text-gray-400 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              <div className="divide-y divide-gray-700">
                {categories.map(category => {
                  const Icon = categoryIcons[category.name];
                  const isMainSelected = selectedMainCategory === category.id;
                  const hasSelectedSubcategories = category.subcategories?.some(
                    sub => selectedCategories.includes(sub.id)
                  );

                  return (
                    <div key={category.id}>
                      <button
                        className={`dropdown-item w-full px-3 py-2 flex items-center justify-between hover:bg-gray-700 ${
                          isMainSelected || hasSelectedSubcategories ? 'bg-gray-700' : ''
                        }`}
                        onClick={() => handleCategorySelect(category.id)}
                      >
                        <div className="flex items-center">
                          {Icon && <Icon className="h-4 w-4 mr-2 text-orange-500" />}
                          <span>
                            {language === 'ru' ? category.name : t(category.id)}
                          </span>
                        </div>
                        <ChevronDown 
                          className={`h-4 w-4 text-gray-400 transform transition-transform ${
                            isMainSelected ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      
                      
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Stores Filter - Commented out */}
        {/* <div className="relative">
          <button
            className={`flex items-center rounded-md px-3 py-1.5 text-sm ${
              selectedStores.length > 0 ? 'bg-orange-500 text-white' : 'bg-gray-800 text-white'
            }`}
            onClick={() => {
              setStoreMenuOpen(!storeMenuOpen);
              setCategoryMenuOpen(false);
            }}
          >
            <span className="mr-2">
              {selectedStores.length > 0 
                ? `${t('filters.stores')} (${selectedStores.length})`
                : t('filters.stores')
              }
            </span>
            <ChevronDown className="h-4 w-4" />
          </button>
          
          {storeMenuOpen && (
            <div className="dropdown-menu absolute top-full left-0 mt-1 w-48 rounded-md shadow-lg z-30">
              <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-2 flex justify-between items-center">
                <span className="text-white font-medium">{t('filters.stores')}</span>
                {selectedStores.length > 0 && (
                  <button
                    onClick={() => onFilterChange('stores', [])}
                    className="text-gray-400 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              <div className="max-h-[300px] overflow-y-auto">
                {stores.map(store => (
                  <button
                    key={store.id}
                    className={`dropdown-item w-full px-3 py-2 text-left hover:bg-gray-700 ${
                      selectedStores.includes(store.id)
                        ? 'bg-gray-700 text-orange-500'
                        : ''
                    }`}
                    onClick={() => handleStoreSelect(store.id)}
                  >
                    {store.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div> */}
      </div>

      {/* Selected Filters */}
      {(selectedCategories.length > 0) && (
        <div className="flex flex-wrap gap-2 mt-2">
          {getSelectedCategoryNames().map(name => (
            <span key={name} className="bg-orange-500 text-white text-sm px-2 py-0.5 rounded">
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default FilterBar;
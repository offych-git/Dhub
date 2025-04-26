import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { categories, stores, categoryIcons } from '../data/mockData';
import { useLanguage } from '../contexts/LanguageContext';

interface SharedFilterBarProps {
  selectedCategories: string[];
  selectedStores: string[];
  onFilterChange: (type: 'categories' | 'stores', ids: string[]) => void;
}

const SharedFilterBar: React.FC<SharedFilterBarProps> = ({
  selectedCategories,
  selectedStores,
  onFilterChange,
}) => {
  const { t, language } = useLanguage();
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [storeMenuOpen, setStoreMenuOpen] = useState(false);
  const [selectedMainCategory, setSelectedMainCategory] = useState<string | null>(null);

  const handleCategoryClick = () => {
    setStoreMenuOpen(false);
    setCategoryMenuOpen(!categoryMenuOpen);
  };

  const handleStoreClick = () => {
    setCategoryMenuOpen(false);
    setStoreMenuOpen(!storeMenuOpen);
  };

  const handleMainCategorySelect = (categoryId: string) => {
    setSelectedMainCategory(categoryId === selectedMainCategory ? null : categoryId);
  };

  const handleSubcategorySelect = (subcategoryId: string) => {
    const newCategories = selectedCategories.includes(subcategoryId)
      ? selectedCategories.filter(id => id !== subcategoryId)
      : [...selectedCategories, subcategoryId];
    onFilterChange('categories', newCategories);
  };

  const handleStoreSelect = (storeId: string) => {
    const newStores = selectedStores.includes(storeId)
      ? selectedStores.filter(id => id !== storeId)
      : [...selectedStores, storeId];
    onFilterChange('stores', newStores);
  };

  return (
    <div className="px-4 mb-4">
      <div className="flex items-center text-gray-400 mb-2">
        <span>{t('filters.title')}</span>
        <div className="flex space-x-2 ml-4">
          {/* Categories Filter */}
          <div className="relative">
            <button
              className="flex items-center bg-gray-800 rounded-md px-3 py-1.5 text-sm"
              onClick={handleCategoryClick}
            >
              <span>{t('filters.categories')}</span>
              <ChevronDown className="h-4 w-4 ml-1" />
            </button>
            
            {categoryMenuOpen && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-gray-800 rounded-md shadow-lg z-20">
                <div 
                  className={`px-3 py-2 cursor-pointer ${
                    selectedCategories.length === 0 ? 'bg-gray-700 text-orange-500' : 'text-white'
                  }`}
                  onClick={() => {
                    onFilterChange('categories', []);
                    setSelectedMainCategory(null);
                  }}
                >
                  {t('filters.all')} {t('filters.categories')}
                </div>
                {categories.map(category => {
                  const Icon = categoryIcons[category.name];
                  const isMainSelected = selectedMainCategory === category.id;
                  const hasSelectedSubcategories = category.subcategories?.some(
                    sub => selectedCategories.includes(sub.id)
                  );

                  return (
                    <div key={category.id}>
                      <div
                        className={`px-3 py-2 cursor-pointer flex items-center justify-between ${
                          isMainSelected || hasSelectedSubcategories ? 'bg-gray-700' : ''
                        }`}
                        onClick={() => handleMainCategorySelect(category.id)}
                      >
                        <div className="flex items-center">
                          {Icon && <Icon className="h-4 w-4 mr-2 text-orange-500" />}
                          <span className="text-white">
                            {language === 'ru' ? category.name : t(category.id)}
                          </span>
                        </div>
                        <ChevronDown 
                          className={`h-4 w-4 text-gray-400 transform transition-transform ${
                            isMainSelected ? 'rotate-180' : ''
                          }`} 
                        />
                      </div>
                      
                      {isMainSelected && category.subcategories && (
                        <div className="bg-gray-700 py-1">
                          {category.subcategories.map(subcategory => (
                            <div
                              key={subcategory.id}
                              className={`px-6 py-1.5 cursor-pointer flex items-center ${
                                selectedCategories.includes(subcategory.id)
                                  ? 'text-orange-500'
                                  : 'text-gray-300'
                              }`}
                              onClick={() => handleSubcategorySelect(subcategory.id)}
                            >
                              <span>
                                {language === 'ru' ? subcategory.name : t(subcategory.id)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Stores Filter */}
          <div className="relative">
            <button
              className="flex items-center bg-gray-800 rounded-md px-3 py-1.5 text-sm"
              onClick={handleStoreClick}
            >
              <span>{t('filters.stores')}</span>
              <ChevronDown className="h-4 w-4 ml-1" />
            </button>
            
            {storeMenuOpen && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-gray-800 rounded-md shadow-lg z-20">
                <div 
                  className={`px-3 py-2 cursor-pointer ${
                    selectedStores.length === 0 ? 'bg-gray-700 text-orange-500' : 'text-white'
                  }`}
                  onClick={() => onFilterChange('stores', [])}
                >
                  {t('filters.all')} {t('filters.stores')}
                </div>
                {stores.map(store => (
                  <div
                    key={store.id}
                    className={`px-3 py-2 cursor-pointer ${
                      selectedStores.includes(store.id) ? 'bg-gray-700 text-orange-500' : 'text-white'
                    }`}
                    onClick={() => handleStoreSelect(store.id)}
                  >
                    {store.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SharedFilterBar;
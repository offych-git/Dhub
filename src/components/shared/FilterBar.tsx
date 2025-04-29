import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { categories } from '../../data/mockData';
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
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);

  useEffect(() => {
    if (isFilterSheetOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isFilterSheetOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!sheetRef.current) return;

    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;

    if (diff > 0) {
      sheetRef.current.style.transform = `translateY(${diff}px)`;
      sheetRef.current.style.transition = 'none';
    }
  };

  const handleTouchEnd = () => {
    if (!sheetRef.current) return;

    const diff = currentY.current - startY.current;
    sheetRef.current.style.transition = 'transform 0.3s ease-out';

    if (diff > 50) {
      sheetRef.current.style.transform = 'translateY(100%)';
      setTimeout(() => setIsFilterSheetOpen(false), 300);
    } else {
      sheetRef.current.style.transform = 'translateY(0)';
    }
  };

  const handleCategorySelect = (categoryId: string) => {
    onFilterChange('categories', [categoryId]);
    setIsFilterSheetOpen(false);
  };

  const getSelectedCategoryNames = () => {
    return selectedCategories.map(id => {
      const category = categories.find(c => c.id === id);
      return language === 'ru' ? category?.name : t(id);
    });
  };

  return (
    <div className="px-4 mb-4 mt-[5px]">
      <div className="flex items-center text-gray-400 mb-2">
        <span>{t('filters.title')}</span>
        <button
          onClick={() => setIsFilterSheetOpen(true)}
          className={`ml-4 px-4 py-2 rounded-full text-sm flex items-center justify-center min-w-[120px] ${
            selectedCategories.length > 0 ? 'bg-orange-500 text-white' : 'bg-gray-800'
          }`}
        >
          {selectedCategories.length > 0 ? (
            <>
              <span>{getSelectedCategoryNames()[0]}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFilterChange('categories', []);
                }}
                className="ml-2 p-1 hover:bg-orange-600 rounded-full"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          ) : (
            <>
              {t('filters.categories')}
              <ChevronDown className="h-4 w-4 ml-1" />
            </>
          )}
        </button>
      </div>


      {/* Bottom Sheet */}
      {isFilterSheetOpen && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setIsFilterSheetOpen(false)}
          />
          <div
            ref={sheetRef}
            className="fixed bottom-0 left-0 right-0 bg-gray-900 rounded-t-2xl z-50 max-h-[80vh] flex flex-col pt-4"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Handle */}
            <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto my-3" />

            {/* Header */}
            <div className="relative px-4 py-3 border-b border-gray-800 flex items-center">
              <button onClick={() => setIsFilterSheetOpen(false)} className="absolute left-4">
                <X className="h-6 w-6 text-white" />
              </button>
              <h2 className="text-white text-lg font-medium flex-1 text-center">{t('filters.categories')}</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-3">
                {categories.map(category => (
                  <button
                    key={category.id}
                    onClick={() => handleCategorySelect(category.id)}
                    className={`p-4 rounded-xl flex flex-col items-center justify-center text-center transition-colors ${
                      selectedCategories.includes(category.id)
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-800 text-gray-300'
                    }`}
                  >
                    <span className="text-sm">
                      {language === 'ru' ? category.name : t(category.id)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FilterBar;
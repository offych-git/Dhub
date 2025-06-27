import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { categories } from '../../data/mockData';
import { useLanguage } from '../../contexts/LanguageContext';

interface FilterBarProps {
  selectedCategories: string[];
  selectedStores: string[];
  selectedStatus: string[];
  onFilterChange: (type: 'categories' | 'stores' | 'status', ids: string[]) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({
  selectedCategories,
  selectedStores,
  selectedStatus,
  onFilterChange,
}) => {
  const { t, language } = useLanguage();
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [isStatusSheetOpen, setIsStatusSheetOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const statusSheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);

  useEffect(() => {
    if (isFilterSheetOpen || isStatusSheetOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isFilterSheetOpen, isStatusSheetOpen]);

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

  const handleStatusSelect = (statusId: string) => {
    const newStatus = selectedStatus.includes(statusId)
      ? selectedStatus.filter(id => id !== statusId)
      : [...selectedStatus, statusId];
    onFilterChange('status', newStatus);
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
        <div className="flex space-x-2 ml-4">
          <button
            onClick={() => setIsFilterSheetOpen(true)}
            className={`px-4 py-2 rounded-full text-sm flex items-center justify-center min-w-[120px] ${
              selectedCategories.length > 0 ? 'bg-orange-500 text-white' : 'bg-gray-800'
            }`}
          >
            {selectedCategories.length > 0 ? (
              <>
                <span>{getSelectedCategoryNames()[0]}</span>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onFilterChange('categories', []);
                  }}
                  className="ml-2 p-1 hover:bg-orange-600 rounded-full cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </div>
              </>
            ) : (
              <>
                {t('filters.categories')}
                <ChevronDown className="h-4 w-4 ml-1" />
              </>
            )}
          </button>
          <button
            onClick={() => setIsStatusSheetOpen(true)}
            className={`px-4 py-2 rounded-full text-sm flex items-center justify-center min-w-[100px] ${
              selectedStatus.length > 0 ? 'bg-orange-500 text-white' : 'bg-gray-800'
            }`}
          >
            {selectedStatus.length > 0 ? (
              <>
                <span>
                  {selectedStatus.length === 2 
                    ? t('filters.all') || 'All'
                    : selectedStatus.includes('active') 
                      ? t('filters.active') 
                      : t('filters.expired')
                  }
                </span>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onFilterChange('status', []);
                  }}
                  className="ml-2 p-1 hover:bg-orange-600 rounded-full cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </div>
              </>
            ) : (
              <>
                {t('filters.status')}
                <ChevronDown className="h-4 w-4 ml-1" />
              </>
            )}
          </button>
        </div>
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
            className="fixed bottom-0 left-0 right-0 bg-gray-900 rounded-t-2xl z-50 max-h-[80vh] flex flex-col"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Handle */}
            <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mt-3 mb-2" />

            {/* Header */}
            <div className="relative px-4 py-2 border-b border-gray-800 flex items-center">
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

      {/* Status Bottom Sheet */}
      {isStatusSheetOpen && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setIsStatusSheetOpen(false)}
          />
          <div
            ref={statusSheetRef}
            className="fixed bottom-0 left-0 right-0 bg-gray-900 rounded-t-2xl z-50 max-h-[80vh] flex flex-col"
          >
            {/* Handle */}
            <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mt-3 mb-2" />

            {/* Header */}
            <div className="relative px-4 py-2 border-b border-gray-800 flex items-center">
              <button onClick={() => setIsStatusSheetOpen(false)} className="absolute left-4">
                <X className="h-6 w-6 text-white" />
              </button>
              <h2 className="text-white text-lg font-medium flex-1 text-center">{t('filters.status')}</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => handleStatusSelect('active')}
                  className={`p-4 rounded-xl flex items-center justify-center text-center transition-colors ${
                    selectedStatus.includes('active')
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-800 text-gray-300'
                  }`}
                >
                  <span className="text-sm">{t('filters.active')}</span>
                </button>
                <button
                  onClick={() => handleStatusSelect('expired')}
                  className={`p-4 rounded-xl flex items-center justify-center text-center transition-colors ${
                    selectedStatus.includes('expired')
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-800 text-gray-300'
                  }`}
                >
                  <span className="text-sm">{t('filters.expired')}</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FilterBar;
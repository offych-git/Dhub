import React, { useEffect, useRef } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import { categories } from '../../data/mockData';
import { useLanguage } from '../../contexts/LanguageContext';

interface CategoryBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCategory: string | null;
  onCategorySelect: (categoryId: string) => void;
  selectedSubcategories: string[];
  onSubcategorySelect: (subcategoryId: string) => void;
}

const CategoryBottomSheet: React.FC<CategoryBottomSheetProps> = ({
  isOpen,
  onClose,
  selectedCategory,
  onCategorySelect,
  selectedSubcategories,
  onSubcategorySelect,
}) => {
  const { t, language } = useLanguage();
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!sheetRef.current) return;

    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;

    if (diff > 0) { // Only allow dragging down
      sheetRef.current.style.transform = `translateY(${diff}px)`;
    }
  };

  const handleTouchEnd = () => {
    if (!sheetRef.current) return;

    const diff = currentY.current - startY.current;
    if (diff > 100) { // If dragged more than 100px, close the sheet
      onClose();
    } else {
      sheetRef.current.style.transform = 'translateY(0)';
    }
  };

  if (!isOpen) return null;

  const selectedCategoryData = categories.find(cat => cat.id === selectedCategory);

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 bg-gray-900 rounded-t-2xl z-50 max-h-[80vh] flex flex-col"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle */}
        <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto my-3" />

        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <button onClick={onClose} className="text-white">
            <X className="h-6 w-6" />
          </button>
          <h2 className="text-white text-lg font-medium">{t('filters.categories')}</h2>
          <div className="w-6" /> {/* Spacer for alignment */}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {!selectedCategory ? (
            // Main categories list
            <div className="space-y-2 p-4">
              {categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => onCategorySelect && onCategorySelect(category.id)}
                  className="w-full bg-gray-800 text-white rounded-lg p-4 flex items-center justify-between hover:bg-gray-700 transition-colors"
                >
                  <span>{language === 'ru' ? category.name : t(category.id)}</span>
                  <ChevronLeft className="h-5 w-5 transform rotate-180" />
                </button>
              ))}
            </div>
          ) : (
            // Subcategories list
            <div className="space-y-2 p-4">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log("Попытка возврата к списку категорий");
                  // Принудительно вызываем с пустой строкой
                  onCategorySelect('');
                }}
                className="w-full bg-gray-800 text-white rounded-lg p-4 flex items-center hover:bg-gray-700 transition-colors"
              >
                <ChevronLeft className="h-5 w-5 mr-2" />
                <span>{language === 'ru' ? selectedCategoryData?.name : t(selectedCategory)}</span>
              </button>

              {selectedCategoryData?.subcategories?.map((subcategory: { id: string; name: string }) => (
                <button
                  key={subcategory.id}
                  onClick={() => onSubcategorySelect(subcategory.id)}
                  className={`w-full bg-gray-800 text-white rounded-lg p-4 flex items-center justify-between hover:bg-gray-700 transition-colors ${
                    selectedSubcategories.includes(subcategory.id) ? 'bg-orange-500 hover:bg-orange-600' : ''
                  }`}
                >
                  <span>{language === 'ru' ? subcategory.name : t(subcategory.id)}</span>
                  {selectedSubcategories.includes(subcategory.id) && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected subcategories bar */}
        {selectedSubcategories?.length > 0 && selectedCategoryData?.subcategories && (
          <div className="border-t border-gray-800 p-4">
            <div className="flex flex-wrap gap-2">
              {selectedSubcategories.map(subId => {
                const subcategory = selectedCategoryData?.subcategories?.find((s: { id: string }) => s.id === subId);
                return subcategory ? (
                  <span
                    key={subId}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-500 text-white"
                  >
                    {language === 'ru' ? subcategory.name : t(subId)}
                    <button
                      onClick={() => onSubcategorySelect(subId)}
                      className="ml-2 text-white hover:text-gray-200"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                ) : null;
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default CategoryBottomSheet;
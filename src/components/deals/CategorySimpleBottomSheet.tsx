import React, { useEffect, useRef } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import { categories } from '../../data/mockData';
import { useLanguage } from '../../contexts/LanguageContext';

interface CategorySimpleBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCategory: string | null;
  onCategorySelect: (categoryId: string) => void;
}

const CategorySimpleBottomSheet: React.FC<CategorySimpleBottomSheetProps> = ({
  isOpen,
  onClose,
  selectedCategory,
  onCategorySelect,
}) => {
  const { t, language } = useLanguage();
  console.log('Current language in BottomSheet:', language);
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
          <div className="space-y-2 p-4">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => {
                  console.log('Category selected in BottomSheet:', category.id);
                  onCategorySelect && onCategorySelect(category.id);
                  onClose();
                }}
                className={`w-full bg-gray-800 text-white rounded-lg p-4 flex items-center justify-between hover:bg-gray-700 transition-colors ${
                  selectedCategory === category.id ? 'bg-orange-500 hover:bg-orange-600' : ''
                }`}
              >
                <span>{language === 'ru' ? category.name : t(category.id)}</span>
                {selectedCategory === category.id && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default CategorySimpleBottomSheet;
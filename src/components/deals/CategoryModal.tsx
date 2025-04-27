import React from 'react';
import { ChevronLeft, X } from 'lucide-react';
import { categories } from '../../data/mockData';
import { useLanguage } from '../../contexts/LanguageContext';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCategory: string | null;
  onCategorySelect: (categoryId: string) => void;
  selectedSubcategories: string[];
  onSubcategorySelect: (subcategoryId: string) => void;
}

const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  selectedCategory,
  onCategorySelect,
  selectedSubcategories,
  onSubcategorySelect,
}) => {
  const { t, language } = useLanguage();

  if (!isOpen) return null;

  const selectedCategoryData = categories.find(cat => cat.id === selectedCategory);

  return (
    <div className="fixed inset-0 bg-gray-900 z-50">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
        <button onClick={onClose} className="text-white">
          <X className="h-6 w-6" />
        </button>
        <h2 className="text-white text-lg font-medium">{t('filters.categories')}</h2>
        <div className="w-6" /> {/* Spacer for alignment */}
      </div>

      {/* Content */}
      <div className="pt-16 pb-4 h-full overflow-y-auto">
        {!selectedCategory ? (
          // Main categories list
          <div className="space-y-2 p-4">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => onCategorySelect(category.id)}
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
              onClick={() => onCategorySelect('')}
              className="w-full bg-gray-800 text-white rounded-lg p-4 flex items-center hover:bg-gray-700 transition-colors"
            >
              <ChevronLeft className="h-5 w-5 mr-2" />
              <span>{language === 'ru' ? selectedCategoryData?.name : t(selectedCategory)}</span>
            </button>

            {selectedCategoryData?.subcategories?.map(subcategory => (
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
      {selectedSubcategories.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 p-4">
          <div className="flex flex-wrap gap-2">
            {selectedSubcategories.map(subId => {
              const subcategory = selectedCategoryData?.subcategories?.find(s => s.id === subId);
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
  );
};

export default CategoryModal; 
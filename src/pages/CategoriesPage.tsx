import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ArrowLeft } from 'lucide-react';
import { categories, categoryIcons } from '../data/mockData';
import { Category, Subcategory } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

const CategoriesPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  const handleCategoryClick = (category: Category) => {
    setSelectedCategory(category);
  };

  const handleBack = () => {
    setSelectedCategory(null);
  };

  const handleSubcategoryClick = (subcategory: Subcategory) => {
    // Navigate to deals page with category filter
    navigate(`/?category=${subcategory.id}`);
  };

  if (selectedCategory) {
    return (
      <div className="pb-16 pt-16 bg-gray-900 min-h-screen">
        <div className="px-4">
          {/* Back button and category name */}
          <div className="flex items-center mb-6">
            <button 
              onClick={handleBack}
              className="text-white mr-3"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h2 className="text-white text-xl font-medium">
              {language === 'ru' ? selectedCategory.name : t(selectedCategory.id)}
            </h2>
          </div>

          {/* Subcategories */}
          <div className="space-y-2">
            {selectedCategory.subcategories?.map(subcategory => {
              const Icon = categoryIcons[subcategory.name];
              return (
                <button
                  key={subcategory.id}
                  className="w-full bg-gray-800 rounded-lg p-4 flex items-center justify-between text-left"
                  onClick={() => handleSubcategoryClick(subcategory)}
                >
                  <div className="flex items-center">
                    {Icon && (
                      <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center mr-4">
                        <Icon className="h-5 w-5 text-orange-500" />
                      </div>
                    )}
                    <div>
                      <h3 className="text-white font-medium">
                        {language === 'ru' ? subcategory.name : t(subcategory.id)}
                      </h3>
                      <p className="text-gray-400 text-sm mt-0.5">
                        {/* You can add count of deals/promos here */}
                        {Math.floor(Math.random() * 50) + 1} deals available
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-16 pt-0 bg-gray-900 min-h-screen">
      <div className="px-4 pb-6">
        <h2 className="text-white text-xl font-medium mb-4">
          {t('navigation.categories')}
        </h2>

        <div className="grid grid-cols-2 gap-4">
          {categories.map(category => {
            const Icon = categoryIcons[category.name];
            const subcategoryCount = category.subcategories?.length || 0;

            return (
              <button
                key={category.id}
                onClick={() => handleCategoryClick(category)}
                className="bg-gray-800 rounded-lg p-4 flex flex-col items-center text-center"
              >
                <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center mb-3">
                  {Icon && <Icon className="h-6 w-6 text-orange-500" />}
                </div>
                <h3 className="text-white font-medium">
                  {language === 'ru' ? category.name : t(category.id)}
                </h3>
                <p className="text-gray-400 text-sm mt-1">
                  {subcategoryCount} {t('common.subcategories')}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CategoriesPage;
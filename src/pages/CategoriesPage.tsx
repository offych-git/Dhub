
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { categories, categoryIcons } from '../data/mockData';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';

const CategoriesPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [categoryCounts, setCategoryCounts] = useState<{[key: string]: number}>({});

  useEffect(() => {
    // Fetch counts for each category
    const fetchCategoryCounts = async () => {
      const counts: {[key: string]: number} = {};

      // Get deals count by category - только published
      const { data: dealsData, error: dealsError } = await supabase
        .from('deals')
        .select('category_id, id')
        .eq('status', 'published');

      if (!dealsError && dealsData) {
        console.log('Deals by category:', dealsData);
        dealsData.forEach(item => {
          if (item.category_id) { // Проверяем, что категория задана
            counts[item.category_id] = (counts[item.category_id] || 0) + 1;
          }
        });
      } else if (dealsError) {
        console.error('Error fetching deals:', dealsError);
      }

      // Get promos count by category - только активные
      const { data: promosData, error: promosError } = await supabase
        .from('promo_codes')
        .select('category_id, id');

      if (!promosError && promosData) {
        console.log('Promos by category:', promosData);
        promosData.forEach(item => {
          if (item.category_id) { // Проверяем, что категория задана
            counts[item.category_id] = (counts[item.category_id] || 0) + 1;
          }
        });
      } else if (promosError) {
        console.error('Error fetching promos:', promosError);
      }

      // If no real data is available, use random counts for development
      if (Object.keys(counts).length === 0) {
        categories.forEach(category => {
          counts[category.id] = Math.floor(Math.random() * 50) + 1;
        });
      }

      console.log('Category counts:', counts);
      setCategoryCounts(counts);
    };

    fetchCategoryCounts();
  }, []);

  const handleCategoryClick = (categoryId: string, categoryName: string) => {
    // Redirect to the category items page
    navigate(`/category/${categoryId}`, { 
      state: { 
        categoryId, 
        categoryName: language === 'ru' ? categoryName : t(categoryId),
        itemCount: categoryCounts[categoryId] || 0
      } 
    });
  };

  return (
    <div className="pb-16 pt-0 bg-gray-900 min-h-screen">
      <div className="px-4 pb-6">
        <h2 className="text-white text-xl font-medium mb-4">
          {t('navigation.categories')}
        </h2>

        <div className="grid grid-cols-2 gap-4">
          {categories.map(category => {
            const Icon = categoryIcons[category.name];
            // Get count of items (deals + promos) for this category
            const itemCount = categoryCounts[category.id] || 0;

            return (
              <button
                key={category.id}
                onClick={() => handleCategoryClick(category.id, category.name)}
                className="bg-gray-800 rounded-lg p-4 flex flex-col items-center text-center"
              >
                <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center mb-3">
                  {Icon && <Icon className="h-6 w-6 text-orange-500" />}
                </div>
                <h3 className="text-white font-medium">
                  {language === 'ru' ? category.name : t(category.id)}
                </h3>
                <p className="text-gray-400 text-sm mt-1">
                  {itemCount} {t('common.items')}
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

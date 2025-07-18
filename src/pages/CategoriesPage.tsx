import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { categoryIcons } from '../data/mockData'; // Оставляем только иконки
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';

const CategoriesPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage(); // 'language' здесь не нужен, так как 't' уже использует нужный язык
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<{[key: string]: number}>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);

      // 1. Загружаем сами категории из базы
      const { data: categoriesData, error: categoriesError } = await supabase.rpc('get_categories');
      
      if (categoriesError) {
        console.error('Error fetching categories:', categoriesError);
        setIsLoading(false);
        return;
      }
      
      setCategories(categoriesData || []);

      // 2. Загружаем счетчики
      const counts: {[key: string]: number} = {};
      const { data: dealsData, error: dealsError } = await supabase
        .from('deals')
        .select('category_id')
        .eq('status', 'published');

      if (!dealsError && dealsData) {
        dealsData.forEach(item => {
          if (item.category_id) {
            counts[item.category_id] = (counts[item.category_id] || 0) + 1;
          }
        });
      }

      const { data: promosData, error: promosError } = await supabase
        .from('promo_codes')
        .select('category_id');

      if (!promosError && promosData) {
        promosData.forEach(item => {
          if (item.category_id) {
            counts[item.category_id] = (counts[item.category_id] || 0) + 1;
          }
        });
      }
      
      setCategoryCounts(counts);
      setIsLoading(false);
    };

    fetchData();
  }, [t]); // Зависимость от 't', чтобы перезагрузить при смене языка

  const handleCategoryClick = (categoryId: string) => {
    navigate(`/category/${categoryId}`, { 
      state: { 
        categoryName: t(categoryId) // Передаем на следующую страницу уже переведенное название
      } 
    });
  };

  if (isLoading) {
    return <div className="text-white text-center p-10">Загрузка категорий...</div>;
  }

  return (
    <div className="pb-16 pt-0 bg-gray-900 min-h-screen">
      <div className="px-4 pb-6">
        <h2 className="text-white text-xl font-medium mb-4">
          {t('navigation.categories')}
        </h2>

        <div className="grid grid-cols-2 gap-4">
          {categories.map(category => {
            const Icon = categoryIcons[t(category.id, { lng: 'en' })]; // Иконку ищем по английскому названию
            const itemCount = categoryCounts[category.id] || 0;

            return (
              <button
                key={category.id}
                onClick={() => handleCategoryClick(category.id)}
                className="bg-gray-800 rounded-lg p-4 flex flex-col items-center text-center"
              >
                <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center mb-3">
                  {Icon && <Icon className="h-6 w-6 text-orange-500" />}
                </div>
                <h3 className="text-white font-medium">
                  {t(category.id)}
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
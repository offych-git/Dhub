import React, { useState, useEffect } from 'react';
import Tabs from '../components/deals/Tabs';
import FilterBar from '../components/shared/FilterBar';
import DealCard from '../components/deals/DealCard';
import { Deal } from '../types';
import { supabase } from '../lib/supabase';
import { useGlobalState } from '../contexts/GlobalStateContext';
import { useLanguage } from '../contexts/LanguageContext'; // Added import

const formatRelativeTime = (date: Date) => {
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

  if (diffInMinutes < 1) return 'just now';
  if (diffInMinutes < 5) return '1m';
  if (diffInMinutes < 15) return '5m';
  if (diffInMinutes < 30) return '30m';
  if (diffInMinutes < 60) return '1h';
  if (diffInMinutes < 120) return '1h';
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
  return `${Math.floor(diffInMinutes / 1440)}d`;
};

import { DEAL_SETTINGS } from '../config/settings';
import { useSearchParams, useLocation } from 'react-router-dom';

const DealsPage: React.FC = () => {
  // Читаем сохраненную вкладку сразу при инициализации компонента
  const initialTab = sessionStorage.getItem('activeDealsTab') || 'hot';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('q');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const location = useLocation();
  const { t } = useLanguage(); // Added language context

  const { state, dispatch, refreshDeals } = useGlobalState();
  const dbDeals = state.deals.items;

  // Force refresh on navigation
  useEffect(() => {
    // When the user navigates back to this page, always fetch fresh data
    console.log("Navigation detected, принудительное обновление сделок...");

    // Очищаем текущие данные перед загрузкой новых
    dispatch({ type: 'SET_DEALS', payload: [] });

    // Устанавливаем флаг загрузки
    setLoading(true);

    // Сбрасываем пагинацию
    setPage(1);
    setHasMore(true);

    // Запускаем загрузку свежих данных с учетом текущих URL-параметров
    fetchDeals();
  }, [location.key]);

  useEffect(() => {
    // При изменении активной вкладки или поискового запроса
    setPage(1);
    setHasMore(true);

    // Для всех случаев загружаем данные заново
    console.log(`Загрузка данных для вкладки ${activeTab} (всегда свежие данные)`);

    // Очищаем текущие данные перед загрузкой новых
    dispatch({ type: 'SET_DEALS', payload: [] });

    // Запускаем загрузку
    fetchDeals();
  }, [activeTab, searchQuery]);

  const handleScroll = () => {
    if (window.innerHeight + document.documentElement.scrollTop !== document.documentElement.offsetHeight || 
        !hasMore || isFetchingMore) {
      return;
    }

    setIsFetchingMore(true);
    setPage(prev => prev + 1);
    fetchDeals();
  };

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasMore, isFetchingMore]);

  const fetchDeals = async () => {
    console.log("Запуск fetchDeals - загрузка свежих данных");
    setError(null);
    dispatch({ type: 'SET_DEALS_LOADING', payload: true });

    try {
      // Добавляем случайный параметр для предотвращения кеширования
      const cacheInvalidator = new Date().getTime();

      let query = supabase
        .from('deals')
        .select(`
          *,
          profiles (
            id,
            email,
            display_name
          )
        `)
        .not('type', 'eq', 'sweepstakes')  // Exclude sweepstakes
        .order('updated_at', { ascending: false })  // Сначала недавно обновленные
        .limit(100);  // Увеличиваем лимит для получения большего объема данных

      console.log(`Загрузка данных с параметром cache_invalidator=${cacheInvalidator}`);

      // Apply search filter if query exists
      if (searchQuery) {
        const searchTerms = searchQuery.toLowerCase().split(' ').filter(Boolean);

        if (searchTerms.length > 0) {
          query = query.or(
            searchTerms.map(term => 
              `title.ilike.%${term}%,description.ilike.%${term}%,store_id.ilike.%${term}%`
            ).join(',')
          );
        }
      }

      // Не применяем пагинацию для первоначальной загрузки, чтобы получить все HOT скидки
      // Это предотвратит пропажу отредактированных скидок

      const { data: deals, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Get votes and comments for each deal
      const dealsWithStats = await Promise.all((deals || []).map(async (deal) => {
        const { data: votes } = await supabase
          .from('deal_votes')
          .select('vote_type')
          .eq('deal_id', deal.id);

        const voteCount = votes?.reduce((acc, vote) => acc + (vote.vote_type ? 1 : -1), 0) || 0;
        const positiveVotes = votes?.filter(v => v.vote_type)?.length || 0;

        const { count: commentCount } = await supabase
          .from('deal_comments')
          .select('id', { count: 'exact' })
          .eq('deal_id', deal.id);

        // Get user profile information
        const userDisplayName = deal.profiles?.display_name || (
          deal.profiles?.email ? deal.profiles.email.split('@')[0] : 'Anonymous User'
        );

        return {
          id: deal.id,
          title: deal.title,
          currentPrice: parseFloat(deal.current_price),
          originalPrice: deal.original_price ? parseFloat(deal.original_price) : undefined,
          store: { id: deal.store_id, name: deal.store_id },
          category: { id: deal.category_id, name: deal.category_id },
          image: deal.image_url || 'https://via.placeholder.com/400x300?text=No+Image',
          postedAt: {
            relative: formatRelativeTime(new Date(deal.created_at)),
            exact: new Date(deal.created_at).toLocaleString()
          },
          popularity: voteCount,
          positiveVotes,
          comments: commentCount || 0,
          postedBy: {
            id: deal.profiles?.id || 'anonymous',
            name: userDisplayName,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(userDisplayName)}&background=random`
          },
          description: deal.description,
          url: deal.deal_url,
          createdAt: new Date(deal.created_at),
          is_hot: deal.is_hot
        };
      }));

      if (page === 1) {
        dispatch({ type: 'SET_DEALS', payload: dealsWithStats });
      } else {
        // Для подгрузки новых данных при скролле
        const updatedDeals = [...state.deals.items, ...dealsWithStats];
        dispatch({ type: 'SET_DEALS', payload: updatedDeals });
      }

      setHasMore(dealsWithStats.length === 20);
      setIsFetchingMore(false);
    } catch (err: any) {
      console.error('Error fetching deals:', err);
      setError('Failed to load deals');
    } finally {
      setLoading(false);
      dispatch({ type: 'SET_DEALS_LOADING', payload: false });
    }
  };

  const handleFilterChange = (type: 'categories' | 'stores', ids: string[]) => {
    if (type === 'categories') {
      setSelectedCategories(ids);
    } else {
      setSelectedStores(ids);
    }
  };

  // Filter and sort deals based on active tab
  let displayDeals: Deal[] = [];

  if (activeTab === 'hot') {
    console.log("Обработка HOT скидок, всего скидок:", dbDeals.length);

    // Преобразуем все скидки в Map для быстрого поиска и обновления
    const dealsMap = new Map();

    // Сначала добавляем все скидки
    dbDeals.forEach(deal => {
      // Используем новую и более детальную логику для HOT скидок
      const isHot = deal.is_hot || deal.positiveVotes >= DEAL_SETTINGS.hotThreshold;

      // Определяем приоритет скидки (отредактированные имеют высший приоритет)
      const priority = deal.updated_at ? new Date(deal.updated_at).getTime() : 0;

      if (isHot) {
        // Если скидка уже есть в Map, обновляем только если приоритет выше
        if (!dealsMap.has(deal.id) || priority > dealsMap.get(deal.id).priority) {
          dealsMap.set(deal.id, { deal, priority });
        }
      }
    });

    // Извлекаем скидки из Map, отсортированные по приоритету
    const hotDeals = Array.from(dealsMap.values())
      .sort((a, b) => b.priority - a.priority)
      .map(item => item.deal);

    console.log("Найдено HOT скидок:", hotDeals.length);


    // После обработки сортируем по обновлению/созданию (самые свежие вверху)
    hotDeals.sort((a, b) => {
      // Используем самую позднюю дату из updated_at или createdAt
      const getLatestDate = (deal) => {
        const createdTime = deal.createdAt ? deal.createdAt.getTime() : 0;
        const updatedTime = deal.updated_at ? new Date(deal.updated_at).getTime() : 0;
        return Math.max(createdTime, updatedTime);
      };

      return getLatestDate(b) - getLatestDate(a);
    });

    // Окончательное удаление дубликатов (сохраняем самые свежие версии)
    const uniqueIds = new Set();
    displayDeals = hotDeals.filter(deal => {
      if (uniqueIds.has(deal.id)) {
        return false;
      }
      uniqueIds.add(deal.id);
      return true;
    });

    // Логируем информацию для отладки
    console.log("Итоговое количество HOT скидок:", displayDeals.length);
  } else if (activeTab === 'new') {
    // Показываем только не HOT deals в NEW
    displayDeals = [
      ...dbDeals.filter(deal => !deal.is_hot)
    ].sort((a, b) => {
      const dateA = a.createdAt || new Date(0);
      const dateB = b.createdAt || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  } else if (activeTab === 'all') {
    // Combine and sort all deals by date (newest first)
    displayDeals = [
      ...dbDeals
    ].sort((a, b) => {
      const dateA = a.createdAt || new Date(0);
      const dateB = b.createdAt || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  } else if (activeTab === 'discussed') {
    // Sort by comment count (descending) and then by creation date (newest first)
    displayDeals = [
      ...dbDeals
    ].sort((a, b) => {
      // Primary sort by comment count (descending)
      const commentDiff = b.comments - a.comments;
      if (commentDiff !== 0) return commentDiff;

      // Secondary sort by date (newer first) if comment counts are equal
      const dateA = a.createdAt || new Date(0);
      const dateB = b.createdAt || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  } else if (activeTab === 'free') {
    // Фильтруем и показываем только бесплатные скидки (currentPrice = 0)
    console.log("Обработка FREE скидок, всего скидок:", dbDeals.length);
    
    // Фильтруем скидки с ценой 0
    const freeDeals = dbDeals.filter(deal => deal.currentPrice === 0);
    
    // Сортируем по дате создания (новые сверху)
    freeDeals.sort((a, b) => {
      const dateA = a.createdAt || new Date(0);
      const dateB = b.createdAt || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
    
    displayDeals = freeDeals;
    console.log("Найдено FREE скидок:", displayDeals.length);
  }

  // Apply category filter
  if (selectedCategories.length > 0) {
    displayDeals = displayDeals.filter(deal => selectedCategories.includes(deal.category.id));
  }

  // Apply store filter
  if (selectedStores.length > 0) {
    displayDeals = displayDeals.filter(deal => selectedStores.includes(deal.store.id));
  }

  // Удаляем дубликаты по ID только если это не было сделано ранее в коде
  if (activeTab !== 'hot') {
    const uniqueIds = new Set();
    displayDeals = displayDeals.filter(deal => {
      if (uniqueIds.has(deal.id)) {
        return false;
      }
      uniqueIds.add(deal.id);
      return true;
    });
  }

  const translations = {
    en: 'Nothing found for your query',
    ru: 'Ничего не найдено по вашему запросу',
    es: 'Nada encontrado para su consulta'
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    // Сохраняем выбранную вкладку в sessionStorage
    sessionStorage.setItem('activeDealsTab', tab);
  };

  return (
    <div className="pb-16 pt-0 bg-gray-900 min-h-screen">
      {/* Информационная строка о промоакциях */}
      <div className="bg-[#c1c1c1] dark:bg-gray-700/90 text-gray-500 dark:text-gray-200 text-[10px] text-center py-1 px-2">
        We may get paid by brands for deals, including promoted items.
      </div>
      <Tabs activeTab={activeTab} onTabChange={handleTabChange} />

      <FilterBar
        selectedCategories={selectedCategories}
        selectedStores={selectedStores}
        onFilterChange={handleFilterChange}
      />

      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : error ? (
        <div className="text-red-500 text-center py-8">
          {error}
        </div>
      ) : displayDeals.length > 0 ? (
        <div className="divide-y divide-gray-800">
          {displayDeals.map(deal => (
            <DealCard 
              key={deal.id} 
              deal={deal}
              onVoteChange={fetchDeals}
            />
          ))}
        </div>
      ) : searchParams.get('q') && searchParams.get('no_results') === 'true' ? (
        <div className="text-gray-400 text-center py-8">
          {translations[t('locale')] || translations.ru} {/* Use translation based on locale */}
        </div>
      ) : selectedCategories.length > 0 && !loading ? (
        <div className="text-gray-400 text-center py-8">
          {t('common.no_items_in_category', 'Нет элементов в выбранной категории')}
        </div>
      ) : (
        <div className="flex justify-center items-center py-8">
          <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
};

export default DealsPage;
import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useGlobalState } from '../contexts/GlobalStateContext';
import { supabase } from '../lib/supabase';
import { Deal } from '../types';
import Tabs from '../components/deals/Tabs';
import FilterBar from '../components/shared/FilterBar';
import DealCard from '../components/deals/DealCard';
import { DEAL_SETTINGS } from '../config/settings';

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

const DealsPage: React.FC = () => {
  const initialTab = sessionStorage.getItem('activeDealsTab') || 'hot';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { t } = useLanguage();
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  const { state, dispatch } = useGlobalState();
  const deals = state.deals.items;

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    sessionStorage.setItem('activeDealsTab', tab);
  };

  const handleFilterChange = (type: 'categories' | 'stores', ids: string[]) => {
    if (type === 'categories') setSelectedCategories(ids);
    else setSelectedStores(ids);
  };

  const handleScroll = useCallback(() => {
    if (
      window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 10 &&
      hasMore &&
      !fetchingMore
    ) {
      setPage((p) => p + 1);
      setFetchingMore(true);
    }
  }, [hasMore, fetchingMore]);

  const loadDeals = useCallback(
    async (isInitial = false) => {
      if (isInitial) {
        setLoading(true);
        dispatch({ type: 'SET_DEALS', payload: [] });
      }
      setError(null);
      dispatch({ type: 'SET_DEALS_LOADING', payload: true });

      try {
        const query = supabase
          .from('get_deals_with_stats')
          .select('*')
          .not('type', 'eq', 'sweepstakes')
          .order('updated_at', { ascending: false })
          .limit(100);

        const { data: profile } = user
          ? await supabase.from('profiles').select('user_status').eq('id', user.id).single()
          : { data: null };

        const isAdminOrModerator = ['admin', 'moderator', 'super_admin'].includes(profile?.user_status);

        if (!user) {
        // Неавторизованные пользователи видят опубликованные и одобренные сделки
        console.log("Неавторизованный пользователь - показываем опубликованные и одобренные сделки");
          query.in('status', ['published', 'approved']);
        } else if (!isAdminOrModerator) {
          // Обычные пользователи видят опубликованные и одобренные сделки + свои собственные на модерации
          console.log("Обычный пользователь - показываем опубликованные, одобренные сделки + свои собственные");
          query.or(`status.in.(published,approved),user_id.eq.${user.id}`);
        }

        if (searchQuery) {
          const terms = searchQuery.toLowerCase().split(' ').filter(Boolean);
          if (terms.length) {
            const filters = terms.map(term =>
              `title.ilike.%${term}%,description.ilike.%${term}%,store_id.ilike.%${term}%`
            );
            query.or(filters.join(','));
          }
        }

        const { data, error: fetchError } = await query;
        if (fetchError) throw fetchError;
        const enrichedDeals = (data || []).map(deal => ({
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
          popularity: 56,//deal.popularity || 0,
          positiveVotes: 57,//deal.positive_votes || 0,
          comments: deal.comment_count || 0,
          postedBy: {
            id: deal.profile_id || 'anonymous',
            name: deal.display_name || deal.email?.split('@')[0] || 'Anonymous',
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(
              deal.display_name || deal.email?.split('@')[0] || 'Anonymous'
            )}&background=random`
          },
          description: deal.description,
          url: deal.deal_url,
          createdAt: new Date(deal.created_at),
          is_hot: deal.is_hot,
          expires_at: deal.expires_at,
          status: deal.status
        }));

        const updatedDeals = isInitial
          ? enrichedDeals
          : [...state.deals.items, ...enrichedDeals];

        dispatch({ type: 'SET_DEALS', payload: updatedDeals });
        setHasMore(enrichedDeals.length === 20);
      } catch (err) {
        console.error('Error fetching deals:', err);
        setError('Failed to load deals');
      } finally {
        dispatch({ type: 'SET_DEALS_LOADING', payload: false });
        setLoading(false);
        setFetchingMore(false);
      }
    },
    [user, searchQuery, dispatch, state.deals.items]
  );

  useEffect(() => {
    loadDeals(true);
  }, [activeTab, location.key, searchQuery, user?.id]);

  useEffect(() => {
    if (page > 1) loadDeals(false);
  }, [page]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const filteredDeals = deals
    .filter((deal) => {
      if (selectedCategories.length && !selectedCategories.includes(deal.category.id)) return false;
      if (selectedStores.length && !selectedStores.includes(deal.store.id)) return false;
      if (activeTab === 'hot') return deal.is_hot || deal.positiveVotes >= DEAL_SETTINGS.hotThreshold;
      if (activeTab === 'free') return deal.currentPrice === 0;
      return true;
    })
    .sort((a, b) => {
      if (activeTab === 'discussed') return b.comments - a.comments || b.createdAt.getTime() - a.createdAt.getTime();
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

  const translations = {
    en: 'Nothing found for your query',
    ru: 'Ничего не найдено по вашему запросу',
    es: 'Nada encontrado para su consulta'
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
        <div className="text-red-500 text-center py-8">{error}</div>
      ) : filteredDeals.length > 0 ? (
        <div className="divide-y divide-gray-800">
          {filteredDeals.map(deal => (
            <DealCard key={deal.id} deal={deal} onVoteChange={() => loadDeals(true)} />
          ))}
        </div>
      ) : (
        <div className="text-gray-400 text-center py-8">
          {searchQuery
            ? translations[t('locale')] || translations.ru
            : t('common.no_items_in_category', 'Нет элементов в выбранной категории')}
        </div>
      )}
    </div>
  );
};

export default DealsPage;
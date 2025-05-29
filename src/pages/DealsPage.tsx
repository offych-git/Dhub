import React, { useState, useEffect, useCallback, useRef } from 'react'; // Добавлен useRef
import { useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useGlobalState } from '../contexts/GlobalStateContext';
import { supabase } from '../lib/supabase';
import Tabs from '../components/deals/Tabs';
import FilterBar from '../components/shared/FilterBar';
import DealCard from '../components/deals/DealCard';
import { DEAL_SETTINGS } from '../config/settings';

const ITEMS_PER_PAGE = 20;

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

  const loadDeals = useCallback(
    async (isInitial = false, pageToLoad = 1) => {
      console.log(`loadDeals called: isInitial=${isInitial}, pageToLoad=${pageToLoad}, currentGlobalItemsCount=${state.deals.items.length}`);
      if (isInitial) {
        setLoading(true);
      } else {
        setFetchingMore(true);
      }
      setError(null);
      // dispatch({ type: 'SET_DEALS_LOADING', payload: true }); // Эта линия может быть избыточной, если есть setLoading и setFetchingMore

      try {
        const from = (pageToLoad - 1) * ITEMS_PER_PAGE;
        const to = pageToLoad * ITEMS_PER_PAGE - 1;

        const query = supabase
          .from('get_deals_with_stats')
          .select('*')
          .not('type', 'eq', 'sweepstakes')
          .order('updated_at', { ascending: false })
          .range(from, to);

        let favoriteIds: Set<string> = new Set();
        if (user) {
          const { data: favoritesData } = await supabase.from('deal_favorites').select('deal_id').eq('user_id', user.id);
          if (favoritesData) favoriteIds = new Set(favoritesData.map(fav => fav.deal_id));
        }
        let votedIds: Map<string, boolean> = new Map();
        if (user) {
          const { data: votesData } = await supabase.from('deal_votes').select('deal_id, vote_type').eq('user_id', user.id);
          if (votesData) votedIds = new Map(votesData.map(vote => [vote.deal_id, vote.vote_type]));
        }
        const { data: profile } = user ? await supabase.from('profiles').select('user_status').eq('id', user.id).single() : { data: null };
        const isAdminOrModerator = ['admin', 'moderator', 'super_admin'].includes(profile?.user_status);

        if (!user) query.in('status', ['published', 'approved']);
        else if (!isAdminOrModerator) query.or(`status.in.(published,approved),user_id.eq.${user.id}`);

        if (searchQuery) {
          const terms = searchQuery.toLowerCase().split(' ').filter(Boolean);
          if (terms.length) {
            const filters = terms.map(term => `title.ilike.%${term}%,description.ilike.%${term}%,store_id.ilike.%${term}%`);
            query.or(filters.join(','));
          }
        }

        const { data, error: fetchError } = await query;
        console.log('Supabase response:', { dataLength: data?.length, fetchError });
        if (fetchError) throw fetchError;

        const enrichedDeals = (data || []).map(deal => ({
          id: deal.id, title: deal.title, type: deal.type,
          currentPrice: parseFloat(deal.current_price),
          originalPrice: deal.original_price ? parseFloat(deal.original_price) : undefined,
          store: { id: deal.store_id, name: deal.store_id }, category: { id: deal.category_id, name: deal.category_id },
          image: deal.image_url || 'https://via.placeholder.com/400x300?text=No+Image',
          postedAt: { relative: formatRelativeTime(new Date(deal.created_at)), exact: new Date(deal.created_at).toLocaleString() },
          popularity: deal.popularity || 0, userVoteType: votedIds.get(deal.id),
          comments: deal.comment_count || 0, isFavorite: favoriteIds.has(deal.id),
          postedBy: {
            id: deal.profile_id || 'anonymous', name: deal.display_name || deal.email?.split('@')[0] || 'Anonymous',
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(deal.display_name || deal.email?.split('@')[0] || 'Anonymous')}&background=random`
          },
          description: deal.description, url: deal.deal_url, createdAt: new Date(deal.created_at),
          is_hot: deal.is_hot, expires_at: deal.expires_at, status: deal.status
        }));

        const currentDeals = state.deals.items; // Получаем актуальные deals из state для объединения
        const uniqueNewDeals = enrichedDeals.filter(d => !currentDeals.find(existing => existing.id === d.id));

        const updatedDeals = isInitial ? enrichedDeals : [...currentDeals, ...uniqueNewDeals];

        dispatch({ type: 'SET_DEALS', payload: updatedDeals });
        setHasMore(enrichedDeals.length === ITEMS_PER_PAGE);

      } catch (err) {
        console.error('Error fetching deals:', err);
        setError('Failed to load deals');
      } finally {
        // dispatch({ type: 'SET_DEALS_LOADING', payload: false }); // Убрал, т.к. есть setLoading/setFetchingMore
        setLoading(false);
        setFetchingMore(false);
        console.log(`loadDeals finished: loading=${false}, fetchingMore=${false}, hasMore=${hasMore}`);
      }
    },
    [user, searchQuery, dispatch, state.deals.items] // state.deals.items здесь нужен для корректного объединения
  );

  // Используем useRef для хранения последней версии loadDeals
  const loadDealsRef = useRef(loadDeals);
  useEffect(() => {
    loadDealsRef.current = loadDeals;
  }, [loadDeals]);


  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    sessionStorage.setItem('activeDealsTab', tab);
    // Загрузка будет вызвана через useEffect, зависящий от activeTab
  };

  const handleFilterChange = (type: 'categories' | 'stores', ids: string[]) => {
    if (type === 'categories') setSelectedCategories(ids);
    else setSelectedStores(ids);
    // Загрузка будет вызвана через useEffect, зависящий от selectedCategories/selectedStores
  };

  // useEffect для начальной загрузки / смены фильтров / табов
  useEffect(() => {
    console.log('Effect for initial load / filter change triggered. Resetting to page 1.');
    setPage(1);
    setHasMore(true); // Важно сбросить hasMore
    // setLoading(true); // loadDealsRef.current(true, 1) это сделает
    loadDealsRef.current(true, 1);
  }, [activeTab, selectedCategories, selectedStores, location.key, searchQuery, user?.id]); // УБРАН loadDeals из зависимостей

  // useEffect для пагинации
  useEffect(() => {
    if (page > 1) {
      console.log(`Effect for pagination triggered for page ${page}. FetchingMore: ${fetchingMore}`);
      // `WorkspaceingMore` устанавливается в `handleScroll`
      // Вызываем loadDeals только если действительно нужно (hasMore) и уже идет процесс подгрузки (fetchingMore)
      if (hasMore && fetchingMore) {
        loadDealsRef.current(false, page);
      } else if (!hasMore && fetchingMore) {
        // Если fetchingMore все еще true, но грузить больше нечего, просто сбрасываем флаг
        setFetchingMore(false);
      }
    }
  }, [page, hasMore, fetchingMore]); // УБРАН loadDeals, ЗАВИСИМ от page, hasMore, fetchingMore

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab became visible. Reloading deals (page 1).');
        setPage(1);
        setHasMore(true);
        loadDealsRef.current(true, 1);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []); // УБРАН loadDeals

  const handleScroll = useCallback(() => {
    if (
      window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 100 &&
      hasMore && !fetchingMore && !loading
    ) {
      console.log('Scroll threshold hit, preparing to load more. Current page before increment:', page);
      setFetchingMore(true);
      setPage(prevPage => prevPage + 1);
    }
  }, [hasMore, fetchingMore, loading, page]); // page добавлен для актуального лога

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Клиентская фильтрация и сортировка (без изменений)
  const filteredDeals = deals.filter((deal) => {
      if (selectedCategories.length && !selectedCategories.includes(deal.category.id)) return false;
      if (selectedStores.length && !selectedStores.includes(deal.store.id)) return false;
      if (activeTab === 'hot') return deal.is_hot || (deal.popularity || 0) >= (DEAL_SETTINGS.hotThreshold || 10);
      if (activeTab === 'free') return deal.currentPrice === 0;
      return true;
    })
    .sort((a, b) => {
      if (activeTab === 'discussed') return (b.comments || 0) - (a.comments || 0) || b.createdAt.getTime() - a.createdAt.getTime();
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

  const translations = {
    en: 'Nothing found for your query',
    ru: 'Ничего не найдено по вашему запросу',
    es: 'Nada encontrado para su consulta'
  };

  return (
    <div className="pb-16 pt-0 bg-gray-900 min-h-screen">
      <div className="bg-[#c1c1c1] dark:bg-gray-700/90 text-gray-500 dark:text-gray-200 text-[10px] text-center py-1 px-2">
        We may get paid by brands for deals, including promoted items.
      </div>
      <Tabs activeTab={activeTab} onTabChange={handleTabChange} />
      <FilterBar selectedCategories={selectedCategories} selectedStores={selectedStores} onFilterChange={handleFilterChange} />

      {loading && page === 1 && !error ? (
        <div className="flex justify-center items-center py-8" data-testid="main-loader">
          <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : error ? (
        <div className="text-red-500 text-center py-8">{error}</div>
      ) : filteredDeals.length > 0 ? (
        <div className="divide-y divide-gray-800">
          {filteredDeals.map(deal => (
            <DealCard key={deal.id} deal={deal} onVoteChange={() => {
              console.log('Vote changed, reloading deals (page 1).');
              setPage(1);
              setHasMore(true);
              loadDealsRef.current(true, 1); // Используем ref
            }} />
          ))}
          {fetchingMore && (
             <div className="flex justify-center items-center py-4" data-testid="pagination-loader">
               <div className="h-6 w-6 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
             </div>
          )}
        </div>
      ) : (
        !loading && !fetchingMore && <div className="text-gray-400 text-center py-8">
          {searchQuery
            ? translations[t('locale') as keyof typeof translations] || translations.ru
            : t('common.no_items_in_category', 'Нет элементов в выбранной категории')}
        </div>
      )}
    </div>
  );
};

export default DealsPage;
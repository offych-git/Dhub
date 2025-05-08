import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import DealCard from '../components/deals/DealCard';
import { Deal } from '../types';
import { useGlobalState } from '../contexts/GlobalStateContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useSearchParams, useLocation } from 'react-router-dom';

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

const SweepstakesPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('q');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const location = useLocation();
  const { t } = useLanguage();

  const { state, dispatch, refreshDeals } = useGlobalState();
  const [sweepstakes, setSweepstakes] = useState<Deal[]>([]);

  // Force refresh on navigation
  useEffect(() => {
    console.log("Navigation detected, принудительное обновление розыгрышей...");
    setSweepstakes([]);
    setLoading(true);
    setPage(1);
    setHasMore(true);
    fetchSweepstakes();
  }, [location.key]);

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    console.log(`Загрузка розыгрышей (свежие данные)`);
    setSweepstakes([]);
    fetchSweepstakes();
  }, [searchQuery]);

  const handleScroll = () => {
    if (window.innerHeight + document.documentElement.scrollTop !== document.documentElement.offsetHeight || 
        !hasMore || isFetchingMore) {
      return;
    }

    setIsFetchingMore(true);
    setPage(prev => prev + 1);
    fetchSweepstakes();
  };

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasMore, isFetchingMore]);

  const fetchSweepstakes = async () => {
    console.log("Запуск fetchSweepstakes - загрузка свежих данных");
    setError(null);

    try {
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
        .eq('type', 'sweepstakes')
        .order('updated_at', { ascending: false })
        .limit(100);

      console.log(`Загрузка розыгрышей с параметром cache_invalidator=${cacheInvalidator}`);

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

      const { data: deals, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Get votes and comments for each deal
      const sweepstakesWithStats = await Promise.all((deals || []).map(async (deal) => {
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
          store: { id: deal.store_id, name: deal.store_id || 'Sweepstakes' },
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
          is_hot: deal.is_hot,
          expires_at: deal.expires_at,
          type: 'sweepstakes'
        };
      }));

      if (page === 1) {
        setSweepstakes(sweepstakesWithStats);
      } else {
        setSweepstakes(prev => [...prev, ...sweepstakesWithStats]);
      }

      setHasMore(sweepstakesWithStats.length === 20);
      setIsFetchingMore(false);
    } catch (err: any) {
      console.error('Error fetching sweepstakes:', err);
      setError('Failed to load sweepstakes');
    } finally {
      setLoading(false);
    }
  };

  // No filtering, just use all sweepstakes
  let displaySweepstakes = [...sweepstakes];

  return (
    <div className="pb-16 pt-0 bg-gray-900 min-h-screen">
      {/* Информационная строка о розыгрышах */}
      <div className="bg-[#c1c1c1] dark:bg-gray-700/90 text-gray-500 dark:text-gray-200 text-[10px] text-center py-1 px-2">
        We may get paid by brands for sweepstakes, including promoted items.
      </div>

      <div className="px-4 pb-20">
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="text-red-500 text-center py-8">
            {error}
          </div>
        ) : displaySweepstakes.length > 0 ? (
          <div className="divide-y divide-gray-800">
            {displaySweepstakes.map(deal => (
              <DealCard 
                key={deal.id} 
                deal={{
                  ...deal,
                  // Override store name to prevent showing "Sweepstakes" text
                  store: { ...deal.store, name: '' }
                }}
                onVoteChange={fetchSweepstakes}
                hideFreeLabel={true}
              />
            ))}
          </div>
        ) : searchParams.get('q') && searchParams.get('no_results') === 'true' ? (
          <div className="text-gray-400 text-center py-8">
            {t('common.no_search_results', 'Nothing found for your query')}
          </div>
        ) : (
          <div className="flex justify-center items-center py-8">
            <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SweepstakesPage;
import React, { useState, useEffect } from 'react';
import SearchBar from '../components/ui/SearchBar';
import Tabs from '../components/deals/Tabs';
import FilterBar from '../components/shared/FilterBar';
import DealCard from '../components/deals/DealCard';
import { Deal } from '../types';
import { supabase } from '../lib/supabase';

const formatRelativeTime = (date: Date) => {
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  
  if (diffInMinutes < 1) return 'just now';
  if (diffInMinutes < 5) return '1m';
  if (diffInMinutes < 15) return '5m';
  if (diffInMinutes < 30) return '15m';
  if (diffInMinutes < 60) return '30m';
  if (diffInMinutes < 120) return '1h';
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
  return `${Math.floor(diffInMinutes / 1440)}d`;
};
import { mockDeals } from '../data/mockData';
import { DEAL_SETTINGS } from '../config/settings';
import { useSearchParams } from 'react-router-dom';

const DealsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('hot');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [dbDeals, setDbDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('q');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  
  useEffect(() => {
    setPage(1);
    setHasMore(true);
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
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('deals')
        .select(`
          *,
          profiles (
            id,
            email,
            display_name
          )
        `);

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

      // For NEW tab, fetch all deals sorted by date
      if (activeTab === 'new') {
        query = query.order('created_at', { ascending: false });
      }

      // Add pagination
      query = query.range((page - 1) * 20, page * 20 - 1);

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
        const userEmail = deal.profiles?.email;
        const userName = userEmail ? userEmail.split('@')[0] : 'Anonymous User';

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
            name: userName,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=random`
          },
          description: deal.description,
          url: deal.deal_url,
          createdAt: new Date(deal.created_at),
          is_hot: deal.is_hot
        };
      }));

      if (page === 1) {
        setDbDeals(dealsWithStats);
      } else {
        setDbDeals(prev => [...prev, ...dealsWithStats]);
      }
      setHasMore(dealsWithStats.length === 20);
      setIsFetchingMore(false);
    } catch (err: any) {
      console.error('Error fetching deals:', err);
      setError('Failed to load deals');
    } finally {
      setLoading(false);
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
    // Show mock deals and real deals that have 10+ positive votes or is_hot flag
    const hotDeals = dbDeals.filter(deal => 
      deal.positiveVotes >= DEAL_SETTINGS.hotThreshold || 
      deal.is_hot
    );

    // Разделяем сделки на те, что стали HOT через голоса и изначально HOT
    // Все HOT сделки (отмеченные или набравшие голоса)
    const allHotDeals = hotDeals.filter(deal => 
      deal.is_hot || deal.positiveVotes >= DEAL_SETTINGS.hotThreshold
    );

    // Сортируем по времени попадания в HOT и убираем дубликаты по ID
    let combinedDeals = [...mockDeals, ...allHotDeals];
    
    // Удаляем дубликаты по ID
    const uniqueIds = new Set();
    displayDeals = combinedDeals.filter(deal => {
      if (uniqueIds.has(deal.id)) {
        return false;
      }
      uniqueIds.add(deal.id);
      return true;
    }).sort((a, b) => {
      // Для сделок с голосами используем текущее время как hot_at
      const getHotTime = (deal: Deal) => {
        if (deal.hot_at) return new Date(deal.hot_at);
        if (deal.is_hot) return deal.createdAt || new Date(0);
        if (deal.positiveVotes >= DEAL_SETTINGS.hotThreshold) return new Date();
        return new Date(0);
      };

      const timeA = getHotTime(a);
      const timeB = getHotTime(b);
      return timeB.getTime() - timeA.getTime();
    });
  } else if (activeTab === 'new') {
    // Показываем только не HOT deals в NEW
    displayDeals = [
      ...mockDeals,
      ...dbDeals.filter(deal => !deal.is_hot)
    ].sort((a, b) => {
      const dateA = a.createdAt || new Date(0);
      const dateB = b.createdAt || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  } else if (activeTab === 'all') {
    // Combine and sort all deals by date (newest first)
    displayDeals = [
      ...mockDeals,
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

  return (
    <div className="pb-16 pt-16 bg-gray-900 min-h-screen">
      <SearchBar />
      
      <Tabs activeTab={activeTab} onTabChange={setActiveTab} />
      
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
      ) : (
        <div className="text-gray-400 text-center py-8">
          No deals found
        </div>
      )}
    </div>
  );
};

export default DealsPage;
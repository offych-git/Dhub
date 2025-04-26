import React, { useState, useEffect } from 'react';
import SearchBar from '../components/ui/SearchBar';
import Tabs from '../components/deals/Tabs';
import FilterBar from '../components/shared/FilterBar';
import DealCard from '../components/deals/DealCard';
import { Deal } from '../types';
import { supabase } from '../lib/supabase';
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
  
  useEffect(() => {
    fetchDeals();
  }, [activeTab, searchQuery]);

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

      // For NEW tab, only fetch deals from the last 4 hours
      if (activeTab === 'new') {
        const fourHoursAgo = new Date();
        fourHoursAgo.setHours(fourHoursAgo.getHours() - DEAL_SETTINGS.newTimeWindow);
        
        query = query
          .gte('created_at', fourHoursAgo.toISOString())
          .order('created_at', { ascending: false });
      }

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
          postedAt: new Date(deal.created_at).toLocaleDateString(),
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
          createdAt: new Date(deal.created_at)
        };
      }));

      setDbDeals(dealsWithStats);
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
    // Show mock deals and real deals that have 10+ positive votes
    displayDeals = [
      ...mockDeals,
      ...dbDeals.filter(deal => deal.positiveVotes >= DEAL_SETTINGS.hotThreshold)
    ].sort((a, b) => b.popularity - a.popularity);
  } else if (activeTab === 'new') {
    // Show only real deals from the last 4 hours
    displayDeals = dbDeals;
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
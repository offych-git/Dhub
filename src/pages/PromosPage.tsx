import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ChevronDown, ArrowUp, ArrowDown, MessageSquare, Calendar, Heart, Share2 } from 'lucide-react';
import SearchBar from '../components/ui/SearchBar';
import FilterBar from '../components/shared/FilterBar';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AdminActions from '../components/admin/AdminActions';

interface PromoCode {
  id: string;
  code: string;
  title: string;
  description: string;
  category_id: string;
  discount_url: string;
  expires_at: string | null;
  created_at: string;
  user: {
    id: string;
    displayName: string;
    avatarUrl: string;
    email: string;
  };
  votes: number;
  comments: number;
  userVote: boolean | null;
}

const PromosPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('q');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    setPromoCodes([]);
    fetchPromoCodes();
  }, [searchQuery]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 1000 &&
          !isFetchingMore && hasMore) {
        setPage(prev => prev + 1);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasMore, isFetchingMore]);

  useEffect(() => {
    if (page > 1) {
      fetchPromoCodes();
    }
  }, [page]);

  const fetchPromoCodes = async () => {
    if (page === 1) {
      setLoading(true);
    } else {
      setIsFetchingMore(true);
    }
    try {
      let query = supabase
        .from('promo_codes')
        .select(`
          *,
          profiles:user_id (
            id,
            email,
            display_name
          )
        `);

      if (searchQuery) {
        const searchTerms = searchQuery.toLowerCase().split(' ').filter(Boolean);
        
        if (searchTerms.length > 0) {
          query = query.or(
            searchTerms.map(term => 
              `title.ilike.%${term}%,description.ilike.%${term}%,code.ilike.%${term}%`
            ).join(',')
          );
        }
      }

      query = query
        .order('created_at', { ascending: false })
        .range((page - 1) * 20, page * 20 - 1);

      const { data, error } = await query;

      if (error) throw error;

      const promosWithVotes = await Promise.all([...(data || [])].map(async (promo) => {
        const { data: votes } = await supabase
          .from('promo_votes')
          .select('vote_type')
          .eq('promo_id', promo.id);

        const voteCount = votes?.reduce((acc, vote) => acc + (vote.vote_type ? 1 : -1), 0) || 0;

        const userVote = user ? await supabase
          .from('promo_votes')
          .select('vote_type')
          .eq('promo_id', promo.id)
          .eq('user_id', user.id)
          .maybeSingle() : { data: null };

        const { count: commentCount } = await supabase
          .from('promo_comments')
          .select('id', { count: 'exact' })
          .eq('promo_id', promo.id);

        const displayName =
          promo.profiles?.display_name
          || (promo.profiles?.email ? promo.profiles.email.split('@')[0] : 'Anonymous User');
        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`;
        const email = promo.profiles?.email || '';

        return {
          ...promo,
          user: {
            id: promo.profiles?.id || 'anonymous',
            displayName,
            avatarUrl,
            email
          },
          votes: voteCount,
          comments: commentCount || 0,
          userVote: userVote?.vote_type ?? null
        };
      }));

      if (page === 1) {
        setPromoCodes(promosWithVotes);
      } else {
        setPromoCodes(prev => [...prev, ...promosWithVotes]);
      }
      setHasMore(promosWithVotes.length === 20);
    } catch (err: any) {
      console.error('Error fetching promo codes:', err);
      setError('Failed to load promo codes');
    } finally {
      setLoading(false);
      setIsFetchingMore(false);
    }
  };

  const handleVote = async (promoId: string, voteType: boolean) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    try {
      const promo = promoCodes.find(p => p.id === promoId);
      if (!promo) return;

      const oldVote = promo.userVote;
      let voteDiff = 0;

      if (oldVote === voteType) {
        await supabase
          .from('promo_votes')
          .delete()
          .eq('promo_id', promoId)
          .eq('user_id', user.id);
        voteDiff = voteType ? -1 : 1;
      } else {
        await supabase
          .from('promo_votes')
          .upsert({
            promo_id: promoId,
            user_id: user.id,
            vote_type: voteType
          }, {
            onConflict: 'promo_id,user_id'
          });
        voteDiff = oldVote === null ? (voteType ? 1 : -1) : (voteType ? 2 : -2);
      }

      setPromoCodes(codes => codes.map(code => {
        if (code.id === promoId) {
          return {
            ...code,
            votes: code.votes + voteDiff,
            userVote: oldVote === voteType ? null : voteType
          };
        }
        return code;
      }));
    } catch (err) {
      console.error('Error updating vote:', err);
      fetchPromoCodes();
    }
  };

  const handleCopyCode = (e: React.MouseEvent, code: string, promoId: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCodeId(promoId);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const formatTimeAgo = (dateString: string) => {
    const minutes = Math.floor((Date.now() - new Date(dateString).getTime()) / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  const getStoreName = (url: string) => {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace('www.', '').split('.')[0];
    } catch {
      return url;
    }
  };

  const formatExpiryDate = (date: string | null) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString();
  };

  const handleFilterChange = (type: 'categories' | 'stores', ids: string[]) => {
    if (type === 'categories') {
      setSelectedCategories(ids);
    } else {
      setSelectedStores(ids);
    }
  };

  const filteredPromoCodes = promoCodes.filter(promo => {
    if (selectedCategories.length > 0 && !selectedCategories.includes(promo.category_id)) {
      return false;
    }
    if (selectedStores.length > 0) {
      const storeName = getStoreName(promo.discount_url).toLowerCase();
      if (!selectedStores.some(store => storeName.includes(store.toLowerCase()))) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="pb-16 pt-16 bg-gray-900 min-h-screen">
      <SearchBar />

      <FilterBar
        selectedCategories={selectedCategories}
        selectedStores={selectedStores}
        onFilterChange={handleFilterChange}
      />

      <div className="px-4 pb-20">
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="text-red-500 text-center py-8">
            {error}
          </div>
        ) : filteredPromoCodes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPromoCodes.map(promo => (
              <Link
                key={promo.id}
                to={`/promos/${promo.id}`}
                className="bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-700 transition-colors flex flex-col h-full"
              >
                <div className="p-3 flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-gray-400 text-xs">
                      {formatTimeAgo(promo.created_at)}
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleVote(promo.id, true);
                          }}
                          className={`${promo.userVote === true ? 'text-red-500' : 'text-gray-400'}`}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <span className={`text-sm font-medium ${promo.votes > 0 ? 'text-red-500' : promo.votes < 0 ? 'text-blue-500' : 'text-gray-400'}`}>
                          {promo.votes > 0 ? '+' : ''}{promo.votes}°
                        </span>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleVote(promo.id, false);
                          }}
                          className={`${promo.userVote === false ? 'text-blue-500' : 'text-gray-400'}`}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                      </div>
                      <AdminActions
                        type="promo"
                        id={promo.id}
                        userId={promo.user.id}
                        onAction={fetchPromoCodes}
                      />
                    </div>
                  </div>

                  <div className="mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-medium text-sm">{promo.title}</h3>
                      {promo.expires_at && new Date(promo.expires_at) < new Date() && (
                        <div className="flex items-center bg-red-500/10 px-2 py-0.5 rounded text-red-500 text-xs font-medium">
                          <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Expired
                        </div>
                      )}
                    </div>
                    <div className="text-orange-500 text-xs mt-0.5">
                      {getStoreName(promo.discount_url)}
                    </div>
                  </div>

                  <div className="mb-2">
                    <p className="text-gray-400 text-sm line-clamp-2">{promo.description}</p>
                  </div>

                  <div className="flex items-center space-x-2 mb-2">
                    <div className="bg-gray-700 px-2 py-1 rounded border border-gray-600">
                      {user ? (
                        <span className="text-orange-500 font-mono text-sm">{promo.code}</span>
                      ) : (
                        <span className="italic text-gray-400 text-sm">Login to see code</span>
                      )}
                    </div>
                    {user && (
                      <button 
                        className={`text-sm transition-colors duration-200 ${
                          copiedCodeId === promo.id ? 'text-green-500' : 'text-orange-500'
                        }`}
                        onClick={(e) => handleCopyCode(e, promo.code, promo.id)}
                      >
                        {copiedCodeId === promo.id ? 'Copied!' : 'Copy'}
                      </button>
                    )}
                    {promo.expires_at && (
                      <div className="flex items-center text-gray-400 text-xs ml-auto" title="Expiration Date">
                        <Calendar className="h-3 w-3 mr-1" />
                        <span>Expires {formatExpiryDate(promo.expires_at)}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center">
                      <div className="w-4 h-4 rounded-full overflow-hidden bg-gray-700">
                        <img 
                          src={promo.user.avatarUrl}
                          alt={promo.user.displayName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="text-gray-400 ml-1">
                        {promo.user.displayName}
                      </span>
                    </div>
                    <div className="flex items-center text-gray-400">
                      <MessageSquare className="h-3 w-3 mr-1" />
                      <span>{promo.comments}</span>
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (navigator.share) {
                            navigator.share({
                              title: promo.title,
                              text: `Промокод: ${promo.code}`,
                              url: window.location.href
                            }).catch(console.error);
                          } else {
                            navigator.clipboard.writeText(window.location.href);
                            alert('Ссылка скопирована в буфер обмена!');
                          }
                        }}
                        className="ml-2 text-gray-400 hover:text-orange-500"
                      >
                        <Share2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-orange-500 text-center text-white py-2 text-sm font-medium">
                  Get Discount
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-gray-400 text-center py-8">
            No promo codes found
          </div>
        )}
      </div>
    </div>
  );
};

export default PromosPage;
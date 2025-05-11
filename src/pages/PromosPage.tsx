import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {MessageSquare, Calendar, Heart, Share2, ExternalLink, Edit2, Clock } from 'lucide-react';
import FilterBar from '../components/shared/FilterBar';
import { useNavigate, useSearchParams, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AdminActions from '../components/admin/AdminActions';
import { useAdmin } from '../hooks/useAdmin';
import { useGlobalState } from '../contexts/GlobalStateContext';
import VoteControls from '../components/deals/VoteControls';

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
  status: string | null; // Добавлен статус
}

const PromosPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { role } = useAdmin();
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
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const location = useLocation();

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    setPromoCodes([]);
    fetchPromoCodes();
    if (user) {
      loadFavorites();
    }
  }, [searchQuery, user, location.key]); // Added location.key

  const loadFavorites = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('promo_favorites')
        .select('promo_id')
        .eq('user_id', user.id);

      const favMap: Record<string, boolean> = {};
      if (data) {
        data.forEach(fav => {
          favMap[fav.promo_id] = true;
        });
      }
      setFavorites(favMap);
    } catch (err) {
      console.error('Error loading favorites:', err);
    }
  };

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
    setLoading(true);
    try {
      // Определяем права пользователя
      let isAdminOrModerator = false;
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_status')
          .eq('id', user.id)
          .single();

        isAdminOrModerator = ['admin', 'moderator', 'super_admin'].includes(profile?.user_status);
      }

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

      // Для всех показываем все промокоды, которые не находятся на модерации
      // (т.е. approved или null), и для пользователя также его собственные промокоды
      if (!isAdminOrModerator && user) {
        // Пользователи видят все не-pending промокоды или свои собственные
        query = query.or(`status.neq.pending,user_id.eq.${user?.id}`);
      } else if (!isAdminOrModerator && !user) {
        // Неавторизованные пользователи видят только не-pending промокоды
        query = query.not('status', 'eq', 'pending');
      }
      // Для админов и модераторов показываем все промокоды (фильтрация не применяется)


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


  const handleCopyCode = (e: React.MouseEvent, code: string, promoId: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCodeId(promoId);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const toggleFavorite = async (e: React.MouseEvent, promoId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      navigate('/auth');
      return;
    }

    try {
      if (favorites[promoId]) {
        // Remove from favorites
        await supabase
          .from('promo_favorites')
          .delete()
          .eq('promo_id', promoId)
          .eq('user_id', user.id);

        setFavorites(prev => {
          const newFavorites = { ...prev };
          delete newFavorites[promoId];
          return newFavorites;
        });
      } else {
        // Add to favorites
        await supabase
          .from('promo_favorites')
          .insert({
            promo_id: promoId,
            user_id: user.id
          });

        setFavorites(prev => ({
          ...prev,
          [promoId]: true
        }));
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
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
    <div className="pb-16 pt-0 bg-gray-900 min-h-screen">
      {/* Информационная строка о промоакциях */}
      <div className="bg-[#c1c1c1] dark:bg-gray-700/90 text-gray-500 dark:text-gray-200 text-[10px] text-center py-1 px-2">
        We may get paid by brands for deals, including promoted items.
      </div>
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
                    <VoteControls dealId={promo.id} type="promo" />
                  </div>

                  <div className="mb-2">
                    <div className="flex items-center">
                      <h3 className="text-white font-medium line-clamp-1">{promo.title}</h3>
                      {promo.status === 'pending' && (
                        <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-500 rounded-full">
                          На модерации
                        </span>
                      )}
                      {promo.expires_at && new Date(promo.expires_at) < new Date() && (
                        <span className="ml-2 px-2 py-0.5 text-xs bg-red-500/20 text-red-500 rounded-full">
                          Expired
                        </span>
                      )}
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
                    <div className="flex items-center">
                      <button
                        onClick={(e) => toggleFavorite(e, promo.id)}
                        className={`p-1 rounded-full ${favorites[promo.id] ? 'text-red-500' : 'text-gray-400'}`}
                      >
                        <Heart className="h-4 w-4" fill={favorites[promo.id] ? 'currentColor' : 'none'} />
                      </button>

                      <div className="ml-3 text-gray-400 flex items-center">
                        <MessageSquare className="h-4 w-4 mr-1" />
                        <span className="text-xs">{promo.comments}</span>
                      </div>

                      <button 
                        className="ml-3 text-orange-500 flex items-center"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (navigator.share) {
                            // Формируем правильный URL для конкретного промокода
                            const promoUrl = `${window.location.origin}/promos/${promo.id}`;
                            navigator.share({
                              title: promo.title,
                              url: promoUrl
                            }).catch(console.error);
                          } else {
                            // Формируем правильный URL для копирования
                            const promoUrl = `${window.location.origin}/promos/${promo.id}`;
                            navigator.clipboard.writeText(promoUrl);
                            alert('Ссылка скопирована в буфер обмена!');
                          }
                        }}
                      >
                        <Share2 className="h-4 w-4" />
                      </button>
                      {user && user.id === promo.user.id && 
                        new Date().getTime() - new Date(promo.created_at).getTime() < 24 * 60 * 60 * 1000 && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              navigate(`/promos/${promo.id}/edit`);
                            }}
                            className="ml-3 text-orange-500 flex items-center"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )
                      }
                      <button className="ml-3 text-orange-500 flex items-center">
                        <span className="text-xs mr-1">View</span>
                        <ExternalLink className="h-3 w-3" />
                      </button>

                      {/* Индикатор модерации */}
                      {promo.status === 'pending' && (
                        <div className="ml-3 text-yellow-500 flex items-center text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          На модерации
                        </div>
                      )}
                      {(role === 'admin' || role === 'moderator' || (user && user.id === promo.user.id)) && (
                        <div className="ml-2 border-l border-gray-700 pl-2" onClick={(e) => e.stopPropagation()}>
                          <AdminActions
                            type="promo"
                            id={promo.id}
                            userId={promo.user.id}
                            onAction={fetchPromoCodes}
                          />
                        </div>
                      )}
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
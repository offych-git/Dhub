import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Calendar, Share2, Edit2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import DealCard from '../components/deals/DealCard';
import { Deal } from '../types';

type SortOption = 'newest' | 'oldest' | 'popular';

const UserPostedItemsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [promos, setPromos] = useState<any[]>([]);
  const [sweepstakes, setSweepstakes] = useState<Deal[]>([]);
  const [activeTab, setActiveTab] = useState<'deals' | 'promos' | 'sweepstakes'>('deals');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setPage(1);
      setHasMore(true);
      setDeals([]);
      setPromos([]);
      loadUserItems();
    }
  }, [user, sortBy, activeTab]);

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
    if (page > 1 && user) {
      loadUserItems();
    }
  }, [page]);

  const loadUserItems = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    if (page === 1) {
      setLoading(true);
    } else {
      setIsFetchingMore(true);
    }

    try {
      // Load deals with sorting
      let dealsQuery = supabase
        .from('deals')
        .select(`
          *,
          profiles (
            id,
            email,
            display_name
          ),
          deal_comments (
            id
          )
        `)
        .eq('user_id', user.id)
        .eq('type', 'deal');

      // Load sweepstakes with sorting
      let sweepstakesQuery = supabase
        .from('deals')
        .select(`
          *,
          profiles (
            id,
            email,
            display_name
          ),
          deal_comments (
            id
          )
        `)
        .eq('user_id', user.id)
        .eq('type', 'sweepstakes');

      switch (sortBy) {
        case 'oldest':
          dealsQuery = dealsQuery.order('created_at', { ascending: true });
          break;
        case 'popular':
          dealsQuery = dealsQuery.order('vote_count', { ascending: false })
            .order('created_at', { ascending: false });
          break;
        case 'newest':
        default:
          dealsQuery = dealsQuery.order('created_at', { ascending: false });
          break;
      }

      dealsQuery = dealsQuery.range((page - 1) * 20, page * 20 - 1);
      const { data: dealsData, error: dealsError } = await dealsQuery;

      if (dealsError) throw dealsError;

      const transformedDeals = dealsData?.map(deal => ({
        id: deal.id,
        title: deal.title,
        currentPrice: parseFloat(deal.current_price),
        originalPrice: deal.original_price ? parseFloat(deal.original_price) : undefined,
        store: { id: deal.store_id, name: deal.store_id },
        category: { id: deal.category_id, name: deal.category_id },
        image: deal.image_url,
        postedAt: new Date(deal.created_at).toLocaleDateString(),
        popularity: deal.vote_count || 0,
        comments: deal.deal_comments?.count || 0,
        postedBy: {
          id: deal.profiles?.id || 'anonymous',
          name: deal.profiles?.display_name || deal.profiles?.email?.split('@')[0] || 'Anonymous',
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(deal.profiles?.display_name || deal.profiles?.email || 'Anonymous')}&background=random`
        },
        description: deal.description,
        url: deal.deal_url,
        createdAt: deal.created_at, 
        expires_at: deal.expires_at 
      }));

      if (page === 1) {
        setDeals(transformedDeals || []);
      } else {
        setDeals(prev => [...prev, ...(transformedDeals || [])]);
      }
      setHasMore((transformedDeals || []).length === 20);

      // Process sweepstakes query
      switch (sortBy) {
        case 'oldest':
          sweepstakesQuery = sweepstakesQuery.order('created_at', { ascending: true });
          break;
        case 'popular':
          sweepstakesQuery = sweepstakesQuery.order('vote_count', { ascending: false })
            .order('created_at', { ascending: false });
          break;
        case 'newest':
        default:
          sweepstakesQuery = sweepstakesQuery.order('created_at', { ascending: false });
          break;
      }

      const { data: sweepstakesData, error: sweepstakesError } = await sweepstakesQuery;

      if (sweepstakesError) throw sweepstakesError;

      const transformedSweepstakes = sweepstakesData?.map(deal => ({
        id: deal.id,
        title: deal.title,
        currentPrice: parseFloat(deal.current_price),
        originalPrice: deal.original_price ? parseFloat(deal.original_price) : undefined,
        store: { id: deal.store_id, name: deal.store_id },
        category: { id: deal.category_id, name: deal.category_id },
        image: deal.image_url,
        postedAt: new Date(deal.created_at).toLocaleDateString(),
        popularity: deal.vote_count || 0,
        comments: deal.deal_comments?.count || 0,
        postedBy: {
          id: deal.profiles?.id || 'anonymous',
          name: deal.profiles?.display_name || deal.profiles?.email?.split('@')[0] || 'Anonymous',
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(deal.profiles?.display_name || deal.profiles?.email || 'Anonymous')}&background=random`
        },
        description: deal.description,
        url: deal.deal_url,
        createdAt: deal.created_at,
        expires_at: deal.expires_at,
        type: 'sweepstakes'
      }));

      setSweepstakes(transformedSweepstakes || []);

      // Load promos with sorting
      let promosQuery = supabase
        .from('promo_codes')
        .select(`
          *,
          profiles!promo_codes_user_id_fkey (
            id,
            email,
            display_name
          ),
          promo_comments (
            id
          )
        `)
        .eq('user_id', user.id);

      switch (sortBy) {
        case 'oldest':
          promosQuery = promosQuery.order('created_at', { ascending: true });
          break;
        case 'popular':
          promosQuery = promosQuery.order('vote_count', { ascending: false })
            .order('created_at', { ascending: false });
          break;
        case 'newest':
        default:
          promosQuery = promosQuery.order('created_at', { ascending: false });
          break;
      }

      const { data: promosData, error: promosError } = await promosQuery;

      if (promosError) throw promosError;

      setPromos(promosData || []);
    } catch (error) {
      console.error('Error loading user items:', error);
    } finally {
      setLoading(false);
      setIsFetchingMore(false);
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

  return (
    <div className="pb-16 pt-0 bg-gray-900 min-h-screen">
      <div className="fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 px-4 py-3 z-10">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button onClick={() => navigate(-1)} className="text-white">
                <ArrowLeft className="h-6 w-6" />
              </button>
              <h1 className="text-white font-medium ml-4">My Posted Items</h1>
            </div>
            <div className="flex items-center space-x-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-gray-800 text-white text-sm rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 appearance-none flex-shrink-0"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="popular">Popular</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="flex space-x-2 mb-4 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          <button 
            className={`px-4 py-2 rounded-full whitespace-nowrap ${activeTab === 'deals' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'}`}
            onClick={() => setActiveTab('deals')}
          >
            Deals ({deals.length})
          </button>
          <button 
            className={`px-4 py-2 rounded-full whitespace-nowrap ${activeTab === 'promos' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'}`}
            onClick={() => setActiveTab('promos')}
          >
            Promos ({promos.length})
          </button>
          <button 
            className={`px-4 py-2 rounded-full whitespace-nowrap ${activeTab === 'sweepstakes' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'}`}
            onClick={() => setActiveTab('sweepstakes')}
          >
            Sweepstakes ({sweepstakes.length})
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : !user?.id ? (
          <div className="text-center text-gray-400 py-8">
            Please sign in to view your posted items
          </div>
        ) : deals.length === 0 && promos.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            You haven't posted any deals or promos yet
          </div>
        ) : (
          <div className="space-y-6">
            {/* Deals */}
            {activeTab === 'deals' && deals.length > 0 && (
              <div className="space-y-4">
                {deals.map(deal => (
                  <DealCard
                    key={deal.id}
                    deal={{...deal, postedAt: {relative: deal.postedAt, exact: new Date(deal.createdAt).toLocaleString()}}}
                    onVoteChange={loadUserItems}
                  />
                ))}
              </div>
            )}

            {/* Sweepstakes */}
            {activeTab === 'sweepstakes' && sweepstakes.length > 0 && (
              <div className="space-y-4">
                {sweepstakes.map(sweepstake => (
                  <DealCard
                    key={`sweepstake-${sweepstake.id}`}
                    deal={{
                      ...sweepstake, 
                      postedAt: {
                        relative: sweepstake.postedAt, 
                        exact: new Date(sweepstake.createdAt).toLocaleString()
                      },
                      // Override store name to prevent showing additional text
                      store: { ...sweepstake.store, name: '' }
                    }}
                    onVoteChange={loadUserItems}
                    hideFreeLabel={true}
                  />
                ))}
              </div>
            )}

            {/* Promos */}
            {activeTab === 'promos' && promos.length > 0 && (
              <div className="space-y-4">
                {promos.map(promo => (
                  <div
                    key={promo.id}
                    onClick={() => navigate(`/promos/${promo.id}`)}
                    className="bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-700 transition-colors cursor-pointer"
                  >
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-gray-400 text-xs" title={new Date(promo.created_at).toLocaleString()}>
                          {formatTimeAgo(promo.created_at)}
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center space-x-1">
                            <span className={`text-sm font-medium ${(promo.vote_count || 0) > 0 ? 'text-red-500' : (promo.vote_count || 0) < 0 ? 'text-blue-500' : 'text-gray-400'}`}>
                              {(promo.vote_count || 0) > 0 ? '+' : ''}{promo.vote_count || 0}°
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mb-2">
                      <div className="flex items-center">
                        <h3 className="text-white font-medium line-clamp-1">{promo.title}</h3>
                        {promo.status === 'pending' && (
                          <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-500 rounded-full">
                            На модерации
                          </span>
                        )}
                        {promo.status === 'rejected' && (
                          <span className="ml-2 px-2 py-0.5 text-xs bg-red-500/20 text-red-500 rounded-full">
                            Отклонен
                          </span>
                        )}
                      </div>
                    </div>

                      <div className="mb-2">
                        <p className="text-gray-400 text-sm line-clamp-2">{promo.description}</p>
                      </div>

                      <div className="flex items-center space-x-2 mb-2">
                        <div className="bg-gray-700 px-2 py-1 rounded border border-gray-600">
                          <span className="text-orange-500 font-mono text-sm">{promo.code}</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(promo.code);
                            setCopiedCodeId(promo.id);
                            setTimeout(() => setCopiedCodeId(null), 2000);
                          }}
                          className={`text-sm ${copiedCodeId === promo.id ? 'text-green-500' : 'text-orange-500'}`}
                        >
                          {copiedCodeId === promo.id ? 'Copied!' : 'Copy'}
                        </button>
                        {promo.expires_at && (
                          <div className="flex items-center text-gray-400 text-xs ml-auto">
                            <Calendar className="h-3 w-3 mr-1" />
                            <span>Expires {new Date(promo.expires_at).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center">
                          <div className="w-4 h-4 rounded-full overflow-hidden bg-gray-700">
                            <img
                              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(promo.profiles?.display_name || promo.profiles?.email || 'Anonymous')}&background=random`}
                              alt={promo.profiles?.display_name || 'Anonymous'}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <span className="text-gray-400 ml-1">
                            {promo.profiles?.display_name || promo.profiles?.email?.split('@')[0] || 'Anonymous'}
                          </span>
                        </div>
                        <div className="flex items-center text-gray-400">
                          <MessageSquare className="h-3 w-3 mr-1" />
                          <span>{promo.promo_comments?.length || 0}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Формируем правильный URL для конкретного промокода
                              const promoUrl = `${window.location.origin}/promos/${promo.id}`;

                              // Очищаем HTML-теги из заголовка
                              const cleanTitle = promo.title ? promo.title.replace(/<[^>]*>/g, '') : '';

                              // Для мобильных устройств используем только текст для лучшей совместимости
                              const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

                              try {
                                if (navigator.share) {
                                  if (isMobile) {
                                    // На мобильных только text для максимальной совместимости
                                    navigator.share({
                                      text: `${cleanTitle}\n${promoUrl}`
                                    });
                                  } else {
                                    // На десктопе используем полный набор параметров
                                    navigator.share({
                                      title: cleanTitle,
                                      text: `${cleanTitle}\n${promoUrl}`,
                                      url: promoUrl
                                    });
                                  }
                                } else {
                                  navigator.clipboard.writeText(`${cleanTitle}\n${promoUrl}`);
                                  alert('Ссылка скопирована в буфер обмена!');
                                }
                              } catch (error) {
                                console.error('Ошибка при шаринге:', error);
                              }
                            }}
                            className="ml-2 text-orange-500"
                          >
                            <Share2 className="h-3 w-3" />
                          </button>
                          <button 
                            onClick={(e)=>{
                              e.stopPropagation();
                              e.preventDefault();
                              navigate(`/promos/${promo.id}/edit`);
                            }} 
                            className="ml-2 text-orange-500"
                          >
                            <Edit2 className="h-4 w-4"/>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-orange-500 text-center text-white py-2 text-sm font-medium">
                      Get Discount
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserPostedItemsPage;
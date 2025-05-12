import React, { useState, useEffect } from 'react';
import VoteControls from '../components/deals/VoteControls';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Edit2, Share2, MessageSquare, Calendar, Heart, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import DealCard from '../components/deals/DealCard';
import { Deal } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

type SortOption = 'newest' | 'oldest' | 'popular';

const CategoryItemsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { categoryId } = useParams<{ categoryId: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [categoryDeals, setCategoryDeals] = useState<Deal[]>([]);
  const [categoryPromos, setCategoryPromos] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'deals' | 'promos'>('deals');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [categoryName, setCategoryName] = useState<string>('');

  // Получаем имя категории из state или через API
  useEffect(() => {
    if (location.state?.categoryName) {
      setCategoryName(location.state.categoryName);
    } else {
      // Если имя не передано через state, используем categoryId
      setCategoryName(categoryId || '');

      // Дополнительно можно загрузить имя категории через API если необходимо
      // Например: fetch(`/api/categories/${categoryId}`).then(...)
    }
  }, [categoryId, location.state]);

  useEffect(() => {
    loadCategoryItems();
    if (user) {
      loadFavorites();
    }
  }, [categoryId, user, sortBy, activeTab]);

  const loadFavorites = async () => {
    if (!user) return;

    try {
      // Load deal favorites
      const { data: dealFavorites } = await supabase
        .from('deal_favorites')
        .select('deal_id')
        .eq('user_id', user.id);

      // Load promo favorites
      const { data: promoFavorites } = await supabase
        .from('promo_favorites')
        .select('promo_id')
        .eq('user_id', user.id);

      const favMap: Record<string, boolean> = {};
      if (dealFavorites) {
        dealFavorites.forEach(fav => {
          favMap[fav.deal_id] = true;
        });
      }
      if (promoFavorites) {
        promoFavorites.forEach(fav => {
          favMap[fav.promo_id] = true;
        });
      }
      setFavorites(favMap);
    } catch (err) {
      console.error('Error loading favorites:', err);
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

  const loadCategoryItems = async () => {
    if (!categoryId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Load deals for this category
      let dealsQuery = supabase
        .from('deals')
        .select(`
          *,
          profiles!deals_user_id_fkey (
            id,
            email,
            display_name
          ),
          deal_comments (
            id
          )
        `)
        .eq('category_id', categoryId)
        .eq('status', 'published');

      // Apply sorting
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

      const { data: dealsData, error: dealsError } = await dealsQuery;

      if (dealsError) {
        throw dealsError;
      }

      if (dealsData) {
        const deals = dealsData.map(deal => ({
          id: deal.id,
          title: deal.title,
          currentPrice: parseFloat(deal.current_price),
          originalPrice: deal.original_price ? parseFloat(deal.original_price) : undefined,
          store: { id: deal.store_id, name: deal.store_id },
          category: { id: deal.category_id, name: deal.category_id },
          image: deal.image_url,
          postedAt: {
            relative: formatTimeAgo(deal.created_at),
            exact: new Date(deal.created_at).toLocaleString()
          },
          popularity: deal.vote_count || 0,
          comments: deal.deal_comments?.length || 0,
          postedBy: {
            id: deal.profiles.id,
            name: deal.profiles.display_name || deal.profiles.email.split('@')[0],
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(deal.profiles.display_name || deal.profiles.email)}&background=random`
          },
          description: deal.description,
          url: deal.deal_url
        }));

        setCategoryDeals(deals);
      } else {
        setCategoryDeals([]);
      }

      // Load promos for this category
      let promosQuery = supabase
        .from('promo_codes')
        .select(`
          *,
          profiles:user_id (
            id,
            email,
            display_name
          ),
          promo_comments:promo_comments!promo_comments_promo_id_fkey (
            id
          )
        `)
        .eq('category_id', categoryId);

      // Apply sorting to promos
      switch (sortBy) {
        case 'oldest':
          promosQuery = promosQuery.order('created_at', { ascending: true });
          break;
        case 'popular':
          // We'll sort by votes after fetching
          promosQuery = promosQuery.order('created_at', { ascending: false });
          break;
        case 'newest':
        default:
          promosQuery = promosQuery.order('created_at', { ascending: false });
          break;
      }

      const { data: promosData, error: promosError } = await promosQuery;

      if (promosError) {
        throw promosError;
      }

      if (promosData) {
        // Get votes for promos
        const promoIds = promosData.map(promo => promo.id);
        const { data: votesData } = await supabase
          .from('promo_votes')
          .select('promo_id, vote_type')
          .in('promo_id', promoIds);

        // Calculate vote counts for each promo
        const votesByPromo: Record<string, number> = {};
        if (votesData) {
          votesData.forEach(vote => {
            if (!votesByPromo[vote.promo_id]) {
              votesByPromo[vote.promo_id] = 0;
            }
            votesByPromo[vote.promo_id] += vote.vote_type ? 1 : -1;
          });
        }

        // Add vote counts to promos
        promosData.forEach(promo => {
          promo.vote_count = votesByPromo[promo.id] || 0;
        });

        // Apply popularity sorting if needed
        if (sortBy === 'popular') {
          promosData.sort((a, b) => ((b.vote_count || 0) - (a.vote_count || 0)));
        }

        setCategoryPromos(promosData);
      } else {
        setCategoryPromos([]);
      }
    } catch (error) {
      console.error('Error loading category items:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (e: React.MouseEvent, itemId: string, type: 'deal' | 'promo') => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      navigate('/auth');
      return;
    }

    try {
      if (favorites[itemId]) {
        // Remove from favorites
        await supabase
          .from(type === 'deal' ? 'deal_favorites' : 'promo_favorites')
          .delete()
          .eq(type === 'deal' ? 'deal_id' : 'promo_id', itemId)
          .eq('user_id', user.id);

        setFavorites(prev => {
          const newFavorites = { ...prev };
          delete newFavorites[itemId];
          return newFavorites;
        });
      } else {
        // Add to favorites
        await supabase
          .from(type === 'deal' ? 'deal_favorites' : 'promo_favorites')
          .insert({
            [type === 'deal' ? 'deal_id' : 'promo_id']: itemId,
            user_id: user.id
          });

        setFavorites(prev => ({
          ...prev,
          [itemId]: true
        }));
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  const handleCopyCode = (e: React.MouseEvent, code: string, promoId: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCodeId(promoId);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const formatExpiryDate = (date: string | null) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="pb-24 pt-0 bg-gray-900 min-h-screen">
      <div className="fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 px-4 py-3 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => navigate(-1)} className="text-white">
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-white font-medium ml-4">{categoryName}</h1>
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

      <div className="px-4 pt-4">
        <div className="flex space-x-2 mb-4 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          <button
            className={`px-4 py-2 rounded-full whitespace-nowrap ${activeTab === 'deals' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'}`}
            onClick={() => setActiveTab('deals')}
          >
            Deals ({categoryDeals.length})
          </button>
          <button
            className={`px-4 py-2 rounded-full whitespace-nowrap ${activeTab === 'promos' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'}`}
            onClick={() => setActiveTab('promos')}
          >
            Promos ({categoryPromos.length})
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : categoryDeals.length === 0 && categoryPromos.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            {t('common.no_items_in_category', 'No items in this category')}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Category Deals */}
            {activeTab === 'deals' && categoryDeals.length > 0 && (
              <div className="space-y-4">
                {categoryDeals.map(deal => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    onVoteChange={loadCategoryItems}
                  />
                ))}
              </div>
            )}

            {/* Category Promos */}
            {activeTab === 'promos' && categoryPromos.length > 0 && (
              <div className="space-y-4">
                {categoryPromos.map(promo => (
                  <div
                    key={promo.id}
                    onClick={() => navigate(`/promos/${promo.id}`)}
                    className="bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-700 transition-colors cursor-pointer"
                  >
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-gray-400 text-xs">
                          {formatTimeAgo(promo.created_at)}
                        </div>
                        <div className="flex items-center space-x-2">
                          <VoteControls dealId={promo.id} type="promo" />
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
                              {t('common.expired', 'Expired')}
                            </div>
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
                          onClick={(e) => handleCopyCode(e, promo.code, promo.id)}
                          className={`text-sm ${copiedCodeId === promo.id ? 'text-green-500' : 'text-orange-500'}`}
                        >
                          {copiedCodeId === promo.id ? t('common.copied', 'Copied!') : t('common.copy', 'Copy')}
                        </button>
                        {promo.expires_at && (
                          <div className="flex items-center text-gray-400 text-xs ml-auto" title="Expiration Date">
                            <Calendar className="h-3 w-3 mr-1" />
                            <span>{t('common.expires', 'Expires')} {formatExpiryDate(promo.expires_at)}</span>
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

                        <div className="flex items-center">
                          <button 
                            className={`p-1 rounded-full ${favorites[promo.id] ? 'text-red-500' : 'text-gray-400'}`}
                            onClick={(e) => toggleFavorite(e, promo.id, 'promo')}
                          >
                            <Heart className="h-4 w-4" fill={favorites[promo.id] ? 'currentColor' : 'none'} />
                          </button>

                          <div className="ml-3 text-gray-400 flex items-center">
                            <MessageSquare className="h-4 w-4 mr-1" />
                            <span className="text-xs">{promo.promo_comments?.length || 0}</span>
                          </div>

                          <button 
                            className="ml-3 text-orange-500 flex items-center"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const promoUrl = `${window.location.origin}/promos/${promo.id}`;
                              if (navigator.share) {
                                navigator.share({
                                  title: promo.title,
                                  text: `Промокод: ${promo.code}`,
                                  url: promoUrl
                                }).catch(console.error);
                              } else {
                                navigator.clipboard.writeText(promoUrl);
                                alert(t('common.link_copied', 'Ссылка скопирована в буфер обмена!'));
                              }
                            }}
                          >
                            <Share2 className="h-4 w-4" />
                          </button>

                          {user && user.id === promo.user_id && 
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
                            <span className="text-xs mr-1">{t('common.view', 'View')}</span>
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-orange-500 text-center text-white py-2 text-sm font-medium">
                      {t('promo.get_discount', 'Get Discount')}
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

export default CategoryItemsPage;

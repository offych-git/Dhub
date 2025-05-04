import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import DealCard from '../components/deals/DealCard';
import { Deal } from '../types';

type SortOption = 'newest' | 'oldest' | 'popular';

const SavedItemsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savedDeals, setSavedDeals] = useState<Deal[]>([]);
  const [savedPromos, setSavedPromos] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'deals' | 'promos'>('deals');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  const formatTimeAgo = (dateString: string) => {
    const minutes = Math.floor((Date.now() - new Date(dateString).getTime()) / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  useEffect(() => {
    if (user) {
      loadSavedItems();
    }
  }, [user, sortBy, activeTab]);

  const getStoreName = (url: string) => {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace('www.', '').split('.')[0];
    } catch {
      return url;
    }
  };

  const loadSavedItems = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Load saved deals
      const { data: dealFavorites, error: dealError } = await supabase
        .from('deal_favorites')
        .select('deal_id')
        .eq('user_id', user.id);

      if (dealError) {
        throw dealError;
      }

      if (dealFavorites && dealFavorites.length > 0) {
        const dealIds = dealFavorites.map(fav => fav.deal_id);

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
          .in('id', dealIds);

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
            postedAt: new Date(deal.created_at).toLocaleDateString(),
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

          setSavedDeals(deals);
        }
      } else {
        setSavedDeals([]);
      }

      // Load saved promos - простой запрос только для получения ID
      const { data: promoFavorites, error: promoError } = await supabase
        .from('promo_favorites')
        .select('promo_id')
        .eq('user_id', user.id);

      if (promoError) {
        throw promoError;
      }

      if (promoFavorites) {
        console.log("Структура данных promoFavorites:", JSON.stringify(promoFavorites));

        // Получаем ID сохраненных промокодов
        const promoIds = promoFavorites.map(fav => fav.promo_id);
        console.log("ID избранных промокодов:", promoIds);

        // Если есть избранные промокоды, загружаем их полные данные отдельным запросом
        let promos = [];

        if (promoIds.length > 0) {
          // Загружаем полные данные промокодов
          const { data: promosData, error: promosError } = await supabase
            .from('promo_codes')
            .select(`
              *,
              profiles:user_id (
                id,
                email,
                display_name
              ),
              promo_comments!promo_comments_promo_id_fkey (
                id
              )
            `)
            .in('id', promoIds);

          if (promosError) {
            console.error("Ошибка при загрузке промокодов:", promosError);
          } else if (promosData) {
            promos = promosData;
            console.log("Загружены данные промокодов:", JSON.stringify(promosData));
            console.log("Количество полученных промокодов:", promosData.length);
          }
        }

        // Отладочный вывод
        console.log("Загружено избранных промо-кодов:", promoFavorites.length);
        console.log("После обработки промо-кодов:", promos.length);

        // Apply sorting to promo comments
        if (promos && promos.length > 0) {
          switch (sortBy) {
            case 'oldest':
              promos.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
              break;
            case 'popular':
              promos.sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0));
              break;
            case 'newest':
            default:
              promos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
              break;
          }

          console.log("Отсортированные промокоды:", promos.length);
        } else {
          console.log("Нет промокодов для сортировки");
        }

        setSavedPromos(promos || []);
      }
    } catch (error) {
      console.error('Error loading saved items:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-16 pt-0 bg-gray-900 min-h-screen">
      <div className="fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 px-4 py-3 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => navigate(-1)} className="text-white">
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-white font-medium ml-4">Saved Items</h1>
          </div>
          <div className="flex items-center space-x-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="appearance-none bg-gray-800 text-white text-sm rounded-md pl-3 pr-8 py-1 focus:outline-none focus:ring-2 focus:ring-orange-500"
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
            Deals ({savedDeals.length})
          </button>
          <button 
            className={`px-4 py-2 rounded-full whitespace-nowrap ${activeTab === 'promos' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'}`}
            onClick={() => setActiveTab('promos')}
          >
            Promos ({savedPromos.length})
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : !user ? (
          <div className="text-center text-gray-400 py-8">
            Please sign in to view your saved items
          </div>
        ) : savedDeals.length === 0 && savedPromos.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            No saved items yet
          </div>
        ) : (
          <div className="space-y-6">
            {/* Saved Deals */}
            {activeTab === 'deals' && savedDeals.length > 0 && (
              <div className="space-y-4">
                {savedDeals.map(deal => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    onVoteChange={loadSavedItems}
                  />
                ))}
              </div>
            )}

            {/* Saved Promos */}
            {activeTab === 'promos' && savedPromos.length > 0 && (
              <div className="space-y-4">
                {savedPromos.map(promo => (
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
                          <div className="flex items-center space-x-1">
                            <span className={`text-sm font-medium ${(promo.vote_count || 0) > 0 ? 'text-red-500' : (promo.vote_count || 0) < 0 ? 'text-blue-500' : 'text-gray-400'}`}>
                              {(promo.vote_count || 0) > 0 ? '+' : ''}{promo.vote_count || 0}°
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mb-2">
                        <h3 className="text-white font-medium text-sm">{promo.title}</h3>
                        <div className="text-orange-500 text-xs mt-0.5">
                          {getStoreName(promo.discount_url)}
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

export default SavedItemsPage;
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import DealCard from '../components/deals/DealCard';
import { Deal } from '../types';

const SavedItemsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savedDeals, setSavedDeals] = useState<Deal[]>([]);
  const [savedPromos, setSavedPromos] = useState<any[]>([]);

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
  }, [user]);

  const loadSavedItems = async () => {
    try {
      // Load saved deals
      const { data: dealFavorites, error: dealError } = await supabase
        .from('deal_favorites')
        .select('deal_id')
        .eq('user_id', user!.id);

      if (dealError) {
        throw dealError;
      }

      if (dealFavorites && dealFavorites.length > 0) {
        const dealIds = dealFavorites.map(fav => fav.deal_id);

        const { data: dealsData, error: dealsError } = await supabase
          .from('deals')
          .select(`
            *,
            profiles (
              id,
              email,
              display_name
            )
          `)
          .in('id', dealIds);

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
            popularity: 0, // You might want to load this separately
            comments: 0, // You might want to load this separately
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

      // Load saved promos
      const { data: promoFavorites } = await supabase
        .from('promo_favorites')
        .select(`
          promo_id,
          promo_codes (
            *,
            profiles (
              id,
              email,
              display_name
            )
          )
        `)
        .eq('user_id', user!.id);

      if (promoFavorites) {
        const promos = promoFavorites
          .map(fav => fav.promo_codes)
          .filter(Boolean);

        setSavedPromos(promos);
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
        <div className="flex items-center">
          <button onClick={() => navigate(-1)} className="text-white">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-white font-medium ml-4">Saved Items</h1>
        </div>
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : savedDeals.length === 0 && savedPromos.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            No saved items yet
          </div>
        ) : (
          <div className="space-y-6">
            {/* Saved Deals */}
            {savedDeals.length > 0 && (
              <div>
                <h2 className="text-white font-medium mb-4">Saved Deals</h2>
                <div className="space-y-4">
                  {savedDeals.map(deal => (
                    <DealCard
                      key={deal.id}
                      deal={deal}
                      onVoteChange={loadSavedItems}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Saved Promos */}
            {savedPromos.length > 0 && (
              <div>
                <h2 className="text-white font-medium mb-4">Saved Promo Codes</h2>
                <div className="grid gap-4">
                  {savedPromos.map(promo => (
                    <div
                      key={promo.id}
                      className="bg-gray-800 rounded-lg overflow-hidden"
                    >
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-gray-400 text-xs">
                            {formatTimeAgo(promo.created_at)}
                          </div>
                        </div>
                        <h3 className="text-white font-medium">{promo.title}</h3>
                        <div className="mt-2 flex items-center space-x-2">
                          <div className="bg-gray-700 px-3 py-1 rounded border border-gray-600">
                            <span className="text-orange-500 font-mono">{promo.code}</span>
                          </div>
                          <span className="text-gray-400">{promo.description}</span>
                        </div>
                      </div>
                      <a
                        href={promo.discount_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block bg-orange-500 text-center text-white py-2"
                      >
                        Use Code
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SavedItemsPage;
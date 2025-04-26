import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import DealCard from '../components/deals/DealCard';
import { Deal } from '../types';

const UserCommentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dealComments, setDealComments] = useState<any[]>([]);
  const [promoComments, setPromoComments] = useState<any[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);

  useEffect(() => {
    if (user?.id) {
      loadUserComments();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadUserComments = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      // Load deal comments
      const { data: dealCommentsData, error: dealCommentsError } = await supabase
        .from('deal_comments')
        .select(`
          *,
          deals (
            *,
            profiles (
              id,
              email,
              display_name
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (dealCommentsError) throw dealCommentsError;

      // Transform deals data
      const dealsWithComments = dealCommentsData
        ?.filter(comment => comment?.deals)
        .map(comment => ({
          id: comment.deals.id,
          title: comment.deals.title,
          currentPrice: parseFloat(comment.deals.current_price),
          originalPrice: comment.deals.original_price ? parseFloat(comment.deals.original_price) : undefined,
          store: { id: comment.deals.store_id, name: comment.deals.store_id },
          category: { id: comment.deals.category_id, name: comment.deals.category_id },
          image: comment.deals.image_url,
          postedAt: new Date(comment.deals.created_at).toLocaleDateString(),
          popularity: 0,
          comments: 0,
          postedBy: {
            id: comment.deals.profiles?.id,
            name: comment.deals.profiles?.display_name || comment.deals.profiles?.email?.split('@')[0] || 'Anonymous',
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.deals.profiles?.display_name || comment.deals.profiles?.email || 'Anonymous')}&background=random`
          },
          description: comment.deals.description,
          url: comment.deals.deal_url,
          userComment: {
            content: comment.content,
            createdAt: new Date(comment.created_at).toLocaleString()
          }
        }));

      setDeals(dealsWithComments || []);

      // Load promo comments
      const { data: promoCommentsData, error: promoCommentsError } = await supabase
        .from('promo_comments')
        .select(`
          *,
          promo_codes (
            *,
            profiles (
              id,
              email,
              display_name
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (promoCommentsError) throw promoCommentsError;

      const promosWithComments = promoCommentsData
        ?.filter(comment => comment?.promo_codes)
        .map(comment => ({
          ...comment.promo_codes,
          userComment: {
            content: comment.content,
            createdAt: new Date(comment.created_at).toLocaleString()
          }
        }));

      setPromoComments(promosWithComments || []);
    } catch (error) {
      console.error('Error loading user comments:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 pb-16 pt-16">
      <div className="fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 px-4 py-3 z-10">
        <div className="flex items-center">
          <button onClick={() => navigate(-1)} className="text-white">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-white font-medium ml-4">My Comments</h1>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : !user?.id ? (
          <div className="text-center text-gray-400 py-8">
            Please sign in to view your comments
          </div>
        ) : deals.length === 0 && promoComments.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            You haven't commented on any deals or promos yet
          </div>
        ) : (
          <div className="space-y-6">
            {/* Deal Comments */}
            {deals.length > 0 && (
              <div>
                <h2 className="text-white font-medium mb-4">Deal Comments</h2>
                <div className="space-y-4">
                  {deals.map(deal => (
                    <div key={deal.id} className="space-y-2">
                      <DealCard deal={deal} onVoteChange={loadUserComments} />
                      <div className="bg-gray-800 rounded-md p-3 ml-4 border-l-2 border-orange-500">
                        <div className="text-gray-400 text-sm mb-1">
                          Your comment on {deal.userComment.createdAt}:
                        </div>
                        <div className="text-white">
                          {deal.userComment.content}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Promo Comments */}
            {promoComments.length > 0 && (
              <div>
                <h2 className="text-white font-medium mb-4">Promo Comments</h2>
                <div className="space-y-4">
                  {promoComments.map(promo => (
                    <div key={promo.id} className="bg-gray-800 rounded-lg overflow-hidden">
                      <div className="p-4">
                        <h3 className="text-white font-medium">{promo.title}</h3>
                        <div className="mt-2 flex items-center space-x-2">
                          <div className="bg-gray-700 px-3 py-1 rounded border border-gray-600">
                            <span className="text-orange-500 font-mono">{promo.code}</span>
                          </div>
                        </div>
                        <div className="mt-4 bg-gray-700 rounded-md p-3 border-l-2 border-orange-500">
                          <div className="text-gray-400 text-sm mb-1">
                            Your comment on {promo.userComment.createdAt}:
                          </div>
                          <div className="text-white">
                            {promo.userComment.content}
                          </div>
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

export default UserCommentsPage;
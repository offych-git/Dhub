import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import DealCard from '../components/deals/DealCard';
import { Deal } from '../types';

type SortOption = 'newest' | 'oldest' | 'popular';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  like_count?: number;
  parent_id?: string;
  replies: Comment[];
  deals?: {
    id: string;
    title: string;
    current_price: string;
    original_price?: string;
    store_id: string;
    category_id: string;
    image_url: string;
    deal_url: string;
    description?: string;
    created_at: string;
    profiles?: {
      id?: string;
      email?: string;
      display_name?: string;
    };
  };
}

const UserCommentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dealComments, setDealComments] = useState<Comment[]>([]);
  const [promoComments, setPromoComments] = useState<any[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredDeals = deals.filter(deal => 
    deal.userComment?.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    deal.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPromos = promoComments.filter(promo => 
    promo.userComment?.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    promo.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const [activeTab, setActiveTab] = useState<'deals' | 'promos'>('deals');


  const sortComments = (comments: Comment[], sortBy: SortOption): Comment[] => {
    // Сначала сортируем корневые комментарии
    const sortedRootComments = [...comments].sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'popular':
          const aLikes = typeof a.like_count === 'number' ? a.like_count : 0;
          const bLikes = typeof b.like_count === 'number' ? b.like_count : 0;
          return bLikes - aLikes;
        case 'newest':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    // Затем рекурсивно сортируем ответы каждого комментария
    return sortedRootComments.map(comment => ({
      ...comment,
      replies: comment.replies ? sortComments(comment.replies, sortBy) : []
    }));
  };

  useEffect(() => {
    if (user?.id) {
      loadUserComments();
    } else {
      setLoading(false);
    }
  }, [user, sortBy]);

  const loadUserComments = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      // Load deal comments
      let dealCommentsQuery = supabase
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
          ),
          parent:parent_id (
            id
          )
        `)
        .eq('user_id', user.id);

      // Apply sorting
      switch (sortBy) {
        case 'oldest':
          dealCommentsQuery = dealCommentsQuery.order('created_at', { ascending: true });
          break;
        case 'popular':
          dealCommentsQuery = dealCommentsQuery.order('like_count', { ascending: false })
        .order('created_at', { ascending: false });
          break;
        case 'newest':
        default:
          dealCommentsQuery = dealCommentsQuery.order('created_at', { ascending: false });
          break;
      }

      const { data: dealCommentsData, error: dealCommentsError } = await dealCommentsQuery;

      if (dealCommentsError) throw dealCommentsError;

      // Строим древовидную структуру комментариев
      const commentMap = new Map<string, Comment>();
      const rootComments: Comment[] = [];

      // Первый проход: создаем карту всех комментариев
      dealCommentsData?.forEach(comment => {
        commentMap.set(comment.id, {
          ...comment,
          replies: []
        });
      });

      // Второй проход: строим дерево
      dealCommentsData?.forEach(comment => {
        const commentWithReplies = commentMap.get(comment.id);
        if (commentWithReplies) {
          if (comment.parent_id) {
            const parent = commentMap.get(comment.parent_id);
            if (parent) {
              parent.replies.push(commentWithReplies);
            }
          } else {
            rootComments.push(commentWithReplies);
          }
        }
      });

      // Сортируем древовидную структуру
      const sortedComments = sortComments(rootComments, sortBy);

      // Преобразуем данные в формат Deal
      const dealsWithComments = sortedComments
        .filter(comment => comment?.deals)
        .map(comment => ({
          id: comment.deals!.id,
          title: comment.deals!.title,
          currentPrice: parseFloat(comment.deals!.current_price),
          originalPrice: comment.deals!.original_price ? parseFloat(comment.deals!.original_price) : undefined,
          store: { id: comment.deals!.store_id, name: comment.deals!.store_id },
          category: { id: comment.deals!.category_id, name: comment.deals!.category_id },
          image: comment.deals!.image_url,
          postedAt: new Date(comment.deals!.created_at).toLocaleDateString(),
          popularity: 0,
          comments: 0,
          postedBy: {
            id: comment.deals!.profiles?.id || 'anonymous',
            name: comment.deals!.profiles?.display_name || comment.deals!.profiles?.email?.split('@')[0] || 'Anonymous',
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.deals!.profiles?.display_name || comment.deals!.profiles?.email || 'Anonymous')}&background=random`
          },
          description: comment.deals!.description,
          url: comment.deals!.deal_url,
          userComment: {
            content: comment.content,
            createdAt: new Date(comment.created_at).toLocaleString(),
            replies: comment.replies.map(reply => ({
              content: reply.content,
              createdAt: new Date(reply.created_at).toLocaleString()
            }))
          }
        }));

      setDeals(dealsWithComments);

      // Load promo comments
      let promoCommentsQuery = supabase
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
        .eq('user_id', user.id);

      // Apply sorting
      switch (sortBy) {
        case 'oldest':
          promoCommentsQuery = promoCommentsQuery.order('created_at', { ascending: true });
          break;
        case 'popular':
          promoCommentsQuery = promoCommentsQuery.order('like_count', { ascending: false })
        .order('created_at', { ascending: false });
          break;
        case 'newest':
        default:
          promoCommentsQuery = promoCommentsQuery.order('created_at', { ascending: false });
          break;
      }

      const { data: promoCommentsData, error: promoCommentsError } = await promoCommentsQuery;

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

      // Apply sorting to promo comments
      const sortedPromos = promosWithComments?.sort((a, b) => {
        if (!a.userComment || !b.userComment) return 0;

        switch (sortBy) {
          case 'oldest':
            return new Date(a.userComment.createdAt).getTime() - new Date(b.userComment.createdAt).getTime();
          case 'popular':
            return (b.like_count || 0) - (a.like_count || 0);
          case 'newest':
          default:
            return new Date(b.userComment.createdAt).getTime() - new Date(a.userComment.createdAt).getTime();
        }
      }) || [];

      setPromoComments(sortedPromos);
    } catch (error) {
      console.error('Error loading user comments:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 pb-16 pt-16">
      <div className="fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 px-4 py-3 z-10">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center">
            <button onClick={() => navigate(-1)} className="text-white">
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-white font-medium ml-4">My Comments</h1>
          </div>
        </div>
      </div>

      <div className="relative mx-4 my-3">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center bg-gray-700 rounded-lg px-4 py-2">
              <input
                type="text"
                placeholder="Search comments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent text-gray-300 placeholder-gray-400 outline-none flex-1"
              />
            </div>
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="ml-3 bg-gray-800 text-white text-sm rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 appearance-none"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="popular">Popular</option>
          </select>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        <div className="flex space-x-2 mb-4 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          <button 
            className={`px-4 py-2 rounded-full whitespace-nowrap ${activeTab === 'deals' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'}`}
            onClick={() => setActiveTab('deals')}
          >
            Deals ({filteredDeals.length})
          </button>
          <button 
            className={`px-4 py-2 rounded-full whitespace-nowrap ${activeTab === 'promos' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'}`}
            onClick={() => setActiveTab('promos')}
          >
            Promos ({filteredPromos.length})
          </button>
        </div>
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : !user?.id ? (
          <div className="text-center text-gray-400 py-8">
            Please sign in to view your comments
          </div>
        ) : filteredDeals.length === 0 && filteredPromos.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            You haven't commented on any deals or promos yet
          </div>
        ) : (
          <div className="space-y-6">
            {/* Deal Comments */}
            {activeTab === 'deals' && filteredDeals.length > 0 && (
              <div>
                <h2 className="text-white font-medium mb-4">Deal Comments</h2>
                <div className="space-y-4">
                  {filteredDeals.map((deal, index) => (
                    <div key={`deal-${deal.id}-${index}`} className="space-y-2">
                      <DealCard deal={deal} onVoteChange={loadUserComments} />
                      {deal.userComment && (
                        <div className="space-y-2">
                      <div className="bg-gray-800 rounded-md p-3 ml-4 border-l-2 border-orange-500">
                        <div className="text-gray-400 text-sm mb-1">
                          Your comment on {deal.userComment.createdAt}:
                        </div>
                        <div className="text-white">
                          {deal.userComment.content}
                        </div>
                      </div>
                          {/* Display replies */}
                          {deal.userComment.replies && deal.userComment.replies.length > 0 && (
                            <div className="ml-8 space-y-2">
                              {deal.userComment.replies.map((reply, index) => (
                                <div key={index} className="bg-gray-700 rounded-md p-3 border-l-2 border-orange-400">
                                  <div className="text-gray-400 text-sm mb-1">
                                    Your reply on {reply.createdAt}:
                                  </div>
                                  <div className="text-white">
                                    {reply.content}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Promo Comments */}
            {activeTab === 'promos' && filteredPromos.length > 0 && (
              <div>
                <h2 className="text-white font-medium mb-4">Promo Comments</h2>
                <div className="space-y-4">
                  {filteredPromos.map((promo, index) => (
                    <div key={`promo-${promo.id}-${index}`} className="bg-gray-800 rounded-lg overflow-hidden">
                      <div className="p-4">
                        <h3 className="text-white font-medium">{promo.title}</h3>
                        <div className="mt-2 flex items-center space-x-2">
                          <div className="bg-gray-700 px-3 py-1 rounded border border-gray-600">
                            <span className="text-orange-500 font-mono">{promo.code}</span>
                          </div>
                        </div>
                        {promo.userComment && (
                          <div className="space-y-2">
                        <div className="mt-4 bg-gray-700 rounded-md p-3 border-l-2 border-orange-500">
                          <div className="text-gray-400 text-sm mb-1">
                            Your comment on {promo.userComment.createdAt}:
                          </div>
                          <div className="text-white">
                            {promo.userComment.content}
                          </div>
                        </div>
                            {/* Display replies */}
                            {promo.userComment.replies && promo.userComment.replies.length > 0 && (
                              <div className="ml-8 space-y-2">
                                {promo.userComment.replies.map((reply, index) => (
                                  <div key={index} className="bg-gray-600 rounded-md p-3 border-l-2 border-orange-400">
                                    <div className="text-gray-400 text-sm mb-1">
                                      Your reply on {reply.createdAt}:
                                    </div>
                                    <div className="text-white">
                                      {reply.content}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
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
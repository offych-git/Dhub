import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import DealCard from '../components/deals/DealCard';
import { Deal } from '../types';
import AdminActions from '../components/admin/AdminActions';

type SortOption = 'newest' | 'oldest' | 'popular';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  images?: string[];
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
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

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
      setPage(1);
      setHasMore(true);
      setDeals([]);
      setPromoComments([]);
      loadUserComments();
    } else {
      setLoading(false);
    }
  }, [user, sortBy]);

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
    if (page > 1 && user?.id) {
      loadUserComments();
    }
  }, [page]);

  const loadUserComments = async () => {
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

      dealCommentsQuery = dealCommentsQuery.range((page - 1) * 20, page * 20 - 1);

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
            id: comment.id, // Добавляем ID комментария
            content: comment.content,
            createdAt: new Date(comment.created_at).toLocaleString(),
            images: comment.images, // Added images
            replies: comment.replies.map(reply => ({
              id: reply.id, // Добавляем ID ответа
              content: reply.content,
              createdAt: new Date(reply.created_at).toLocaleString(),
              images: reply.images // Added images to replies
            }))
          }
        }));

      if (page === 1) {
        setDeals(dealsWithComments);
      } else {
        setDeals(prev => [...prev, ...dealsWithComments]);
      }
      setHasMore(dealsWithComments.length === 20);

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
            id: comment.id, // Добавляем ID комментария
            content: comment.content,
            createdAt: new Date(comment.created_at).toLocaleString(),
            images: comment.images // Added images
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
    <div className="min-h-screen bg-gray-900 pb-16 pt-0">
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

      <div className="relative mx-4 mt-3 mb-3">
        <div className="flex items-center bg-gray-700 rounded-lg px-4 py-2 mb-4">
          <input
            type="text"
            placeholder="Search comments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent text-gray-300 placeholder-gray-400 outline-none flex-1"
          />
        </div>
        <div className="flex items-center gap-4 pb-2">
          <div className="flex-grow flex space-x-2 overflow-x-auto scrollbar-hide">
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
                        <div className="flex justify-between items-start">
                          <div className="text-gray-400 text-sm mb-1 flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <circle cx="12" cy="12" r="10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M12 6v6l4 2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            {deal.userComment.createdAt}
                          </div>
                          {deal.userComment && (
                            <>
                            {console.log("Отладка сделки:", deal)}
                            <AdminActions 
                              type="deal_comments"
                              id={deal.userComment.id}
                              userId={user?.id || ''}
                              onAction={loadUserComments}
                            />
                            </>
                          )}
                        </div>
                        <div className="text-white">
                          {deal.userComment.content}
                          {deal.userComment.images && deal.userComment.images.length > 0 && (
                            <div className="flex gap-2 mt-2">
                              {deal.userComment.images.map((image, index) => (
                                <div key={index} className="relative">
                                  <img
                                    src={image}
                                    alt={`Comment image ${index + 1}`}
                                    className="w-16 h-16 object-cover rounded cursor-pointer"
                                    onClick={() => {
                                      const modal = document.createElement('div');
                                      modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50';
                                      modal.onclick = () => document.body.removeChild(modal);

                                      const content = document.createElement('div');
                                      content.className = 'relative max-w-4xl max-h-[90vh]';
                                      content.onclick = e => e.stopPropagation();

                                      const closeBtn = document.createElement('button');
                                      closeBtn.className = 'absolute -top-10 right-0 text-white text-2xl font-bold p-2';
                                      closeBtn.textContent = '×';
                                      closeBtn.onclick = () => document.body.removeChild(modal);

                                      const img = document.createElement('img');
                                      img.src = image;
                                      img.className = 'max-w-full max-h-[90vh] object-contain';

                                      content.appendChild(closeBtn);
                                      content.appendChild(img);
                                      modal.appendChild(content);
                                      document.body.appendChild(modal);
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                          {/* Display replies */}
                          {deal.userComment.replies && deal.userComment.replies.length > 0 && (
                            <div className="ml-8 space-y-2">
                              {deal.userComment.replies.map((reply, index) => (
                                <div key={index} className="bg-gray-700 rounded-md p-3 border-l-2 border-orange-400">
                                  <div className="flex justify-between items-start">
                                    <div className="text-gray-400 text-sm mb-1 flex items-center">
                                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <circle cx="12" cy="12" r="10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        <path d="M12 6v6l4 2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                      {reply.createdAt}
                                    </div>
                                    {reply.id && (
                                      <AdminActions 
                                        type="deal_comment"
                                        id={reply.id}
                                        userId={user?.id || ''}
                                        onAction={loadUserComments}
                                      />
                                    )}
                                  </div>
                                  <div className="text-white">
                                    {reply.content}
                                    {reply.images && reply.images.length > 0 && (
                                      <div className="flex gap-2 mt-2">
                                        {reply.images.map((image, i) => (
                                          <div key={i} className="relative">
                                            <img
                                              src={image}
                                              alt={`Reply image ${i + 1}`}
                                              className="w-16 h-16 object-cover rounded cursor-pointer"
                                              onClick={() => {
                                                const modal = document.createElement('div');
                                                modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50';
                                                modal.onclick = () => document.body.removeChild(modal);

                                                const content = document.createElement('div');
                                                content.className = 'relative max-w-4xl max-h-[90vh]';
                                                content.onclick = e => e.stopPropagation();

                                                const closeBtn = document.createElement('button');
                                                closeBtn.className = 'absolute -top-10 right-0 text-white text-2xl font-bold p-2';
                                                closeBtn.textContent = '×';
                                                closeBtn.onclick = () => document.body.removeChild(modal);

                                                const img = document.createElement('img');
                                                img.src = image;
                                                img.className = 'max-w-full max-h-[90vh] object-contain';

                                                content.appendChild(closeBtn);
                                                content.appendChild(img);
                                                modal.appendChild(content);
                                                document.body.appendChild(modal);
                                              }}
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    )}
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
                          <div className="flex justify-between items-start">
                            <div className="text-gray-400 text-sm mb-1 flex items-center">
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12" cy="12" r="10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M12 6v6l4 2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              {promo.userComment.createdAt}
                            </div>
                            <>
                            {console.log("Отладка промо:", promo)}
                            <AdminActions 
                              type="promo_comments"
                              id={promo.userComment.id}
                              userId={user?.id || ''}
                              onAction={loadUserComments}
                            />
                            </>
                          </div>
                          <div className="text-white">
                            {promo.userComment.content}
                            {promo.userComment.images && promo.userComment.images.length > 0 && (
                              <div className="flex gap-2 mt-2">
                                {promo.userComment.images.map((image, index) => (
                                  <div key={index} className="relative">
                                    <img
                                      src={image}
                                      alt={`Comment image ${index + 1}`}
                                      className="w-16 h-16 object-cover rounded cursor-pointer"
                                      onClick={() => {
                                        const modal = document.createElement('div');
                                        modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50';
                                        modal.onclick = () => document.body.removeChild(modal);

                                        const content = document.createElement('div');
                                        content.className = 'relative max-w-4xl max-h-[90vh]';
                                        content.onclick = e => e.stopPropagation();

                                        const closeBtn = document.createElement('button');
                                        closeBtn.className = 'absolute -top-10 right-0 text-white text-2xl font-bold p-2';
                                        closeBtn.textContent = '×';
                                        closeBtn.onclick = () => document.body.removeChild(modal);

                                        const img = document.createElement('img');
                                        img.src = image;
                                        img.className = 'max-w-full max-h-[90vh] object-contain';

                                        content.appendChild(closeBtn);
                                        content.appendChild(img);
                                        modal.appendChild(content);
                                        document.body.appendChild(modal);
                                      }}
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                            {/* Display replies */}
                            {promo.userComment.replies && promo.userComment.replies.length > 0 && (
                              <div className="ml-8 space-y-2">
                                {promo.userComment.replies.map((reply, index) => (
                                  <div key={index} className="bg-gray-600 rounded-md p-3 border-l-2 border-orange-400">
                                    <div className="flex justify-between items-start">
                                      <div className="text-gray-400 text-sm mb-1 flex items-center">
                                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                          <circle cx="12" cy="12" r="10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                          <path d="M12 6v6l4 2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        {reply.createdAt}
                                      </div>
                                      {reply.id && (
                                        <AdminActions 
                                          type="promo_comment"
                                          id={reply.id}
                                          userId={user?.id || ''}
                                          onAction={loadUserComments}
                                        />
                                      )}
                                    </div>
                                    <div className="text-white">
                                      {reply.content}
                                      {reply.images && reply.images.length > 0 && (
                                        <div className="flex gap-2 mt-2">
                                          {reply.images.map((image, i) => (
                                            <div key={i} className="relative">
                                              <img
                                                src={image}
                                                alt={`Reply image ${i + 1}`}
                                                className="w-16 h-16 object-cover rounded cursor-pointer"
                                                onClick={() => {
                                                  const modal = document.createElement('div');
                                                  modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50';
                                                  modal.onclick = () => document.body.removeChild(modal);

                                                  const content = document.createElement('div');
                                                  content.className = 'relative max-w-4xl max-h-[90vh]';
                                                  content.onclick = e => e.stopPropagation();

                                                  const closeBtn = document.createElement('button');
                                                  closeBtn.className = 'absolute -top-10 right-0 text-white text-2xl font-bold p-2';
                                                  closeBtn.textContent = '×';
                                                  closeBtn.onclick = () => document.body.removeChild(modal);

                                                  const img = document.createElement('img');
                                                  img.src = image;
                                                  img.className = 'max-w-full max-h-[90vh] object-contain';

                                                  content.appendChild(closeBtn);
                                                  content.appendChild(img);
                                                  modal.appendChild(content);
                                                  document.body.appendChild(modal);
                                                }}
                                              />
                                            </div>
                                          ))}
                                        </div>
                                      )}
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
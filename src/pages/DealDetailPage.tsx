import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, ArrowUp, ArrowDown, MessageSquare, Heart, Share2 } from 'lucide-react';
import { mockDeals, generatePriceHistory } from '../data/mockData';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Comment from '../components/comments/Comment';
import CommentInput from '../components/comments/CommentInput';

const DealDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [voteCount, setVoteCount] = useState(0);
  const [userVote, setUserVote] = useState<boolean | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'popular'>('newest');

  const priceHistory = useMemo(() => {
    if (!deal) return [];

    // Use original price if available, otherwise use 120% of current price as reference
    const referencePrice = deal.originalPrice || (deal.currentPrice * 1.2);

    // Only generate price history if we have valid prices
    if (deal.currentPrice <= 0 || referencePrice <= 0) return [];

    return generatePriceHistory(referencePrice, deal.currentPrice);
  }, [deal?.originalPrice, deal?.currentPrice]);

  useEffect(() => {
    if (id) {
      loadDeal();
      loadComments();
      loadVoteStatus();
      loadFavoriteStatus();
    }
  }, [id, sortBy]);

  const loadDeal = async () => {
    try {
      const mockDeal = mockDeals.find(d => d.id === id);
      if (mockDeal) {
        setDeal({
          ...mockDeal,
          currentPrice: Number(mockDeal.currentPrice),
          originalPrice: mockDeal.originalPrice ? Number(mockDeal.originalPrice) : undefined,
          image: mockDeal.image,
          description: mockDeal.description || '',
          url: mockDeal.url || '',
          postedAt: mockDeal.postedAt,
          postedBy: {
            ...mockDeal.postedBy,
            avatar: mockDeal.postedBy.avatar || `https://ui-avatars.com/api/?name=${mockDeal.postedBy.name}&background=random`
          }
        });
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('deals')
        .select(`
          *,
          profiles(id, email)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setError('Deal not found');
        return;
      }

      // Add null checks and default values for profile data
      const profileEmail = data.profiles?.email || 'Anonymous';
      const profileName = profileEmail === 'Anonymous' ? 'Anonymous' : profileEmail.split('@')[0];

      setDeal({
        id: data.id,
        title: data.title,
        currentPrice: Number(data.current_price),
        originalPrice: data.original_price ? Number(data.original_price) : undefined,
        store: { id: data.store_id, name: data.store_id },
        category: { id: data.category_id, name: data.category_id },
        image: data.image_url,
        description: data.description,
        url: data.deal_url,
        postedAt: new Date(data.created_at).toLocaleDateString(),
        postedBy: {
          id: data.profiles?.id || 'anonymous',
          name: profileName,
          avatar: `https://ui-avatars.com/api/?name=${profileName}&background=random`
        }
      });
    } catch (err: any) {
      console.error('Error loading deal:', err);
      setError(err.message || 'Failed to load deal details');
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async () => {
    if (!id) return;

    const { data: comments, error } = await supabase
      .from('deal_comments')
      .select(`
        *,
        profiles(id, email, display_name)
      `)
      .eq('deal_id', id);

    if (error) {
      console.error('Error loading comments:', error);
      return;
    }

    if (!comments) {
      return;
    }

    // Sort comments before building the tree
    const sortedComments = [...comments].sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'popular':
          return (b.like_count || 0) - (a.like_count || 0);
        case 'newest':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    if (!error && comments) {
      // Build comment tree
      const commentMap = new Map();
      const rootComments = [];

      // First pass: create map of all comments
      comments.forEach(comment => {
        commentMap.set(comment.id, {
          ...comment,
          replies: []
        });
      });

      // Second pass: build tree structure
      sortedComments.forEach(comment => {
        const commentWithReplies = commentMap.get(comment.id);
        if (comment.parent_id) {
          const parent = commentMap.get(comment.parent_id);
          if (parent) {
            parent.replies.push(commentWithReplies);
          }
        } else {
          rootComments.push(commentWithReplies);
        }
      });

      // Sort replies recursively
      const sortReplies = (comments) => {
        comments.forEach(comment => {
          if (comment.replies && comment.replies.length > 0) {
            comment.replies.sort((a, b) => {
              switch (sortBy) {
                case 'oldest':
                  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                case 'popular':
                  return (b.like_count || 0) - (a.like_count || 0);
                case 'newest':
                default:
                  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              }
            });
            sortReplies(comment.replies);
          }
        });
      };

      sortReplies(rootComments);
      setComments(rootComments);
      setCommentCount(comments.length);
    }
  };

  const loadVoteStatus = async () => {
    if (!user || !id) return;

    const { data: votes } = await supabase
      .from('deal_votes')
      .select('vote_type')
      .eq('deal_id', id)
      .eq('user_id', user.id);

    if (votes && votes.length > 0) {
      setUserVote(votes[0].vote_type);
    }

    const { data: allVotes } = await supabase
      .from('deal_votes')
      .select('vote_type')
      .eq('deal_id', id);

    const count = allVotes?.reduce((acc, vote) => {
      return acc + (vote.vote_type ? 1 : -1);
    }, 0) || 0;

    setVoteCount(count);
  };

  const loadFavoriteStatus = async () => {
    if (!user || !id) return;

    const { data: favorite } = await supabase
      .from('deal_favorites')
      .select('id')
      .eq('deal_id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    setIsFavorite(!!favorite);
  };

  const handleVote = async (voteType: boolean) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (userVote === voteType) {
      await supabase
        .from('deal_votes')
        .delete()
        .eq('deal_id', id)
        .eq('user_id', user.id);

      setUserVote(null);
    } else {
      await supabase
        .from('deal_votes')
        .upsert({
          deal_id: id,
          user_id: user.id,
          vote_type: voteType
        }, {
          onConflict: 'deal_id,user_id'
        });

      setUserVote(voteType);
    }

    loadVoteStatus();
  };

  const toggleFavorite = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (isFavorite) {
      await supabase
        .from('deal_favorites')
        .delete()
        .eq('deal_id', id)
        .eq('user_id', user.id);
    } else {
      await supabase
        .from('deal_favorites')
        .insert({
          deal_id: id,
          user_id: user.id
        });
    }

    setIsFavorite(!isFavorite);
  };

  // Define a type for comment tree nodes
  type CommentTreeNode = {
    id: string;
    content: string;
    created_at: string;
    profiles?: {
      id?: string;
      display_name?: string;
      email?: string;
    };
    reply_count?: number;
    like_count?: number;
    images?: string[]; // Added images property
    replies?: CommentTreeNode[];
  };

  const renderCommentTree = (comment: CommentTreeNode, depth = 0) => (
    <div key={comment.id} style={{ marginLeft: depth * 24 }}>
      <Comment
        id={comment.id}
        content={comment.content}
        createdAt={comment.created_at}
        images={comment.images || []}
        user={{
          id: comment.profiles?.id,
          name: comment.profiles?.display_name || comment.profiles?.email?.split('@')[0] || 'Anonymous',
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.profiles?.display_name || comment.profiles?.email || 'Anonymous')}&background=random`
        }}
        replyCount={typeof comment.reply_count === 'number' ? comment.reply_count : 0}
        likeCount={typeof comment.like_count === 'number' ? comment.like_count : 0}
        replies={undefined}
        sourceType="deal_comment"
        sourceId={deal && deal.id ? String(deal.id) : ''}
        onReply={loadComments}
        depth={depth || 0}
      />
      {comment.replies && comment.replies.length > 0 && (
        <div>
          {comment.replies.map((reply: CommentTreeNode) => renderCommentTree(reply, (depth || 0) + 1))}
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
        <h2 className="text-white text-xl mb-4">{error || 'Deal not found'}</h2>
        <button 
          onClick={() => navigate('/')}
          className="bg-orange-500 text-white py-2 px-4 rounded-md flex items-center"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Deals
        </button>
      </div>
    );
  }

  const discountPercent = deal.originalPrice 
    ? Math.round(((deal.originalPrice - deal.currentPrice) / deal.originalPrice) * 100) 
    : 0;

  return (
    <div className="pb-16 pt-16 bg-gray-900 min-h-screen">
      <div className="fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 px-4 py-3 z-10 flex items-center">
        <button onClick={() => navigate(-1)} className="text-white">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-white font-medium ml-4 truncate">Deal Details</h1>
      </div>

      <div className="h-64 bg-gray-800">
        <img 
          src={deal.image} 
          alt={deal.title} 
          className="w-full h-full object-contain"
        />
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white text-xl font-medium">{deal.title}</h2>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: deal.title,
                    text: deal.description || `Check out this deal at ${deal.store.name}`,
                    url: window.location.href
                  }).catch(console.error);
                } else {
                  navigator.clipboard.writeText(window.location.href);
                  alert('Link copied to clipboard!');
                }
              }}
              className="p-2 rounded-full text-gray-400 hover:text-orange-500"
            >
              <Share2 className="h-6 w-6" />
            </button>
            <button 
              onClick={toggleFavorite}
              className={`p-2 rounded-full ${isFavorite ? 'text-red-500' : 'text-gray-400'}`}
            >
              <Heart className="h-6 w-6" fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-center">
          <span className="text-orange-500 font-bold text-2xl">
            ${deal.currentPrice.toFixed(2)}
          </span>

          {deal.originalPrice && (
            <span className="ml-3 text-gray-400 line-through text-base">
              ${deal.originalPrice.toFixed(2)}
            </span>
          )}

          {discountPercent > 0 && (
            <span className="ml-2 text-green-500 text-base">
              (-{discountPercent}%)
            </span>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between">
          <div className="bg-gray-800 px-3 py-1 rounded-md text-white">
            {deal.store.name}
          </div>

          <div className="flex items-center space-x-4">
            <button 
              className={`flex items-center ${userVote === true ? 'text-red-500' : 'text-gray-400'}`}
              onClick={() => handleVote(true)}
            >
              <ArrowUp className="h-5 w-5 mr-1" />
            </button>

            <span className={`font-medium ${voteCount > 0 ? 'text-red-500' : voteCount < 0 ? 'text-blue-500' : 'text-gray-400'}`}>
              {voteCount > 0 ? '+' : ''}{voteCount}
            </span>

            <button 
              className={`flex items-center ${userVote === false ? 'text-blue-500' : 'text-gray-400'}`}
              onClick={() => handleVote(false)}
            >
              <ArrowDown className="h-5 w-5 mr-1" />
            </button>
          </div>
        </div>

        {user ? (
          <a
            href={deal.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 bg-orange-500 text-white py-3 rounded-md flex items-center justify-center font-medium"
          >
            <span>Visit Deal</span>
            <ExternalLink className="h-4 w-4 ml-2" />
          </a>
        ) : (
          <button
            onClick={() => navigate('/auth')}
            className="mt-4 bg-gray-500 text-white py-3 rounded-md flex items-center justify-center font-medium w-full cursor-pointer"
          >
            <span>Login to see deal</span>
            <ExternalLink className="h-4 w-4 ml-2" />
          </button>
        )}

        <div className="mt-6">
          <h3 className="text-white font-medium mb-2">Description</h3>
          <div 
            className={`description-text ${!showFullDescription ? 'line-clamp-3' : ''}`}
            dangerouslySetInnerHTML={{ __html: deal.description }}
          />
          {deal.description && deal.description.length > 150 && (
            <button 
              className="text-orange-500 mt-1"
              onClick={() => setShowFullDescription(!showFullDescription)}
            >
              {showFullDescription ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>

        <div className="mt-6">
          <h3 className="text-white font-medium mb-2">Price History</h3>
          {priceHistory.length > 0 ? (
            <div className="bg-gray-800 rounded-md p-3 h-32">
              <svg width="100%" height="100%" viewBox="0 0 300 100" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="rgba(249, 115, 22, 0.5)" />
                    <stop offset="100%" stopColor="rgba(249, 115, 22, 0)" />
                  </linearGradient>
                </defs>

                <path
                  d={`
                    M0,${100 - (priceHistory[0].price / (deal.originalPrice || (deal.currentPrice * 1.2)) * 80)}
                    ${priceHistory.map((point, i) => {
                      const x = (i / (priceHistory.length - 1)) * 300;
                      const y = 100 - (point.price / (deal.originalPrice || (deal.currentPrice * 1.2)) * 80);
                      return `L${x},${y}`;
                    }).join(' ')}
                    L300,100 L0,100 Z
                  `}
                  fill="url(#chartGradient)"
                  stroke="none"
                />

                <path
                  d={`
                    M0,${100 - (priceHistory[0].price / (deal.originalPrice || (deal.currentPrice * 1.2)) * 80)}
                    ${priceHistory.map((point, i) => {
                      const x = (i / (priceHistory.length - 1)) * 300;
                      const y = 100 - (point.price / (deal.originalPrice || (deal.currentPrice * 1.2)) * 80);
                      return `L${x},${y}`;
                    }).join(' ')}
                  `}
                  stroke="#F97316"
                  strokeWidth="2"
                  fill="none"
                />
              </svg>
            </div>
          ) : (
            <div className="bg-gray-800 rounded-md p-4 text-gray-400 text-center">
              No price history available
            </div>
          )}
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-medium">Comments ({commentCount})</h3>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'popular')}
                className="bg-gray-800 text-white text-sm rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 appearance-none flex-shrink-0"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="popular">Popular</option>
            </select>
          </div>

          <div className="mb-4">
            <CommentInput
              sourceType="deal_comment"
              sourceId={deal.id}
              onSubmit={loadComments}
            />
          </div>

          {/* Render comments as a tree */}
          {comments.length > 0 ? (
            <div className="space-y-4">
              {comments.map(comment => renderCommentTree(comment))}
            </div>
          ) : (
            <div className="bg-gray-800 rounded-md p-4 text-gray-400 text-center">
              No comments yet. Be the first to comment!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DealDetailPage;
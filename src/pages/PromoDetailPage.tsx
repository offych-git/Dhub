import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, ArrowUp, ArrowDown, MessageSquare, Heart, Share2, Edit2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Comment from '../components/comments/Comment';
import CommentInput from '../components/comments/CommentInput';
import AdminActions from '../components/admin/AdminActions';

const PromoDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [promo, setPromo] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [voteCount, setVoteCount] = useState(0);
  const [userVote, setUserVote] = useState<boolean | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const isExpired = promo?.expires_at && new Date(promo.expires_at) < new Date();

// Define comment tree node type
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
  replies?: CommentTreeNode[];
};

const renderCommentTree = (comment: CommentTreeNode, depth = 0) => (
  <div key={comment.id} style={{ marginLeft: depth * 24 }}>
    <Comment
      id={comment.id}
      content={comment.content}
      createdAt={comment.created_at}
      user={{
        id: comment.profiles?.id,
        name: comment.profiles?.display_name || comment.profiles?.email?.split('@')[0] || 'Anonymous',
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.profiles?.display_name || comment.profiles?.email || 'Anonymous')}&background=random`
      }}
      replyCount={typeof comment.reply_count === 'number' ? comment.reply_count : 0}
      likeCount={typeof comment.like_count === 'number' ? comment.like_count : 0}
      images={comment.images || []}
      replies={undefined}
      sourceType="promo_comment"
      sourceId={promo && promo.id ? String(promo.id) : ''}
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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'popular'>('newest');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadPromo();
      loadComments();
      if (user) {
        loadVoteStatus();
        loadFavoriteStatus();
      }
    }
  }, [id, user, sortBy]);

  const loadPromo = async () => {
    try {
      const { data, error } = await supabase
        .from('promo_codes')
        .select(`
          *,
          profiles (
            id,
            email,
            display_name
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      if (!data) {
        setError('Promo code not found');
        return;
      }

      setPromo({
        ...data,
        user: {
          id: data.profiles.id,
          name: data.profiles.display_name || data.profiles.email.split('@')[0],
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(data.profiles.display_name || data.profiles.email)}&background=random`
        }
      });
    } catch (err) {
      console.error('Error loading promo:', err);
      setError('Failed to load promo code details');
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async () => {
    if (!id) return;

    let query = supabase
      .from('promo_comments')
      .select(`
        *,
        profiles (
          id,
          email,
          display_name
        )
      `)
      .eq('promo_id', id);

    switch (sortBy) {
      case 'oldest':
        query = query.order('created_at', { ascending: true });
        break;
      case 'popular':
        query = query.order('like_count', { ascending: false })
                    .order('created_at', { ascending: false });
        break;
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }

    const { data: comments, error } = await query;

    if (!error && comments) {
      const commentMap = new Map();
      const rootComments = [];

      comments.forEach(comment => {
        commentMap.set(comment.id, {
          ...comment,
          replies: []
        });
      });

      comments.forEach(comment => {
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

      setComments(rootComments);
      setCommentCount(comments.length);
    }
  };

  const loadVoteStatus = async () => {
    try {
      if (!user) {
        setUserVote(null);
        return;
      }

      const { data: votes } = await supabase
        .from('promo_votes')
        .select('vote_type')
        .eq('promo_id', id)
        .eq('user_id', user.id);

      if (votes && votes.length > 0) {
        setUserVote(votes[0].vote_type);
      }

      const { data: allVotes } = await supabase
        .from('promo_votes')
        .select('vote_type')
        .eq('promo_id', id);

      const count = allVotes?.reduce((acc, vote) => {
        return acc + (vote.vote_type ? 1 : -1);
      }, 0) || 0;

      setVoteCount(count);
    } catch (error) {
      console.error('Error loading vote status:', error);
    }
  };

  const loadFavoriteStatus = async () => {
    try {
      const { data: favorite } = await supabase
        .from('promo_favorites')
        .select('id')
        .eq('promo_id', id)
        .eq('user_id', user!.id)
        .maybeSingle();

      setIsFavorite(!!favorite);
    } catch (error) {
      console.error('Error loading favorite status:', error);
    }
  };

  const handleVote = async (voteType: boolean) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    // Сохраняем исходное состояние голоса для логики обновления
    const previousVote = userVote;
    
    try {
      // Если пользователь нажал на тот же тип голоса, который у него уже активен,
      // то не выполняем никаких действий (ни в БД, ни в UI)
      if (userVote === voteType) {
        // Ничего не делаем при повторном клике на тот же тип голоса
        return;
      } else if (previousVote === null) {
        // Пользователь голосует впервые
        await supabase
          .from('promo_votes')
          .insert({
            promo_id: id,
            user_id: user.id,
            vote_type: voteType
          });

        // Обновляем счетчик голосов и статус голоса пользователя
        setVoteCount(prev => prev + (voteType ? 1 : -1));
        setUserVote(voteType);
      } else {
        // Пользователь меняет тип голоса с одного на другой
        await supabase
          .from('promo_votes')
          .update({ vote_type: voteType })
          .eq('promo_id', id)
          .eq('user_id', user.id);
        
        // Обновляем счетчик голосов - при смене типа голоса изменяем его на 1
        if (previousVote === true && voteType === false) {
          setVoteCount(prev => prev - 1); // С положительного на отрицательный (-1)
        } else if (previousVote === false && voteType === true) {
          setVoteCount(prev => prev + 1); // С отрицательного на положительный (+1)
        }
        
        setUserVote(voteType);
      }
    } catch (error) {
      console.error('Error handling vote:', error);
      // В случае ошибки перезагружаем актуальный статус голосования
      loadVoteStatus();
    }
  };

  const toggleFavorite = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    try {
      if (isFavorite) {
        await supabase
          .from('promo_favorites')
          .delete()
          .eq('promo_id', id)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('promo_favorites')
          .insert({
            promo_id: id,
            user_id: user.id
          });
      }

      setIsFavorite(!isFavorite);
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !promo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
        <h2 className="text-white text-xl mb-4">{error || 'Promo code not found'}</h2>
        <button 
          onClick={() => navigate('/promos')}
          className="bg-orange-500 text-white py-2 px-4 rounded-md flex items-center"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Promos
        </button>
      </div>
    );
  }

  return (
    <div className="pb-16 pt-0 bg-gray-900 min-h-screen">
      <div className="fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 px-4 py-3 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => navigate(-1)} className="text-white">
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-white font-medium ml-4">Promo Details</h1>
          </div>
          <AdminActions
            type="promo"
            id={promo.id}
            userId={promo.user.id}
            onAction={() => navigate('/promos')}
          />
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white text-xl font-medium">{promo.title}</h2>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: promo.title,
                    text: `Use promo code ${promo.code} at ${new URL(promo.discount_url).hostname}`,
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
          </div>
        </div>

        {isExpired && (
          <div className="flex items-center bg-red-500/10 px-2 py-1 rounded-md text-red-500 font-medium mt-2 w-fit">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Expired
          </div>
        )}

        <div className="mt-4 bg-gray-800 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-4">
            <div className="bg-gray-700 px-3 py-1.5 rounded border border-gray-600">
              <span className="text-orange-500 font-mono">{promo.code}</span>
            </div>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigator.clipboard.writeText(promo.code);
                setCopiedCodeId(promo.id);
                setTimeout(() => setCopiedCodeId(null), 2000);
              }}
              className={`font-medium px-3 py-1.5 rounded border ${copiedCodeId === promo.id ? 'bg-green-500 text-white border-green-500' : 'text-orange-500 border-orange-500'}`}
            >
              {copiedCodeId === promo.id ? 'Copied!' : 'Copy Code'}
            </button>
          </div>

          <p className="text-gray-300">{promo.description}</p>

          {promo.expires_at && (
            <div className="mt-4 text-gray-400 text-sm">
              Expires: {new Date(promo.expires_at).toLocaleDateString()}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button 
              className={`flex items-center ${userVote === true ? 'text-green-500' : 'text-gray-400'}`}
              onClick={() => handleVote(true)}
            >
              <ArrowUp className="h-5 w-5 mr-1" />
            </button>

            <span className={`font-medium ${voteCount > 0 ? 'text-green-500' : voteCount < 0 ? 'text-red-500' : 'text-gray-400'}`}>
              {voteCount > 0 ? '+' : ''}{voteCount}
            </span>

            <button 
              className={`flex items-center ${userVote === false ? 'text-red-500' : 'text-gray-400'}`}
              onClick={() => handleVote(false)}
            >
              <ArrowDown className="h-5 w-5 ml-1" />
            </button>
          </div>

          <a
            href={promo.discount_url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-orange-500 text-white px-4 py-2 rounded-md flex items-center"
          >
            <span>Visit Store</span>
            <ExternalLink className="h-4 w-4 ml-2" />
          </a>
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
              sourceType="promo_comment"
              sourceId={promo.id}
              onSubmit={loadComments}
            />
          </div>

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

export default PromoDetailPage;
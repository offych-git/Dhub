import React, { useState, useEffect } from 'react';
import { Reply, ThumbsUp, MoreVertical } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import CommentInput from './CommentInput';
import { createMentionNotification } from '../../utils/mentions';
import { supabase } from '../../lib/supabase';
import AdminActions from '../admin/AdminActions';

interface CommentProps {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  replyCount: number;
  likeCount?: number;
  replies?: CommentProps[];
  sourceType: 'deal_comment' | 'promo_comment';
  sourceId: string;
  parentId?: string;
  onReply: () => void;
  depth?: number;
}

const DEFAULT_AVATAR = 'https://images.pexels.com/photos/1126993/pexels-photo-1126993.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2';

const Comment: React.FC<CommentProps> = ({
  id,
  content,
  createdAt,
  user,
  replyCount,
  likeCount: initialLikeCount = 0,
  replies,
  sourceType,
  sourceId,
  parentId,
  onReply,
  depth = 0
}) => {
  const { user: currentUser } = useAuth();
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [showReplies, setShowReplies] = useState(depth < 2);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [isLiked, setIsLiked] = useState(false);
  const [showAllReplies, setShowAllReplies] = useState(false);
  const maxDepth = 3;

  useEffect(() => {
    if (currentUser) {
      checkIfLiked();
    }
  }, [currentUser]);

  const checkIfLiked = async () => {
    try {
      const { data } = await supabase
        .from('comment_likes')
        .select('id')
        .eq('comment_id', id)
        .eq('user_id', currentUser?.id)
        .eq('comment_type', sourceType === 'deal_comment' ? 'deal' : 'promo')
        .maybeSingle();

      setIsLiked(!!data);
    } catch (error) {
      console.error('Error checking like status:', error);
    }
  };

  const handleLike = async () => {
    if (!currentUser) return;

    try {
      if (isLiked) {
        // Unlike
        await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', id)
          .eq('user_id', currentUser.id)
          .eq('comment_type', sourceType === 'deal_comment' ? 'deal' : 'promo');

        setLikeCount(prev => Math.max(0, prev - 1));
        setIsLiked(false);
      } else {
        // Like
        await supabase
          .from('comment_likes')
          .insert({
            comment_id: id,
            user_id: currentUser.id,
            comment_type: sourceType === 'deal_comment' ? 'deal' : 'promo'
          });

        setLikeCount(prev => prev + 1);
        setIsLiked(true);

        // Create notification for the comment author
        if (user.id !== currentUser.id) {
          await supabase
            .from('notifications')
            .insert({
              user_id: user.id,
              type: 'vote',
              content: 'liked your comment',
              source_type: sourceType,
              source_id: sourceId,
              actor_id: currentUser.id
            });
        }
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Early return if user object is not properly defined
  if (!user?.id || !user?.name) {
    return null;
  }

  return (
    <div className={`${depth > 0 ? `ml-${Math.min(depth * 4, 12)} mt-3` : 'mt-4'}`}>
      <div className={`bg-gray-800 rounded-lg p-4 ${depth > 0 ? 'border-l-2 border-gray-700' : ''}`}>
        {/* Comment header */}
        <div className="flex items-center mb-2">
          <div className="w-8 h-8 rounded-full overflow-hidden mr-2">
            <img
              src={user.avatar || DEFAULT_AVATAR}
              alt={`${user.name}'s avatar`}
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = DEFAULT_AVATAR;
              }}
            />
          </div>
          <div className="flex-1">
            <div className="text-white font-medium">{user.name}</div>
            <div className="text-gray-400 text-xs">{formatDate(createdAt)}</div>
          </div>
          
          <AdminActions
            type={sourceType}
            id={id}
            userId={user.id}
            onAction={onReply}
          />
        </div>

        {/* Comment content */}
        <div className="text-white mb-3">{content}</div>

        {/* Comment actions */}
        <div className="flex items-center space-x-4 text-sm">
          {depth < maxDepth && (
            <button
              onClick={() => setShowReplyInput(!showReplyInput)}
              className="text-gray-400 hover:text-white flex items-center"
            >
              <Reply className="h-4 w-4 mr-1" />
              Reply
            </button>
          )}
          <button
            onClick={handleLike}
            className={`flex items-center ${
              isLiked ? 'text-orange-500' : 'text-gray-400 hover:text-white'
            }`}
          >
            <ThumbsUp className="h-4 w-4 mr-1" fill={isLiked ? 'currentColor' : 'none'} />
            {likeCount > 0 && <span className="ml-1">{likeCount}</span>}
          </button>
        </div>

        {/* Reply input */}
        {showReplyInput && depth < maxDepth && (
          <div className="mt-3">
            <CommentInput
              sourceType={sourceType}
              sourceId={sourceId}
              parentId={id}
              onSubmit={() => {
                setShowReplyInput(false);
                onReply();
              }}
              onCancel={() => setShowReplyInput(false)}
            />
          </div>
        )}
      </div>

      {/* Show replies */}
      {replyCount > 0 && !showReplies && depth < maxDepth && (
        <button
          onClick={() => setShowReplies(true)}
          className="mt-2 text-orange-500 text-sm hover:text-orange-400"
        >
          Show {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
        </button>
      )}

      {/* Replies */}
      {showReplies && replies && depth < maxDepth && (
        <>
          {(showAllReplies ? replies : replies.slice(0, 3)).map(reply => (
            <Comment
              key={reply.id}
              {...reply}
              sourceType={sourceType}
              sourceId={sourceId}
              parentId={id}
              onReply={onReply}
              depth={depth + 1}
            />
          ))}
          {!showAllReplies && replies.length > 3 && (
            <button
              className="mt-2 text-orange-500 text-sm hover:text-orange-400"
              onClick={() => setShowAllReplies(true)}
            >
              Show {replies.length - 3} more repl{replies.length - 3 === 1 ? 'y' : 'ies'}
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default Comment;
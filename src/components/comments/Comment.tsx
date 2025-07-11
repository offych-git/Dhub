import React, { useState, useEffect } from 'react';
import { Reply, ThumbsUp, MoreVertical } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import CommentInput from './CommentInput';
import { createMentionNotification } from '../../utils/mentions';
import { supabase } from '../../lib/supabase';
import AdminActions from '../admin/AdminActions';
import { highlightText } from '../../utils/highlightText';
import { useSearchParams } from 'react-router-dom';


interface CommentProps {
  id: string;
  content: string;
  createdAt: string;
  images: string[];
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
  images = [],
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
  const { t } = useLanguage();
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [showReplies, setShowReplies] = useState(depth < 2);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [isLiked, setIsLiked] = useState(false);
  const [showAllReplies, setShowAllReplies] = useState(false);
  const maxDepth = 3;
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('q');


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
        await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', id)
          .eq('user_id', currentUser.id)
          .eq('comment_type', sourceType === 'deal_comment' ? 'deal' : 'promo');

        setLikeCount(prev => Math.max(0, prev - 1));
        setIsLiked(false);
      } else {
        await supabase
          .from('comment_likes')
          .insert({
            comment_id: id,
            user_id: currentUser.id,
            comment_type: sourceType === 'deal_comment' ? 'deal' : 'promo'
          });

        setLikeCount(prev => prev + 1);
        setIsLiked(true);

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

  if (!user?.id || !user?.name) {
    return null;
  }

  const cleanContent = content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  const highlightedContent = searchQuery ? highlightText(cleanContent, searchQuery) : cleanContent;


  return (
    <div className={`${depth > 0 ? `ml-${Math.min(depth * 4, 12)} mt-3` : 'mt-4'}`}>
      <div className={`bg-gray-800 rounded-lg p-4 ${depth > 0 ? 'border-l-2 border-gray-700' : ''}`}>
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
          <AdminActions type={sourceType} id={id} userId={user.id} createdAt={createdAt} onAction={onReply} />
        </div>

        <div className="text-white mb-3">
          <div>{highlightedContent}</div>
          {Array.isArray(images) && images.length > 0 && (
            <div className="flex gap-2 mt-2">
              {images.map((image, index) => (
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

        <div className="flex items-center space-x-4 text-sm">
          {depth < maxDepth && (
            <button
              onClick={() => setShowReplyInput(!showReplyInput)}
              className={`flex items-center ${showReplyInput ? 'text-orange-500' : 'text-gray-600 dark:text-gray-400 hover:text-orange-500 disabled:opacity-50'}`}
            >
              <Reply className="h-4 w-4 mr-1" />
              <span>{t('buttons.reply')}</span>
            </button>
          )}
          <button
            onClick={handleLike}
            className={`flex items-center ${
              isLiked ? 'text-orange-500' : 'text-gray-600 dark:text-gray-400 hover:text-orange-500 dark:hover:text-orange-400'
            }`}
          >
            <ThumbsUp className="h-4 w-4 mr-1" fill={isLiked ? 'currentColor' : 'none'} />
            {likeCount > 0 && <span className="ml-1">{likeCount}</span>}
          </button>
        </div>

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
            />
          </div>
        )}
      </div>

      {replyCount > 0 && !showReplies && depth < maxDepth && (
        <button
          onClick={() => setShowReplies(true)}
          className="mt-2 text-orange-500 text-sm hover:text-orange-400"
        >
          {t('comments.show_replies')}
        </button>
      )}

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
              {t('comments.show_more_replies')}
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default Comment;
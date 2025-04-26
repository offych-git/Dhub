import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { createMentionNotification } from '../../utils/mentions';

interface CommentInputProps {
  sourceType: 'deal_comment' | 'promo_comment';
  sourceId: string;
  parentId?: string;
  onSubmit: (content: string) => void;
  onCancel?: () => void;
}

const CommentInput: React.FC<CommentInputProps> = ({
  sourceType,
  sourceId,
  parentId,
  onSubmit,
  onCancel
}) => {
  const { user } = useAuth();
  const [comment, setComment] = useState('');
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionUsers, setMentionUsers] = useState<any[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mentionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mentionsRef.current && !mentionsRef.current.contains(event.target as Node)) {
        setShowMentions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (mentionSearch) {
      searchUsers();
    }
  }, [mentionSearch]);

  const searchUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, display_name')
      .ilike('display_name', `${mentionSearch}%`)
      .limit(5);

    setMentionUsers(data || []);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const position = e.target.selectionStart || 0;
    setComment(value);
    setCursorPosition(position);

    // Check if we're in a mention context
    const lastAtSymbol = value.lastIndexOf('@', position);
    if (lastAtSymbol !== -1) {
      const spaceAfterAt = value.indexOf(' ', lastAtSymbol);
      const searchEndPos = spaceAfterAt === -1 ? value.length : spaceAfterAt;
      
      if (position > lastAtSymbol && position <= searchEndPos) {
        const search = value.slice(lastAtSymbol + 1, searchEndPos);
        setMentionSearch(search);
        setShowMentions(true);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (username: string) => {
    const beforeMention = comment.slice(0, comment.lastIndexOf('@'));
    const afterMention = comment.slice(cursorPosition);
    const newComment = `${beforeMention}@${username}${afterMention}`;
    setComment(newComment);
    setShowMentions(false);
    
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleSubmit = async () => {
    if (!user || !comment.trim()) return;

    try {
      const table = sourceType === 'deal_comment' ? 'deal_comments' : 'promo_comments';
      const { error } = await supabase
        .from(table)
        .insert({
          [sourceType === 'deal_comment' ? 'deal_id' : 'promo_id']: sourceId,
          user_id: user.id,
          content: comment.trim(),
          parent_id: parentId
        });

      if (error) throw error;

      // Create notifications for mentions
      await createMentionNotification(
        supabase,
        sourceType,
        sourceId,
        comment.trim(),
        user.id
      );

      onSubmit(comment);
      setComment('');
    } catch (error) {
      console.error('Error posting comment:', error);
    }
  };

  return (
    <div className="relative">
      <div className="flex flex-col space-y-2">
        <textarea
          ref={inputRef}
          value={comment}
          onChange={handleInputChange}
          placeholder={parentId ? "Write a reply..." : "Add a comment..."}
          className="w-full bg-gray-700 text-white placeholder-gray-400 rounded-md px-4 py-2 resize-none"
          rows={3}
        />
        <div className="flex justify-end space-x-2">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-400 hover:text-white"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={!comment.trim()}
            className="bg-orange-500 text-white px-4 py-2 rounded-md disabled:opacity-50"
          >
            {parentId ? 'Reply' : 'Comment'}
          </button>
        </div>
      </div>

      {showMentions && mentionUsers.length > 0 && (
        <div
          ref={mentionsRef}
          className="absolute left-0 right-0 mt-1 bg-gray-800 rounded-md shadow-lg overflow-hidden z-10"
        >
          {mentionUsers.map(user => (
            <button
              key={user.id}
              className="w-full px-4 py-2 text-left hover:bg-gray-700 text-white"
              onClick={() => insertMention(user.display_name)}
            >
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-600 mr-2">
                  <img
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.display_name || user.email)}&background=random`}
                    alt={user.display_name || user.email}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span>{user.display_name || user.email.split('@')[0]}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CommentInput;
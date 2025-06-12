import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import imageCompression from 'browser-image-compression';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { createMentionNotification } from '../../utils/mentions';
import { handleImageError } from '../../utils/imageUtils';
import { useLanguage } from '../../contexts/LanguageContext'; // <-- ДОБАВЛЕН ИМПОРТ useLanguage

interface CommentInputProps {
  sourceType: 'deal_comment' | 'promo_comment';
  sourceId: string;
  parentId?: string;
  onSubmit: (content: string, images?: File[]) => void;
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
  const navigate = useNavigate();
  const { t } = useLanguage(); // <-- ПОЛУЧАЕМ ФУНКЦИЮ ПЕРЕВОДА t
  
  const [comment, setComment] = useState('');
  const [mentionSearch, setMentionSearch] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionUsers, setMentionUsers] = useState<any[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mentionsRef = useRef<HTMLDivElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);

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

  const compressImage = async (file: File): Promise<File> => {
    const options = {
      maxSizeMB: 0.2,
      maxWidthOrHeight: 1200,
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: 0.8,
    };

    try {
      return await imageCompression(file, options);
    } catch (error) {
      console.error('Error compressing image:', error);
      return file;
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + images.length > 2) {
      alert(t('commentInput.maxImagesAlert')); // Используем t()
      return;
    }

    const newImages = files.slice(0, 2 - images.length);

    const compressedImages = await Promise.all(
      newImages.map(file => compressImage(file))
    );

    const newPreviews = compressedImages.map(file => URL.createObjectURL(file));

    setImages(prev => [...prev, ...compressedImages]);
    setPreviews(prev => [...prev, ...newPreviews]);
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setError(null);
    
    if (!user) {
      console.warn('Неавторизованный пользователь пытается оставить комментарий. Перенаправление на авторизацию.');
      const currentPath = window.location.pathname + window.location.search;
      navigate(`/auth?redirect=${encodeURIComponent(currentPath)}`);
      return;
    }

    if (!comment.trim()) {
      setError(t('commentInput.emptyCommentError')); // Используем t()
      return;
    }

    setIsSubmitting(true);
    try {
      const imageUrls = [];
      if (images.length > 0) {
        for (const image of images) {
          const fileExt = image.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const filePath = `${user.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('deal-images')
            .upload(filePath, image, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('deal-images')
            .getPublicUrl(filePath);

          imageUrls.push(publicUrl);
        }
      }

      const table = sourceType === 'deal_comment' ? 'deal_comments' : 'promo_comments';
      if (!user) {
        throw new Error('User not authenticated (after async operations)');
      }

      const { data: commentData, error: insertError } = await supabase
        .from(table)
        .insert({
          [sourceType === 'deal_comment' ? 'deal_id' : 'promo_id']: sourceId,
          user_id: user.id,
          content: comment.trim(),
          parent_id: parentId,
          images: imageUrls
        })
        .select()
        .single();

      if (insertError) throw insertError;
      
      console.log('Создан новый комментарий с ID:', commentData?.id);
      console.log('Данные комментария:', commentData);

      try {
        console.log('--- Передача параметров в createMentionNotification ---');
        console.log('Параметр sourceType:', sourceType);
        console.log('Параметр sourceId (Deal/Promo ID):', sourceId);
        console.log('Параметр commentId (Новый ID комментария):', commentData?.id);
        console.log('--- Конец параметров ---');
        
        await createMentionNotification(
          supabase,
          sourceType,
          sourceId,
          comment.trim(),
          user.id,
          commentData?.id
        );
        
        if (parentId) {
          console.log('Создаем уведомление о ответе на комментарий с ID:', parentId);
          
          const parentTable = sourceType === 'deal_comment' ? 'deal_comments' : 'promo_comments';
          const { data: parentComment, error: parentError } = await supabase
            .from(parentTable)
            .select('user_id')
            .eq('id', parentId)
            .maybeSingle();
            
          if (parentError) {
            console.error('Ошибка при получении данных о родительском комментарии:', parentError);
          } else if (parentComment && parentComment.user_id && parentComment.user_id !== user.id) {
            console.log('Автор родительского комментария:', parentComment.user_id);
            
            const { data: userPrefs, error: prefsError } = await supabase
              .from('profiles')
              .select('notification_preferences')
              .eq('id', parentComment.user_id)
              .maybeSingle();
              
            if (!prefsError && 
                (!userPrefs?.notification_preferences || 
                 userPrefs.notification_preferences.replies !== false)) {
              
              const { error: notifError } = await supabase
                .from('notifications')
                .insert({
                  user_id: parentComment.user_id,
                  type: 'reply',
                  content: comment.trim().substring(0, 100) + (comment.trim().length > 100 ? '...' : ''),
                  source_type: sourceType,
                  source_id: commentData?.id,
                  entity_id: sourceId,
                  actor_id: user.id
                });
                
              if (notifError) {
                console.error('Ошибка при создании уведомления о ответе:', notifError);
              } else {
                console.log('Уведомление о ответе успешно создано');
              }
            } else if (prefsError) {
              console.error('Ошибка при получении настроек пользователя:', prefsError);
            } else {
              console.log('Пользователь отключил уведомления о ответах в настройках');
            }
          } else {
            console.log('Пользователь отвечает на свой собственный комментарий, уведомление не создается');
          }
        }
      } catch (mentionError) {
        console.error('Error creating notifications:', mentionError);
      }

      onSubmit(comment, images);
      setComment('');
      setImages([]);
      setPreviews([]);
    } catch (error: any) {
      console.error('Error posting comment:', error);
      setError(error.message || t('commentInput.postCommentError')); // Используем t()
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative">
      {!user ? (
        <div className="bg-gray-800 rounded-md p-4 text-gray-400 text-center">
          <p className="mb-3">{t('commentInput.loginPrompt')}</p>
          <button
            onClick={() => {
              const currentPath = window.location.pathname + window.location.search;
              navigate(`/auth?redirect=${encodeURIComponent(currentPath)}`);
            }}
            className="bg-orange-500 text-white py-2 px-4 rounded-md font-medium"
          >
            {t('commentInput.loginButton')}
          </button>
          {error && <div className="text-red-500 mt-2">{error}</div>}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col space-y-2">
          {error && <div className="text-red-500 mb-2">{error}</div>}
          <textarea
            ref={inputRef}
            value={comment}
            onChange={handleInputChange}
            placeholder={parentId ? t('commentInput.writeReplyPlaceholder') : t('commentInput.addCommentPlaceholder')}
            className="w-full bg-gray-700 text-white placeholder-gray-400 rounded-md px-4 py-2 resize-none"
            rows={3}
            disabled={isSubmitting}
          />

          {previews.length > 0 && (
            <div className="flex gap-2 mt-2">
              {previews.map((preview, index) => (
                <div key={index} className="relative group">
                  <img
                    src={preview}
                    alt={`Preview ${index + 1}`}
                    className="w-16 h-16 object-cover rounded cursor-pointer"
                    onClick={() => window.open(preview, '_blank')}
                    onError={handleImageError}
                  />
                  <button
                    onClick={() => removeImage(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between items-center">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={images.length >= 2 || isSubmitting}
              className={`text-gray-600 dark:text-gray-400 hover:text-orange-500 disabled:opacity-50`}
            >
              📎 {t('commentInput.addImage')}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              multiple
            />
            <div className="flex space-x-2">
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-orange-500 dark:hover:text-white font-medium"
                  disabled={isSubmitting}
                >
                  {t('commentInput.cancel')}
                </button>
              )}
              <button
                type="submit"
                disabled={!comment.trim() || isSubmitting}
                className="bg-orange-500 text-white px-4 py-2 rounded-md disabled:opacity-50 flex items-center"
              >
                {isSubmitting ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-2"></div>
                ) : (
                  parentId ? t('commentInput.replyButton') : t('commentInput.commentButton')
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {showMentions && mentionUsers.length > 0 && (
        <div
          ref={mentionsRef}
          className="absolute left-0 right-0 mt-1 bg-gray-800 rounded-md shadow-lg overflow-hidden z-10 max-h-60 overflow-y-auto"
          style={{ maxWidth: '100%', position: 'absolute' }}
        >
          {mentionUsers.map(mentionUser => (
            <button
              key={mentionUser.id}
              className="w-full px-4 py-2 text-left hover:bg-gray-700 text-white"
              onClick={() => insertMention(mentionUser.display_name)}
            >
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-600 mr-2">
                  <img
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(mentionUser.display_name || mentionUser.email)}&background=random`}
                    alt={mentionUser.display_name || mentionUser.email}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span>{mentionUser.display_name || mentionUser.email.split('@')[0]}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CommentInput;

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, ArrowUp, ArrowDown, MessageSquare, Heart, Share2, ArrowLeftCircle, ArrowRightCircle, Edit2 } from 'lucide-react';
import { mockDeals } from '../data/mockData';
import { useAuth } from '../contexts/AuthContext';
import AdminActions from '../components/admin/AdminActions';
import { supabase } from '../lib/supabase';
import Comment from '../components/comments/Comment';
import CommentInput from '../components/comments/CommentInput';
import { handleImageError, getValidImageUrl } from '../utils/imageUtils';
import { highlightText } from '../utils/highlightText';

const DealDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  const { user } = useAuth();
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
  const [dealVote, setDealVote] = useState<'up' | 'down' | null>(null);
  const [votesCount, setVotesCount] = useState<number>(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const isExpired = deal?.expires_at && new Date(deal.expires_at) < new Date();

  // Получение списка изображений для карусели
  const dealImages = useMemo(() => {
    if (!deal) return [];

    // Основное изображение всегда первое
    const images = [deal.image];

    // Проверяем, есть ли в описании JSON с дополнительными изображениями
    if (deal.description) {
      const match = deal.description.match(/<!-- DEAL_IMAGES: (.*?) -->/);
      if (match && match[1]) {
        try {
          // Пытаемся распарсить JSON с изображениями
          const allImages = JSON.parse(match[1]);

          // Если первое изображение в JSON совпадает с основным, не дублируем его
          if (allImages[0] === deal.image) {
            images.push(...allImages.slice(1));
          } else {
            // Если не совпадает (это может быть из-за старых данных), добавляем все кроме первого
            images.push(...allImages.slice(1));
          }
        } catch (e) {
          console.error('Ошибка при разборе JSON с изображениями:', e);
        }
      }
    }

    // Отладочная информация
    if (id === '73b11531-278d-46e1-9c4a-f674110b6ec5') {
      console.log('Deal ID:', id);
      console.log('Количество изображений:', images.length);
      console.log('Изображения:', images);
    }

    return images;
  }, [deal, id]);

  // Функции для навигации по карусели
  const goToPreviousImage = () => {
    setCurrentImageIndex((prev) => 
      prev === 0 ? dealImages.length - 1 : prev - 1
    );
  };

  const goToNextImage = () => {
    setCurrentImageIndex((prev) => 
      prev === dealImages.length - 1 ? 0 : prev + 1
    );
  };

  // Обработчики свайпов с улучшенной реактивностью
  const handleTouchStart = (e: React.TouchEvent) => {
    // Сохраняем начальную позицию касания
    setTouchStart(e.targetTouches[0].clientX);
    setTouchEnd(null); // Сбрасываем конечную позицию при новом касании
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Обновляем позицию при движении пальца
    setTouchEnd(e.targetTouches[0].clientX);

    // Предотвращаем скролл страницы при горизонтальном свайпе
    if (Math.abs((touchStart || 0) - e.targetTouches[0].clientX) > 10) {
      e.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    if (touchStart === null) return;

    // Если touchEnd не был установлен (пользователь просто тапнул), выходим
    if (touchEnd === null) {
      setTouchStart(null);
      return;
    }

    const distance = touchStart - touchEnd;
    const minSwipeDistance = 50; // Минимальное расстояние свайпа для срабатывания

    if (distance > minSwipeDistance) {
      // Свайп влево - следующее изображение
      goToNextImage();
    } else if (distance < -minSwipeDistance) {
      // Свайп вправо - предыдущее изображение
      goToPreviousImage();
    }

    // Сбрасываем состояния касания
    setTouchStart(null);
    setTouchEnd(null);
  };

  // Функция генерации ценовой истории удалена

  useEffect(() => {
    // Прокручиваем страницу вверх при открытии деталей сделки
    window.scrollTo(0, 0);
    
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
      const profileDisplayName = data.profiles?.display_name || (
        data.profiles?.email ? data.profiles.email.split('@')[0] : 'Anonymous'
      );

      // Log для отладки структуры данных сделки
      console.log('Загружены данные сделки:', data);
      console.log('Дополнительные изображения:', data.additional_images);

      setDeal({
        id: data.id,
        title: data.title,
        currentPrice: Number(data.current_price),
        originalPrice: data.original_price ? Number(data.original_price) : undefined,
        store: { id: data.store_id, name: data.store_id },
        category: { id: data.category_id, name: data.category_id },
        image: data.image_url,
        additional_images: data.additional_images || [], // Явно передаем дополнительные изображения
        description: data.description,
        url: data.deal_url,
        postedAt: new Date(data.created_at).toLocaleDateString(),
        postedBy: {
          id: data.profiles?.id || 'anonymous',
          name: profileDisplayName,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(profileDisplayName)}&background=random`
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
    <div className="pb-16 pt-0 bg-gray-900 min-h-screen">
      <div className="fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 px-4 py-3 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => navigate('/deals')} className="text-white">
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-white font-medium ml-4 truncate">Deal Details</h1>
          </div>
          <AdminActions
            type="deal"
            id={deal.id}
            userId={deal.postedBy.id}
            onAction={() => navigate('/')}
          />
        </div>
      </div>

      <div 
        className="h-64 bg-gray-800 relative overflow-hidden touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img 
          src={getValidImageUrl(dealImages[currentImageIndex] || deal.image)} 
          alt={deal.title} 
          className="w-full h-full object-contain cursor-pointer"
          onError={handleImageError}
          draggable="false"
          onClick={(e) => {
            // Находим текущий элемент img
            const img = e.target as HTMLImageElement;

            // Проверяем, есть ли уже модальное окно для этого изображения
            const existingModal = document.querySelector('.fullscreen-image-modal');
            if (existingModal) {
              // Если модальное окно уже открыто, закрываем его
              document.body.removeChild(existingModal);
              return;
            }

            // Создаем модальное окно для просмотра изображения в полном размере
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 fullscreen-image-modal';

            // При клике на фон закрываем модальное окно
            modal.addEventListener('click', (e) => {
              if (e.target === modal) {
                document.body.removeChild(modal);
              }
            });

            const content = document.createElement('div');
            content.className = 'relative max-w-4xl max-h-[90vh]';

            const fullImg = document.createElement('img');
            fullImg.src = getValidImageUrl(dealImages[currentImageIndex] || deal.image);
            fullImg.className = 'max-w-full max-h-[90vh] object-contain cursor-pointer';
            fullImg.onError = handleImageError;

            // При клике на изображение закрываем модальное окно
            fullImg.addEventListener('click', () => {
              document.body.removeChild(modal);
            });

            // Добавляем кнопки навигации при наличии нескольких изображений
            if (dealImages.length > 1) {
              // Создаем контейнер для навигационных точек
              const navContainer = document.createElement('div');
              navContainer.className = 'absolute bottom-4 left-0 right-0 flex justify-center space-x-2';

              // Создаем точки для каждого изображения
              dealImages.forEach((_, index) => {
                const dot = document.createElement('button');
                dot.className = `h-2 w-2 rounded-full ${
                  index === currentImageIndex ? 'bg-orange-500' : 'bg-gray-400'
                }`;

                // При клике на точку меняем изображение
                dot.addEventListener('click', (e) => {
                  e.stopPropagation();
                  setCurrentImageIndex(index);
                  fullImg.src = getValidImageUrl(dealImages[index]);

                  // Обновляем активную точку
                  const dots = navContainer.querySelectorAll('button');
                  dots.forEach((d, i) => {
                    d.className = `h-2 w-2 rounded-full ${
                      i === index ? 'bg-orange-500' : 'bg-gray-400'
                    }`;
                  });
                });

                navContainer.appendChild(dot);
              });

              content.appendChild(navContainer);

              // Стрелки навигации не добавляем в режиме увеличенного изображения
              // Навигация происходит свайпом или нажатием на точки
            }

            content.appendChild(fullImg);
            modal.appendChild(content);
            document.body.appendChild(modal);
          }}
        />

        {dealImages.length > 1 && (
          <>
            {/* Кнопка предыдущего изображения */}
            <button 
              onClick={goToPreviousImage}
              className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white rounded-full p-2 hover:bg-black/70"
              aria-label="Previous image"
            >
              <ArrowLeftCircle className="h-6 w-6" />
            </button>

            {/* Кнопка следующего изображения */}
            <button 
              onClick={goToNextImage}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white rounded-full p-2 hover:bg-black/70"
              aria-label="Next image"
            >
              <ArrowRightCircle className="h-6 w-6" />
            </button>

            {/* Индикатор текущего изображения */}
            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
              {dealImages.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndex(index)}
                  className={`h-2 w-2 rounded-full ${
                    index === currentImageIndex ? 'bg-orange-500' : 'bg-gray-400'
                  }`}
                  aria-label={`Go to image ${index + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white text-xl font-medium">
            {searchQuery 
              ? highlightText(deal.title, searchQuery)
              : deal.title
            }
          </h2>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => {
                if (navigator.share) {
                  // Формируем правильный URL для конкретной сделки
                  const dealUrl = `${window.location.origin}/deals/${deal.id}`;

                  // Очищаем HTML-теги из заголовка и описания
                  const cleanTitle = deal.title ? deal.title.replace(/<[^>]*>/g, '') : '';
                  const cleanDescription = deal.description 
                    ? deal.description.replace(/<[^>]*>/g, '')
                    : `Check out this deal at ${deal.store.name}`;

                  navigator.share({
                    title: cleanTitle,
                    text: cleanDescription,
                    url: dealUrl
                  }).catch(console.error);
                } else {
                  // Формируем правильный URL для копирования
                  const dealUrl = `${window.location.origin}/deals/${deal.id}`;
                  navigator.clipboard.writeText(dealUrl);
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
            {user && user.id === deal.postedBy.id && 
              new Date().getTime() - new Date(deal.postedAt).getTime() < 24 * 60 * 60 * 1000 && (
                <button
                  onClick={() => navigate(`/deals/${deal.id}/edit`)}
                  className="ml-3 text-orange-500 flex items-center"
                >
                  <Edit2 className="h-5 w-5" />
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

        <div className="mt-3 flex items-center">
          <span className="text-orange-500 font-bold text-2xl">
            {deal.currentPrice === 0 ? (
              <span className="px-4 py-1.5 bg-orange-500/20 text-orange-500 rounded-md text-xl font-semibold">FREE</span>
            ) : (
              `$${deal.currentPrice.toFixed(2)}`
            )}
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
          <pre 
            className="description-text font-sans text-sm bg-transparent overflow-visible whitespace-pre-wrap border-0 p-0 m-0"
            dangerouslySetInnerHTML={{ 
              __html: (() => {
                // Сначала подготавливаем описание
                let processedDescription = deal.description
                  // Сначала удаляем технический блок с JSON изображений
                  .replace(/<!-- DEAL_IMAGES: .*? -->/g, '')
                  // Обрабатываем URL в тексте с улучшенным регулярным выражением
                  .replace(/(https?:\/\/[^\s<>"]+)/g, (match) => {
                    // Проверяем, заканчивается ли URL специальным символом
                    const lastChar = match.charAt(match.length - 1);
                    // Проверяем специальные символы на конце URL
                    if ([',', '.', ':', ';', '!', '?', ')', ']', '}'].includes(lastChar)) {
                      // Исключаем последний символ из ссылки (href и текста) и добавляем его после тега </a>
                      return `<a href="${match.slice(0, -1)}" target="_blank" rel="noopener noreferrer" class="text-orange-500 hover:underline">${match.slice(0, -1)}</a>${lastChar}`;
                    }
                    // Если URL не заканчивается специальным символом из списка, создаем ссылку как обычно
                    return `<a href="${match}" target="_blank" rel="noopener noreferrer" class="text-orange-500 hover:underline">${match}</a>`;
                  })
                  // Обрабатываем двойные переносы строк (пустые строки)
                  .replace(/\n\n/g, '<br><br>')
                  // Затем обрабатываем обычные переносы строк
                  .replace(/\n/g, '<br>');
                
                // Если есть поисковый запрос, применяем прямую подсветку в HTML строке
                if (searchQuery) {
                  const searchRegex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                  return processedDescription.replace(
                    searchRegex, 
                    '<span class="bg-orange-500 text-white px-0.5 rounded">$1</span>'
                  );
                }
                
                return processedDescription;
              })()
            }}
            ref={(element) => {
              if (element) {
                const links = element.querySelectorAll('a');
                links.forEach(link => {
                  link.setAttribute('target', '_blank');
                  link.setAttribute('rel', 'noopener noreferrer');
                });
              }
            }}
          />
        </div>

        {/* Блок с ценовой историей был удалён */}

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
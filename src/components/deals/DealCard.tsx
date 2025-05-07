import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Deal } from '../../types';
import { ArrowUp, ArrowDown, MessageSquare, ExternalLink, Heart, Share2, Edit2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import AdminActions from '../admin/AdminActions';
import { useAdmin } from '../../hooks/useAdmin';
import { handleImageError, getValidImageUrl } from '../../utils/imageUtils';
import { useSearchParams } from 'react-router-dom'; // Added import
import { highlightText } from '../../utils/highlightText'; // Added import


interface DealCardProps {
  deal: Deal;
  onVoteChange?: () => void;
  onDelete?: () => void;
}

const DealCard: React.FC<DealCardProps> = ({ deal, onDelete, onVoteChange }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { role } = useAdmin();
  const [voteCount, setVoteCount] = useState(deal.popularity);
  const [userVote, setUserVote] = useState<boolean | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [commentCount, setCommentCount] = useState(deal.comments);
  const isOwnDeal = user && deal.postedBy.id === user.id;
  const [searchParams] = useSearchParams(); // Added useSearchParams hook

  useEffect(() => {
    if (user) {
      loadVoteStatus();
      loadFavoriteStatus();
    }
    loadCommentCount();
  }, [user, deal.id]);

  const loadVoteStatus = async () => {
    try {
      const { data: votes } = await supabase
        .from('deal_votes')
        .select('vote_type')
        .eq('deal_id', deal.id)
        .eq('user_id', user!.id);

      if (votes && votes.length > 0) {
        setUserVote(votes[0].vote_type);
      }

      const { data: voteCount } = await supabase
        .from('deal_votes')
        .select('vote_type', { count: 'exact' })
        .eq('deal_id', deal.id);

      const count = voteCount?.reduce((acc, vote) => {
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
        .from('deal_favorites')
        .select('id')
        .eq('deal_id', deal.id)
        .eq('user_id', user!.id)
        .maybeSingle();

      setIsFavorite(!!favorite);
    } catch (error) {
      console.error('Error loading favorite status:', error);
    }
  };

  const loadCommentCount = async () => {
    try {
      const { count } = await supabase
        .from('deal_comments')
        .select('id', { count: 'exact' })
        .eq('deal_id', deal.id);

      setCommentCount(count || 0);
    } catch (error) {
      console.error('Error loading comment count:', error);
    }
  };

  const handleVote = async (e: React.MouseEvent, voteType: boolean) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      navigate('/auth');
      return;
    }
    
    // Предотвращаем множественные быстрые клики
    if (e.currentTarget.hasAttribute('disabled')) {
      return;
    }
    e.currentTarget.setAttribute('disabled', 'true');
    
    try {
      // Сохраняем предыдущее значение голоса
      const previousVote = userVote;
      
      if (userVote === voteType) {
        // Если пользователь повторно нажимает на тот же тип голоса,
        // то ничего не происходит (ни в БД, ни в интерфейсе)
        return;
      } else if (previousVote === null) {
        // Если пользователь голосует впервые
        await supabase
          .from('deal_votes')
          .insert({
            deal_id: deal.id,
            user_id: user.id,
            vote_type: voteType
          });

        // Обновляем счетчик и статус голоса
        setVoteCount(voteType ? voteCount + 1 : voteCount - 1);
        setUserVote(voteType);
      } else {
        // Если пользователь меняет свой голос с одного типа на другой
        // Обновляем существующую запись вместо удаления и создания новой
        await supabase
          .from('deal_votes')
          .update({ vote_type: voteType })
          .eq('deal_id', deal.id)
          .eq('user_id', user.id);
        
        // Обновляем счетчик голосов - изменение на противоположный тип
        // При смене голоса с положительного на отрицательный счетчик должен изменяться на 0
        if (previousVote === true && voteType === false) {
          setVoteCount(voteCount - 1); // С положительного на отрицательный (-1)
        } else if (previousVote === false && voteType === true) {
          setVoteCount(voteCount + 1); // С отрицательного на положительный (+1)
        }
        
        setUserVote(voteType);
      }

      // Вызываем обратные функции после обновления UI
      if (onVoteChange) onVoteChange();
    } catch (error) {
      console.error('Error handling vote:', error);
      // В случае ошибки загружаем актуальные данные с сервера
      loadVoteStatus();
    } finally {
      // Проверяем, существует ли элемент, прежде чем удалять атрибут
      if (e && e.currentTarget) {
        e.currentTarget.removeAttribute('disabled');
      }
    }
  };

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      navigate('/auth');
      return;
    }

    try {
      if (isFavorite) {
        await supabase
          .from('deal_favorites')
          .delete()
          .eq('deal_id', deal.id)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('deal_favorites')
          .insert({
            deal_id: deal.id,
            user_id: user.id
          });
      }

      setIsFavorite(!isFavorite);
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const discountPercent = deal.originalPrice 
    ? Math.round(((deal.originalPrice - deal.currentPrice) / deal.originalPrice) * 100) 
    : 0;

  const isExpired = deal.expires_at && new Date(deal.expires_at) < new Date();

  return (
    <div className="block border-b border-gray-800 px-4 py-2.5">
      <div className="flex items-start justify-between">
        <div className="flex items-center text-gray-500 text-sm mr-3">
          <span className="inline-block h-5 w-5 mr-1">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 7V12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          <span title={deal.postedAt.exact}>{deal.postedAt.relative}</span>
        </div>

        <div className="ml-auto flex items-center text-sm">
          <button
            onClick={(e) => handleVote(e, true)}
            className={`${userVote === true ? 'text-green-500' : 'text-gray-400'}`}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <div className={`flex items-center mx-2 ${voteCount > 0 ? 'text-green-500' : voteCount < 0 ? 'text-red-500' : 'text-gray-400'}`}>
            <span className="font-medium">{voteCount > 0 ? '+' : ''}{voteCount}</span>
          </div>
          <button
            onClick={(e) => handleVote(e, false)}
            className={`${userVote === false ? 'text-red-500' : 'text-gray-400'}`}
          >
            <ArrowDown className="h-4 w-4" />
          </button>
          </div>
      </div>

      <div className="flex mt-1.5">
        <div className="w-16 h-16 bg-gray-800 rounded-md overflow-hidden mr-3 flex-shrink-0">
          <img 
            src={getValidImageUrl(deal.image)} 
            alt={deal.title} 
            className="w-full h-full object-contain"
            onError={handleImageError}
          />
        </div>

        <div className="flex-1 min-w-0" onClick={() => navigate(`/deals/${deal.id}`)}>
          <h3 onClick={() => navigate(`/deals/${deal.id}`)} className="text-white font-medium text-sm line-clamp-2 cursor-pointer">
            {searchParams.get('q') ? highlightText(deal.title, searchParams.get('q') || '') : deal.title}
          </h3>

          <div className="mt-1 flex items-center">
            <span className="text-orange-500 font-bold text-base">
              {deal.currentPrice === 0 ? (
                <span className="px-2.5 py-1 bg-orange-500/20 text-orange-500 rounded-md text-sm font-semibold">FREE</span>
              ) : (
                `$${deal.currentPrice.toFixed(2)}`
              )}
            </span>

            {deal.originalPrice && (
              <span className="ml-2 text-gray-400 line-through text-xs">
                ${deal.originalPrice.toFixed(2)}
              </span>
            )}

            {discountPercent > 0 && (
              <span className="ml-2 text-green-500 text-xs">
                (-{discountPercent}%)
              </span>
            )}
          </div>

          <div className="mt-0.5 text-gray-400 text-xs">
            {deal.store.name}
          </div>
          {deal.description && (
            <div 
              className="mt-1 text-gray-400 text-xs description-preview line-clamp-2 overflow-hidden"
              style={{ pointerEvents: 'none' }}
            >
              {(() => {
                // Сначала очищаем текст от HTML-тегов
                const cleanDescription = deal.description
                  // Заменяем <br> тег на ' '
                  .replace(/<br[^>]*>/gi, ' ')
                  // Заменяем закрывающие теги на пробел
                  .replace(/<\/[^>]*>/g, ' ')
                  // Заменяем оставшиеся HTML теги на пробел
                  .replace(/<[^>]*>/g, ' ')
                  // Декодируем HTML-сущности
                  .replace(/&nbsp;/g, ' ')
                  // Заменяем множественные пробелы на один
                  .replace(/\s+/g, ' ')
                  .trim();
                
                // Затем применяем подсветку, если есть поисковый запрос
                return searchParams.get('q') 
                  ? highlightText(cleanDescription, searchParams.get('q') || '') 
                  : cleanDescription;
              })()}
            </div>
          )}
          {isExpired && (
            <div className="flex items-center bg-red-500/10 px-2 py-1 rounded-md text-red-500 font-medium mt-1">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Expired
            </div>
          )}
        </div>
      </div>

      <div className="mt-1.5 flex items-center">
        <div className="w-5 h-5 rounded-full overflow-hidden mr-1.5">
          <img 
            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(deal.postedBy.name)}&background=random`}
            alt={deal.postedBy.name}
            className="w-full h-full object-cover"
          />
        </div>

        <span className="author-name text-xs">{deal.postedBy.name}</span>

        <div className="ml-auto flex items-center">
          <button
            onClick={toggleFavorite}
            className={`p-1 rounded-full ${isFavorite ? 'text-red-500' : 'text-gray-400'}`}
          >
            <Heart className="h-4 w-4" fill={isFavorite ? 'currentColor' : 'none'} />
          </button>

          <div className="ml-3 text-gray-400 flex items-center">
            <MessageSquare className="h-4 w-4 mr-1" />
            <span className="text-xs">{commentCount}</span>
          </div>

          {user && (
            <>
              <button 
                className="ml-3 text-orange-500 flex items-center"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (navigator.share) {
                    navigator.share({
                      title: `${deal.title} - ${deal.store.name}`,
                      text: `Скидка ${discountPercent}%! ${deal.title} за $${deal.currentPrice.toFixed(2)} (было $${deal.originalPrice?.toFixed(2)})`,
                      url: window.location.href
                    }).catch(console.error);
                  }
                }}
              >
                <Share2 className="h-4 w-4" />
              </button>
              <button 
                className="ml-3 text-orange-500 flex items-center"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (deal.url) {
                    window.open(deal.url, '_blank', 'noopener,noreferrer');
                  } else {
                    navigate(`/deals/${deal.id}`);
                  }
                }}
              >
                <span className="text-xs mr-1">View</span>
                <ExternalLink className="h-3 w-3" />
              </button>
              {user && (
                <>
                  {user.id === deal.postedBy.id && 
                    new Date().getTime() - new Date(deal.createdAt).getTime() < 24 * 60 * 60 * 1000 && (
                      <div
                        className="ml-3 text-orange-500 flex items-center cursor-pointer"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          window.location.href = `/deals/${deal.id}/edit`;
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </div>
                    )
                  }
                  {(user.id === deal.postedBy.id || role === 'admin' || role === 'moderator' || role === 'super_admin') && (
                    <div className="ml-3 border-l border-gray-700 pl-3" onClick={(e) => e.stopPropagation()}>
                      <AdminActions
                        type="deal"
                        id={deal.id}
                        userId={deal.postedBy.id}
                        onAction={onDelete || (() => {})}
                      />
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DealCard;
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Deal } from '../../types';
import { ArrowUp, ArrowDown, MessageSquare, ExternalLink, Heart } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import AdminActions from '../admin/AdminActions';

interface DealCardProps {
  deal: Deal;
  onVoteChange?: () => void;
}

const DealCard: React.FC<DealCardProps> = ({ deal, onVoteChange }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [voteCount, setVoteCount] = useState(deal.popularity);
  const [userVote, setUserVote] = useState<boolean | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [commentCount, setCommentCount] = useState(deal.comments);
  
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

      // Calculate vote count manually
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
      // Keep the existing comment count on error
    }
  };

  const handleVote = async (e: React.MouseEvent, voteType: boolean) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      navigate('/auth');
      return;
    }

    try {
      if (userVote === voteType) {
        // Remove vote
        await supabase
          .from('deal_votes')
          .delete()
          .eq('deal_id', deal.id)
          .eq('user_id', user.id);
        
        setUserVote(null);
      } else {
        // Upsert vote
        await supabase
          .from('deal_votes')
          .upsert({
            deal_id: deal.id,
            user_id: user.id,
            vote_type: voteType
          }, {
            onConflict: 'deal_id,user_id'
          });
        
        setUserVote(voteType);
      }

      loadVoteStatus();
      if (onVoteChange) onVoteChange();
    } catch (error) {
      console.error('Error handling vote:', error);
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

  return (
    <Link to={`/deals/${deal.id}`} className="block border-b border-gray-800 px-4 py-2.5">
      <div className="flex items-start justify-between">
        <div className="flex items-center text-gray-500 text-sm mr-3">
          <span className="inline-block h-5 w-5 mr-1">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 7V12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          {deal.postedAt}
        </div>

        <AdminActions
          type="deal"
          id={deal.id}
          userId={deal.postedBy.id}
          onAction={onVoteChange}
        />
        
        <div className="ml-auto flex items-center text-sm">
          <button
            onClick={(e) => handleVote(e, true)}
            className={`${userVote === true ? 'text-red-500' : 'text-gray-400'}`}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <div className={`flex items-center mx-2 ${voteCount > 0 ? 'text-red-500' : voteCount < 0 ? 'text-blue-500' : 'text-gray-400'}`}>
            <span className="font-medium">{voteCount > 0 ? '+' : ''}{voteCount}</span>
          </div>
          <button
            onClick={(e) => handleVote(e, false)}
            className={`${userVote === false ? 'text-blue-500' : 'text-gray-400'}`}
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      <div className="flex mt-1.5">
        <div className="w-16 h-16 bg-gray-800 rounded-md overflow-hidden mr-3 flex-shrink-0">
          <img 
            src={deal.image} 
            alt={deal.title} 
            className="w-full h-full object-contain"
          />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium text-sm line-clamp-2">{deal.title}</h3>
          
          <div className="mt-1 flex items-center">
            <span className="text-orange-500 font-bold text-base">
              ${deal.currentPrice.toFixed(2)}
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
            <button className="ml-3 text-orange-500 flex items-center">
              <span className="text-xs mr-1">View</span>
              <ExternalLink className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </Link>
  );
};

export default DealCard;
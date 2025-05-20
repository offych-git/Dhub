import React, { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface VoteControlsProps {
    dealId: string;
    popularity: bigint;
    userVoteType: boolean;
    type: string;
    do_refresh: boolean;
}

const VoteControls: React.FC<VoteControlsProps> = ({ dealId, type, popularity, userVoteType, do_refresh }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [voteCount, setVoteCount] = useState(popularity || 0);
    const [userVote, setUserVote] = useState<boolean | null>(null);

    useEffect(() => {
        if (typeof userVoteType === 'boolean') {
            setUserVote(userVoteType);
        }
    }, [userVoteType]);

    const table = type === 'promo' ? 'promo_votes' : 'deal_votes';
    if (do_refresh || type !== 'deal' && type !== 'promo') {
        useEffect(() => {
            loadVoteStatus();
        }, [dealId, user]);
    }

    const loadVoteStatus = async () => {
        const idKey = type === 'promo' ? 'promo_id' : 'deal_id';

        const { data: allVotes } = await supabase
            .from(table)
            .select('vote_type')
            .eq(idKey, dealId);

        const count = allVotes?.reduce((acc, vote) => acc + (vote.vote_type ? 1 : -1), 0) || 0;
        setVoteCount(count);

        if (user) {
            const { data: uv } = await supabase
                .from(table)
                .select('vote_type')
                .eq(idKey, dealId)
                .eq('user_id', user.id)
                .maybeSingle();

            setUserVote(uv?.vote_type === true ? true : uv?.vote_type === false ? false : null);
        } else {
            setUserVote(null);
        }
    };

    const handleVote = async (voteType: boolean) => {
        if (!user) {
            navigate('/auth');
            return;
        }

        const previousVote = userVote;

        if (userVote === voteType) return;

        if (previousVote === null) {
            await supabase
                .from(table)
                .insert({
                    [type === 'promo' ? 'promo_id' : 'deal_id']: dealId,
                    user_id: user.id,
                    vote_type: voteType
                });
            setVoteCount(prev => prev + (voteType ? 1 : -1));
            setUserVote(voteType);
        } else {
            await supabase
                .from(table)
                .delete()
                .eq(type === 'promo' ? 'promo_id' : 'deal_id', dealId)
                .eq('user_id', user.id);
            setVoteCount(prev => prev + (previousVote ? -1 : 1));
            setUserVote(null);
        }
    };

    return (
        <div className="flex items-center space-x-2">
            <button
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleVote(true)
                }}
                className={`flex items-center ${userVote === true ? 'text-green-500' : 'text-gray-400'}`}
            >
                <ArrowUp className="h-5 w-5" />
            </button>
            <span
                className={`font-medium ${voteCount > 0 ? 'text-green-500' : voteCount < 0 ? 'text-red-500' : 'text-gray-400'}`}
            >
        {voteCount > 0 ? `+${voteCount}` : voteCount}
      </span>
            <button
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleVote(false)
                }}
                className={`flex items-center ${userVote === false ? 'text-red-500' : 'text-gray-400'}`}
            >
                <ArrowDown className="h-5 w-5" />
            </button>
        </div>
    );
};

export default VoteControls;

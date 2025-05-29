// SavedItemsPage.tsx
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Edit2,
  ExternalLink,
  Heart,
  MessageSquare,
  Share2,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import DealCard from "../components/deals/DealCard";
import { Deal } from "../types";
import VoteControls from "../components/deals/VoteControls";

type SortOption = "newest" | "oldest" | "popular";

interface SavedPromoItem {
  id: string;
  title: string;
  code: string;
  description?: string;
  created_at: string;
  user_id?: string;
  profiles?: { id?: string; email?: string; display_name?: string; avatar?: string };
  comments: number;
  popularity: number;
  userVoteType?: boolean | null;
  type: "promo";
  discount_url?: string;
  status?: string;
  expires_at?: string;
}

const SavedItemsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savedDeals, setSavedDeals] = useState<Deal[]>([]);
  const [savedPromos, setSavedPromos] = useState<SavedPromoItem[]>([]);
  const [savedSweepstakes, setSavedSweepstakes] = useState<Deal[]>([]);
  const [activeTab, setActiveTab] = useState<"deals" | "promos" | "sweepstakes">("deals");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [isReactNativeView, setIsReactNativeView] = useState(false);

  useEffect(() => {
    const pageTitle = "Saved Items";
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      setIsReactNativeView(true);
      const timerId = setTimeout(() => {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: "SET_NATIVE_HEADER_TITLE",
            title: pageTitle,
          })
        );
      }, 50);
      return () => clearTimeout(timerId);
    } else {
      setIsReactNativeView(false);
    }
  }, []);

  const formatTimeAgo_local = useCallback((dateString?: string): string => {
    if (!dateString) return "some time ago";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "invalid date";
    const now = new Date();
    const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);

    if (seconds < 5) return "just now";
    if (minutes < 1) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString();
  }, []);

  const loadSavedItems = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setSavedDeals([]);
      setSavedPromos([]);
      setSavedSweepstakes([]);
      return;
    }

    setLoading(true);

    try {
      // Загружаем ВСЕ данные одновременно, независимо от активной вкладки
      const [dealsResult, promosResult] = await Promise.allSettled([
        loadSavedDealsAndSweepstakes(),
        loadSavedPromos()
      ]);

      // Обрабатываем результаты
      if (dealsResult.status === 'fulfilled') {
        const { deals, sweepstakes } = dealsResult.value;
        setSavedDeals(deals);
        setSavedSweepstakes(sweepstakes);
      } else {
        console.error("Error loading deals/sweepstakes:", dealsResult.reason);
        setSavedDeals([]);
        setSavedSweepstakes([]);
      }

      if (promosResult.status === 'fulfilled') {
        setSavedPromos(promosResult.value);
      } else {
        console.error("Error loading promos:", promosResult.reason);
        setSavedPromos([]);
      }

    } catch (error) {
      console.error("Error loading saved items:", error);
      setSavedDeals([]);
      setSavedPromos([]);
      setSavedSweepstakes([]);
    } finally {
      setLoading(false);
    }
  }, [user, sortBy, formatTimeAgo_local]);

  const loadSavedDealsAndSweepstakes = async (): Promise<{ deals: Deal[], sweepstakes: Deal[] }> => {
    if (!user) return { deals: [], sweepstakes: [] };

    const { data: dealFavorites, error: dealFavError } = await supabase
      .from("deal_favorites")
      .select("deal_id")
      .eq("user_id", user.id);

    if (dealFavError) throw dealFavError;
    if (!dealFavorites || dealFavorites.length === 0) {
      return { deals: [], sweepstakes: [] };
    }

    const itemIdsFromFavorites = dealFavorites.map((fav) => fav.deal_id);

    let itemsQuery = supabase
      .from("deals")
      .select(`*, 
               profiles!deals_user_id_fkey(id, email, display_name), 
               deal_comments(count)`)
      .in("id", itemIdsFromFavorites)
      .or("status.eq.published,status.eq.approved,status.is.null");

    // Применяем сортировку
    switch (sortBy) {
      case "oldest":
        itemsQuery = itemsQuery.order("created_at", { ascending: true });
        break;
      case "popular":
        itemsQuery = itemsQuery.order("created_at", { ascending: false });
        break;
      default: // newest
        itemsQuery = itemsQuery.order("created_at", { ascending: false });
        break;
    }

    const { data: itemsData, error: itemsFetchError } = await itemsQuery;
    if (itemsFetchError) throw itemsFetchError;
    if (!itemsData || itemsData.length === 0) {
      return { deals: [], sweepstakes: [] };
    }

    // Загружаем голоса
    const allFetchedItemIds = itemsData.map(item => item.id);
    let votesMap = new Map<string, { count: number, userVote: boolean | null }>();

    const { data: votes, error: voteError } = await supabase
      .from('deal_votes')
      .select('deal_id, user_id, vote_type')
      .in('deal_id', allFetchedItemIds);

    if (!voteError && votes) {
      allFetchedItemIds.forEach(id => {
        let currentItemVoteCount = 0;
        let currentUserVoteForThisItem: boolean | null = null;
        votes.filter(v => v.deal_id === id).forEach(vote => {
          currentItemVoteCount += vote.vote_type ? 1 : -1;
          if (user.id === vote.user_id) {
            currentUserVoteForThisItem = vote.vote_type;
          }
        });
        votesMap.set(id, { count: currentItemVoteCount, userVote: currentUserVoteForThisItem });
      });
    }

    // Маппим данные
    const mappedDealsAndSweepstakes = itemsData.map((d: any): Deal => {
      const voteInfo = votesMap.get(d.id) || { count: 0, userVote: null };
      const profileData = d.profiles || {};
      return {
        id: d.id,
        title: d.title,
        currentPrice: parseFloat(d.current_price),
        originalPrice: d.original_price ? parseFloat(d.original_price) : undefined,
        store: { id: d.store_id, name: d.store_name || d.store_id },
        category: { id: d.category_id, name: d.category_name || d.category_id },
        image: d.image_url,
        postedAt: {
          relative: formatTimeAgo_local(d.created_at),
          exact: new Date(d.created_at).toLocaleString(),
        },
        postedBy: {
          id: profileData.id || 'anon',
          name: profileData.display_name || profileData.email?.split('@')[0] || 'Anonymous',
          avatar: profileData.avatar_url || profileData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(profileData.display_name || profileData.email?.split('@')[0] || 'A')}&background=random`,
        },
        comments: d.deal_comments?.[0]?.count || 0,
        popularity: voteInfo.count,
        userVoteType: voteInfo.userVote,
        type: d.type,
        isFavorite: true,
        createdAt: d.created_at,
        status: d.status || 'approved',
        url: d.deal_url,
        description: d.description,
        expires_at: d.expires_at,
      };
    });

    const deals = mappedDealsAndSweepstakes.filter(d => d.type === 'deal');
    const sweepstakes = mappedDealsAndSweepstakes.filter(d => d.type === 'sweepstakes');

    return { deals, sweepstakes };
  };

  const loadSavedPromos = async (): Promise<SavedPromoItem[]> => {
    if (!user) return [];

    const { data: promoFavorites, error: promoFavError } = await supabase
      .from("promo_favorites")
      .select("promo_id")
      .eq("user_id", user.id);

    if (promoFavError) throw promoFavError;
    if (!promoFavorites || promoFavorites.length === 0) return [];

    const promoIdsFromFavorites = promoFavorites.map((fav) => fav.promo_id);

    let promosQuery = supabase
      .from("promo_codes")
      .select(`*, 
               profiles:user_id(id, email, display_name), 
               promo_comments:promo_comments_promo_id_fkey(count)`)
      .in("id", promoIdsFromFavorites)
      .or("status.eq.published,status.eq.approved,status.is.null");

    // Применяем сортировку
    switch (sortBy) {
      case "oldest":
        promosQuery = promosQuery.order("created_at", { ascending: true });
        break;
      case "popular":
        promosQuery = promosQuery.order("created_at", { ascending: false });
        break;
      default: // newest
        promosQuery = promosQuery.order("created_at", { ascending: false });
        break;
    }

    const { data: promosData, error: promosFetchError } = await promosQuery;
    if (promosFetchError) throw promosFetchError;
    if (!promosData || promosData.length === 0) return [];

    // Загружаем голоса для промо
    const allFetchedPromoIds = promosData.map(p => p.id);
    let promoVotesMap = new Map<string, { count: number, userVote: boolean | null }>();

    const { data: votes, error: voteError } = await supabase
      .from('promo_votes')
      .select('promo_id, user_id, vote_type')
      .in('promo_id', allFetchedPromoIds);

    if (!voteError && votes) {
      allFetchedPromoIds.forEach(id => {
        let currentItemVoteCount = 0;
        let currentUserVoteForThisItem: boolean | null = null;
        votes.filter(v => v.promo_id === id).forEach(vote => {
          currentItemVoteCount += vote.vote_type ? 1 : -1;
          if (user.id === vote.user_id) {
            currentUserVoteForThisItem = vote.vote_type;
          }
        });
        promoVotesMap.set(id, { count: currentItemVoteCount, userVote: currentUserVoteForThisItem });
      });
    }

    return promosData.map((p: any): SavedPromoItem => {
      const voteInfo = promoVotesMap.get(p.id) || { count: 0, userVote: null };
      const profileData = p.profiles || {};
      return {
        id: p.id,
        title: p.title,
        code: p.code,
        description: p.description,
        created_at: p.created_at,
        user_id: p.user_id,
        profiles: {
          id: profileData.id,
          email: profileData.email,
          display_name: profileData.display_name,
          avatar: profileData.avatar_url || profileData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(profileData.display_name || profileData.email?.split('@')[0] || 'A')}&background=random`,
        },
        comments: p.promo_comments?.[0]?.count || 0,
        popularity: voteInfo.count,
        userVoteType: voteInfo.userVote,
        type: "promo",
        discount_url: p.discount_url,
        status: p.status || 'approved',
        expires_at: p.expires_at,
      };
    });
  };

  // Загружаем данные при изменении пользователя или сортировки
  useEffect(() => {
    loadSavedItems();
  }, [loadSavedItems]);

  return (
    <div className="pb-24 bg-gray-900 min-h-screen">
      <div className="web-page-header fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 px-4 py-3 z-10">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center">
            <button
              onClick={() => navigate(-1)}
              className="text-white p-1 hover:bg-gray-700 rounded-full"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-white font-medium ml-3">Saved Items</h1>
          </div>
          <div className="flex items-center space-x-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-gray-800 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-orange-500 appearance-none"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="popular">Popular</option>
            </select>
          </div>
        </div>
      </div>

      <div className="main-content-area px-4 pt-16">
        <div className="flex space-x-2 mb-4 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          <button
            className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium ${
              activeTab === "deals"
                ? "bg-orange-500 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"
            }`}
            onClick={() => setActiveTab("deals")}
          >
            Deals ({savedDeals.length})
          </button>
          <button
            className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium ${
              activeTab === "promos"
                ? "bg-orange-500 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"
            }`}
            onClick={() => setActiveTab("promos")}
          >
            Promos ({savedPromos.length})
          </button>
          <button
            className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium ${
              activeTab === "sweepstakes"
                ? "bg-orange-500 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"
            }`}
            onClick={() => setActiveTab("sweepstakes")}
          >
            Sweepstakes ({savedSweepstakes.length})
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : !user ? (
          <div className="text-center text-gray-400 py-8">
            Please sign in to view your saved items.
          </div>
        ) : (
          <div className="space-y-4">
            {activeTab === "deals" && (
              savedDeals.length > 0 ? (
                <div className="space-y-4">
                  {savedDeals.map((deal) => (
                    <DealCard
                      key={`deal-${deal.id}`}
                      deal={deal}
                      onVoteChange={loadSavedItems}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">No saved deals yet.</div>
              )
            )}

            {activeTab === "sweepstakes" && (
              savedSweepstakes.length > 0 ? (
                <div className="space-y-4">
                  {savedSweepstakes.map((sweepstake) => (
                    <DealCard
                      key={`sweepstake-${sweepstake.id}`}
                      deal={sweepstake}
                      onVoteChange={loadSavedItems}
                      hideFreeLabel={true}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">No saved sweepstakes yet.</div>
              )
            )}

            {activeTab === "promos" && (
              savedPromos.length > 0 ? (
                <div className="space-y-4">
                  {savedPromos.map((promo) => (
                    <div key={promo.id} className="bg-gray-800 rounded-lg overflow-hidden shadow-md">
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-gray-400 text-xs" title={promo.created_at ? new Date(promo.created_at).toLocaleString() : undefined}>
                            {formatTimeAgo_local(promo.created_at)}
                          </div>
                          <div className="flex items-center space-x-2">
                            <VoteControls
                              dealId={promo.id}
                              type={promo.type}
                              popularity={promo.popularity as any}
                              userVoteType={promo.userVoteType as any}
                              onVoteChange={loadSavedItems}
                            />
                          </div>
                        </div>
                        <h3 
                          onClick={() => navigate(promo.id ? `/promos/${promo.id}` : "#")}
                          className="text-white font-medium text-sm cursor-pointer hover:text-orange-400 transition-colors"
                        >
                          {promo.title}
                        </h3>
                        {promo.expires_at && new Date(promo.expires_at) < new Date() && (
                          <div className="flex items-center bg-red-500/10 px-2 py-0.5 rounded text-red-500 text-xs font-medium mt-1">
                            <Calendar className="w-3 h-3 mr-0.5" /> Expired
                          </div>
                        )}
                        {promo.description && (
                          <div className="my-2">
                            <p className="text-gray-400 text-sm line-clamp-2">
                              {promo.description}
                            </p>
                          </div>
                        )}
                        <div className="flex items-center space-x-2 my-3">
                          <div className="bg-gray-700 px-3 py-1.5 rounded-md border border-gray-600">
                            <span className="text-orange-400 font-mono text-sm tracking-wider">
                              {promo.code}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(promo.code);
                              setCopiedCodeId(promo.id);
                              setTimeout(() => setCopiedCodeId(null), 2000);
                            }}
                            className={`text-sm px-3 py-1.5 rounded-md ${
                              copiedCodeId === promo.id 
                                ? "bg-green-600 text-white" 
                                : "bg-orange-500 text-white hover:bg-orange-600"
                            }`}
                          >
                            {copiedCodeId === promo.id ? "Copied!" : "Copy Code"}
                          </button>
                          {promo.expires_at && !(new Date(promo.expires_at) < new Date()) && (
                            <div className="flex items-center text-gray-400 text-xs ml-auto" title="Expiration Date">
                              <Calendar className="h-3.5 w-3.5 mr-1" />
                              <span>Expires {new Date(promo.expires_at).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs mt-3 pt-3 border-t border-gray-700">
                          <div className="flex items-center">
                            <div className="w-5 h-5 rounded-full overflow-hidden bg-gray-700 mr-1.5">
                              <img
                                src={promo.profiles?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(promo.profiles?.display_name || promo.profiles?.email || "A")}&background=random`}
                                alt={promo.profiles?.display_name || "Anonymous"}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <span className="text-gray-400">
                              {promo.profiles?.display_name || promo.profiles?.email?.split("@")[0] || "Anonymous"}
                            </span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <button 
                              className="p-1 rounded-full text-red-500 hover:text-red-400"
                              onClick={async (e) => { 
                                e.stopPropagation(); 
                                if (!user) return;
                                const { error } = await supabase.from('promo_favorites').delete().match({ promo_id: promo.id, user_id: user.id });
                                if (error) console.error("Error unsaving promo:", error);
                                else loadSavedItems(); 
                              }}
                              title="Unsave"
                            >
                              <Heart className="h-4 w-4" fill="currentColor" />
                            </button>
                            <button 
                              className="text-gray-400 hover:text-orange-500 flex items-center"
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                const shareUrl = `${window.location.origin}/promos/${promo.id}`;
                                const cleanTitle = promo.title ? promo.title.replace(/<[^>]*>/g, "") : "";
                                if (navigator.share) {
                                  navigator.share({ title: cleanTitle, text: `${cleanTitle}\n${shareUrl}`, url: shareUrl });
                                } else {
                                  navigator.clipboard.writeText(`${cleanTitle}\n${shareUrl}`);
                                  alert("Link copied to clipboard!");
                                }
                              }}
                              title="Share"
                            >
                              <Share2 className="h-4 w-4" />
                            </button>
                            <a 
                              href={promo.discount_url || '#'} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              onClick={(e) => e.stopPropagation()}
                              className="text-gray-400 hover:text-orange-500 flex items-center"
                              title="Visit Store"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>
                        </div>
                      </div>
                      {promo.discount_url && (
                        <a
                          href={promo.discount_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="block bg-orange-600 hover:bg-orange-700 text-center text-white py-2.5 text-sm font-semibold transition-colors"
                        >
                          Use Code
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">No saved promo codes yet.</div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SavedItemsPage;
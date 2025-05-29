// CODE_BLOCK_START - SearchPage.tsx - Гибкий поиск параметра query или q
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import DealCard from "../components/deals/DealCard";
import { Deal } from "../types";
import VoteControls from "../components/deals/VoteControls";

type SortOption = "newest" | "oldest" | "popular";

const formatCount = (count: number): string => {
  if (typeof count !== "number" || isNaN(count)) return "0";
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  }
  return count.toString();
};

const formatTimeAgo = (dateString?: string) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);

  if (seconds < 5) return "just now";
  if (minutes < 1) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

function getQueryParamManually(searchString: string, paramName: string): string {
  if (!searchString || searchString.length < 2) {
    return '';
  }
  const query = searchString.startsWith('?') ? searchString.substring(1) : searchString;
  const vars = query.split('&');
  for (let i = 0; i < vars.length; i++) {
    const pair = vars[i].split('=');
    if (decodeURIComponent(pair[0]) === paramName) {
      return pair.length > 1 ? (decodeURIComponent(pair[1]) || '').trim() : ''; // Добавлен trim
    }
  }
  return '';
}

const SearchPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [actualSearchParams, setActualSearchParams] = useSearchParams();

  const { user } = useAuth();
  const { t } = useLanguage();

  const [searchQuery, setSearchQuery] = useState('');

  console.log('[SearchPage RENDER] location.search:', location.search);
  console.log('[SearchPage RENDER] Current searchQuery STATE:', searchQuery);

  const [deals, setDeals] = useState<Deal[]>([]);
  const [promos, setPromos] = useState<any[]>([]);
  const [sweepstakes, setSweepstakes] = useState<Deal[]>([]);

  const [dealCount, setDealCount] = useState(0);
  const [promoCount, setPromoCount] = useState(0);
  const [sweepstakesCount, setSweepstakesCount] = useState(0);

  const [activeTab, setActiveTab] = useState< "deals" | "promos" | "sweepstakes" >("deals");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [isReactNativeView, setIsReactNativeView] = useState(false);

  useEffect(() => {
    console.log('[SearchPage FLEXIBLE SYNC EFFECT] Hook fired. location.search:', location.search);

    let queryFromLocation = getQueryParamManually(location.search, 'query'); // Сначала ищем 'query'
    console.log('[SearchPage FLEXIBLE SYNC EFFECT] Parsed for "query":', queryFromLocation);

    if (!queryFromLocation) { // Если 'query' не найден или пуст, пробуем 'q'
        console.log('[SearchPage FLEXIBLE SYNC EFFECT] "query" not found or empty, trying "q"');
        queryFromLocation = getQueryParamManually(location.search, 'q');
        console.log('[SearchPage FLEXIBLE SYNC EFFECT] Parsed for "q":', queryFromLocation);
    }

    console.log('[SearchPage FLEXIBLE SYNC EFFECT] Final queryFromLocation:', queryFromLocation);
    console.log('[SearchPage FLEXIBLE SYNC EFFECT] Current searchQuery STATE before update:', searchQuery);

    if (queryFromLocation !== searchQuery) {
      console.log('[SearchPage FLEXIBLE SYNC EFFECT] Updating searchQuery STATE to:', queryFromLocation);
      setSearchQuery(queryFromLocation);
    } else {
      console.log('[SearchPage FLEXIBLE SYNC EFFECT] searchQuery STATE is already up to date or effective query is empty.');
      if (!queryFromLocation && loading && searchQuery === '') {
        console.log('[SearchPage FLEXIBLE SYNC EFFECT] No query in URL and state is empty, ensuring loading is false.');
        setLoading(false);
      }
    }
  }, [location.search, searchQuery, loading]);

  useEffect(() => {
    const pageTitle = "Search Results";
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      setIsReactNativeView(true);
      const timerId = setTimeout(() => {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: "SET_NATIVE_HEADER_TITLE",
            title: pageTitle,
          }),
        );
      }, 50);
      return () => clearTimeout(timerId);
    } else {
      setIsReactNativeView(false);
    }
  }, []);

  const loadSearchCounts = useCallback(async () => {
    if (!searchQuery) {
        setDealCount(0); setPromoCount(0); setSweepstakesCount(0);
        return;
    }
    try {
      console.log(`[SearchPage] Loading search counts for query (from STATE): "${searchQuery}"`);
      const { count: dealsTotal } = await supabase.from("deals").select("id", { count: "exact", head: true }).eq("type", "deal").or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      setDealCount(dealsTotal || 0);
      const { count: promosTotal } = await supabase.from("promo_codes").select("id", { count: "exact", head: true }).or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      setPromoCount(promosTotal || 0);
      const { count: sweepstakesTotal } = await supabase.from("deals").select("id", { count: "exact", head: true }).eq("type", "sweepstakes").or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      setSweepstakesCount(sweepstakesTotal || 0);
    } catch (error) {
      console.error("Error loading search counts:", error);
      setDealCount(0); setPromoCount(0); setSweepstakesCount(0);
    }
  }, [searchQuery]);

  const searchItems = useCallback(async () => {
    if (!searchQuery) {
      console.log(`[SearchPage] searchItems ABORTED - no searchQuery.`);
      setLoading(false); setIsFetchingMore(false);
      setDeals([]); setPromos([]); setSweepstakes([]);
      return;
    }
    console.log(`[SearchPage] searchItems CALLED. Query: "${searchQuery}", Tab: ${activeTab}, Page: ${page}, SortBy: ${sortBy}`);
    if (page === 1) setLoading(true);
    else setIsFetchingMore(true);

    try {
      let itemsToSet: any[] = []; const itemsPerPage = 20; let query;
      if (activeTab === "deals") { query = supabase.from("deals").select(`*, profiles!deals_user_id_fkey(id, email, display_name), deal_comments(id)`).eq("type", "deal").or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      } else if (activeTab === "sweepstakes") { query = supabase.from("deals").select(`*, profiles!deals_user_id_fkey(id, email, display_name), deal_comments(id)`).eq("type", "sweepstakes").or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      } else if (activeTab === "promos") { query = supabase.from("promo_codes").select(`*, profiles!promo_codes_user_id_fkey(id, email, display_name), promo_comments(id)`).or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      } else { setLoading(false); setIsFetchingMore(false); return; }

      if (!user) {
        if (activeTab === "deals" || activeTab === "sweepstakes") { query = query.in("status", ["published", "approved"]); }
        else if (activeTab === "promos") { query = query.in("status", ["published", "approved"]); }
      }
      switch (sortBy) {
        case "oldest": query = query.order("created_at", { ascending: true }); break;
        case "popular": query = query.order("vote_count", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }); break;
        default: query = query.order("created_at", { ascending: false }); break;
      }
      const { data, error } = await query.range((page - 1) * itemsPerPage, page * itemsPerPage - 1);
      if (error) throw error;

      console.log(`[SearchPage] searchItems DATA RECEIVED for query "${searchQuery}", page ${page}. Length: ${data?.length || 0}`);

      if (activeTab === "deals") {
        itemsToSet = data?.map((d) => ({ id: d.id, title: d.title, currentPrice: parseFloat(d.current_price), originalPrice: d.original_price ? parseFloat(d.original_price) : undefined, store: { id: d.store_id, name: d.store_id }, category: { id: d.category_id, name: d.category_id }, image: d.image_url, postedAt: { relative: formatTimeAgo(d.created_at), exact: new Date(d.created_at).toLocaleString(), }, popularity: d.vote_count || 0, comments: d.deal_comments?.length || 0, postedBy: { id: d.profiles?.id || "anon", name: d.profiles?.display_name || d.profiles?.email?.split("@")[0] || "Anonymous", avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(d.profiles?.display_name || d.profiles?.email?.split("@")[0] || "A")}&background=random`, }, description: d.description, url: d.deal_url, createdAt: d.created_at, expires_at: d.expires_at, type: "deal", status: d.status, })) || [];
        setDeals((prev) => page === 1 ? itemsToSet : [...prev, ...itemsToSet]);
      } else if (activeTab === "sweepstakes") {
        itemsToSet = data?.map((d) => ({ id: d.id, title: d.title, currentPrice: parseFloat(d.current_price), originalPrice: d.original_price ? parseFloat(d.original_price) : undefined, store: { id: d.store_id, name: d.store_id }, category: { id: d.category_id, name: d.category_id }, image: d.image_url, postedAt: { relative: formatTimeAgo(d.created_at), exact: new Date(d.created_at).toLocaleString(), }, popularity: d.vote_count || 0, comments: d.deal_comments?.length || 0, postedBy: { id: d.profiles?.id || "anon", name: d.profiles?.display_name || d.profiles?.email?.split("@")[0] || "Anonymous", avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(d.profiles?.display_name || d.profiles?.email?.split("@")[0] || "A")}&background=random`, }, description: d.description, url: d.deal_url, createdAt: d.created_at, expires_at: d.expires_at, type: "sweepstakes", status: d.status, })) || [];
        setSweepstakes((prev) => page === 1 ? itemsToSet : [...prev, ...itemsToSet]);
      } else if (activeTab === "promos") {
        const promosWithVotes = data ? await Promise.all( data.map(async (p) => { const { data: votesData, error: votesError } = await supabase .from("promo_votes") .select("vote_type") .eq("promo_id", p.id); let vote_count = 0; if (votesData && !votesError) { vote_count = votesData.reduce( (acc, vote) => acc + (vote.vote_type ? 1 : -1), 0, ); } return { ...p, vote_count: vote_count, profiles: p.profiles || { id: "anon", display_name: "Anonymous", email: "", }, promo_comments: p.promo_comments || [], }; }), ) : [];
        itemsToSet = promosWithVotes;
        setPromos((prev) => page === 1 ? itemsToSet : [...prev, ...itemsToSet]);
      }
      setHasMore(itemsToSet.length === itemsPerPage);
    } catch (error) { console.error("Error searching items:", error); setHasMore(false);
    } finally {
      console.log(`[SearchPage] searchItems FINALLY block. Setting loading to false. Query: "${searchQuery}", Page: ${page}`);
      setLoading(false); setIsFetchingMore(false);
    }
  }, [searchQuery, activeTab, sortBy, page, user, hasMore]);

  useEffect(() => {
    console.log(`[Effect searchQuery Change] searchQuery is now: "${searchQuery}"`);
    if (searchQuery) {
      setLoading(true);
      loadSearchCounts();
      setDeals([]); setPromos([]); setSweepstakes([]);
      setPage(1);
      setHasMore(true);
    } else {
      setDealCount(0); setPromoCount(0); setSweepstakesCount(0);
      setDeals([]); setPromos([]); setSweepstakes([]);
      setLoading(false);
      setHasMore(true);
      setPage(1);
    }
  }, [searchQuery, loadSearchCounts]);

  useEffect(() => {
    if (searchQuery) {
      console.log(`[Effect Filters Change] Filters changed (sortBy/activeTab). Query: "${searchQuery}", Tab: ${activeTab}, SortBy: ${sortBy}. Resetting page to 1.`);
      setLoading(true);
      setPage(1);
      setHasMore(true);
      if (activeTab === "deals") setDeals([]);
      else if (activeTab === "promos") setPromos([]);
      else if (activeTab === "sweepstakes") setSweepstakes([]);
    }
  }, [sortBy, activeTab, searchQuery]);

  useEffect(() => {
    console.log(`[Effect Call searchItems] Evaluating. searchQuery: "${searchQuery}", page: ${page}, hasMore: ${hasMore}, loading: ${loading}`);
    if (searchQuery) {
      if (page === 1 || (page > 1 && hasMore)) {
        console.log(`[Effect Call searchItems] Calling searchItems. Query: "${searchQuery}", Page: ${page}`);
        searchItems();
      } else if (page > 1 && !hasMore) {
        console.log(`[Effect Call searchItems] Not calling searchItems for page ${page}. No more data.`);
        setIsFetchingMore(false);
      }
    } else {
      setLoading(false);
    }
  }, [searchQuery, page, hasMore, searchItems]);


  useEffect(() => {
    const handleScroll = () => { if ( window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 500 && !isFetchingMore && hasMore && searchQuery ) { setPage((prevPage) => prevPage + 1); } };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isFetchingMore, hasMore, searchQuery]);

  const handleDataRefreshNeeded = () => { if (searchQuery) { loadSearchCounts(); setPage(1); setDeals([]); setPromos([]); setSweepstakes([]); setHasMore(true); setLoading(true); } };

  // JSX ... (остается таким же, как в предыдущем полном варианте)
  return (
    <div className="min-h-screen bg-gray-900 pb-24">
      {!isReactNativeView && (
        <div className="web-page-header fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 px-4 py-3 z-10">
          <div className="max-w-lg mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <button onClick={() => navigate(-1)} className="text-white p-1 hover:bg-gray-700 rounded-full" >
                  <ArrowLeft className="h-6 w-6" />
                </button>
                <h1 className="text-white font-medium ml-3">Search Results</h1>
              </div>
              <div className="flex items-center space-x-2">
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)} className="bg-gray-800 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-orange-500 appearance-none" >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="popular">Popular</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`main-content-area relative mx-4 mb-3 ${!isReactNativeView ? "pt-4" : "pt-4"}`} style={{ paddingTop: !isReactNativeView ? '60px' : '16px' }} >
        <div className="flex justify-center pb-2 mb-4">
          <div className="flex flex-nowrap items-center space-x-2 overflow-x-auto scrollbar-hide">
            <button className={`min-w-0 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${activeTab === "deals" ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"}`} onClick={() => setActiveTab("deals")} title={`Deals (${dealCount})`} >
              Deals ({formatCount(dealCount)})
            </button>
            <button className={`min-w-0 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${activeTab === "promos" ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"}`} onClick={() => setActiveTab("promos")} title={`Promos (${promoCount})`} >
              Promos ({formatCount(promoCount)})
            </button>
            <button className={`min-w-0 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${activeTab === "sweepstakes" ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"}`} onClick={() => setActiveTab("sweepstakes")} title={`Sweepstakes (${sweepstakesCount})`} >
              Sweepstakes ({formatCount(sweepstakesCount)})
            </button>
          </div>
        </div>

        {!searchQuery ? (
          <div className="text-center text-gray-400 py-12">
            Enter a search term to see results.
          </div>
        ) : loading && page === 1 ? (
          <div className="flex justify-center items-center py-12">
            <div className="h-10 w-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {activeTab === "deals" &&
              (deals.length > 0
                ? deals.map((deal) => ( <DealCard key={`deal-${deal.id}`} deal={deal} onVoteChange={handleDataRefreshNeeded} /> ))
                : !loading && !isFetchingMore && ( <div className="text-center text-gray-500 py-8"> No deals found matching your search. </div> ))}
            {activeTab === "sweepstakes" &&
              (sweepstakes.length > 0
                ? sweepstakes.map((sweepstake) => ( <DealCard key={`sweepstake-${sweepstake.id}`} deal={{ ...sweepstake, store: { ...sweepstake.store, name: sweepstake.store?.name || "", }, }} onVoteChange={handleDataRefreshNeeded} hideFreeLabel={true} /> ))
                : !loading && !isFetchingMore && ( <div className="text-center text-gray-500 py-8"> No sweepstakes found matching your search. </div> ))}
            {activeTab === "promos" &&
              (promos.length > 0
                ? promos.map((promo) => (
                    <div key={promo.id} onClick={() => navigate(promo.id ? `/promos/${promo.id}` : "#")} className="bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-700 transition-colors cursor-pointer shadow-md" >
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-gray-400 text-xs" title={ promo.created_at ? new Date(promo.created_at).toLocaleString() : undefined } >
                            {formatTimeAgo(promo.created_at)}
                          </div>
                          <VoteControls dealId={promo.id} type="promo_code" initialVoteCount={promo.vote_count} onVoteChange={handleDataRefreshNeeded} />
                        </div>
                        <h3 className="text-white font-semibold text-lg line-clamp-1 mb-1"> {promo.title} </h3>
                        {promo.status === "pending" && ( <span className="my-1 px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded-full inline-block"> Pending </span> )}
                        {promo.status === "rejected" && ( <span className="my-1 px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full inline-block"> Rejected </span> )}
                        <p className="text-gray-300 text-sm line-clamp-2 my-2"> {promo.description} </p>
                        <div className="flex items-center space-x-2 mb-3">
                          <div className="bg-gray-700 px-3 py-1.5 rounded-md border border-gray-600">
                            <span className="text-orange-400 font-mono text-md"> {promo.code} </span>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(promo.code); setCopiedCodeId(promo.id); setTimeout(() => setCopiedCodeId(null), 2000); }} className={`text-sm font-medium ${ copiedCodeId === promo.id ? "text-green-400" : "text-orange-400 hover:text-orange-300" }`} >
                            {copiedCodeId === promo.id ? "Copied!" : "Copy Code"}
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-400 mt-3 pt-3 border-t border-gray-700">
                          <div className="flex items-center">
                            {promo.profiles && ( <> <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent( promo.profiles.display_name || promo.profiles.email?.split("@")[0] || "A", )}&background=random`} alt={promo.profiles.display_name || "User"} className="w-5 h-5 rounded-full mr-1.5" /> <span> {promo.profiles.display_name || promo.profiles.email?.split("@")[0] || "Anonymous"} </span> </> )}
                          </div>
                        </div>
                      </div>
                      {promo.discount_url && ( <a href={promo.discount_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="block bg-orange-600 hover:bg-orange-700 text-center text-white py-2.5 text-sm font-semibold transition-colors" > Use Code </a> )}
                    </div>
                  ))
                : !loading && !isFetchingMore && ( <div className="text-center text-gray-500 py-8"> No promos found matching your search. </div> ))}
            {isFetchingMore && ( <div className="flex justify-center items-center py-6"> <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div> </div> )}
            {!hasMore && !loading && !isFetchingMore && (dealCount > 0 || promoCount > 0 || sweepstakesCount > 0) && ( <div className="text-center text-gray-600 py-8 text-sm"> You've reached the end of search results. </div> )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPage;
// CODE_BLOCK_END - SearchPage.tsx - Гибкий поиск параметра query или q
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext"; // ИСПРАВЛЕНО: Вернули оригинальный путь
import { useLanguage } from "../contexts/LanguageContext";
import { useGlobalState } from "../contexts/GlobalStateContext";
import { supabase } from "../lib/supabase";
import Tabs from "../components/deals/Tabs";
import FilterBar from "../components/shared/FilterBar";
import DealCard from "../components/deals/DealCard";
import { DEAL_SETTINGS } from "../config/settings";
import { decodeHtmlEntities } from "../utils/htmlUtils";

const ITEMS_PER_PAGE = 20;

const formatRelativeTime = (date: Date) => {
  const now = new Date();
  const diffInMinutes = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60),
  );
  if (diffInMinutes < 1) return "just now";
  if (diffInMinutes < 5) return "1m";
  if (diffInMinutes < 15) return "5m";
  if (diffInMinutes < 30) return "30m";
  if (diffInMinutes < 60) return "1h";
  if (diffInMinutes < 120) return "1h";
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
  return `${Math.floor(diffInMinutes / 1440)}d`;
};

const DealsPage: React.FC = () => {
  const initialTab = sessionStorage.getItem("activeDealsTab") || "hot";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>(['active', 'expired']); // По умолчанию оба включены
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { t } = useLanguage();
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get("q") || "";
  const { state, dispatch } = useGlobalState();
  // const deals = state.deals.items;

  const loadDeals = useCallback(
    async (isInitial = false, pageToLoad = 1) => {
      console.log(
        `loadDeals called: isInitial=${isInitial}, pageToLoad=${pageToLoad}, activeTab=${activeTab}, currentGlobalItemsCount=${state.deals.items.length}`,
      );
      if (isInitial) {
        setLoading(true);
      } else {
        setFetchingMore(true);
      }
      setError(null);

      try {
        const from = (pageToLoad - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;

        let query = supabase
          .from("get_deals_with_stats")
          .select("*, title_en, title_es, description_en, description_es")
          .not("type", "eq", "sweepstakes");

        // Apply tab-specific ordering and filtering directly in the Supabase query
if (activeTab === "hot") {
  query = query
    .or(
      `is_hot.eq.true,popularity.gte.${DEAL_SETTINGS.hotThreshold || 10}`,
    )
    .order("created_at", { ascending: false });
} else if (activeTab === "discussed") {
  query = query
    .order("comment_count", { ascending: false })
    .order("updated_at", { ascending: false });
} else if (activeTab === "free") {
  query = query
    .eq("current_price", 0)
    .order("created_at", { ascending: false });
} else {
  // 'new' tab or default
  query = query.order("created_at", { ascending: false });
}

        // Apply category and store filters
        if (selectedCategories.length > 0) {
          query = query.in("category_id", selectedCategories);
        }
        if (selectedStores.length > 0) {
          query = query.in("store_id", selectedStores);
        }

        // Apply status filter (active/expired)
        if (selectedStatus.length > 0 && selectedStatus.length < 2) {
          const now = new Date().toISOString();
          if (selectedStatus.includes('active')) {
            query = query.or(`expires_at.is.null,expires_at.gte.${now}`);
          } else if (selectedStatus.includes('expired')) {
            query = query.lt('expires_at', now);
          }
        }

        // Apply user/admin status filters
        let favoriteIds: Set<string> = new Set();
        if (user) {
          const { data: favoritesData } = await supabase
            .from("deal_favorites")
            .select("deal_id")
            .eq("user_id", user.id);
          if (favoritesData)
            favoriteIds = new Set(favoritesData.map((fav) => fav.deal_id));
        }
        let votedIds: Map<string, boolean> = new Map();
        if (user) {
          const { data: votesData } = await supabase
            .from("deal_votes")
            .select("deal_id, vote_type")
            .eq("user_id", user.id);
          if (votesData)
            votedIds = new Map(
              votesData.map((vote) => [vote.deal_id, vote.vote_type]),
            );
        }
        const { data: profile } = user
          ? await supabase
              .from("profiles")
              .select("user_status")
              .eq("id", user.id)
              .single()
          : { data: null };
        const isAdminOrModerator = [
          "admin",
          "moderator",
          "super_admin",
        ].includes(profile?.user_status);

        if (!user) query = query.in("status", ["published", "approved"]);
        else if (!isAdminOrModerator)
          query = query.or(
            `status.in.(published,approved),user_id.eq.${user.id}`,
          );

        // Apply search query
        if (searchQuery) {
          const terms = searchQuery.toLowerCase().split(" ").filter(Boolean);
          if (terms.length) {
            const filters = terms.map(
              (term) =>
                `title.ilike.%${term}%,description.ilike.%${term}%,store_id.ilike.%${term}%`,
            );
            query = query.or(filters.join(","));
          }
        }

        // Apply pagination range
        query = query.range(from, to);

        const { data, error: fetchError } = await query;
        console.log("Supabase response:", {
          dataLength: data?.length,
          fetchError,
        });
        
        // ОТЛАДКА: Проверяем мультиязычные поля
        if (data && data.length > 0) {
          console.log("DEBUG: First deal multilingual fields:", {
            id: data[0].id,
            title: data[0].title,
            title_en: data[0].title_en,
            title_es: data[0].title_es,
            description: data[0].description?.substring(0, 50),
            description_en: data[0].description_en?.substring(0, 50),
            description_es: data[0].description_es?.substring(0, 50),
            allFields: Object.keys(data[0])
          });
        }
        if (fetchError) throw fetchError;

        const enrichedDeals = (data || []).map((deal) => ({
          id: deal.id,
          title: decodeHtmlEntities(deal.title),
          title_en: deal.title_en,
          title_es: deal.title_es,
          type: deal.type,
          currentPrice: parseFloat(deal.current_price),
          originalPrice: deal.original_price
            ? parseFloat(deal.original_price)
            : undefined,
          store: { id: deal.store_id, name: deal.store_id },
          category: { id: deal.category_id, name: deal.category_id },
          image:
            deal.image_url ||
            "https://via.placeholder.com/400x300?text=No+Image",
          postedAt: {
            relative: formatRelativeTime(new Date(deal.created_at)),
            exact: new Date(deal.created_at).toLocaleString(),
          },
          popularity: deal.popularity || 0,
          userVoteType: votedIds.get(deal.id),
          comments: deal.comment_count || 0,
          isFavorite: favoriteIds.has(deal.id),
          postedBy: {
            id: deal.profile_id || "anonymous",
            name: deal.display_name || deal.email?.split("@")[0] || "Anonymous",
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(deal.display_name || deal.email?.split("@")[0] || "Anonymous")}&background=random`,
          },
          description: decodeHtmlEntities(deal.description),
          description_en: deal.description_en,
          description_es: deal.description_es,
          url: deal.deal_url,
          createdAt: new Date(deal.created_at),
          is_hot: deal.is_hot,
          expires_at: deal.expires_at,
          status: deal.status,
        }));

        if (!enrichedDeals.length && !isInitial) {
          console.log("Received 0 new deals on pagination — skipping state update");
          setHasMore(false);
          return;
        }

        const currentDeals = state.deals.items;
        const updatedDeals = isInitial ? enrichedDeals : [...currentDeals, ...enrichedDeals];

        if (isInitial) {
          dispatch({ type: "SET_DEALS", payload: enrichedDeals });
        } else {
          dispatch({ type: "APPEND_DEALS", payload: enrichedDeals });
        }

        const shouldHaveMore = enrichedDeals.length === ITEMS_PER_PAGE;
        console.log(
          `Setting hasMore to ${shouldHaveMore}. Received ${enrichedDeals.length} items, expected ${ITEMS_PER_PAGE}`,
        );
        setHasMore(shouldHaveMore);
      } catch (err) {
        console.error("Error fetching deals:", err);
        setError("Failed to load deals");
      } finally {
        setLoading(false);
        setFetchingMore(false);
        console.log(`loadDeals finished: loading=false, fetchingMore=false`);
      }
    },
    [
      user,
      searchQuery,
      activeTab,
      selectedCategories,
      selectedStores,
      selectedStatus,
      dispatch,
    ],
  );

  const loadDealsRef = useRef(loadDeals);
  useEffect(() => {
    loadDealsRef.current = loadDeals;
  }, [loadDeals]);

  const handleTabChange = (tab: string) => {
  console.log(`Переключаемся на вкладку: ${tab}`);
  console.log('Текущие выбранные категории:', selectedCategories);
    setActiveTab(tab);
    sessionStorage.setItem("activeDealsTab", tab);
 setSelectedCategories([]);
  setSelectedStores([]);
  setSelectedStatus(['active', 'expired']); // Сбрасываем к значениям по умолчанию
  };

  const handleFilterChange = (type: "categories" | "stores" | "status", ids: string[]) => {
    if (type === "categories") setSelectedCategories(ids);
    else if (type === "stores") setSelectedStores(ids);
    else if (type === "status") setSelectedStatus(ids);
  };

  useEffect(() => {
    console.log(
      "Effect for initial load / filter change triggered. Resetting to page 1.",
    );
    setPage(1);
    setHasMore(true);
    loadDealsRef.current(true, 1);
  }, [
    activeTab,
    selectedCategories,
    selectedStores,
    selectedStatus,
    location.key,
    searchQuery,
    user?.id,
  ]);

  useEffect(() => {
    if (page > 1 && fetchingMore) {
      console.log(
        `Effect for pagination triggered for page ${page}. FetchingMore: ${fetchingMore}, hasMore: ${hasMore}`,
      );
      loadDealsRef.current(false, page);
    } else if (page > 1 && !fetchingMore) {
      console.log(
        `Page ${page}: fetchingMore is false, pagination load already completed. hasMore: ${hasMore}`,
      );
    }
  }, [page, fetchingMore, hasMore]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("Tab became visible. Reloading deals (page 1).");
        setPage(1);
        setHasMore(true);
        loadDealsRef.current(true, 1);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const handleScroll = useCallback(() => {
    if (
      window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - 100 &&
      hasMore &&
      !fetchingMore &&
      !loading
    ) {
      console.log(
        "Scroll threshold hit, preparing to load more. Current page before increment:",
        page,
        "hasMore:",
        hasMore,
        "fetchingMore:",
        fetchingMore,
        "loading:",
        loading,
      );
      setFetchingMore(true);
      setPage((prevPage) => {
        const nextPage = prevPage + 1;
        console.log("Setting page from", prevPage, "to", nextPage);
        return nextPage;
      });
    }
  }, [hasMore, fetchingMore, loading, page]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Client-side sorting is still okay here as it's applied to the already fetched and filtered data.
  // The 'hot' filtering is now done on the server, so no client-side 'hot' filter needed.
  const displayedDeals = state.deals.items.sort((a, b) => {
    if (activeTab === "discussed")
      return (
        (b.comments || 0) - (a.comments || 0) ||
        b.createdAt.getTime() - a.createdAt.getTime()
      );
    return b.createdAt.getTime() - a.createdAt.getTime(); // Default sort for 'new' and 'hot' (if no specific hot sorting in DB)
  });

  const translations = {
    en: "Nothing found for your query",
    ru: "Ничего не найдено по вашему запросу",
    es: "Nada encontrado para su consulta",
  };

  return (
    <div className="pb-16 pt-0 bg-gray-900 min-h-screen">
      <div className="text-[10px] text-center py-1 px-2">
        We may get paid by brands for deals, including promoted items.
      </div>
      <Tabs activeTab={activeTab} onTabChange={handleTabChange} />
      <FilterBar
        selectedCategories={selectedCategories}
        selectedStores={selectedStores}
        selectedStatus={selectedStatus}
        onFilterChange={handleFilterChange}
      />

      {loading && page === 1 && !error ? (
        <div
          className="flex justify-center items-center py-8"
          data-testid="main-loader"
        >
          <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : error ? (
        <div className="text-red-500 text-center py-8">{error}</div>
      ) : displayedDeals.length > 0 ? (
        <div className="divide-y divide-gray-800">
          {displayedDeals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              onVoteChange={() => {
                console.log("Vote changed, reloading deals (page 1).");
                setPage(1);
                setHasMore(true);
                loadDealsRef.current(true, 1);
              }}
            />
          ))}
          {fetchingMore && (
            <div
              className="flex justify-center items-center py-4"
              data-testid="pagination-loader"
            >
              <div className="h-6 w-6 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>
      ) : (
        !loading &&
        !fetchingMore && (
          <div className="text-gray-400 text-center py-8">
            {searchQuery
              ? translations[t("locale") as keyof typeof translations] ||
                translations.ru
              : t(
                  "common.no_items_in_category",
                  "Нет элементов в выбранной категории",
                )}
          </div>
        )
      )}
    </div>
  );
};

export default DealsPage;

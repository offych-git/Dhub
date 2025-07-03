import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  MessageSquare,
  Edit2,
  Search,
  Plus,
  X,
  Heart,
  Share2,
  ExternalLink,
  Calendar,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import DealCard from "../components/deals/DealCard";
import { Deal } from "../types"; // Убедитесь, что Deal теперь имеет popularity: number | undefined, userVoteType?: boolean | null
import VoteControls from "../components/deals/VoteControls";

type SortOption = "newest" | "oldest" | "popular";

// Тип Deal должен быть обновлен в ../types.ts:
// export interface Deal {
//   // ... все существующие поля ...
//   id: string;
//   title: string;
//   currentPrice: number;
//   originalPrice?: number;
//   store: { id: string; name: string };
//   category: { id: string; name: string };
//   image: string;
//   postedAt: { exact: string; relative: string }; // DealCard ожидает этот формат
//   postedBy: { id: string; name: string; avatar?: string };
//   comments: number;
//   type: "deal" | "sweepstakes" | "promo"; // Добавляем "promo" если нужно для VoteControls через DealCard
//   popularity: number; // ИЗМЕНЕНО НА NUMBER
//   userVoteType?: boolean | null;
//   isFavorite?: boolean;
//   createdAt: string; // DealCard ожидает это
//   status?: string;
//   url?: string;
//   description?: string;
//   expires_at?: string;
//   userComment?: any; // Если используется UserPostedItemsPage для фильтрации
//   // добавьте другие поля, которые использует DealCard
// }

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

interface PromoItemFromDB {
  // Тип данных, приходящих из таблицы promo_codes
  id: string;
  title: string;
  code: string;
  description?: string;
  created_at: string;
  user_id: string;
  profiles: { id?: string; email?: string; display_name?: string };
  promo_comments: { id: string }[]; // Предполагаем, что так приходит количество комментариев
  discount_url?: string;
  status?: string;
  // Добавьте другие поля из вашей таблицы promo_codes
}

interface PromoItemForDisplay {
  // Тип для состояния и передачи в VoteControls
  id: string;
  title: string;
  code: string;
  description?: string;
  created_at: string; // Используется для formatTimeAgo_local
  user_id: string;
  profiles: {
    id?: string;
    email?: string;
    display_name?: string;
    avatar?: string;
  };
  comments: number; // Количество комментариев
  popularity: number; // ИЗМЕНЕНО НА NUMBER
  userVoteType?: boolean | null;
  type: "promo"; // Для VoteControls
  discount_url?: string;
  status?: string;
  // Добавьте другие поля, если они используются в JSX для промо
}

const UserPostedItemsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [deals, setDeals] = useState<Deal[]>([]);
  const [promos, setPromos] = useState<PromoItemForDisplay[]>([]);
  const [sweepstakes, setSweepstakes] = useState<Deal[]>([]);

  const [dealCount, setDealCount] = useState(0);
  const [promoCount, setPromoCount] = useState(0);
  const [sweepstakesCount, setSweepstakesCount] = useState(0);

  const [activeTab, setActiveTab] = useState<
    "deals" | "promos" | "sweepstakes"
  >("deals");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true); // Сохраняем true для начальной загрузки
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [isReactNativeView, setIsReactNativeView] = useState(false);

  useEffect(() => {
    const pageTitle = "My Posted Items";
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

  const loadAllCounts = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { count: dealsTotal } = await supabase
        .from("deals")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("type", "deal");
      setDealCount(dealsTotal || 0);

      const { count: promosTotal } = await supabase
        .from("promo_codes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      setPromoCount(promosTotal || 0);

      const { count: sweepstakesTotal } = await supabase
        .from("deals")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("type", "sweepstakes");
      setSweepstakesCount(sweepstakesTotal || 0);
    } catch (error) {
      console.error("Error loading all counts:", error);
    }
  }, [user]);

  const loadUserItems = useCallback(async () => {
    if (!user?.id) {
      setLoading(false); // Убедимся, что лоадер выключен, если нет пользователя
      setIsFetchingMore(false);
      return;
    }
    // Если это не первая страница и больше нет данных, просто выходим
    if (!hasMore && page > 1) {
      setIsFetchingMore(false);
      return;
    }

    // Лоадер для первой загрузки или когда fetchingMore уже активен
    if (page === 1) setLoading(true);
    else setIsFetchingMore(true);

    try {
      const itemsPerPage = 20;
      let baseQuery;
      let voteTable: "deal_votes" | "promo_votes" = "deal_votes";
      let itemIdColumnInVoteTable: "deal_id" | "promo_id" = "deal_id";
      let itemTypePropForVoteControls: "deal" | "sweepstakes" | "promo" =
        "deal";

      if (activeTab === "deals") {
        baseQuery = supabase
          .from("deals")
          .select(
            `*, profiles!deals_user_id_fkey(id, email, display_name), deal_comments(count)`,
          )
          .eq("user_id", user.id)
          .eq("type", "deal");
        voteTable = "deal_votes";
        itemIdColumnInVoteTable = "deal_id";
        itemTypePropForVoteControls = "deal";
      } else if (activeTab === "sweepstakes") {
        baseQuery = supabase
          .from("deals")
          .select(
            `*, profiles!deals_user_id_fkey(id, email, display_name), deal_comments(count)`,
          )
          .eq("user_id", user.id)
          .eq("type", "sweepstakes");
        voteTable = "deal_votes";
        itemIdColumnInVoteTable = "deal_id";
        itemTypePropForVoteControls = "sweepstakes";
      } else if (activeTab === "promos") {
        baseQuery = supabase
          .from("promo_codes")
          .select(
            `*, profiles!promo_codes_user_id_fkey(id, email, display_name), promo_comments(count)`,
          )
          .eq("user_id", user.id);
        voteTable = "promo_votes";
        itemIdColumnInVoteTable = "promo_id";
        itemTypePropForVoteControls = "promo";
      } else {
        // Если activeTab не соответствует ничему, выключаем лоадер
        setLoading(false);
        setIsFetchingMore(false);
        return;
      }

      switch (sortBy) {
        case "oldest":
          baseQuery = baseQuery.order("created_at", { ascending: true });
          break;
        case "popular":
          baseQuery = baseQuery.order("created_at", { ascending: false }); // Пока так
          break;
        default: // newest
          baseQuery = baseQuery.order("created_at", { ascending: false });
          break;
      }

      const { data: primaryData, error: primaryError } = await baseQuery.range(
        (page - 1) * itemsPerPage,
        page * itemsPerPage - 1,
      );

      if (primaryError) throw primaryError;

      // Если данных нет, нет и последующих страниц
      if (!primaryData || primaryData.length === 0) {
        setHasMore(false);
        // Если это была первая страница, очищаем списки
        if (page === 1) {
          if (activeTab === "deals") setDeals([]);
          else if (activeTab === "promos") setPromos([]);
          else if (activeTab === "sweepstakes") setSweepstakes([]);
        }
        return; // Важно выйти здесь
      }

      const itemIds = primaryData.map((item: any) => item.id);
      let itemsWithFullData: Array<Deal | PromoItemForDisplay> = [];

      if (itemIds.length > 0) {
        const { data: votesData, error: votesError } = await supabase
          .from(voteTable)
          .select(`${itemIdColumnInVoteTable}, user_id, vote_type`)
          .in(itemIdColumnInVoteTable, itemIds);

        if (votesError) {
          console.error(`Error fetching votes from ${voteTable}:`, votesError);
        }

        itemsWithFullData = primaryData.map((item: any) => {
          let currentItemVoteCount = 0;
          let currentUserVoteForThisItem: boolean | null = null;
          const currentUserId = user?.id;

          if (votesData) {
            votesData
              .filter((vote) => vote[itemIdColumnInVoteTable] === item.id)
              .forEach((vote) => {
                currentItemVoteCount += vote.vote_type ? 1 : -1;
                if (currentUserId && vote.user_id === currentUserId) {
                  currentUserVoteForThisItem = vote.vote_type;
                }
              });
          }

          const profileData = item.profiles || {
            id: user?.id,
            display_name: user?.email?.split("@")[0] || "Anonymous",
            email: user?.email,
          };

          const commonFields = {
            id: item.id,
            title: item.title,
            description: item.description,
            createdAt: item.created_at,
            postedAt: {
              relative: formatTimeAgo_local(item.created_at),
              exact: new Date(item.created_at).toLocaleString(),
            },
            postedBy: {
              id: profileData.id || "anon",
              name:
                profileData.display_name ||
                profileData.email?.split("@")[0] ||
                "Anonymous",
              avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(profileData.display_name || profileData.email?.split("@")[0] || "A")}&background=random`,
            },
            comments:
              activeTab === "promos"
                ? item.promo_comments?.[0]?.count || 0
                : item.deal_comments?.[0]?.count || 0,
            popularity: currentItemVoteCount,
            userVoteType: currentUserVoteForThisItem,
            type: item.type || itemTypePropForVoteControls,
            isFavorite: false,
            status: item.status || "approved",
          };

          if (activeTab === "deals" || activeTab === "sweepstakes") {
            return {
              ...commonFields,
              currentPrice: parseFloat(item.current_price),
              originalPrice: item.original_price
                ? parseFloat(item.original_price)
                : undefined,
              store: { id: item.store_id, name: item.store_id },
              category: { id: item.category_id, name: item.category_id },
              image: item.image_url,
              url: item.deal_url,
              expires_at: item.expires_at,
            } as Deal;
          } else {
            return {
              ...commonFields,
              code: item.code,
              discount_url: item.discount_url,
            } as PromoItemForDisplay;
          }
        });
      } else {
        itemsWithFullData = primaryData.map((item: any) => {
          const profileData = item.profiles || {
            id: user?.id,
            display_name: user?.email?.split("@")[0] || "Anonymous",
            email: user?.email,
          };
          const commonFields = {
            id: item.id,
            title: item.title,
            description: item.description,
            createdAt: item.created_at,
            postedAt: {
              relative: formatTimeAgo_local(item.created_at),
              exact: new Date(item.created_at).toLocaleString(),
            },
            postedBy: {
              id: profileData.id || "anon",
              name:
                profileData.display_name ||
                profileData.email?.split("@")[0] ||
                "Anonymous",
              avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(profileData.display_name || profileData.email?.split("@")[0] || "A")}&background=random`,
            },
            comments:
              activeTab === "promos"
                ? item.promo_comments?.[0]?.count || 0
                : item.deal_comments?.[0]?.count || 0,
            popularity: 0,
            userVoteType: null,
            type: item.type || itemTypePropForVoteControls,
            isFavorite: false,
            status: item.status || "approved",
          };
          if (activeTab === "deals" || activeTab === "sweepstakes") {
            return {
              ...commonFields,
              currentPrice: parseFloat(item.current_price),
              originalPrice: item.original_price
                ? parseFloat(item.original_price)
                : undefined,
              store: { id: item.store_id, name: item.store_id },
              category: { id: item.category_id, name: item.category_id },
              image: item.image_url,
              url: item.deal_url,
              expires_at: item.expires_at,
            } as Deal;
          } else {
            return {
              ...commonFields,
              code: item.code,
              discount_url: item.discount_url,
            } as PromoItemForDisplay;
          }
        });
      }

      if (activeTab === "deals") {
        setDeals((prev) =>
          page === 1
            ? (itemsWithFullData as Deal[])
            : [...prev, ...(itemsWithFullData as Deal[])],
        );
      } else if (activeTab === "sweepstakes") {
        setSweepstakes((prev) =>
          page === 1
            ? (itemsWithFullData as Deal[])
            : [...prev, ...(itemsWithFullData as Deal[])],
        );
      } else if (activeTab === "promos") {
        setPromos((prev) =>
          page === 1
            ? (itemsWithFullData as PromoItemForDisplay[])
            : [...prev, ...(itemsWithFullData as PromoItemForDisplay[])],
        );
      }

      setHasMore(itemsWithFullData.length === itemsPerPage);
    } catch (error) {
      console.error("Error loading user items:", error);
      setHasMore(false);
    } finally {
      // Гарантируем, что setLoading(false) всегда вызывается
      setLoading(false);
      setIsFetchingMore(false);
    }
  }, [user, activeTab, sortBy, page, hasMore]); // Убрал deals, promos, sweepstakes из зависимостей

  // ЭТОТ useEffect теперь только переключает "первую загрузку"
  useEffect(() => {
    if (user) {
      loadAllCounts();
      setPage(1); // Сбрасываем страницу на 1 при смене пользователя или вкладки
      setHasMore(true); // Сбрасываем hasMore на true для новой загрузки
      // Очищаем списки, чтобы гарантировать полную перезагрузку
      setDeals([]);
      setPromos([]);
      setSweepstakes([]);
      setLoading(true); // Устанавливаем loading в true для новой загрузки
    } else {
      // Если пользователя нет, все сбрасываем
      setDealCount(0);
      setPromoCount(0);
      setSweepstakesCount(0);
      setDeals([]);
      setPromos([]);
      setSweepstakes([]);
      setPage(1);
      setHasMore(true);
      setLoading(false); // Здесь loading false, т.к. нет пользователя
    }
  }, [user, loadAllCounts, activeTab, sortBy]); // Добавил activeTab и sortBy, чтобы сброс происходил при смене сортировки/вкладки

  // ЭТОТ useEffect теперь отвечает только за запуск loadUserItems при изменении page, user, activeTab, sortBy
  useEffect(() => {
    // Запускаем loadUserItems только если user есть И (это первая страница ИЛИ есть еще данные)
    // hasMore в данном useEffect не должен быть в зависимостях
    // потому что изменение hasMore не должно приводить к запуску loadUserItems,
    // оно лишь влияет на то, будет ли loadUserItems вызван при следующем скролле
    if (user && (page === 1 || hasMore || (deals.length === 0 && activeTab === 'deals') || (promos.length === 0 && activeTab === 'promos') || (sweepstakes.length === 0 && activeTab === 'sweepstakes'))) {
      loadUserItems();
    }
  }, [user, page, activeTab, sortBy, loadUserItems]); // hasMore убран из зависимостей

  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop >=
          document.documentElement.offsetHeight - 500 &&
        !isFetchingMore &&
        hasMore &&
        !loading // Добавил проверку на !loading, чтобы не пытаться загружать, пока идет первая загрузка
      ) {
        setPage((prevPage) => prevPage + 1);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isFetchingMore, hasMore, loading]); // Добавил loading в зависимости

  const formatTimeAgo_local = (dateString?: string): string => {
    if (!dateString) return "some time ago";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "invalid date";

    const now = new Date();
    const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 5) return "just now";
    if (minutes < 1) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString(); // Для старых дат показываем полную дату
  };

  const handleDataRefreshNeeded = () => {
    loadAllCounts();
    if (page === 1) {
      setDeals([]);
      setPromos([]);
      setSweepstakes([]);
      setLoading(true);
      setPage(1); // Гарантируем, что сброс страницы на 1 вызовет загрузку
    } else {
      setPage(1); // Если не на первой странице, сброс page вызовет useEffect
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 pb-24">
      {!isReactNativeView && (
        <div className="web-page-header fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 px-4 py-3 z-10">
          <div className="max-w-lg mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <button
                  onClick={() => navigate(-1)}
                  className="text-white p-1 hover:bg-gray-700 rounded-full"
                >
                  <ArrowLeft className="h-6 w-6" />
                </button>
                <h1 className="text-white font-medium ml-3">My Posted Items</h1>
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
        </div>
      )}

      <div
        className={`main-content-area relative mx-4 mb-3 ${!isReactNativeView ? "pt-0" : "pt-4"}`}
      >
        <div className="flex justify-center pb-2 mb-4">
          <div className="flex flex-nowrap items-center space-x-2 overflow-x-auto scrollbar-hide">
            <button
              className={`min-w-0 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${activeTab === "deals" ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"}`}
              onClick={() => setActiveTab("deals")}
              title={`Deals (${dealCount})`}
            >
              Deals ({formatCount(dealCount)})
            </button>
            <button
              className={`min-w-0 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${activeTab === "promos" ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"}`}
              onClick={() => setActiveTab("promos")}
              title={`Promos (${promoCount})`}
            >
              Promos ({formatCount(promoCount)})
            </button>
            <button
              className={`min-w-0 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${activeTab === "sweepstakes" ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"}`}
              onClick={() => setActiveTab("sweepstakes")}
              title={`Sweepstakes (${sweepstakesCount})`}
            >
              Sweepstakes ({formatCount(sweepstakesCount)})
            </button>
          </div>
        </div>

        {loading && page === 1 ? (
          <div className="flex justify-center items-center py-12">
            <div className="h-10 w-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : !user?.id ? (
          <div className="text-center text-gray-400 py-12">
            Please sign in to view your posted items.
          </div>
        ) : (
          <div className="space-y-4">
            {activeTab === "deals" &&
              (deals.length > 0
                ? deals.map((deal) => (
                    <DealCard
                      key={`deal-${deal.id}`}
                      deal={deal}
                      onVoteChange={handleDataRefreshNeeded}
                    />
                  ))
                : (
                    <div className="text-center text-gray-500 py-8">
                      No deals posted yet.{" "}
                      <button
                        onClick={() => navigate("/deals/new-carousel")}
                        className="text-orange-500 hover:underline"
                      >
                        Post one!
                      </button>
                    </div>
                  ))}

            {activeTab === "sweepstakes" &&
              (sweepstakes.length > 0
                ? sweepstakes.map((sweepstake) => (
                    <DealCard
                      key={`sweepstake-${sweepstake.id}`}
                      deal={sweepstake}
                      onVoteChange={handleDataRefreshNeeded}
                      hideFreeLabel={true}
                    />
                  ))
                : (
                    <div className="text-center text-gray-500 py-8">
                      No sweepstakes posted yet.{" "}
                      <button
                        onClick={() => navigate("/sweepstakes/new")}
                        className="text-orange-500 hover:underline"
                      >
                        Post one!
                      </button>
                    </div>
                  ))}

            {activeTab === "promos" &&
              (promos.length > 0
                ? promos.map((promo) => (
                    <div
                      key={promo.id}
                      className="bg-gray-800 rounded-lg overflow-hidden shadow-md"
                    >
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div
                            className="text-gray-400 text-xs"
                            title={
                              promo.created_at
                                ? new Date(promo.created_at).toLocaleString()
                                : undefined
                            }
                          >
                            {formatTimeAgo_local(promo.created_at)}
                          </div>
                          <VoteControls
                            dealId={promo.id}
                            type={promo.type}
                            popularity={promo.popularity as any}
                            userVoteType={promo.userVoteType as any}
                            onVoteChange={handleDataRefreshNeeded}
                          />
                        </div>
                        <h3
                          onClick={() =>
                            navigate(promo.id ? `/promos/${promo.id}` : "#")
                          }
                          className="text-white font-semibold text-lg line-clamp-1 mb-1 cursor-pointer hover:text-orange-400"
                        >
                          {promo.title}
                        </h3>
                        {promo.status === "pending" && (
                          <span className="my-1 px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded-full inline-block">
                            Pending
                          </span>
                        )}
                        {promo.status === "rejected" && (
                          <span className="my-1 px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full inline-block">
                            Rejected
                          </span>
                        )}
                        <p className="text-gray-300 text-sm line-clamp-2 my-2">
                          {promo.description}
                        </p>
                        <div className="flex items-center space-x-2 mb-3">
                          <div className="bg-gray-700 px-3 py-1.5 rounded-md border border-gray-600">
                            <span className="text-orange-400 font-mono text-md">
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
                            className={`text-sm font-medium ${copiedCodeId === promo.id ? "text-green-400" : "text-orange-400 hover:text-orange-300"}`}
                          >
                            {copiedCodeId === promo.id
                              ? "Copied!"
                              : "Copy Code"}
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-400 mt-3 pt-3 border-t border-gray-700">
                          <div className="flex items-center">
                            {promo.profiles && (
                              <>
                                <img
                                  src={
                                    promo.profiles.avatar ||
                                    `https://ui-avatars.com/api/?name=${encodeURIComponent(promo.profiles.display_name || promo.profiles.email?.split("@")[0] || "A")}&background=random`
                                  }
                                  alt={promo.profiles.display_name || "User"}
                                  className="w-5 h-5 rounded-full mr-1.5"
                                />
                                <span>
                                  {promo.profiles.display_name ||
                                    promo.profiles.email?.split("@")[0] ||
                                    "Anonymous"}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center space-x-3">
                            {user && user.id === promo.user_id && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  navigate(
                                    promo.id ? `/promos/${promo.id}/edit` : "#",
                                  );
                                }}
                                className="text-orange-400 hover:text-orange-300 p-0.5"
                                title="Edit Promo"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              className="text-gray-400 hover:text-orange-500 p-0.5"
                              onClick={(e) => {
                                e.stopPropagation();
                                const shareUrl = `${window.location.origin}/promos/${promo.id}`;
                                const cleanTitle = promo.title
                                  ? promo.title.replace(/<[^>]*>/g, "")
                                  : "";
                                if (navigator.share) {
                                  navigator.share({
                                    title: cleanTitle,
                                    text: `${cleanTitle}\n${shareUrl}`,
                                    url: shareUrl,
                                  });
                                } else {
                                  navigator.clipboard.writeText(
                                    `${cleanTitle}\n${shareUrl}`,
                                  );
                                  alert("Link copied to clipboard!");
                                }
                              }}
                              title="Share"
                            >
                              <Share2 className="h-4 w-4" />
                            </button>
                            <a
                              href={promo.discount_url || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-gray-400 hover:text-orange-500 p-0.5"
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
                  ))
                : (
                    <div className="text-center text-gray-500 py-8">
                      No promos posted yet.{" "}
                      <button
                        onClick={() => navigate("/promos/new")}
                        className="text-orange-500 hover:underline"
                      >
                        Post one!
                      </button>
                    </div>
                  ))}

            {isFetchingMore && (
              <div className="flex justify-center items-center py-6">
                <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            {!hasMore &&
              !loading &&
              !isFetchingMore &&
              (dealCount > 0 || promoCount > 0 || sweepstakesCount > 0) && (
                <div className="text-center text-gray-600 py-8 text-sm">
                  You've reached the end.
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserPostedItemsPage;
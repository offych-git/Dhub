// UserPostedItemsPage.tsx
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MessageSquare, Edit2, Search, Plus, X, Heart, Share2, ExternalLink, Calendar } from "lucide-react"; // Добавил недостающие иконки, если они используются
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
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

const UserPostedItemsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [deals, setDeals] = useState<Deal[]>([]);
  const [promos, setPromos] = useState<any[]>([]);
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
  const [loading, setLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [isReactNativeView, setIsReactNativeView] = useState(false); // Этот флаг уже был

  // ИЗМЕНЕННЫЙ useEffect для отправки заголовка и определения режима RN
  useEffect(() => {
    const pageTitle = "My Posted Items"; // Заголовок для этой страницы (соответствует h1)
    console.log(`[${pageTitle} Web Page] INFO: useEffect для отправки заголовка и определения RN режима запущен.`);

    // Проверяем, есть ли ReactNativeWebView и postMessage
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      setIsReactNativeView(true); // Устанавливаем, что мы в RN

      // Отправляем заголовок с небольшой задержкой
      const timerId = setTimeout(() => {
        console.log(`[${pageTitle} Web Page] INFO: Отправляю заголовок "${pageTitle}" после задержки.`);
        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: "SET_NATIVE_HEADER_TITLE",
            title: pageTitle,
          }),
        );
      }, 50); // Задержка 50мс

      return () => clearTimeout(timerId); // Очищаем таймер при размонтировании
    } else {
      setIsReactNativeView(false);
      console.warn(`[${pageTitle} Web Page] WARN: ReactNativeWebView.postMessage НЕ ДОСТУПЕН.`);
    }
  }, []); // Пустой массив зависимостей, чтобы выполнилось один раз при монтировании


  const loadAllCounts = useCallback(async () => {
    if (!user?.id) return;
    console.log("[UserPostedItemsPage] Loading all counts...");
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
      setLoading(false);
      setIsFetchingMore(false);
      return;
    }
    if (!hasMore && page > 1) {
      setIsFetchingMore(false);
      return;
    }

    console.log(
      `[UserPostedItemsPage] Loading items for tab: ${activeTab}, page: ${page}, sortBy: ${sortBy}`,
    );
    if (page === 1) setLoading(true);
    else setIsFetchingMore(true);

    try {
      let itemsToSet: any[] = [];
      const itemsPerPage = 20;
      let query;

      if (activeTab === "deals") {
        query = supabase
          .from("deals")
          .select(
            `*, profiles!deals_user_id_fkey(id, email, display_name), deal_comments(id)`,
          )
          .eq("user_id", user.id)
          .eq("type", "deal");
      } else if (activeTab === "sweepstakes") {
        query = supabase
          .from("deals")
          .select(
            `*, profiles!deals_user_id_fkey(id, email, display_name), deal_comments(id)`,
          )
          .eq("user_id", user.id)
          .eq("type", "sweepstakes");
      } else if (activeTab === "promos") {
        query = supabase
          .from("promo_codes")
          .select(
            `*, profiles!promo_codes_user_id_fkey(id, email, display_name), promo_comments(id)`, // Предполагаем, что внешний ключ promo_comments.promo_id на promo_codes.id
          )
          .eq("user_id", user.id);
      } else {
        setLoading(false);
        setIsFetchingMore(false);
        return;
      }

      switch (sortBy) {
        case "oldest":
          query = query.order("created_at", { ascending: true });
          break;
        case "popular":
          query = query
            .order("vote_count", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false });
          break;
        default: // newest
          query = query.order("created_at", { ascending: false });
          break;
      }

      const { data, error } = await query.range(
        (page - 1) * itemsPerPage,
        page * itemsPerPage - 1,
      );
      if (error) throw error;

      if (activeTab === "deals") {
        itemsToSet =
          data?.map((d: any) => ({ // Добавил : any для d
            id: d.id,
            title: d.title,
            currentPrice: parseFloat(d.current_price),
            originalPrice: d.original_price
              ? parseFloat(d.original_price)
              : undefined,
            store: { id: d.store_id, name: d.store_id }, // Заполните name, если есть
            category: { id: d.category_id, name: d.category_id }, // Заполните name, если есть
            image: d.image_url,
            postedAt: d.created_at, // Передаем строку, DealCard сам форматирует
            popularity: d.vote_count || 0,
            comments: d.deal_comments?.length || 0,
            postedBy: {
              id: d.profiles?.id || "anon",
              name:
                d.profiles?.display_name ||
                d.profiles?.email?.split("@")[0] ||
                "Anonymous",
              avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(d.profiles?.display_name || d.profiles?.email?.split("@")[0] || "A")}&background=random`,
            },
            description: d.description,
            url: d.deal_url,
            createdAt: d.created_at, // Добавил createdAt для DealCard
            expires_at: d.expires_at,
            type: "deal",
          })) || [];
        setDeals((prev) =>
          page === 1 ? itemsToSet : [...prev, ...itemsToSet],
        );
      } else if (activeTab === "sweepstakes") {
        itemsToSet =
          data?.map((d: any) => ({ // Добавил : any для d
            id: d.id,
            title: d.title,
            currentPrice: parseFloat(d.current_price),
            originalPrice: d.original_price
              ? parseFloat(d.original_price)
              : undefined,
            store: { id: d.store_id, name: d.store_id },
            category: { id: d.category_id, name: d.category_id },
            image: d.image_url,
            postedAt: d.created_at,
            popularity: d.vote_count || 0,
            comments: d.deal_comments?.length || 0,
            postedBy: {
              id: d.profiles?.id || "anon",
              name:
                d.profiles?.display_name ||
                d.profiles?.email?.split("@")[0] ||
                "Anonymous",
              avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(d.profiles?.display_name || d.profiles?.email?.split("@")[0] || "A")}&background=random`,
            },
            description: d.description,
            url: d.deal_url,
            createdAt: d.created_at,
            expires_at: d.expires_at,
            type: "sweepstakes",
          })) || [];
        setSweepstakes((prev) =>
          page === 1 ? itemsToSet : [...prev, ...itemsToSet],
        );
      } else if (activeTab === "promos") {
        // Для промокодов, загрузка голосов может потребоваться отдельно, если они в другой таблице
        // В этом примере предполагается, что vote_count есть в promo_codes или добавлен после
        const promosWithVotes = data ? await Promise.all(data.map(async (p: any) => {
            const { data: votesData, error: votesError } = await supabase
                .from('promo_votes')
                .select('vote_type')
                .eq('promo_id', p.id);

            let vote_count = 0;
            if (votesData && !votesError) {
                vote_count = votesData.reduce((acc, vote) => acc + (vote.vote_type ? 1 : -1), 0);
            }
            return { 
                ...p, 
                vote_count: vote_count,
                profiles: p.profiles || { id: "anon", display_name: "Anonymous", email: "" },
                promo_comments: p.promo_comments || [] // Убедимся, что это массив
            };
        })) : [];
        itemsToSet = promosWithVotes;
        setPromos((prev) =>
          page === 1 ? itemsToSet : [...prev, ...itemsToSet],
        );
      }

      setHasMore(itemsToSet.length === itemsPerPage);
    } catch (error) {
      console.error("Error loading user items:", error);
      setHasMore(false);
    } finally {
      setLoading(false);
      setIsFetchingMore(false);
    }
  }, [user, activeTab, sortBy, page, hasMore]); // Убрал transformAndSetComments из зависимостей, т.к. он сам useCallback

  useEffect(() => {
    if (user) loadAllCounts();
    else {
      setDealCount(0);
      setPromoCount(0);
      setSweepstakesCount(0);
      setDeals([]);
      setPromos([]);
      setSweepstakes([]);
      setPage(1);
      setHasMore(true);
      setLoading(true); // Устанавливаем true, чтобы показать лоадер при выходе и повторном входе
    }
  }, [user, loadAllCounts]);

  useEffect(() => {
    if (user) {
      console.log(
        `[Effect] Filters changed (user/sortBy/activeTab), current page: ${page}, new page will be 1 for tab: ${activeTab}`,
      );
      // Сбрасываем данные и страницу при смене фильтров
      setPage(1); 
      setHasMore(true); // Сбрасываем hasMore, чтобы загрузка началась заново
      if (activeTab === "deals") setDeals([]);
      else if (activeTab === "promos") setPromos([]);
      else if (activeTab === "sweepstakes") setSweepstakes([]);
      // loadUserItems будет вызван следующим useEffect, который следит за page
    }
  }, [user, sortBy, activeTab]); // page убран из зависимостей здесь, он управляет пагинацией

  useEffect(() => {
    if (user && hasMore) { // Добавил hasMore в условие
      loadUserItems();
    }
  }, [user, page, loadUserItems, hasMore]); // hasMore добавлено в зависимости

  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop >=
          document.documentElement.offsetHeight - 500 &&
        !isFetchingMore &&
        hasMore
      ) {
        setPage((prevPage) => prevPage + 1);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isFetchingMore, hasMore]);


  const formatTimeAgo_local = (dateString?: string) => { // Переименовал, чтобы не конфликтовать с глобальной (если есть)
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

  const handleDataRefreshNeeded = () => {
    loadAllCounts();
    setPage(1); // Сброс на первую страницу приведет к перезагрузке через useEffects
    setDeals([]); // Очищаем сразу для лучшего UX
    setPromos([]);
    setSweepstakes([]);
    setHasMore(true);
  };

  return (
    // Убрал pt-0
    <div className="min-h-screen bg-gray-900 pb-24"> 
      {/* ИЗМЕНЕНО: Добавлен класс web-page-header к блоку хедера */}
      {/* Существующая логика !isReactNativeView уже скрывает этот хедер в RN, 
          но класс web-page-header нужен для глобального CSS правила, если isReactNativeView не успеет обновиться */}
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

      {/* ИЗМЕНЕНО: Добавлен класс main-content-area. 
           Отступ сверху управляется условным классом Tailwind в зависимости от isReactNativeView.
           pt-16 (примерно 64px) используется, когда веб-хедер ВИДЕН (!isReactNativeView).
           pt-4 используется, когда веб-хедер СКРЫТ в RN (isReactNativeView).
           Глобальный CSS body.embedded-app .main-content-area { padding-top: 0 !important; } 
           переопределит pt-4 на pt-0, если это необходимо. */}
      <div
        className={`main-content-area relative mx-4 mb-3 ${!isReactNativeView ? "pt-6" : "pt-4"}`}
      >

        <div className="flex justify-center pb-2 mb-4">
          <div className="flex flex-nowrap items-center space-x-2 overflow-x-auto scrollbar-hide"> {/* Добавлен overflow-x-auto и scrollbar-hide */}
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

        {/* ... остальной JSX для отображения списков ... */}
        {loading &&
        page === 1 &&
        ((activeTab === "deals" && deals.length === 0) ||
          (activeTab === "promos" && promos.length === 0) ||
          (activeTab === "sweepstakes" && sweepstakes.length === 0)) ? (
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
                      deal={{
                        ...deal,
                        postedAt: { // Обеспечиваем нужный формат для DealCard
                            relative: formatTimeAgo_local(deal.createdAt || deal.postedAt as string), // Используем createdAt если есть, иначе postedAt
                            exact: new Date(deal.createdAt || deal.postedAt as string).toLocaleString(),
                        }
                      }}
                      onVoteChange={handleDataRefreshNeeded}
                    />
                  ))
                : !loading &&
                  !isFetchingMore && (
                    <div className="text-center text-gray-500 py-8">
                      No deals posted yet.
                    </div>
                  ))}

            {activeTab === "sweepstakes" &&
              (sweepstakes.length > 0
                ? sweepstakes.map((sweepstake) => (
                    <DealCard
                      key={`sweepstake-${sweepstake.id}`}
                      deal={{
                        ...sweepstake,
                        postedAt: { // Обеспечиваем нужный формат для DealCard
                            relative: formatTimeAgo_local(sweepstake.createdAt || sweepstake.postedAt as string),
                            exact: new Date(sweepstake.createdAt || sweepstake.postedAt as string).toLocaleString(),
                        },
                        store: {
                          ...sweepstake.store,
                          name: sweepstake.store?.name || "", 
                        },
                      }}
                      onVoteChange={handleDataRefreshNeeded}
                      hideFreeLabel={true}
                    />
                  ))
                : !loading &&
                  !isFetchingMore && (
                    <div className="text-center text-gray-500 py-8">
                      No sweepstakes posted yet.
                    </div>
                  ))}

            {activeTab === "promos" &&
              (promos.length > 0
                ? promos.map((promo) => (
                    <div
                      key={promo.id}
                      onClick={() =>
                        navigate(promo.id ? `/promos/${promo.id}` : "#")
                      }
                      className="bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-700 transition-colors cursor-pointer shadow-md"
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
                            type="promo_code" // Убедитесь, что VoteControls поддерживает этот тип
                            initialVoteCount={promo.vote_count}
                            onVoteChange={handleDataRefreshNeeded}
                          />
                        </div>
                        <h3 className="text-white font-semibold text-lg line-clamp-1 mb-1">
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
                            {promo.profiles && ( // Проверяем наличие profiles
                              <>
                                <img
                                  src={
                                    (promo.profiles as any).avatar || // Приводим к any для доступа к avatar, если структура неизвестна
                                    `https://ui-avatars.com/api/?name=${encodeURIComponent((promo.profiles as any).display_name || (promo.profiles as any).email?.split("@")[0] || "A")}&background=random`
                                  }
                                  alt={(promo.profiles as any).display_name || "User"}
                                  className="w-5 h-5 rounded-full mr-1.5"
                                />
                                <span>
                                  {(promo.profiles as any).display_name ||
                                    (promo.profiles as any).email?.split("@")[0] ||
                                    "Anonymous"}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center space-x-3">
                             {/* Кнопки действий для промо */}
                             {user && user.id === promo.user_id && (
                                <button
                                    onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    navigate(promo.id ? `/promos/${promo.id}/edit` : "#");
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
                                className="text-gray-400 hover:text-orange-500 p-0.5"
                                title="Visit Store"
                            >
                                <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>
                        </div>
                      </div>
                      {promo.discount_url && ( // Кнопка Use Code, если есть discount_url
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
                : !loading &&
                  !isFetchingMore && (
                    <div className="text-center text-gray-500 py-8">
                      No promos posted yet.
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
              (dealCount > 0 || promoCount > 0 || sweepstakesCount > 0) && ( // Используем общие счетчики
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
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, X, Search } from "lucide-react"; // Убедимся, что useEffect импортирован
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import DealCard from "../components/deals/DealCard";
import { Deal } from "../types";
import AdminActions from "../components/admin/AdminActions";
import VoteControls from "../components/deals/VoteControls";

interface UserPageComment {
  id: string;
  content: string;
  created_at: string;
  createdAt?: string;
  images?: string[];
  like_count?: number;
  reply_count?: number;
  parent_id?: string | null;
  user_id?: string;
  replies?: UserPageComment[];
  deals?: {
    id: string;
    title: string;
    current_price: string;
    original_price?: string;
    store_id: string;
    category_id: string;
    image_url: string;
    deal_url: string;
    description?: string;
    created_at: string;
    type?: "deal" | "sweepstakes";
    profiles?: { id?: string; email?: string; display_name?: string };
  };
  promo_codes?: {
    id: string;
    title: string;
    code: string;
    discount_url?: string;
    created_at: string;
    profiles?: { id?: string; email?: string; display_name?: string };
  };
}

const formatCount = (count: number): string => {
  if (typeof count !== "number" || isNaN(count)) return "0";
  if (count >= 1000000)
    return (count / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (count >= 1000) return (count / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return count.toString();
};

const buildCommentTree = (
  flatComments: UserPageComment[],
): UserPageComment[] => {
  const commentMap = new Map<string, UserPageComment>();
  const rootComments: UserPageComment[] = [];
  flatComments.forEach((comment) => {
    commentMap.set(comment.id, {
      ...comment,
      replies: [],
      createdAt: new Date(comment.created_at).toLocaleString(),
    });
  });
  flatComments.forEach((comment) => {
    const commentNode = commentMap.get(comment.id);
    if (commentNode) {
      if (comment.parent_id && commentMap.has(comment.parent_id)) {
        const parentNode = commentMap.get(comment.parent_id);
        parentNode?.replies?.push(commentNode);
      } else {
        rootComments.push(commentNode);
      }
    }
  });
  return rootComments;
};

const sortCommentTree = (
  comments: UserPageComment[],
  sortBy: SortOption,
): UserPageComment[] => {
  const sorted = [...comments].sort((a, b) => {
    switch (sortBy) {
      case "oldest":
        return (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      case "popular":
        return (b.like_count || 0) - (a.like_count || 0);
      default: // newest
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }
  });
  return sorted.map((comment) => ({
    ...comment,
    replies:
      comment.replies && comment.replies.length > 0
        ? sortCommentTree(comment.replies, sortBy)
        : [],
  }));
};

type SortOption = "newest" | "oldest" | "popular";

const UserCommentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [isReactNativeView, setIsReactNativeView] = useState(false);

  const [dealsWithUserComments, setDealsWithUserComments] = useState<Deal[]>(
    [],
  );
  const [sweepstakesWithUserComments, setSweepstakesWithUserComments] =
    useState<Deal[]>([]);
  const [promosWithUserComments, setPromosWithUserComments] = useState<any[]>(
    [],
  );

  const [dealCommentItemsCount, setDealCommentItemsCount] = useState(0);
  const [promoCommentItemsCount, setPromoCommentItemsCount] = useState(0);
  const [sweepstakesCommentItemsCount, setSweepstakesCommentItemsCount] =
    useState(0);

  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<
    "deals" | "promos" | "sweepstakes"
  >("deals");

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const filteredDeals = dealsWithUserComments.filter(
    (deal) =>
      (deal.userComment?.content?.toLowerCase() || "").includes(
        searchTerm.toLowerCase(),
      ) || (deal.title?.toLowerCase() || "").includes(searchTerm.toLowerCase()),
  );
  const filteredSweepstakes = sweepstakesWithUserComments.filter(
    (sweep) =>
      (sweep.userComment?.content?.toLowerCase() || "").includes(
        searchTerm.toLowerCase(),
      ) ||
      (sweep.title?.toLowerCase() || "").includes(searchTerm.toLowerCase()),
  );
  const filteredPromos = promosWithUserComments.filter(
    (promo) =>
      (promo.userComment?.content?.toLowerCase() || "").includes(
        searchTerm.toLowerCase(),
      ) ||
      (promo.title?.toLowerCase() || "").includes(searchTerm.toLowerCase()),
  );

  const loadAllCommentItemCounts = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data: dealUserComments, error: dealError } = await supabase
        .from("deal_comments")
        .select("deals!inner(id, type)")
        .eq("user_id", user.id);
      if (dealError) throw dealError;

      const distinctDealIds = new Set(
        dealUserComments
          ?.filter((c) => c.deals?.type === "deal" || !c.deals?.type)
          .map((c) => c.deals!.id),
      );
      setDealCommentItemsCount(distinctDealIds.size);

      const distinctSweepstakeIds = new Set(
        dealUserComments
          ?.filter((c) => c.deals?.type === "sweepstakes")
          .map((c) => c.deals!.id),
      );
      setSweepstakesCommentItemsCount(distinctSweepstakeIds.size);

      const { data: promoUserComments, error: promoError } = await supabase
        .from("promo_comments")
        .select("promo_codes!inner(id)")
        .eq("user_id", user.id);
      if (promoError) throw promoError;

      const distinctPromoIds = new Set(
        promoUserComments?.map((c) => c.promo_codes!.id),
      );
      setPromoCommentItemsCount(distinctPromoIds.size);
    } catch (error) {
      console.error("Error loading all comment item counts:", error);
    }
  }, [user]);

  const transformAndSetComments = useCallback(
    (
      rawComments: UserPageComment[],
      tab: "deals" | "promos" | "sweepstakes",
      currentPage: number,
    ) => {
      const commentTree = buildCommentTree(rawComments);
      const sortedCommentTree = sortCommentTree(commentTree, sortBy);

      if (tab === "deals" || tab === "sweepstakes") {
        const itemsMap = new Map<string, Deal>();
        sortedCommentTree.forEach((comment) => {
          if (comment.deals && !itemsMap.has(comment.deals.id)) {
            const dealItem: Deal & { userComment?: UserPageComment } = {
              id: comment.deals.id,
              title: comment.deals.title,
              currentPrice: parseFloat(comment.deals.current_price),
              originalPrice: comment.deals.original_price
                ? parseFloat(comment.deals.original_price)
                : undefined,
              store: {
                id: comment.deals.store_id,
                name: comment.deals.store_id, // Предполагаем, что имя совпадает с ID или будет получено позже
              },
            
              
              category: {
                id: comment.deals.category_id,
                name: comment.deals.category_id, // Аналогично
              },
              image: comment.deals.image_url,
              postedAt: comment.deals.created_at
                ? new Date(comment.deals.created_at).toLocaleDateString() // Упрощено для примера
                : "Date unavailable",
              popularity: comment.like_count || 0,
              comments: comment.reply_count || 0,
              postedBy: {
                id: comment.deals.profiles?.id || "anonymous",
                name:
                  comment.deals.profiles?.display_name ||
                  comment.deals.profiles?.email?.split("@")[0] ||
                  "Anonymous",
                avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.deals.profiles?.display_name || comment.deals.profiles?.email || "A")}&background=random`,
              },
              description: comment.deals.description,
              url: comment.deals.deal_url,
              type: comment.deals.type || "deal",
              userComment: comment,
            };
            itemsMap.set(comment.deals.id, dealItem);
          }
        });
        const allItems = Array.from(itemsMap.values());
        if (tab === "deals") {
          setDealsWithUserComments((prev) =>
            currentPage === 1
              ? allItems.filter((item) => item.type === "deal" || !item.type)
              : [
                  ...prev,
                  ...allItems.filter(
                    (item) => item.type === "deal" || !item.type,
                  ),
                ],
          );
        } else {
          // sweepstakes
          setSweepstakesWithUserComments((prev) =>
            currentPage === 1
              ? allItems.filter((item) => item.type === "sweepstakes")
              : [
                  ...prev,
                  ...allItems.filter((item) => item.type === "sweepstakes"),
                ],
          );
        }
      } else if (tab === "promos") {
        const itemsMap = new Map<string, any>();
        sortedCommentTree.forEach((comment) => {
          if (comment.promo_codes && !itemsMap.has(comment.promo_codes.id)) {
            itemsMap.set(comment.promo_codes.id, {
              ...comment.promo_codes,
              userComment: comment,
            });
          }
        });
        const allPromoItems = Array.from(itemsMap.values());
        setPromosWithUserComments((prev) =>
          currentPage === 1 ? allPromoItems : [...prev, ...allPromoItems],
        );
      }
    },
    [sortBy],
  );

  const loadUserComments = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      setIsFetchingMore(false);
      return;
    }
    if (!hasMore && page > 1) {
      setIsFetchingMore(false);
      return;
    }

    if (page === 1) setLoading(true);
    else setIsFetchingMore(true);

    try {
      const itemsPerPage = 20;
      let query;
      if (activeTab === "deals" || activeTab === "sweepstakes") {
        query = supabase
          .from("deal_comments")
          .select(
            `*, deals!inner(*, profiles!deals_user_id_fkey(id, email, display_name))`,
          )
          .eq("user_id", user.id);
      } else if (activeTab === "promos") {
        query = supabase
          .from("promo_comments")
          .select(
            `*, promo_codes!inner(*, profiles!promo_codes_user_id_fkey(id, email, display_name))`,
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
            .order("like_count", { ascending: false, nullsFirst: false })
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

      const fetchedComments = (data as UserPageComment[]) || [];
      transformAndSetComments(fetchedComments, activeTab, page);
      setHasMore(fetchedComments.length === itemsPerPage);
    } catch (error) {
      console.error("Error loading user comments:", error);
      setHasMore(false);
    } finally {
      setLoading(false);
      setIsFetchingMore(false);
    }
  }, [user, activeTab, sortBy, page, hasMore, transformAndSetComments]);

  useEffect(() => {
    if (user?.id) {
      loadAllCommentItemCounts();
    } else {
      setDealCommentItemsCount(0);
      setPromoCommentItemsCount(0);
      setSweepstakesCommentItemsCount(0);
      setDealsWithUserComments([]);
      setPromosWithUserComments([]);
      setSweepstakesWithUserComments([]);
      setPage(1);
      setHasMore(true);
      setLoading(false);
    }
  }, [user, loadAllCommentItemCounts]);

  useEffect(() => {
    if (user?.id) {
      setPage(1);
      setHasMore(true);
      if (activeTab === "deals") setDealsWithUserComments([]);
      else if (activeTab === "promos") setPromosWithUserComments([]);
      else if (activeTab === "sweepstakes") setSweepstakesWithUserComments([]);
      // loadUserComments будет вызван другим useEffect, который следит за page
    }
  }, [user, sortBy, activeTab]);

  useEffect(() => {
    if (user?.id) {
      loadUserComments();
    }
  }, [user, page, loadUserComments]); // loadUserComments добавлена в зависимости, т.к. она useCallback

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

  // ИЗМЕНЕННЫЙ useEffect для отправки заголовка и определения режима RN
  useEffect(() => {
    const pageTitle = "My Comments";
    console.log(
      `[${pageTitle} Web Page] INFO: useEffect для отправки заголовка и определения RN режима запущен.`,
    );

    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      setIsReactNativeView(true); // Устанавливаем, что мы в RN, если можем отправить сообщение

      // Отправляем заголовок с небольшой задержкой
      const timerId = setTimeout(() => {
        console.log(
          `[${pageTitle} Web Page] INFO: Отправляю заголовок "${pageTitle}" после задержки.`,
        );
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
      console.warn(
        `[${pageTitle} Web Page] WARN: ReactNativeWebView.postMessage НЕ ДОСТУПЕН.`,
      );
    }
  }, []);

  const handleCommentAction = () => {
    loadAllCommentItemCounts();
    setPage(1); // Сбрасываем на первую страницу для перезагрузки комментариев с учетом возможных изменений
    // setDealsWithUserComments([]); // Очищаем текущие данные, чтобы избежать дублирования при перезагрузке
    // setPromosWithUserComments([]);
    // setSweepstakesWithUserComments([]);
    // loadUserComments(); // Можно вызвать сразу, если setPage(1) не вызывает нужный useEffect
  };

  const renderCommentWithReplies = (
    comment: UserPageComment,
    itemType: "deal_comments" | "promo_comments",
  ) => {
    if (!comment) return null;
    return (
      <div className="space-y-2">
        <div className="bg-gray-800 rounded-md p-3 ml-4 border-l-2 border-orange-500">
          <div className="flex justify-between items-start">
            <div className="text-gray-400 text-xs mb-1 flex items-center">
              <svg
                className="w-3 h-3 mr-1 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 6v6l4 2"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>
                {comment.createdAt ||
                  (comment.created_at
                    ? new Date(comment.created_at).toLocaleString()
                    : "Date unavailable")}
              </span>
            </div>
            {comment.id &&
              comment.user_id &&
              user &&
              comment.user_id === user.id && (
                <AdminActions
                  type={itemType}
                  id={comment.id}
                  userId={comment.user_id}
                  onAction={handleCommentAction}
                />
              )}
          </div>
          <div className="text-white text-sm whitespace-pre-wrap">
            {comment.content}
          </div>
          {comment.images && comment.images.length > 0 && (
            <div className="flex gap-2 mt-2">
              {comment.images.map((image, index) => (
                <div key={index} className="relative">
                  <img
                    src={image}
                    alt={`Comment image ${index + 1}`}
                    className="w-16 h-16 object-cover rounded cursor-pointer"
                    onClick={() => {
                      const modal = document.createElement("div");
                      modal.className =
                        "fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4";
                      modal.onclick = () => document.body.removeChild(modal);
                      const content = document.createElement("div");
                      content.className =
                        "relative max-w-4xl max-h-[90vh] bg-gray-900 p-2 rounded-lg shadow-xl";
                      content.onclick = (e) => e.stopPropagation();
                      const closeBtn = document.createElement("button");
                      closeBtn.className =
                        "absolute top-2 right-2 text-white text-2xl font-bold bg-black bg-opacity-50 rounded-full w-8 h-8 flex items-center justify-center leading-none";
                      closeBtn.textContent = "×";
                      closeBtn.onclick = () => document.body.removeChild(modal);
                      const img = document.createElement("img");
                      img.src = image;
                      img.className =
                        "max-w-full max-h-[calc(90vh-40px)] object-contain rounded";
                      content.appendChild(img);
                      content.appendChild(closeBtn);
                      modal.appendChild(content);
                      document.body.appendChild(modal);
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {comment.replies && comment.replies.length > 0 && (
          <div className="ml-8 space-y-2">
            {comment.replies.map((reply) => (
              <div
                key={reply.id}
                className="bg-gray-700 rounded-md p-3 border-l-2 border-orange-400"
              >
                <div className="flex justify-between items-start">
                  <div className="text-gray-400 text-xs mb-1 flex items-center">
                    <svg /* ... reply icon ... */>
                      <circle /* ... */ /> <path /* ... */ />
                    </svg>
                    <span>
                      {reply.createdAt ||
                        (reply.created_at
                          ? new Date(reply.created_at).toLocaleString()
                          : "Date unavailable")}
                    </span>
                  </div>
                  {reply.id &&
                    reply.user_id &&
                    user &&
                    reply.user_id === user.id && (
                      <AdminActions
                        type={itemType} // Should be same itemType as parent
                        id={reply.id}
                        userId={reply.user_id}
                        onAction={handleCommentAction}
                      />
                    )}
                </div>
                <div className="text-white text-sm whitespace-pre-wrap">
                  {reply.content}
                </div>
                {reply.images && reply.images.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {reply.images.map((image, index) => (
                      <div key={index} className="relative">
                        <img /* ... reply image ... */ />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    // Убрал pt-0, если он был
    <div className="min-h-screen bg-gray-900 pb-24">
      {/* ИЗМЕНЕНО: Добавляем класс web-page-header к блоку хедера */}
      {/* Также, существующая логика !isReactNativeView уже скрывает этот хедер в RN */}
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
                <h1 className="text-white font-medium ml-3">My Comments</h1>
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

      {/* ИЗМЕНЕНО: Добавляем класс main-content-area. 
           Логика отступа здесь УЖЕ УЧИТЫВАЕТ isReactNativeView.
           `pt-[60px]` (например, pt-14 или pt-16 в Tailwind) должно быть значением, если !isReactNativeView.
           Я изменю pt-[6px] на pt-16 для консистентности, когда веб-хедер виден.
           Если isReactNativeView, то pt-4 (или pt-0, если хотите, чтобы RN-хедер управлял отступом). */}
      <div
        className={`main-content-area relative mx-4 mb-3 ${!isReactNativeView ? "pt-6" : "pt-4"}`}
      >
        <div className="flex items-center bg-gray-700 rounded-lg px-3 py-2 mb-4 shadow">
          <Search className="h-5 w-5 text-gray-400 mr-2 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search comments or item titles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent text-gray-200 placeholder-gray-400 outline-none flex-1 w-full"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="text-gray-400 hover:text-white ml-2 p-1"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="flex justify-center pb-2 mb-4">
          <div className="flex flex-wrap justify-center gap-2">
            <button
              className={`min-w-0 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis ${activeTab === "deals" ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"}`}
              onClick={() => setActiveTab("deals")}
              title={`Deals (${dealCommentItemsCount})`}
            >
              Deals ({formatCount(dealCommentItemsCount)})
            </button>
            <button
              className={`min-w-0 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis ${activeTab === "promos" ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"}`}
              onClick={() => setActiveTab("promos")}
              title={`Promos (${promoCommentItemsCount})`}
            >
              Promos ({formatCount(promoCommentItemsCount)})
            </button>
            <button
              className={`min-w-0 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis ${activeTab === "sweepstakes" ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"}`}
              onClick={() => setActiveTab("sweepstakes")}
              title={`Sweepstakes (${sweepstakesCommentItemsCount})`}
            >
              Sweepstakes ({formatCount(sweepstakesCommentItemsCount)})
            </button>
          </div>
        </div>

        {loading &&
        page === 1 &&
        ((activeTab === "deals" && dealsWithUserComments.length === 0) ||
          (activeTab === "promos" && promosWithUserComments.length === 0) ||
          (activeTab === "sweepstakes" &&
            sweepstakesWithUserComments.length === 0)) ? (
          <div className="flex justify-center items-center py-12">
            <div className="h-10 w-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : !user?.id ? (
          <div className="text-center text-gray-400 py-12">
            {" "}
            Please sign in to view your comments.{" "}
          </div>
        ) : (
          <div className="space-y-6">
            {activeTab === "deals" &&
              (filteredDeals.length > 0
                ? filteredDeals.map((deal) => (
                    <div key={`deal-item-${deal.id}`} className="space-y-2">
                      <DealCard
                        deal={deal}
                        onVoteChange={handleCommentAction}
                      />
                      {deal.userComment &&
                        renderCommentWithReplies(
                          deal.userComment as UserPageComment,
                          "deal_comments",
                        )}
                    </div>
                  ))
                : !loading &&
                  !isFetchingMore && (
                    <div className="text-center text-gray-500 py-8">
                      No comments on deals yet.
                    </div>
                  ))}

            {activeTab === "sweepstakes" &&
              (filteredSweepstakes.length > 0
                ? filteredSweepstakes.map((sweep) => (
                    <div key={`sweep-item-${sweep.id}`} className="space-y-2">
                      <DealCard
                        deal={sweep}
                        onVoteChange={handleCommentAction}
                        hideFreeLabel={true}
                      />
                      {sweep.userComment &&
                        renderCommentWithReplies(
                          sweep.userComment as UserPageComment,
                          "deal_comments", // Assuming sweepstakes comments are also in 'deal_comments' table for AdminActions
                        )}
                    </div>
                  ))
                : !loading &&
                  !isFetchingMore && (
                    <div className="text-center text-gray-500 py-8">
                      No comments on sweepstakes yet.
                    </div>
                  ))}

            {activeTab === "promos" &&
              (filteredPromos.length > 0
                ? filteredPromos.map((promo) => (
                    <div key={`promo-item-${promo.id}`} className="space-y-2">
                      <div className="bg-gray-800 rounded-lg overflow-hidden">
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-white font-medium">
                              {promo.title}
                            </h3>
                            <VoteControls
                              dealId={promo.id} // Assuming promo ID is used like dealId
                              type="promo"
                              onVoteChange={handleCommentAction}
                            />
                          </div>
                          <div className="mt-2 flex items-center space-x-2">
                            <div className="bg-gray-700 px-3 py-1 rounded border border-gray-600">
                              <span className="text-orange-500 font-mono">
                                {promo.code}
                              </span>
                            </div>
                          </div>
                          <div className="mt-3">
                            <a
                              href={promo.discount_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block bg-orange-500 text-center text-white py-2 rounded-md text-sm hover:bg-orange-600"
                            >
                              Use Code
                            </a>
                          </div>
                        </div>
                      </div>
                      {promo.userComment &&
                        renderCommentWithReplies(
                          promo.userComment as UserPageComment,
                          "promo_comments",
                        )}
                    </div>
                  ))
                : !loading &&
                  !isFetchingMore && (
                    <div className="text-center text-gray-500 py-8">
                      No comments on promos yet.
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
              (dealsWithUserComments.length > 0 ||
                promosWithUserComments.length > 0 ||
                sweepstakesWithUserComments.length > 0) && (
                <div className="text-center text-gray-600 py-8 text-sm">
                  You've reached the end of your comments.
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserCommentsPage;

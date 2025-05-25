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

// Убрал UserPageComment, так как он не используется в этом файле напрямую
// Если он нужен для DealCard или других компонентов, убедитесь, что он там определен или импортирован

const SavedItemsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savedDeals, setSavedDeals] = useState<Deal[]>([]);
  const [savedPromos, setSavedPromos] = useState<any[]>([]);
  const [savedSweepstakes, setSavedSweepstakes] = useState<Deal[]>([]);
  const [activeTab, setActiveTab] = useState<
    "deals" | "promos" | "sweepstakes"
  >("deals");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // НОВОЕ: useEffect для отправки заголовка в React Native приложение
  useEffect(() => {
    const pageTitle = "Saved Items"; // Заголовок для этой страницы

    console.log(`[${pageTitle} Web Page] INFO: useEffect для отправки заголовка запущен (с небольшой задержкой).`);

    const timerId = setTimeout(() => {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        console.log(`[${pageTitle} Web Page] INFO: Отправляю заголовок "${pageTitle}" после задержки.`);
        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: "SET_NATIVE_HEADER_TITLE",
            title: pageTitle,
          })
        );
      } else {
        console.warn(`[${pageTitle} Web Page] WARN: ReactNativeWebView.postMessage НЕ ДОСТУПЕН (после задержки).`);
      }
    }, 50); // Небольшая задержка в 50 миллисекунд

    return () => clearTimeout(timerId); // Очистка таймера при размонтировании компонента
  }, []); // Пустой массив зависимостей, чтобы выполнился один раз при монтировании

  const formatTimeAgo = (dateString: string) => {
    const minutes = Math.floor(
      (Date.now() - new Date(dateString).getTime()) / 60000,
    );
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  // useEffect для загрузки сохраненных элементов остался без изменений
  useEffect(() => {
    if (user) {
      loadSavedItems();
    } else {
      setLoading(false); // Если пользователя нет, ничего не грузим
      setSavedDeals([]);   // и очищаем списки
      setSavedPromos([]);
      setSavedSweepstakes([]);
    }
  //sortBy и activeTab были в зависимостях, они инициируют перезагрузку с сортировкой/фильтрацией
  }, [user, sortBy, activeTab]); 


  const getStoreName = (url: string) => {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace("www.", "").split(".")[0];
    } catch {
      return url;
    }
  };

  const loadSavedItems = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data: dealFavorites, error: dealError } = await supabase
        .from("deal_favorites")
        .select("deal_id")
        .eq("user_id", user.id);

      if (dealError) throw dealError;

      if (dealFavorites && dealFavorites.length > 0) {
        const dealIds = dealFavorites.map((fav) => fav.deal_id);

        let dealsQuery = supabase
          .from("deals")
          .select(
            `
            *,
            profiles!deals_user_id_fkey (
              id,
              email,
              display_name
            ),
            deal_comments (
              id
            )
            `,
          )
          .in("id", dealIds)
          .eq("type", "deal")
          .or("status.eq.published,status.eq.approved");

        let sweepstakesQuery = supabase
          .from("deals")
          .select(
            `
            *,
            profiles!deals_user_id_fkey (
              id,
              email,
              display_name
            ),
            deal_comments (
              id
            )
            `,
          )
          .in("id", dealIds)
          .eq("type", "sweepstakes")
          .or("status.eq.published,status.eq.approved");

        // Применение сортировки (пример для dealsQuery, аналогично для sweepstakesQuery если нужно)
        switch (sortBy) {
          case "oldest":
            dealsQuery = dealsQuery.order("created_at", { ascending: true });
            sweepstakesQuery = sweepstakesQuery.order("created_at", { ascending: true });
            break;
          case "popular":
            dealsQuery = dealsQuery
              .order("vote_count", { ascending: false, nullsFirst: false }) // nullsFirst: false чтобы nulls были в конце
              .order("created_at", { ascending: false });
            sweepstakesQuery = sweepstakesQuery
              .order("vote_count", { ascending: false, nullsFirst: false })
              .order("created_at", { ascending: false });
            break;
          case "newest":
          default:
            dealsQuery = dealsQuery.order("created_at", { ascending: false });
            sweepstakesQuery = sweepstakesQuery.order("created_at", { ascending: false });
            break;
        }

        const { data: dealsData, error: dealsFetchError } = await dealsQuery;
        if (dealsFetchError) throw dealsFetchError;

        if (dealsData) {
          const deals = dealsData.map((deal: any) => ({ // Явно типизируем deal здесь, если нужно
            id: deal.id,
            title: deal.title,
            currentPrice: parseFloat(deal.current_price),
            originalPrice: deal.original_price
              ? parseFloat(deal.original_price)
              : undefined,
            store: { id: deal.store_id, name: deal.store_id },
            category: {
              id: deal.category_id,
              name: deal.category_id,
            },
            image: deal.image_url,
            postedAt: { // Изменил на объект для консистентности с DealCard
              relative: formatTimeAgo(deal.created_at),
              exact: new Date(deal.created_at).toLocaleString(),
            },
            popularity: deal.vote_count || 0,
            comments: deal.deal_comments?.length || 0,
            postedBy: {
              id: deal.profiles.id,
              name:
                deal.profiles.display_name ||
                deal.profiles.email.split("@")[0],
              avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(deal.profiles.display_name || deal.profiles.email)}&background=random`,
            },
            description: deal.description,
            url: deal.deal_url,
            type: "deal" // Явно указываем тип
          }));
          setSavedDeals(deals);
        }

        const { data: sweepstakesData, error: sweepstakesFetchError } = await sweepstakesQuery;
        if (sweepstakesFetchError) throw sweepstakesFetchError;

        if (sweepstakesData) {
          const sweepstakes = sweepstakesData.map((deal: any) => ({
            id: deal.id,
            title: deal.title,
            currentPrice: parseFloat(deal.current_price), // Для sweepstakes это может быть нерелевантно
            originalPrice: deal.original_price
              ? parseFloat(deal.original_price)
              : undefined,
            store: { id: deal.store_id, name: deal.store_id },
            category: {
              id: deal.category_id,
              name: deal.category_id,
            },
            image: deal.image_url,
            postedAt: {
              relative: formatTimeAgo(deal.created_at),
              exact: new Date(deal.created_at).toLocaleString(),
            },
            popularity: deal.vote_count || 0,
            comments: deal.deal_comments?.length || 0,
            postedBy: {
              id: deal.profiles.id,
              name:
                deal.profiles.display_name ||
                deal.profiles.email.split("@")[0],
              avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(deal.profiles.display_name || deal.profiles.email)}&background=random`,
            },
            description: deal.description,
            url: deal.deal_url,
            type: "sweepstakes" // Явно указываем тип
          }));
          setSavedSweepstakes(sweepstakes);
        }

      } else {
        setSavedDeals([]);
        setSavedSweepstakes([]);
      }

      const { data: promoFavorites, error: promoError } = await supabase
        .from("promo_favorites")
        .select("promo_id")
        .eq("user_id", user.id);

      if (promoError) throw promoError;

      if (promoFavorites) {
        const promoIds = promoFavorites.map((fav) => fav.promo_id);
        let promos: any[] = []; // Используем any[], так как структура промо отличается

        if (promoIds.length > 0) {
          let promoDetailsQuery = supabase
            .from("promo_codes")
            .select(
              `
              *,
              profiles:user_id (
                id,
                email,
                display_name
              ),
              promo_comments:promo_comments_promo_id_fkey (
                id
              )
            `,
            )
            .in("id", promoIds);

          // Применение сортировки (пример для promoDetailsQuery)
          switch (sortBy) {
            case "oldest":
              promoDetailsQuery = promoDetailsQuery.order("created_at", { ascending: true });
              break;
            // Для промокодов "популярность" может быть по vote_count, если он есть
            case "popular": 
              promoDetailsQuery = promoDetailsQuery
                .order("vote_count", { ascending: false, nullsFirst: false }) // Предполагаем, что vote_count есть
                .order("created_at", { ascending: false });
              break;
            case "newest":
            default:
              promoDetailsQuery = promoDetailsQuery.order("created_at", { ascending: false });
              break;
          }

          const { data: promosData, error: promosFetchError } = await promoDetailsQuery;

          if (promosFetchError) {
            console.error("Ошибка при загрузке промокодов:", promosFetchError);
          } else if (promosData) {
             // Загрузка голосов для промокодов, если это необходимо
             if (promosData && promosData.length > 0) {
                const promoIdsForVotes = promosData.map(p => p.id);
                const { data: votesData, error: votesError } = await supabase
                    .from('promo_votes')
                    .select('promo_id, vote_type')
                    .in('promo_id', promoIdsForVotes);

                if (votesError) {
                    console.error("Error fetching promo votes:", votesError);
                } else if (votesData) {
                    const votesByPromo: { [key: string]: number } = {};
                    votesData.forEach(vote => {
                        if (!votesByPromo[vote.promo_id]) {
                            votesByPromo[vote.promo_id] = 0;
                        }
                        votesByPromo[vote.promo_id] += vote.vote_type ? 1 : -1;
                    });
                    promosData.forEach(promo => {
                        promo.vote_count = votesByPromo[promo.id] || 0;
                    });
                }
            }
            promos = promosData;
          }
        }
        setSavedPromos(promos || []);
      }
    } catch (error) {
      console.error("Error loading saved items:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    // Убрал pt-0
    <div className="pb-24 bg-gray-900 min-h-screen"> 
      {/* ИЗМЕНЕНО: Добавлен класс web-page-header */}
      <div className="web-page-header fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 px-4 py-3 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => navigate(-1)}
              className="text-white p-1 hover:bg-gray-700 rounded-full" // Добавил немного padding и hover
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-white font-medium ml-3"> {/* Уменьшил ml */}
              Saved Items
            </h1>
          </div>
          <div className="flex items-center space-x-2">
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as SortOption)
              }
              className="bg-gray-800 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-orange-500 appearance-none" // Убрал flex-shrink-0, px-4, py-2; добавил px-3, py-2, ring-1
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="popular">Popular</option>
            </select>
          </div>
        </div>
      </div>

      {/* ИЗМЕНЕНО: Добавлен класс main-content-area и отступ pt-16 (примерно высота хедера) */}
      <div className="main-content-area px-4 pt-6"> 
        <div className="flex space-x-2 mb-4 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          <button
            className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium ${activeTab === "deals" ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"}`}
            onClick={() => setActiveTab("deals")}
          >
            Deals ({savedDeals.length})
          </button>
          <button
            className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium ${activeTab === "promos" ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"}`}
            onClick={() => setActiveTab("promos")}
          >
            Promos ({savedPromos.length})
          </button>
           <button
            className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium ${activeTab === "sweepstakes" ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"}`}
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
            Please sign in to view your saved items
          </div>
        ) : (
          <div className="space-y-6">
            {activeTab === "deals" && (
              savedDeals.length > 0 ? (
                <div className="space-y-4">
                  {savedDeals.map((deal) => (
                    <DealCard
                      key={`deal-${deal.id}`}
                      deal={deal}
                      onVoteChange={loadSavedItems} // Чтобы обновлять данные после голоса
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
                      deal={{ ...sweepstake, store: { ...sweepstake.store, name: "" } }} // Тип для DealCard
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
                    <div
                      key={promo.id}
                      onClick={() => navigate(`/promos/${promo.id}`)}
                      className="bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-700 transition-colors cursor-pointer shadow-md"
                    >
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-gray-400 text-xs">
                            {formatTimeAgo(promo.created_at)}
                          </div>
                          <div className="flex items-center space-x-2">
                            <VoteControls
                              dealId={promo.id} // Используем ID промо как dealId для VoteControls
                              type="promo"
                              initialVoteCount={promo.vote_count} // Передаем начальное количество голосов
                              onVoteChange={loadSavedItems} // Обновляем список при голосовании
                            />
                          </div>
                        </div>

                        <div className="mb-2">
                           <div className="flex items-center gap-2">
                            <h3 className="text-white font-medium text-sm">
                                {promo.title}
                            </h3>
                            {promo.expires_at && new Date(promo.expires_at) < new Date() && (
                                <div className="flex items-center bg-red-500/10 px-2 py-0.5 rounded text-red-500 text-xs font-medium">
                                    <Calendar className="w-3 h-3 mr-0.5" /> Expired
                                </div>
                            )}
                           </div>
                        </div>

                        {promo.description && (
                            <div className="mb-2">
                                <p className="text-gray-400 text-sm line-clamp-2">
                                {promo.description}
                                </p>
                            </div>
                        )}


                        <div className="flex items-center space-x-2 mb-3">
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
                                className={`text-sm px-3 py-1.5 rounded-md ${copiedCodeId === promo.id ? "bg-green-600 text-white" : "bg-orange-500 text-white hover:bg-orange-600"}`}
                            >
                                {copiedCodeId === promo.id ? "Copied!" : "Copy Code"}
                            </button>
                            {promo.expires_at && (
                                <div className="flex items-center text-gray-400 text-xs ml-auto" title="Expiration Date">
                                <Calendar className="h-3.5 w-3.5 mr-1" />
                                <span>
                                    Expires {new Date(promo.expires_at).toLocaleDateString()}
                                </span>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between text-xs mt-3 pt-3 border-t border-gray-700">
                            <div className="flex items-center">
                                <div className="w-5 h-5 rounded-full overflow-hidden bg-gray-700 mr-1.5">
                                <img
                                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(promo.profiles?.display_name || promo.profiles?.email || "A")}&background=random`}
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
                                    className="p-1 rounded-full text-gray-400 hover:text-red-500"
                                    onClick={(e) => { e.stopPropagation(); /* Логика открепления */ }}
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
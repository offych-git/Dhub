import React, { useEffect, useMemo, useState } from "react";
import {
    useLocation,
    useNavigate,
    useParams,
    useSearchParams,
} from "react-router-dom";
import { ArrowLeft, Edit2, ExternalLink, Heart, Share2 } from "lucide-react";
import { mockDeals } from "../data/mockData";
import { useAuth } from "../contexts/AuthContext";
import AdminActions from "../components/admin/AdminActions";
import { supabase } from "../lib/supabase";
import Comment from "../components/comments/Comment";
import CommentInput from "../components/comments/CommentInput";
import { getValidImageUrl, handleImageError } from "../utils/imageUtils";
import { highlightText } from "../utils/highlightText";
import VoteControls from "../components/deals/VoteControls.tsx";
import { triggerNativeHaptic } from "../utils/nativeBridge";
import ReactGA4 from 'react-ga4'; // <-- Добавлен импорт ReactGA4
import { LinkifiedHtml } from "../utils/linkUtils";
import { useLocalizedContent } from '../utils/localizationUtils';

const DealDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const highlightedCommentId = searchParams.get("comment");
    const searchQuery = searchParams.get("q") || "";
    const { user } = useAuth();
    const [comments, setComments] = useState<any[]>([]);
    const [commentCount, setCommentCount] = useState(0);
    const [userVote, setUserVote] = useState<boolean | null>(null);
    const [isFavorite, setIsFavorite] = useState(false);
    const [deal, setDeal] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<"newest" | "oldest" | "popular">(
        "newest",
    );
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const isExpired =
        deal?.expires_at && new Date(deal.expires_at) < new Date();
    const { getLocalizedDealContent } = useLocalizedContent();
    const localizedContent = deal ? getLocalizedDealContent(deal) : { title: '', description: '' };

    // Получение списка изображений для карусели
    const dealImages = useMemo(() => {
        if (!deal) return [];

        // Основное изображение всегда первое
        const images = [deal.image];

        // Проверяем, есть ли в описании JSON с дополнительными изображениями
        if (deal.description) {
            // Строка 54 (Правильно)
            const match = deal.description.match(/<!-- DEAL_IMAGES: (.*?) -->/);
            if (match && match[1]) {
                try {
                    // Пытаемся распарсить JSON с изображениями
                    const allImages = JSON.parse(match[1]);

                    // Если первое изображение в JSON совпадает с основным, не дублируем его
                    if (allImages[0] === deal.image) {
                        images.push(...allImages.slice(1));
                    } else {
                        // Если не совпадает (это может быть из-за старых данных), добавляем все кроме первого
                        images.push(...allImages.slice(1));
                    }
                } catch (e) {
                    console.error(
                        "Ошибка при разборе JSON с изображениями:",
                        e,
                    );
                }
            }
        }

        return images;
    }, [deal, id]);

    // Функции для навигации по карусели с циклическим переходом
    const goToPreviousImage = () => {
        setCurrentImageIndex((prev) =>
            prev === 0 ? dealImages.length - 1 : prev - 1,
        );
    };

    const goToNextImage = () => {
        setCurrentImageIndex((prev) =>
            prev === dealImages.length - 1 ? 0 : prev + 1,
        );
    };

    // Обработчики свайпов с улучшенной реактивностью
    const handleTouchStart = (e: React.TouchEvent) => {
        // Сохраняем начальную позицию касания
        setTouchStart(e.targetTouches[0].clientX);
        setTouchEnd(null); // Сбрасываем конечную позицию при новом касании
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        // Обновляем позицию при движении пальца
        setTouchEnd(e.targetTouches[0].clientX);

        // Предотвращаем скролл страницы при горизонтальном свайпе
        if (Math.abs((touchStart || 0) - e.targetTouches[0].clientX) > 10) {
            e.preventDefault();
        }
    };

    const handleTouchEnd = () => {
        if (touchStart === null) return;

        // Если touchEnd не был установлен (пользователь просто тапнул), выходим
        if (touchEnd === null) {
            setTouchStart(null);
            return;
        }

        const distance = touchStart - touchEnd;
        const minSwipeDistance = 50; // Минимальное расстояние свайпа для срабатывания

        if (distance > minSwipeDistance) {
            // Свайп влево - следующее изображение
            goToNextImage();
        } else if (distance < -minSwipeDistance) {
            // Свайп вправо - предыдущее изображение
            goToPreviousImage();
        }

        // Сбрасываем состояния касания
        setTouchStart(null);
        setTouchEnd(null);
    };

    useEffect(() => {
        // НЕ устанавливаем заголовок страницы в браузере - используем дефолтный из index.html
        // document.title = "Deal Details - WeDealz";
        
        // Прокручиваем страницу вверх при открытии деталей сделки
        window.scrollTo(0, 0);

        if (id) {
            loadDeal();
            loadComments();
            loadFavoriteStatus();
        }
    }, [id, sortBy]);

    // Прокрутка к комментарию если есть параметр comment в URL
    useEffect(() => {
        const commentId = searchParams.get("comment");
        if (commentId && deal) {
            console.log(
                "Ищем комментарий для прокрутки:",
                commentId,
                "в сделке:",
                deal.id,
            );

            // Сначала убедимся, что комментарии загружены
            const checkCommentsLoaded = () => {
                if (comments.length === 0) {
                    console.log(
                        "Комментарии еще не загружены, повторная попытка загрузки...",
                    );
                    loadComments();
                    return false;
                }
                return true;
            };

            // Функция для проверки, принадлежит ли комментарий текущей сделке
            const checkCommentBelongsToDeal = () => {
                // Рекурсивная функция для поиска комментария в дереве
                const findCommentInTree = (commentsList) => {
                    for (const comment of commentsList) {
                        if (comment.id === commentId) {
                            return true; // Комментарий найден
                        }
                        if (comment.replies && comment.replies.length > 0) {
                            if (findCommentInTree(comment.replies)) {
                                return true;
                            }
                        }
                    }
                    return false; // Комментарий не найден
                };

                const found = findCommentInTree(comments);
                if (!found) {
                    console.warn(
                        `Комментарий ${commentId} не принадлежит сделке ${deal.id}. Возможно неправильная ссылка.`,
                    );
                }
                return found;
            };

            // Функция для поиска и прокрутки
            const findAndScrollToComment = () => {
                if (!checkCommentsLoaded()) {
                    return false;
                }

                // Проверка принадлежности комментария текущей сделке
                if (!checkCommentBelongsToDeal()) {
                    console.log(
                        `Комментарий ${commentId} не найден в текущей сделке ${deal.id}`,
                    );
                    return false;
                }

                const commentElement = document.getElementById(
                    `comment-${commentId}`,
                );
                console.log(
                    "Найден элемент комментария:",
                    !!commentElement,
                    commentId,
                );

                if (commentElement) {
                    // Прокручиваем сразу к комментарию без промежуточных прокруток
                    commentElement.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                    });
                    commentElement.classList.add("highlight-comment");

                    // Добавляем более заметное выделение комментария с корректной анимацией без дерганий
                    commentElement.classList.add("bg-orange-500/20");
                    setTimeout(() => {
                        commentElement.classList.remove("bg-orange-500/20");
                        commentElement.classList.add("bg-orange-500/10");
                        setTimeout(() => {
                            commentElement.classList.remove(
                                "bg-orange-500/10",
                            );
                        }, 1000);
                    }, 1000);

                    // Для всех элементов с классом highlighted-comment также применим подсветку
                    if (commentId === highlightedCommentId) {
                        const allHighlighted = document.querySelectorAll(
                            ".highlighted-comment",
                        );
                        allHighlighted.forEach((element) => {
                            element.classList.add("bg-orange-500/20");
                            setTimeout(() => {
                                element.classList.remove("bg-orange-500/20");
                                element.classList.add("bg-orange-500/10");
                                setTimeout(() => {
                                    element.classList.remove(
                                        "bg-orange-500/10",
                                    );
                                }, 1000);
                            }, 1000);
                        });
                    }

                    // Снимаем дополнительное выделение после анимации
                    setTimeout(() => {
                        commentElement.classList.remove("highlight-comment");
                    }, 3000);

                    return true;
                }
                return false;
            };

            // Попробуем найти комментарий несколько раз с интервалом
            let attempts = 0;
            const maxAttempts = 15; // Увеличиваем количество попыток для более надежного поиска

            const attemptToFind = () => {
                if (findAndScrollToComment() || attempts >= maxAttempts) {
                    if (attempts >= maxAttempts) {
                        console.warn(
                            `Не удалось найти комментарий ${commentId} после ${maxAttempts} попыток`,
                        );
                    }
                    return;
                }

                attempts++;
                console.log(
                    `Попытка найти комментарий ${attempts}/${maxAttempts} для ID: ${commentId}`,
                );
                setTimeout(attemptToFind, 1000); // Увеличиваем интервал между попытками
            };

            // Начинаем поиск с задержкой, чтобы дать время на рендеринг и загрузку комментариев
            setTimeout(attemptToFind, 1500);
        }
    }, [searchParams, deal, comments, highlightedCommentId, id]); // Добавляем id сделки в зависимости

    // <-- НОВЫЙ useEffect для отслеживания события view_item -->
    useEffect(() => {
        if (deal && !loading) { // Убедитесь, что данные сделки загружены и страница не в состоянии загрузки
            ReactGA4.event({ //
                category: "Content View", // Категория события
                action: "View Item Detail", // Действие
                label: `Deal: ${deal.title}`, // Метка для более информативной метки
                item_id: deal.id, // Пользовательские параметры GA4
                item_name: deal.title,
                content_type: 'deal',
                price: deal.currentPrice, // Можно добавить цену для отслеживания
                original_price: deal.originalPrice, // Исходная цена
                store_name: deal.store?.name, // Название магазина
                category_name: deal.category?.name // Название категории
            });
            console.log(`GA4: View Item Detail event sent for Deal ID: ${deal.id}`);
        }
    }, [id, deal, loading]); // Зависимости: id (для новой страницы), deal (для полной загрузки данных) и loading (чтобы событие не отправлялось, пока данные не готовы)
    // <-- КОНЕЦ НОВОГО useEffect -->

    const loadDeal = async () => {
        try {
            const mockDeal = mockDeals.find((d) => d.id === id);
            if (mockDeal) {
                setDeal({
                    ...mockDeal,
                    currentPrice: Number(mockDeal.currentPrice),
                    originalPrice: mockDeal.originalPrice
                        ? Number(mockDeal.originalPrice)
                        : undefined,
                    image: mockDeal.image,
                    description: mockDeal.description || "",
                    url: mockDeal.url || "",
                    postedAt: mockDeal.postedAt,
                    postedBy: {
                        ...mockDeal.postedBy,
                        avatar:
                            mockDeal.postedBy.avatar ||
                            `https://ui-avatars.com/api/?name=${mockDeal.postedBy.name}&background=random`,
                    },
                });
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from("deals")
                .select(
                    `
          *,
          profiles:profiles!deals_user_id_fkey(id, email, display_name)
        `,
                )
                .eq("id", id)
                .maybeSingle();

            // Логируем данные из Supabase
            console.log('SUPABASE DATA:', data);

            if (error) throw error;

            if (!data) {
                setError("Deal not found");
                return;
            }

            // Add null checks and default values for profile data
            const profileDisplayName =
                data.profiles?.display_name ||
                (data.profiles?.email
                    ? data.profiles.email.split("@")[0]
                    : "Anonymous");

            setDeal({
                id: data.id,
                title: data.title,
                title_en: data.title_en,
                title_es: data.title_es,
                description: data.description,
                description_en: data.description_en,
                description_es: data.description_es,
                currentPrice: Number(data.current_price),
                originalPrice: data.original_price
                    ? Number(data.original_price)
                    : undefined,
                store: { id: data.store_id, name: data.store_id },
                category: { id: data.category_id, name: data.category_id },
                image: data.image_url,
                additional_images: data.additional_images || [],
                url: data.deal_url,
                expires_at: data.expires_at,
                created_at: data.created_at,
                postedAt: new Date(data.created_at).toLocaleDateString(),
                postedBy: {
                    id: data.profiles?.id || "anonymous",
                    name: profileDisplayName,
                    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(profileDisplayName)}&background=random`,
                },
            });
        } catch (err: any) {
            console.error("Error loading deal:", err);
            setError(err.message || "Failed to load deal details");
        } finally {
            setLoading(false);
        }
    };

    const loadComments = async () => {
        if (!id) return;

        // --- ИЗМЕНЕНИЕ ЗДЕСЬ ---
        const { data: comments, error } = await supabase
            .from("deal_comments")
            .select(
                `
                *,
                profiles ( id, email, display_name )
                `,
            )
            .eq("deal_id", id);
        // --- КОНЕЦ ИЗМЕНЕНИЯ ---

        if (error) {
            console.error("Error loading comments:", error);
            return;
        }

        if (!comments) {
            return;
        }

        const sortedComments = [...comments].sort((a, b) => {
            switch (sortBy) {
                case "oldest":
                    return (
                        new Date(a.created_at).getTime() -
                        new Date(b.created_at).getTime()
                    );
                case "popular":
                    return (b.like_count || 0) - (a.like_count || 0);
                case "newest":
                default:
                    return (
                        new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime()
                    );
            }
        });

        if (!error && comments) {
            const commentMap = new Map();
            const rootComments: any[] = [];

            comments.forEach((comment) => {
                commentMap.set(comment.id, {
                    ...comment,
                    replies: [],
                });
            });

            sortedComments.forEach((comment) => {
                const commentWithReplies = commentMap.get(comment.id);
                if (comment.parent_id) {
                    const parent = commentMap.get(comment.parent_id);
                    if (parent) {
                        parent.replies.push(commentWithReplies);
                    } else {
                        rootComments.push(commentWithReplies);
                    }
                } else {
                    rootComments.push(commentWithReplies);
                }
            });

            const sortReplies = (comments: any[]) => {
                comments.forEach((comment) => {
                    if (comment.replies && comment.replies.length > 0) {
                        comment.replies.sort((a, b) => {
                            switch (sortBy) {
                                case "oldest":
                                    return (
                                        new Date(a.created_at).getTime() -
                                        new Date(b.created_at).getTime()
                                    );
                                case "popular":
                                    return (
                                        (b.like_count || 0) -
                                        (a.like_count || 0)
                                    );
                                case "newest":
                                default:
                                    return (
                                        new Date(b.created_at).getTime() -
                                        new Date(a.created_at).getTime()
                                    );
                            }
                        });
                        sortReplies(comment.replies);
                    }
                });
            };

            sortReplies(rootComments);
            setComments(rootComments);
            setCommentCount(comments.length);
        }
    };

    const loadFavoriteStatus = async () => {
        if (!user || !id) return;

        const { data: favorite } = await supabase
            .from("deal_favorites")
            .select("id")
            .eq("deal_id", id)
            .eq("user_id", user.id)
            .maybeSingle();

        setIsFavorite(!!favorite);
    };

const toggleFavorite = async () => {
    console.log("toggleFavorite called. User object:", user);

    if (!user) {
        // Эту часть мы уже проверили, пользователь существует.
        navigate("/auth");
        return;
    }



    // -->> НАЧИНАЕМ НОВУЮ ДИАГНОСТИКУ ЗДЕСЬ <<--
    console.log("User check passed. Current 'isFavorite' state:", isFavorite);

    try {
        if (isFavorite) {
            // Попытка удалить из избранного
            console.log("Attempting to DELETE favorite...");
            const { error } = await supabase
                .from("deal_favorites")
                .delete()
                .eq("deal_id", id)
                .eq("user_id", user.id);

            if (error) throw error; // Если есть ошибка, передаем ее в catch
            console.log("DELETE request successful.");

        } else {
            // Попытка добавить в избранное
            console.log("Attempting to INSERT favorite...");
            const { error } = await supabase.from("deal_favorites").insert({
                deal_id: id,
                user_id: user.id,
            });

            if (error) throw error; // Если есть ошибка, передаем ее в catch
            console.log("INSERT request successful.");

    console.log(`GA4: Sending 'add_to_favorites' for Deal: ${deal.title}`);
    ReactGA4.event({
        category: 'Engagement',
        action: 'add_to_favorites',
        label: deal.title,
        item_id: deal.id,
        item_name: deal.title,
        content_type: 'deal'
    });
        }

        // Этот код обновляет иконку в интерфейсе
        setIsFavorite(!isFavorite);
        triggerNativeHaptic("impactLight");

    } catch (error) {
        // Если на любом из этапов (delete или insert) произошла ошибка, мы увидим ее здесь
        console.error("Error inside toggleFavorite try...catch block:", error);
    }
};


const handleVisitDealClick = () => {
  // Проверяем, что у нас есть все данные для отправки
  if (!deal) return;

  console.log(`GA4: Sending 'click_outbound' for Deal: ${deal.title}`);

  ReactGA4.event({
    category: 'Outbound Link',
    action: 'Click Visit Deal',
    label: deal.title,

    // Пользовательские параметры для детального анализа
    item_id: deal.id,
    item_name: deal.title,
    content_type: 'deal',
    destination_url: deal.url
  });
};

    // Define a type for comment tree nodes
    type CommentTreeNode = {
        id: string;
        content: string;
        created_at: string;
        profiles?: {
            id?: string;
            display_name?: string;
            email?: string;
        };
        reply_count?: number;
        like_count?: number;
        images?: string[]; // Added images property
        replies?: CommentTreeNode[];
    };

    const renderCommentTree = (comment: CommentTreeNode, depth = 0) => {
        const isHighlighted = highlightedCommentId === comment.id;

        // ВАЖНО: Не используем useEffect внутри функции рендеринга!
        // Вместо этого определяем класс на основе isHighlighted
        const commentClass = `transition-colors duration-300 ${isHighlighted ? "bg-orange-500/20 rounded-lg highlighted-comment" : ""}`;

        return (
            <div
                key={comment.id}
                style={{ marginLeft: depth * 24 }}
                id={`comment-${comment.id}`}
                className={commentClass}
            >
                <Comment
                    id={comment.id}
                    content={comment.content}
                    createdAt={comment.created_at}
                    images={comment.images || []}
                    user={{
                        id: comment.profiles?.id,
                        name:
                            comment.profiles?.display_name ||
                            comment.profiles?.email?.split("@")[0] ||
                            "Anonymous",
                        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.profiles?.display_name || comment.profiles?.email || "Anonymous")}&background=random`,
                    }}
                    replyCount={
                        typeof comment.reply_count === "number"
                            ? comment.reply_count
                            : 0
                    }
                    likeCount={
                        typeof comment.like_count === "number"
                            ? comment.like_count
                            : 0
                    }
                    replies={undefined}
                    sourceType="deal_comment"
                    sourceId={deal && deal.id ? String(deal.id) : ""}
                    onReply={loadComments}
                    depth={depth || 0}
                />
                {comment.replies && comment.replies.length > 0 && (
                    <div>
                        {comment.replies.map((reply: CommentTreeNode) =>
                            renderCommentTree(reply, (depth || 0) + 1),
                        )}
                    </div>
                )}
            </div>
        );
    };

    // Диагностика
    console.log('DEAL FIELDS IN DETAIL:', deal);
    console.log('LOCALIZED CONTENT:', localizedContent);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-900">
                <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error || !deal) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
                <h2 className="text-white text-xl mb-4">
                    {error || "Deal not found"}
                </h2>
                <button
                    onClick={() => navigate("/")}
                    className="bg-orange-500 text-white py-2 px-4 rounded-md flex items-center"
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Deals
                </button>
            </div>
        );
    }

    const discountPercent = deal.originalPrice
        ? Math.round(
              ((deal.originalPrice - deal.currentPrice) / deal.originalPrice) *
                  100,
          )
        : 0;
console.log("--- DEBUG INFO ---");
console.log("Loading State:", loading);
console.log("Error State:", error);
console.log("Comment Count State:", commentCount);
console.log("Comments Array to Render:", JSON.stringify(comments, null, 2));
console.log("--------------------");

    return (
        <div className="pb-16 pt-0 bg-gray-900 min-h-screen">
            <div className="fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 px-4 py-3 z-10 page-content-header">
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <button
                            onClick={() => navigate("/deals")}
                            className="text-white"
                        >
                            <ArrowLeft className="h-6 w-6" />
                        </button>
                        <h1 className="text-white font-medium ml-4 truncate">
                            Deal Details
                        </h1>
                    </div>
                    <AdminActions
                        type="deal"
                        id={deal.id}
                        userId={deal.postedBy.id}
                        onAction={() => navigate("/")}
                    />
                </div>
            </div>

            <div
                className="h-64 bg-gray-800 relative overflow-hidden touch-pan-y"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <img
                    src={getValidImageUrl(
                        dealImages[currentImageIndex] || deal.image,
                    )}
                    alt={deal.title}
                    className="w-full h-full object-contain cursor-pointer"
                    onError={handleImageError}
                    draggable="false"
                    onClick={(e) => {
                        // Находим текущий элемент img
                        const img = e.target as HTMLImageElement;

                        // Проверяем, есть ли уже модальное окно для этого изображения
                        const existingModal = document.querySelector(
                            ".fullscreen-image-modal",
                        );
                        if (existingModal) {
                            // Если модальное окно уже открыто, закрываем его
                            document.body.removeChild(existingModal);
                            return;
                        }

                        // Создаем модальное окно для просмотра изображения в полном размере
                        const modal = document.createElement("div");
                        modal.className =
                            "fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 fullscreen-image-modal";

                        // Переменная для отслеживания текущего индекса изображения в полноэкранном режиме
                        let currentFullscreenIndex = currentImageIndex;

                        // При клике на фон закрываем модальное окно
                        modal.addEventListener("click", (e) => {
                            if (e.target === modal) {
                                document.body.removeChild(modal);
                            }
                        });

                        // Определяем переменные заранее, чтобы избежать ошибок в ссылках
                        let prevButton, nextButton, counterElement;

                        // Функция для навигации по изображениям с циклическим переходом
                        const goToPrevImage = () => {
                            // Циклическая навигация: если мы на первом изображении, переходим к последнему
                            const newIndex =
                                currentFullscreenIndex > 0
                                    ? currentFullscreenIndex - 1
                                    : dealImages.length - 1;
                            updateFullscreenImage(newIndex);
                        };

                        const goToNextImage = () => {
                            // Циклическая навигация: если мы на последнем изображении, переходим к первому
                            const newIndex =
                                currentFullscreenIndex < dealImages.length - 1
                                    ? currentFullscreenIndex + 1
                                    : 0;
                            updateFullscreenImage(newIndex);
                        };

                        // Функция для обновления отображаемого изображения в полноэкранном режиме
                        const updateFullscreenImage = (index) => {
                            // Обновляем индекс
                            currentFullscreenIndex = index;

                            // Обновляем источник изображения
                            fullImg.src = getValidImageUrl(dealImages[index]);

                            // Обновляем активную точку навигации
                            const dots =
                                navContainer.querySelectorAll("button.nav-dot");
                            dots.forEach((d, i) => {
                                d.className = `nav-dot h-2 w-2 rounded-full ${
                                    i === index
                                        ? "bg-orange-500"
                                        : "bg-gray-400"
                                }`;
                            });

                            // Обновляем счетчик изображений
                            if (counterElement) {
                                counterElement.textContent = `${index + 1} / ${dealImages.length}`;
                            }
                        };

                        const content = document.createElement("div");
                        content.className = "relative max-w-4xl max-h-[90vh]";

                        // Добавляем кнопку закрытия (крестик) с улучшенной видимостью
                        const closeBtn = document.createElement("button");
                        closeBtn.className =
                            "absolute top-4 right-4 bg-orange-500 hover:bg-orange-600 text-white text-2xl font-bold rounded-full w-12 h-12 flex items-center justify-center shadow-xl z-10 border-2 border-white";
                        closeBtn.innerHTML = "×";
                        closeBtn.onclick = (e) => {
                            e.stopPropagation();
                            document.body.removeChild(modal);
                        };

                        const fullImg = document.createElement("img");
                        fullImg.src = getValidImageUrl(
                            dealImages[currentImageIndex] || deal.image,
                        );
                        fullImg.className =
                            "max-w-full max-h-[90vh] object-contain";
                        fullImg.onError = handleImageError;
                        fullImg.draggable = false; // Отключаем стандартное перетаскивание

                        // Добавляем обработчики событий касания для свайпов
                        let touchStartX = 0;
                        let touchEndX = 0;

                        // Функция обработки начала касания
                        const handleTouchStartModal = (e) => {
                            touchStartX = e.changedTouches[0].screenX;
                        };

                        // Функция обработки движения касания
                        const handleTouchMoveModal = (e) => {
                            // Предотвращаем стандартное поведение браузера при горизонтальном свайпе
                            const currentX = e.changedTouches[0].screenX;
                            const diff = Math.abs(touchStartX - currentX);

                            if (diff > 10) {
                                e.preventDefault();
                            }
                        };

                        // Функция обработки окончания касания
                        const handleTouchEndModal = (e) => {
                            touchEndX = e.changedTouches[0].screenX;

                            // Определяем направление свайпа
                            const diff = touchStartX - touchEndX;
                            const threshold = 50; // Минимальное расстояние для засчитывания свайпа

                            if (Math.abs(diff) > threshold) {
                                if (diff > 0) {
                                    // Свайп влево - следующее изображение
                                    goToNextImage();
                                } else {
                                    // Свайп вправо - предыдущее изображение
                                    goToPrevImage();
                                }
                            }
                        };

                        // Назначаем обработчики событий касания для полноэкранного изображения
                        fullImg.addEventListener(
                            "touchstart",
                            handleTouchStartModal,
                            { passive: false },
                        );
                        fullImg.addEventListener(
                            "touchmove",
                            handleTouchMoveModal,
                            { passive: false },
                        );
                        fullImg.addEventListener(
                            "touchend",
                            handleTouchEndModal,
                        );

                        content.appendChild(closeBtn);

                        // Создаем контейнер для навигационных точек
                        const navContainer = document.createElement("div");
                        navContainer.className =
                            "absolute bottom-4 left-0 right-0 flex justify-center space-x-2";

                        // Создаем счетчик изображений (только если есть больше одного изображения)
                        if (dealImages.length > 1) {
                            counterElement = document.createElement("div");
                            counterElement.className =
                                "absolute top-4 left-4 bg-orange-500 text-white px-2 py-1 rounded-md text-sm font-semibold shadow-lg border border-white/60";
                            counterElement.textContent = `${currentFullscreenIndex + 1} / ${dealImages.length}`;
                            content.appendChild(counterElement);
                        }

                        // Добавляем кнопки навигации при наличии нескольких изображений
                        if (dealImages.length > 1) {
                            // Кнопка "Предыдущее изображение"
                            const prevButton = document.createElement("button");
                            prevButton.className =
                                "absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-3 z-10 shadow-md border border-white/30";
                            prevButton.innerHTML =
                                '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
                            prevButton.onclick = (e) => {
                                e.stopPropagation();
                                goToPrevImage();
                            };
                            // Всегда активно для циклической навигации
                            content.appendChild(prevButton);

                            // Кнопка "Следующее изображение"
                            const nextButton = document.createElement("button");
                            nextButton.className =
                                "absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-3 z-10 shadow-md border border-white/30";
                            nextButton.innerHTML =
                                '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
                            nextButton.onclick = (e) => {
                                e.stopPropagation();
                                goToNextImage();
                            };
                            // Всегда активно для циклической навигации
                            content.appendChild(nextButton);

                            // Создаем точки для каждого изображения
                            dealImages.forEach((_, index) => {
                                const dot = document.createElement("button");
                                dot.className = `nav-dot h-2 w-2 rounded-full ${
                                    currentFullscreenIndex === index
                                        ? "bg-orange-500"
                                        : "bg-gray-400"
                                }`;

                                // При клике на точку меняем изображение
                                dot.addEventListener("click", (e) => {
                                    e.stopPropagation();
                                    updateFullscreenImage(index);
                                });

                                navContainer.appendChild(dot);
                            });

                            content.appendChild(navContainer);
                        }

                        content.appendChild(fullImg);
                        modal.appendChild(content);
                        document.body.appendChild(modal);

                        // Обработчик клавиатуры для навигации
                        const handleKeyDown = (e) => {
                            if (e.key === "ArrowLeft") {
                                goToPrevImage();
                            } else if (e.key === "ArrowRight") {
                                goToNextImage();
                            } else if (e.key === "Escape") {
                                document.body.removeChild(modal);
                                document.removeEventListener(
                                    "keydown",
                                    handleKeyDown,
                                );
                            }
                        };

                        // Добавляем обработчик клавиатуры
                        document.addEventListener("keydown", handleKeyDown);

                        // Удаляем обработчик при закрытии модального окна
                        modal.addEventListener("remove", () => {
                            document.removeEventListener(
                                "keydown",
                                handleKeyDown,
                            );
                        });
                    }}
                />

                {dealImages.length > 1 && (
                    <>
                        {/* Кнопка предыдущего изображения */}
                        <button
                            onClick={goToPreviousImage}
                            className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-3 z-10 shadow-md border border-white/30"
                            aria-label="Previous image"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="white"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <polyline points="15 18 9 12 15 6"></polyline>
                            </svg>
                        </button>

                        {/* Кнопка следующего изображения */}
                        <button
                            onClick={goToNextImage}
                            className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-3 z-10 shadow-md border border-white/30"
                            aria-label="Next image"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="white"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </button>

                        {/* Индикатор текущего изображения с счетчиком */}
                        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
                            {dealImages.map((_, index) => (
                                <button
                                    key={index}
                                    onClick={() => setCurrentImageIndex(index)}
                                    className={`h-2 w-2 rounded-full ${
                                        index === currentImageIndex
                                            ? "bg-orange-500"
                                            : "bg-gray-400"
                                    }`}
                                    aria-label={`Go to image ${index + 1}`}
                                />
                            ))}
                        </div>

                        {/* Счетчик изображений */}
                        {dealImages.length > 1 && (
                            <div className="absolute top-3 right-3 bg-orange-500 text-white px-2 py-1 rounded font-medium text-sm shadow-md border border-white/60">
                                {currentImageIndex + 1} / {dealImages.length}
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="p-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-white text-xl font-medium">
                        {searchQuery
                            ? highlightText(localizedContent.title, searchQuery)
                            : localizedContent.title}
                    </h2>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => {
                                if (navigator.share) {
                                    // Формируем правильный URL для конкретной сделки
                                    const dealUrl = `${window.location.origin}/deals/${deal.id}`;

                                    // Очищаем HTML-теги из заголовка
                                    const cleanTitle = deal.title
                                        ? deal.title.replace(/<[^>]*>/g, "")
                                        : "";

                                    navigator
                                        .share({
                                            title: cleanTitle,
                                            url: dealUrl,
                                        })
                                        .catch(console.error);
                                } else {
                                    // Формируем правильный URL для копирования
                                    const dealUrl = `${window.location.origin}/deals/${deal.id}`;
                                    navigator.clipboard.writeText(dealUrl);
                                    alert("Link copied to clipboard!");
                                }
                            }}
                            className="p-2 rounded-full text-gray-400 hover:text-orange-500"
                        >
                            <Share2 className="h-6 w-6" />
                        </button>
                        <button
                            onClick={toggleFavorite}
                            className={`p-2 rounded-full ${isFavorite ? "text-red-500" : "text-gray-400"}`}
                        >
                            <Heart
                                className="h-6 w-6"
                                fill={isFavorite ? "currentColor" : "none"}
                            />
                        </button>
                        {user &&
                            user.id === deal.postedBy.id &&
                            new Date().getTime() -
                                new Date(
                                    deal.created_at || deal.postedAt,
                                ).getTime() <
                                24 * 60 * 60 * 1000 && (
                                <button
                                    onClick={() =>
                                        navigate(`/edit-deal/${deal.id}`)
                                    }
                                    className="ml-3 text-orange-500 flex items-center"
                                >
                                    <Edit2 className="h-5 w-5" />
                                </button>
                            )}
                    </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center">
                        <span className="text-orange-500 font-bold text-2xl">
                            {deal.currentPrice === 0 ? (
                                <span className="px-4 py-1.5 bg-orange-500/20 text-orange-500 rounded-md text-xl font-semibold">
                                    FREE
                                </span>
                            ) : (
                                `$${deal.currentPrice.toFixed(2)}`
                            )}
                        </span>

                        {deal.originalPrice && (
                            <span className="ml-3 text-gray-400 line-through text-base">
                                ${deal.originalPrice.toFixed(2)}
                            </span>
                        )}

                        {discountPercent > 0 && (
                            <span className="ml-2 text-green-500 text-base">
                                (-{discountPercent}%)
                            </span>
                        )}
                    </div>

                    {deal.expires_at && (
                        <div
                            className={`flex items-center ${
                                isExpired
                                    ? "text-red-600 bg-red-600/20 px-2 py-0.5 rounded border border-red-600/30 font-semibold"
                                    : "text-gray-400"
                            } font-medium`}
                        >
                            {isExpired ? (
                                <>
                                    <svg
                                        className="w-4 h-4 mr-1"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                    </svg>
                                    Expired
                                </>
                            ) : (
                                <>
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="mr-1"
                                    >
                                        <path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1.5" />
                                        <path d="M16 2v4" />
                                        <path d="M8 2v4" />
                                        <path d="M3 10h18" />
                                        <circle cx="18" cy="18" r="4" />
                                        <path d="M18 16.5v1.5h1.5" />
                                    </svg>
                                    {new Date(
                                        deal.expires_at,
                                    ).toLocaleDateString()}
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div className="mt-2 flex items-center justify-between">
                    <div className="bg-gray-800 px-3 py-1 rounded-md text-white">
                        {deal.store.name}
                    </div>

                    <VoteControls dealId={deal.id} />
                </div>
                <a
                    href={deal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 bg-orange-500 text-white py-3 rounded-md flex items-center justify-center font-medium"
                    onClick={handleVisitDealClick}
                >
                    <span>Visit Deal</span>
                    <ExternalLink className="h-4 w-4 ml-2" />
                </a>


                <div className="mt-6">
                    <h3 className="text-white font-medium mb-2">Description</h3>
                    <LinkifiedHtml
                        content={localizedContent.description || ''}
                        searchQuery={searchQuery}
                        className="description-text font-sans text-sm bg-transparent overflow-visible whitespace-pre-wrap border-0 p-0 m-0"
                    />
                </div>

                {/* Блок с ценовой историей был удалён */}

<div className="text-center text-gray-500 text-sm mt-6 mb-6">
                    If you purchase something through a post on our site, WeDealz may get a small share of the sale.
                </div>

                <div className="mt-6" id="comments-section">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-white font-medium">
                            Comments ({commentCount})
                        </h3>
                        <select
                            value={sortBy}
                            onChange={(e) =>
                                setSortBy(
                                    e.target.value as
                                        | "newest"
                                        | "oldest"
                                        | "popular",
                                )
                            }
                            className="bg-gray-800 text-white text-sm rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 appearance-none flex-shrink-0"
                        >
                            <option value="newest">Newest</option>
                            <option value="oldest">Oldest</option>
                            <option value="popular">Popular</option>
                        </select>
                    </div>

                    <div className="mb-4">
                        <CommentInput
                            sourceType="deal_comment"
                            sourceId={deal.id}
                            onSubmit={loadComments}
                        />
                    </div>

                    {/* Render comments as a tree */}
                    {comments.length > 0 ? (
                        <div className="space-y-4">
                            {comments.map((comment) =>
                                renderCommentTree(comment),
                            )}
                        </div>
                    ) : (
                        <div className="bg-gray-800 rounded-md p-4 text-gray-400 text-center">
                            No comments yet. Be the first to comment!
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DealDetailPage;
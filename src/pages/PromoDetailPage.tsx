import React, { useState, useEffect } from "react";
import VoteControls from "../components/deals/VoteControls";
import {
  useParams,
  useNavigate,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { ArrowLeft, ExternalLink, Heart, Share2, Edit2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import Comment from "../components/comments/Comment";
import CommentInput from "../components/comments/CommentInput";
import AdminActions from "../components/admin/AdminActions";
import { highlightText } from "../utils/highlightText";
import { triggerNativeHaptic } from "../utils/nativeBridge";

const PromoDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const highlightedCommentId = searchParams.get("comment");
  const navigate = useNavigate();
  const location = useLocation();
  const searchQuery = searchParams.get("q") || "";
  const { user } = useAuth();
  const [promo, setPromo] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  // Removed voteCount and userVote state
  const [isFavorite, setIsFavorite] = useState(false);
  const isExpired =
    promo?.expires_at && new Date(promo.expires_at) < new Date();

  // Define comment tree node type
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
    replies?: CommentTreeNode[];
  };

  const renderCommentTree = (comment: CommentTreeNode, depth = 0) => {
    const isHighlighted = highlightedCommentId === comment.id;

    return (
      <div
        key={comment.id}
        style={{ marginLeft: depth * 24 }}
        id={`comment-${comment.id}`}
        className={`transition-colors duration-300 ${isHighlighted ? "bg-orange-500/20 rounded-lg" : ""}`}
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
          replyCount={comment.reply_count || 0}
          likeCount={comment.like_count || 0}
          replies={undefined}
          sourceType="promo_comment"
          sourceId={promo && promo.id ? String(promo.id) : ""}
          onReply={loadComments}
          depth={depth}
        />
        {comment.replies && comment.replies.length > 0 && (
          <div>
            {comment.replies.map((reply) =>
              renderCommentTree(reply, depth + 1),
            )}
          </div>
        )}
      </div>
    );
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "popular">(
    "newest",
  );
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  useEffect(() => {
    const pageTitle = "Promo Details"; // Или ваш динамический заголовок

    console.log(
      `[PromocodeDetailPage Web] INFO: useEffect для отправки заголовка "${pageTitle}" запущен (с небольшой задержкой).`,
    );

    const timerId = setTimeout(() => {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        console.log(
          `[PromocodeDetailPage Web] INFO: Отправляю заголовок "${pageTitle}" в React Native после задержки.`,
        );
        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: "SET_NATIVE_HEADER_TITLE",
            title: pageTitle,
          }),
        );
      } else {
        console.warn(
          `[PromocodeDetailPage Web] WARN: ReactNativeWebView.postMessage НЕ ДОСТУПЕН (после задержки). Возможно, страница открыта не в WebView React Native.`,
        );
      }
    }, 50);

    return () => clearTimeout(timerId);
  }, []);

  useEffect(() => {
    // Прокручиваем страницу вверх при открытии деталей промокода
    window.scrollTo(0, 0);

    if (id) {
      loadPromo();
      loadComments();
      if (user) {
        // loadVoteStatus(); // removed
        loadFavoriteStatus();
      }
    }
  }, [id, user, sortBy]);

  // Отдельный эффект для прокрутки к комментарию, если указан ID комментария в URL
  useEffect(() => {
    if (highlightedCommentId) {
      // Для DOM-элементов используем небольшую задержку, чтобы убедиться, что комментарии загружены
      const timer = setTimeout(() => {
        const commentElement = document.getElementById(
          `comment-${highlightedCommentId}`,
        );
        if (commentElement) {
          // Прокручиваем к комментарию один раз
          commentElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });

          // Добавляем эффект подсветки (упрощаем анимацию)
          // Используем последовательные классы без лишних удалений
          commentElement.classList.add("bg-orange-500/20");
          setTimeout(() => {
            commentElement.classList.remove("bg-orange-500/20");
            commentElement.classList.add("bg-orange-500/10");
            setTimeout(() => {
              commentElement.classList.remove("bg-orange-500/10");
            }, 1000);
          }, 1000);
        }
      }, 800);

      return () => clearTimeout(timer);
    }
  }, [highlightedCommentId, comments.length]);

  const loadPromo = async () => {
    try {
      const { data, error } = await supabase
        .from("promo_codes")
        .select(
          `
          *,
          profiles!promo_codes_user_id_fkey (
            id,
            email,
            display_name
          )
        `,
        )
        .eq("id", id)
        .single();

      if (error) throw error;

      if (!data) {
        setError("Promo code not found");
        return;
      }

      setPromo({
        ...data,
        user: {
          id: data.profiles.id,
          name: data.profiles.display_name || data.profiles.email.split("@")[0],
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(data.profiles.display_name || data.profiles.email)}&background=random`,
        },
      });
    } catch (err) {
      console.error("Error loading promo:", err);
      setError("Failed to load promo code details");
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async () => {
    if (!id) return;

    let query = supabase
      .from("promo_comments")
      .select(
        `
        *,
        profiles!promo_comments_user_id_fkey (
          id,
          email,
          display_name
        )
      `,
      )
      .eq("promo_id", id);

    switch (sortBy) {
      case "oldest":
        query = query.order("created_at", { ascending: true });
        break;
      case "popular":
        query = query
          .order("like_count", { ascending: false })
          .order("created_at", { ascending: false });
        break;
      case "newest":
      default:
        query = query.order("created_at", { ascending: false });
        break;
    }

    const { data: comments, error } = await query;

    if (!error && comments) {
      const commentMap = new Map();
      const rootComments = [];

      comments.forEach((comment) => {
        commentMap.set(comment.id, {
          ...comment,
          replies: [],
        });
      });

      comments.forEach((comment) => {
        const commentWithReplies = commentMap.get(comment.id);
        if (comment.parent_id) {
          const parent = commentMap.get(comment.parent_id);
          if (parent) {
            parent.replies.push(commentWithReplies);
          }
        } else {
          rootComments.push(commentWithReplies);
        }
      });

      setComments(rootComments);
      setCommentCount(comments.length);
    }
  };

  const loadFavoriteStatus = async () => {
    try {
      const { data: favorite } = await supabase
        .from("promo_favorites")
        .select("id")
        .eq("promo_id", id)
        .eq("user_id", user!.id)
        .maybeSingle();

      setIsFavorite(!!favorite);
    } catch (error) {
      console.error("Error loading favorite status:", error);
    }
  };

  const toggleFavorite = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }

    try {
      if (isFavorite) {
        await supabase
          .from("promo_favorites")
          .delete()
          .eq("promo_id", id)
          .eq("user_id", user.id);
      } else {
        await supabase.from("promo_favorites").insert({
          promo_id: id,
          user_id: user.id,
        });
      }

      setIsFavorite(!isFavorite);
      triggerNativeHaptic("impactLight");
    } catch (error) {
      console.error("Error toggling favorite:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !promo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
        <h2 className="text-white text-xl mb-4">
          {error || "Promo code not found"}
        </h2>
        <button
          onClick={() => navigate("/promos")}
          className="bg-orange-500 text-white py-2 px-4 rounded-md flex items-center"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Promos
        </button>
      </div>
    );
  }

  return (
    <div className="pb-16 pt-12 bg-gray-900 min-h-screen">
      <div className="web-page-header fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 px-4 py-3 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => navigate("/promos")} className="text-white">
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-white font-medium ml-4">Promo Details</h1>
          </div>
          <AdminActions
            type="promo"
            id={promo.id}
            userId={promo.user.id}
            onAction={() => navigate("/promos")}
          />
        </div>
      </div>

      <div className="main-content-area px-4 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-white text-xl font-medium">
            {searchQuery
              ? highlightText(promo.title, searchQuery)
              : promo.title}
          </h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                if (navigator.share) {
                  // Формируем правильный URL для конкретного промокода
                  const promoUrl = `${window.location.origin}/promos/${promo.id}`;
                  navigator
                    .share({
                      title: promo.title,
                      url: promoUrl,
                    })
                    .catch(console.error);
                } else {
                  // Формируем правильный URL для копирования
                  const promoUrl = `${window.location.origin}/promos/${promo.id}`;
                  navigator.clipboard.writeText(promoUrl);
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
              user.id === promo.user.id &&
              new Date().getTime() -
                new Date(promo.created_at || promo.postedAt).getTime() <
                24 * 60 * 60 * 1000 && (
                <button
                  onClick={() => navigate(`/promos/${promo.id}/edit`)}
                  className="ml-3 text-orange-500 flex items-center"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              )}
          </div>
        </div>

        {isExpired && (
          <div className="flex items-center bg-red-500/10 px-2 py-1 rounded-md text-red-500 font-medium mt-2 w-fit">
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
          </div>
        )}

        <div className="mt-4 bg-gray-800 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-4">
            <div className="bg-gray-700 px-3 py-1.5 rounded border border-gray-600">
              <span className="text-orange-500 font-mono">{promo.code}</span>
            </div>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigator.clipboard.writeText(promo.code);
                setCopiedCodeId(promo.id);
                setTimeout(() => setCopiedCodeId(null), 2000);
              }}
              className={`font-medium px-3 py-1.5 rounded border ${copiedCodeId === promo.id ? "bg-green-500 text-white border-green-500" : "text-orange-500 border-orange-500"}`}
            >
              {copiedCodeId === promo.id ? "Copied!" : "Copy Code"}
            </button>
          </div>

          <div
            className="text-gray-300"
            dangerouslySetInnerHTML={{
              __html: (() => {
                // Если есть поисковый запрос, применяем прямую подсветку в HTML строке
                if (searchQuery) {
                  const searchRegex = new RegExp(
                    `(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
                    "gi",
                  );
                  return promo.description.replace(
                    searchRegex,
                    '<span class="bg-orange-500 text-white px-0.5 rounded">$1</span>',
                  );
                }

                return promo.description;
              })(),
            }}
          />

          {promo.expires_at && (
            <div className="mt-4 text-gray-400 text-sm">
              Expires: {new Date(promo.expires_at).toLocaleDateString()}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <VoteControls dealId={promo.id} type="promo" do_refresh={true} />
          <a
            href={promo.discount_url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-orange-500 text-white px-4 py-2 rounded-md flex items-center"
          >
            <span>Visit Store</span>
            <ExternalLink className="h-4 w-4 ml-2" />
          </a>
        </div>
<div className="text-center text-gray-500 text-sm mt-6 mb-6">
                    If you purchase something through a post on our site, WeDealz may get a small share of the sale.
                </div>
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-medium">
              Comments ({commentCount})
            </h3>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "newest" | "oldest" | "popular")
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
              sourceType="promo_comment"
              sourceId={promo.id}
              onSubmit={loadComments}
            />
          </div>

          {comments.length > 0 ? (
            <div className="space-y-4">
              {comments.map((comment) => renderCommentTree(comment))}
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

export default PromoDetailPage;

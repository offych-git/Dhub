import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Deal } from "../../types";
import {
  MessageSquare,
  ExternalLink,
  Heart,
  Share2,
  Edit2,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import AdminActions from "../admin/AdminActions";
import { useAdmin } from "../../hooks/useAdmin";
import { handleImageError, getValidImageUrl } from "../../utils/imageUtils";
import { useSearchParams } from "react-router-dom"; // Added import
import { highlightText } from "../../utils/highlightText"; // Added import
import VoteControls from "../deals/VoteControls";
import { triggerNativeHaptic } from "../../utils/nativeBridge";

interface DealCardProps {
  deal: Deal;
  onVoteChange?: () => void;
  onDelete?: () => void;
  hideFreeLabel?: boolean;
}

const DealCard: React.FC<DealCardProps> = ({
  deal,
  onDelete,
  onVoteChange,
  hideFreeLabel = false,
}) => {
  const { user } = useAuth();
  const { role } = useAdmin();
  const navigate = useNavigate();
  // Determine if this is a sweepstakes based on deal type or other properties
  const isSweepstakes = deal.type === "sweepstakes";
  const [isFavorite, setIsFavorite] = useState(deal.isFavorite);
  const [commentCount] = useState(deal.comments);
  const isOwnDeal = user && deal.postedBy.id === user.id;
  const [searchParams] = useSearchParams();
  const [dealStatus] = useState(deal.status || "approved");

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      navigate("/auth");
      return;
    }

    try {
      if (isFavorite) {
        await supabase
          .from("deal_favorites")
          .delete()
          .eq("deal_id", deal.id)
          .eq("user_id", user.id);
      } else {
        await supabase.from("deal_favorites").insert({
          deal_id: deal.id,
          user_id: user.id,
        });
      }

      setIsFavorite(!isFavorite);
      triggerNativeHaptic("impactLight");
    } catch (error) {
      console.error("Error toggling favorite:", error);
    }
  };

  const discountPercent = deal.originalPrice
    ? Math.round(
        ((deal.originalPrice - deal.currentPrice) / deal.originalPrice) * 100,
      )
    : 0;

  const isExpired = deal.expires_at && new Date(deal.expires_at) < new Date();
  const expiryDate = deal.expires_at
    ? new Date(deal.expires_at).toLocaleDateString()
    : null;

  return (
    <div className="block border-b border-gray-800 px-4 py-2.5">
      <div className="flex items-start justify-between">
        <div className="flex items-center text-gray-500 text-sm mr-3">
          <span className="inline-block h-5 w-5 mr-1">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M12 7V12L15 15"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span title={deal.postedAt.exact}>{deal.postedAt.relative}</span>
        </div>

        <div className="ml-auto flex items-center text-sm">
          <VoteControls
            dealId={deal.id}
            popularity={deal.popularity}
            userVoteType={deal.userVoteType}
            type={deal.type}
            onVoteChange={onVoteChange}
          />
        </div>
      </div>

      <div className="flex mt-1.5">
        <div className="w-16 h-16 bg-gray-800 rounded-md overflow-hidden mr-3 flex-shrink-0">
          <img
            src={getValidImageUrl(deal.image)}
            alt={deal.title}
            className="w-full h-full object-contain"
            onError={handleImageError}
          />
        </div>

        <div
          className="flex-1 min-w-0"
          onClick={() =>
            navigate(
              isSweepstakes ? `/sweepstakes/${deal.id}` : `/deals/${deal.id}`,
            )
          }
        >
          <h3 className="text-white font-medium text-sm line-clamp-2 cursor-pointer">
            {searchParams.get("q")
              ? highlightText(deal.title, searchParams.get("q") || "")
              : deal.title}
          </h3>

          <div className="mt-1 flex items-center justify-between">
            <div className="flex items-center">
              {!hideFreeLabel && (
                <>
                  <span className="text-orange-500 font-bold text-base">
                    {deal.currentPrice === 0 ? (
                      <span className="px-2.5 py-1 bg-orange-500/20 text-orange-500 rounded-md text-sm font-semibold">
                        FREE
                      </span>
                    ) : (
                      `$${deal.currentPrice.toFixed(2)}`
                    )}
                  </span>

                  {deal.originalPrice && (
                    <span className="ml-2 text-gray-400 line-through text-xs">
                      ${deal.originalPrice.toFixed(2)}
                    </span>
                  )}

                  {discountPercent > 0 && (
                    <span className="ml-2 text-green-500 text-xs">
                      (-{discountPercent}%)
                    </span>
                  )}
                </>
              )}
            </div>

            {deal.status === "rejected" && (
              <div className="ml-2 px-2 py-0.5 text-xs bg-red-500/20 text-red-500 rounded-full">
                Rejected
              </div>
            )}

            {isOwnDeal && dealStatus === "pending" && (
              <div className="ml-2 px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-500 rounded-full">
                Pending Review
              </div>
            )}

            {expiryDate &&
              deal.status !== "rejected" &&
              (isExpired ? (
                <div className="ml-2 px-2 py-0.5 text-xs bg-red-500/20 text-red-500 rounded-full">
                  Expired
                </div>
              ) : (
                <div className="flex items-center text-gray-400 text-xs font-medium">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
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
                  {new Date(deal.expires_at || expiryDate).toLocaleDateString()}
                </div>
              ))}
          </div>

          <div className="mt-0.5 text-gray-400 text-xs">{deal.store.name}</div>
          {deal.description && (
            <div
              className="mt-1 text-gray-400 text-xs description-preview line-clamp-2 overflow-hidden"
              style={{ pointerEvents: "none" }}
            >
              {(() => {
                // Сначала очищаем текст от HTML-тегов
                const cleanDescription = deal.description
                  // Заменяем <br> тег на ' '
                  .replace(/<br[^>]*>/gi, " ")
                  // Заменяем закрывающие теги на пробел
                  .replace(/<\/[^>]*>/g, " ")
                  // Заменяем оставшиеся HTML теги на пробел
                  .replace(/<[^>]*>/g, " ")
                  // Декодируем HTML-сущности
                  .replace(/&nbsp;/g, " ")
                  // Заменяем множественные пробелы на один
                  .replace(/\s+/g, " ")
                  .trim();

                // Затем применяем подсветку, если есть поисковый запрос
                return searchParams.get("q")
                  ? highlightText(cleanDescription, searchParams.get("q") || "")
                  : cleanDescription;
              })()}
            </div>
          )}
        </div>
      </div>

      <div className="mt-1.5 flex items-center">
        <div className="w-5 h-5 rounded-full overflow-hidden mr-1.5">
          <img
            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(deal.postedBy.name)}&background=random`}
            alt={deal.postedBy.name}
            className="w-full h-full object-cover"
          />
        </div>

        <span className="author-name text-xs">{deal.postedBy.name}</span>

        <div className="ml-auto flex items-center">
          <button
            onClick={toggleFavorite}
            className={`p-1 rounded-full ${isFavorite ? "text-red-500" : "text-gray-400"}`}
          >
            <Heart
              className="h-4 w-4"
              fill={isFavorite ? "currentColor" : "none"}
            />
          </button>

          <div className="ml-3 text-gray-400 flex items-center">
            <MessageSquare className="h-4 w-4 mr-1" />
            <span className="text-xs">{commentCount}</span>
          </div>

          {/* Share button - always visible */}
          <button
            className="ml-3 text-orange-500 flex items-center"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (navigator.share) {
                const cleanTitle = deal.title
                  ? deal.title.replace(/<[^>]*>/g, "")
                  : "";
                const cleanStoreName =
                  deal.store && deal.store.name
                    ? deal.store.name.replace(/<[^>]*>/g, "")
                    : "";

                // Формируем URL для конкретного предложения
                const dealUrl = `${window.location.origin}/deals/${deal.id}`;
                const shareTitle = `${cleanTitle}${cleanStoreName ? ` - ${cleanStoreName}` : ""}`;

                try {
                  // Определяем устройство и браузер для разных стратегий sharing
                  const isMobile =
                    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
                      navigator.userAgent,
                    );
                  const isChrome =
                    /Chrome/i.test(navigator.userAgent) &&
                    !/Edge|Edg/i.test(navigator.userAgent);

                  if (isMobile) {
                    // На мобильных используем только text без url параметра, чтобы избежать дублирования
                    navigator.share({
                      text: `${shareTitle}\n${dealUrl}`,
                    });
                  } else if (isChrome) {
                    // В Chrome на десктопе используем только title и url, чтобы избежать дублирования
                    navigator.share({
                      title: shareTitle,
                      url: dealUrl,
                    });
                  } else {
                    // В других браузерах на десктопе используем все параметры
                    navigator.share({
                      title: shareTitle,
                      text: shareTitle,
                      url: dealUrl,
                    });
                  }
                } catch (error) {
                  console.error("Error sharing:", error);
                }
              }
            }}
          >
            <Share2 className="h-4 w-4" />
          </button>

          {/* View button - always visible */}
          <button
            className="ml-3 text-orange-500 flex items-center"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (deal.url) {
                window.open(deal.url, "_blank", "noopener,noreferrer");
              } else {
                navigate(`/deals/${deal.id}`);
              }
            }}
          >
            <span className="text-xs mr-1">View</span>
            <ExternalLink className="h-3 w-3" />
          </button>

          {/* User-specific actions */}
          {user &&
            user.id === deal.postedBy.id &&
            new Date().getTime() - new Date(deal.createdAt).getTime() <
              24 * 60 * 60 * 1000 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // Проверяем тип сделки и выбираем правильный маршрут
                  if (deal.type === "sweepstakes") {
                    console.log(
                      "Перенаправление на страницу редактирования розыгрыша:",
                      `/edit-sweepstakes/${deal.id}`,
                    );
                    navigate(`/edit-sweepstakes/${deal.id}`);
                  } else {
                    console.log(
                      "Перенаправление на страницу редактирования обычной сделки:",
                      `/deals/${deal.id}/edit`,
                    );
                    // ПРАВИЛЬНО
navigate(`/edit-deal/${deal.id}`);
                  }
                }}
                className="ml-3 text-orange-500 flex items-center"
              >
                <Edit2 className="h-4 w-4" />
              </button>
            )}
          {user &&
            (role === "admin" ||
              role === "moderator" ||
              user.id === deal.postedBy.id) && (
              <AdminActions
                type={deal.type === "sweepstakes" ? "sweepstakes" : "deal"}
                id={deal.id}
                userId={deal.postedBy.id}
                createdAt={deal.createdAt}
                onAction={onDelete || (() => {})}
                className="ml-3 border-l border-gray-700 pl-3"
              />
            )}
        </div>
      </div>
    </div>
  );
};

export default DealCard;

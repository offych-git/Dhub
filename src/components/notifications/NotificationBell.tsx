// NotificationBell.tsx (Полная версия с отладкой deleteNotification)
import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom"; // НУЖЕН ДЛЯ ПОРТАЛА
import { Bell } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext"; // Убедитесь, что путь правильный
import { supabase } from "../../lib/supabase"; // Убедитесь, что путь правильный
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../contexts/ThemeContext"; // Убедитесь, что путь правильный
import { registerNotificationHandler } from "../../utils/globalInteractions"; // Убедитесь, что путь правильный

// Расширяем Window, если это еще не сделано глобально
declare global {
  interface Window {
    isNativeApp?: boolean;
    toggleNotificationsView?: () => void; // Используется globalInteractions
    // setWebNotificationDropdownPosition?: (positionData: { top: number; left: number; }) => void; // Определяется в App.tsx (RN)
  }
}

const NotificationBell: React.FC = () => {
  console.log("САЙТ: NotificationBell монтируется/перерисовывается (начало)");

  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
    console.log("САЙТ: NotificationBell isClient установлен в true");
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      console.log(
        "САЙТ: Загружаем реальные уведомления из базы данных для user:",
        user.id,
      );
      const { data, error } = await supabase
        .from("notifications")
        .select(
          `
          *,
          actor:actor_id (id, email, display_name)
        `,
        )
        .eq("user_id", user?.id)
        .in("type", ["mention", "reply", "subscription"])
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      console.log(
        "САЙТ: Получены уведомления из базы:",
        data?.length || 0,
        data,
      );
      setNotifications(data || []);

      const { count, error: countError } = await supabase
        .from("notifications")
        .select("id", { count: "exact" })
        .eq("user_id", user?.id)
        .eq("read", false);

      if (countError) throw countError;
      console.log("САЙТ: Количество непрочитанных уведомлений:", count || 0);
      setUnreadCount(count || 0);
    } catch (err: any) {
      console.error("САЙТ: Ошибка загрузки уведомлений:", err.message || err);
    }
  }, [user]);

  const subscribeToNotifications = useCallback(() => {
    if (!user) return () => {};
    console.log(
      "САЙТ: Подписываемся на обновления уведомлений для user:",
      user.id,
    );

    const channel = supabase
      .channel(`notifications_user_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log(
            "САЙТ: Получено изменение в уведомлениях через подписку:",
            payload,
          );
          loadNotifications();
        },
      )
      .subscribe((status, err) => {
        console.log(`САЙТ: Статус подписки на канал уведомлений: ${status}`);
        if (err) {
          console.error(
            "САЙТ: Объект ошибки при подписке на уведомления:",
            err,
          );
        }
        // if (status === 'SUBSCRIBED') { console.log('САЙТ: Успешно подписан на канал уведомлений!'); }
        // if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { console.error('САЙТ: Ошибка подписки или таймаут (уведомления):', err); }
      });

    return () => {
      console.log("САЙТ: Отписка от канала уведомлений");
      supabase.removeChannel(channel);
    };
  }, [user, loadNotifications]);

  useEffect(() => {
    if (user && isClient) {
      loadNotifications();
      const unsubscribe = subscribeToNotifications();
      return () => unsubscribe();
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setShowDropdown(false);
    }
  }, [user, isClient, loadNotifications, subscribeToNotifications]);

  const stableToggle = useCallback(() => {
    console.log("САЙТ: stableToggle вызван.");
    setShowDropdown((currentState) => {
      const newState = !currentState;
      console.log(
        "САЙТ: stableToggle меняет showDropdown с",
        currentState,
        "на",
        newState,
      );
      return newState;
    });
  }, [setShowDropdown]);

  useEffect(() => {
    if (!isClient) return;
    const mountId = Date.now();
    console.log(
      "САЙТ: NotificationBell useEffect для регистрации (ID: " + mountId + ")",
    );
    registerNotificationHandler(stableToggle);
    return () => {
      console.log(
        "САЙТ: NotificationBell РАЗМОНТИРОВАН (ID: " +
          mountId +
          "). Вызываем registerNotificationHandler(null).",
      );
      registerNotificationHandler(null);
    };
  }, [isClient, stableToggle]);

  useEffect(() => {
    if (!isClient) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showDropdown &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isClient, showDropdown]);

  const markAsRead = async (notificationId?: string) => {
    console.log("САЙТ: Вызвана markAsRead для ID:", notificationId || "все");
    try {
      if (notificationId) {
        await supabase
          .from("notifications")
          .update({ read: true })
          .eq("id", notificationId);
      } else {
        await supabase
          .from("notifications")
          .update({ read: true })
          .eq("user_id", user?.id)
          .eq("read", false);
      }
      await loadNotifications(); // Перезагружаем, чтобы обновить UI
    } catch (error) {
      console.error(
        "САЙТ: Ошибка при отметке уведомлений как прочитанных:",
        error,
      );
    }
  };

  const deleteNotification = async (
    notificationId: string,
    event: React.MouseEvent,
  ) => {
    event.stopPropagation();
    console.log("САЙТ: Вызвана deleteNotification для ID:", notificationId);

    const originalNotifications = [...notifications];
    const notificationToDelete = notifications.find(
      (n) => n.id === notificationId,
    );

    if (!notificationToDelete) {
      console.error(
        "САЙТ: Уведомление для удаления не найдено в локальном состоянии:",
        notificationId,
      );
      return;
    }
    console.log(
      "САЙТ: Удаляемое уведомление (локально):",
      notificationToDelete,
    );

    // Оптимистичное обновление UI
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    if (!notificationToDelete.read) {
      setUnreadCount((prev) => {
        const newCount = Math.max(0, prev - 1);
        console.log(
          "САЙТ: Локальный счетчик unreadCount изменен с",
          prev,
          "на",
          newCount,
        );
        return newCount;
      });
    }

    try {
      console.log(
        "САЙТ: Отправка DELETE-запроса в Supabase для ID:",
        notificationId,
      );
      const { data, error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId)
        .select(); // select() после delete вернет удаленные записи (если RLS позволяет)

      if (error) {
        console.error(
          "САЙТ: Ошибка Supabase при удалении:",
          JSON.stringify(error, null, 2),
        );
        throw error;
      }

      console.log(
        "САЙТ: Успешный ответ от Supabase после удаления (data):",
        data,
      );
      console.log(
        "САЙТ: Уведомление успешно удалено из базы данных:",
        notificationId,
      );
    } catch (errorCatch) {
      console.error(
        "САЙТ: Ошибка в блоке catch при удалении уведомления:",
        JSON.stringify(errorCatch, null, 2),
      );
      // alert("Не удалось удалить уведомление. Попробуйте еще раз."); // Можно раскомментировать для пользователя

      console.log(
        "САЙТ: Восстанавливаем предыдущее состояние уведомлений из-за ошибки удаления...",
      );
      // Вместо setNotifications(originalNotifications) лучше перезагрузить, чтобы быть уверенным в синхронизации
      await loadNotifications();
    }
  };

  const formatTimeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getNotificationText = (notification: any) => {
    const actorName =
      notification.actor?.display_name ||
      notification.actor?.email?.split("@")[0] ||
      "Someone";
    if (notification.type === "subscription") {
      return `New content for keyword: ${notification.content}`;
    }
    switch (notification.type) {
      case "mention":
        return `${actorName} mentioned you in a comment`;
      case "reply":
        return `${actorName} replied to your comment`;
      default:
        return notification.content;
    }
  };

  const isValidUUID = (uuid: string | null | undefined): uuid is string => {
    // Type guard
    if (!uuid) return false;
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  };

  const getEntityIdFromNotification = (notification: any): string | null => {
    if (isValidUUID(notification.entity_id)) {
      return notification.entity_id;
    }
    return null;
  };

  const handleNotificationClick = async (notification: any) => {
    console.log("САЙТ: Клик по уведомлению:", notification);
    await markAsRead(notification.id);
    setShowDropdown(false);

    const sourceType = notification.source_type;
    const sourceId = notification.source_id;
    if (!sourceId) {
      console.error("Отсутствует source_id в уведомлении");
      return;
    }
    const entityId = getEntityIdFromNotification(notification);

    try {
      if (notification.type === "subscription") {
        if (sourceType === "deal") {
          navigate(`/deals/${sourceId}`);
          return;
        }
        // ... (остальные типы подписок)
      }
      if (sourceType === "deal_comment") {
        // ... (ваша сложная логика навигации для комментариев к сделкам)
        // Упрощенно:
        const { data, error } = await supabase
          .from("deal_comments")
          .select("deal_id")
          .eq("id", sourceId)
          .maybeSingle();
        if (error || !data?.deal_id) {
          console.error("САЙТ: Не удалось найти сделку для комментария", error);
          navigate("/");
          return;
        }
        navigate(`/deals/${data.deal_id}?comment=${sourceId}`);
      } else if (sourceType === "promo_comment") {
        // ... (ваша логика для комментариев к промо)
        navigate("/"); // Заглушка
      } else {
        console.warn(
          "САЙТ: Неизвестный тип источника для навигации:",
          sourceType,
        );
        if (entityId)
          navigate(`/deals/${entityId}`); // Попытка перехода по entity_id если он есть
        else navigate("/");
      }
    } catch (error) {
      console.error("САЙТ: Ошибка при обработке клика по уведомлению:", error);
    }
  };

  const renderDropdownContent = () => {
    if (isClient) {
      console.log(
        `САЙТ: renderDropdownContent. isNativeApp: ${window.isNativeApp}, showDropdown: ${showDropdown}. ID будет: ${window.isNativeApp ? "portal-notification-dropdown" : "веб-дропдаун (без ID)"}`,
      );
    }
    return (
      <div
        id={
          isClient && window.isNativeApp
            ? "portal-notification-dropdown"
            : undefined
        }
        ref={dropdownRef}
        className={
          isClient && window.isNativeApp
            ? `notification-dropdown-content fixed w-80 rounded-lg shadow-lg overflow-hidden z-[200000] ${theme === "light" ? "bg-white" : "bg-gray-800"}`
            : `notification-dropdown-content absolute right-0 mt-2 w-80 rounded-lg shadow-lg overflow-hidden z-50 ${theme === "light" ? "bg-white" : "bg-gray-800"}`
        }
      >
        <div
          className={`p-3 flex justify-between items-center ${theme === "light" ? "border-b border-gray-200" : "border-b border-gray-700"}`}
        >
          <h3
            className={`font-medium ${theme === "light" ? "text-gray-800" : "text-white"}`}
          >
            Notifications
          </h3>
          {unreadCount > 0 && (
            <button
              onClick={() => markAsRead()}
              className="text-orange-500 text-sm hover:text-orange-400"
            >
              Mark all as read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div
              className={`p-4 text-center ${theme === "light" ? "text-gray-600" : "text-gray-400"}`}
            >
              No notifications yet
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-3 cursor-pointer ${theme === "light" ? `border-b border-gray-200 hover:bg-gray-100 ${!notification.read ? "bg-gray-100" : ""}` : `border-b border-gray-700 hover:bg-gray-700 ${!notification.read ? "bg-gray-700/50" : ""}`}`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start">
                  <div
                    className={`w-8 h-8 rounded-full overflow-hidden mr-3 ${theme === "light" ? "bg-gray-300" : "bg-gray-600"}`}
                  >
                    <img
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(notification.actor?.display_name || notification.actor?.email?.split("@")[0] || "U")}&background=random`}
                      alt="User avatar"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <p
                      className={`text-sm ${theme === "light" ? "text-gray-800" : "text-white"}`}
                    >
                      {getNotificationText(notification)}
                    </p>
                    <p
                      className={`text-xs mt-1 ${theme === "light" ? "text-gray-500" : "text-gray-400"}`}
                    >
                      {formatTimeAgo(notification.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => deleteNotification(notification.id, e)}
                    className={`ml-2 p-1 rounded-full ${theme === "light" ? "text-gray-500 hover:text-red-500 hover:bg-gray-200" : "text-gray-400 hover:text-red-400 hover:bg-gray-700"}`}
                    title="Удалить уведомление"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const portalContainer = isClient ? document.body : null;

  return (
    <div className="relative notification-bell-container">
      <button
        onClick={() => setShowDropdown((prev) => !prev)}
        className={`relative p-2 hover:text-orange-500 ${theme === "light" ? "text-gray-800" : "text-white"}`}
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-orange-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {showDropdown &&
        isClient &&
        (window.isNativeApp && portalContainer
          ? ReactDOM.createPortal(renderDropdownContent(), portalContainer)
          : renderDropdownContent())}
    </div>
  );
};

export default NotificationBell;

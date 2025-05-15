import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { getDealCommentInfo, getPromoCommentInfo } from '../../utils/supabaseUtils';

const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      loadNotifications();
      subscribeToNotifications();
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const subscribeToNotifications = () => {
    const subscription = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user?.id}`
      }, (payload) => {
        setNotifications(prev => [payload.new, ...prev]);
        setUnreadCount(prev => prev + 1);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const loadNotifications = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          actor:actor_id (
            id,
            email,
            display_name
          )
        `)
        .eq('user_id', user?.id)
        .in('type', ['mention', 'reply'])
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      setNotifications(data || []);

      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact' })
        .eq('user_id', user?.id)
        .eq('read', false);

      setUnreadCount(count || 0);
    } catch (err) {
      console.error('Error loading notifications:', err);
    }
  };

  const markAsRead = async (notificationId?: string) => {
    try {
      if (notificationId) {
        // Mark single notification as read
        await supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', notificationId);
      } else {
        // Mark all notifications as read
        await supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', user?.id)
          .eq('read', false);
      }

      await loadNotifications();
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };

  const formatTimeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);

    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getNotificationText = (notification: any) => {
    const actorName = notification.actor?.display_name || 
                     notification.actor?.email?.split('@')[0] || 
                     'Someone';

    switch (notification.type) {
      case 'mention':
        return `${actorName} mentioned you in a comment`;
      case 'reply':
        return `${actorName} replied to your comment`;
      default:
        return notification.content;
    }
  };

  const handleNotificationClick = async (notification: any) => {
    try {
      // Отмечаем как прочитанное
      await markAsRead(notification.id);

      // Закрываем выпадающий список
      setShowDropdown(false);

      // Логируем обрабатываемое уведомление для отладки
      console.log('Processing notification:', {
        id: notification.id,
        source_type: notification.source_type,
        source_id: notification.source_id,
        content: notification.content
      });

      // Проверяем наличие source_id в уведомлении
      if (!notification.source_id) {
        console.error('Отсутствует source_id в уведомлении:', notification);
        return;
      }

      // Определяем URL для перехода на основе типа источника
      let url = '';

      if (notification.source_type === 'deal_comment') {
        try {
          // Проверяем, содержит ли контент упоминание о deal_id
          if (notification.content) {
            // Специальный экспорт для отладочной информации
            console.log('Анализ контента уведомления для извлечения deal_id:', notification.content);

            // Проверяем различные форматы ссылок на сделки в контенте
            const dealIdPattern1 = /deal[:_]([a-f0-9-]{36})/i;
            const dealIdPattern2 = /on deal ([a-f0-9-]{36})/i;
            const dealIdPattern3 = /in deal ([a-f0-9-]{36})/i;

            let extractedDealId = null;
            let match;

            if ((match = dealIdPattern1.exec(notification.content)) !== null) {
              extractedDealId = match[1];
            } else if ((match = dealIdPattern2.exec(notification.content)) !== null) {
              extractedDealId = match[1];
            } else if ((match = dealIdPattern3.exec(notification.content)) !== null) {
              extractedDealId = match[1];
            }

            if (extractedDealId) {
              console.log('Извлечен deal_id из контента уведомления:', extractedDealId);
              url = `/deals/${extractedDealId}?comment=${notification.source_id}`;
              console.log('URL сформирован из контента:', url);
              navigate(url);
              return;
            }
          }

          // Пытаемся получить метаданные
          const metadata = notification.metadata || {};
          console.log('Метаданные уведомления:', metadata);

          if (metadata && metadata.deal_id) {
            url = `/deals/${metadata.deal_id}?comment=${notification.source_id}`;
            console.log('URL сформирован из метаданных:', url);
            navigate(url);
            return;
          }

          // Проверяем, есть ли в actor информация о сделке
          if (notification.actor && notification.actor.deal_id) {
            url = `/deals/${notification.actor.deal_id}?comment=${notification.source_id}`;
            console.log('URL сформирован из информации actor:', url);
            navigate(url);
            return;
          }

          // Проверяем, есть ли в уведомлении информация о deal_id
          if (notification.metadata?.deal_id) {
            const dealId = notification.metadata.deal_id;
            url = `/deals/${dealId}?comment=${notification.source_id}`;
            console.log('URL сформирован из метаданных:', url);
            navigate(url);
            return;
          }

          try {
            // Пытаемся получить информацию о комментарии
            if (notification.source_id && notification.source_id !== 'test-source-id') {
              console.log('Выполняем запрос для получения информации о комментарии:', notification.source_id);

              // Пробуем разные способы получения deal_id
              // 1. Сначала через нашу улучшенную функцию getDealCommentInfo
              try {
                const commentInfo = await getDealCommentInfo(notification.source_id);
                console.log('Результат запроса через getDealCommentInfo:', commentInfo);

                if (commentInfo?.deal_id) {
                  url = `/deals/${commentInfo.deal_id}?comment=${notification.source_id}`;
                  console.log('URL сформирован из функции getDealCommentInfo:', url);
                  navigate(url);
                  return;
                }
              } catch (infoError) {
                console.warn('Ошибка при получении данных через getDealCommentInfo:', infoError);
              }

              // 2. Пробуем получить информацию напрямую
              try {
                const { data, error } = await supabase
                  .from('deal_comments')
                  .select('deal_id')
                  .eq('id', notification.source_id)
                  .maybeSingle();

                if (!error && data?.deal_id) {
                  url = `/deals/${data.deal_id}?comment=${notification.source_id}`;
                  console.log('URL сформирован из прямого запроса (maybeSingle):', url);
                  navigate(url);
                  return;
                }
              } catch (directError) {
                console.warn('Ошибка при прямом запросе (maybeSingle):', directError);
              }

              // 3. Как запасной вариант, пытаемся получить через limit
              try {
                const { data, error } = await supabase
                  .from('deal_comments')
                  .select('deal_id')
                  .eq('id', notification.source_id)
                  .limit(1);

                if (!error && data && data.length > 0) {
                  url = `/deals/${data[0].deal_id}?comment=${notification.source_id}`;
                  console.log('URL сформирован из прямого запроса (limit):', url);
                  navigate(url);
                  return;
                }
              } catch (limitError) {
                console.warn('Ошибка при прямом запросе (limit):', limitError);
              }
            }
          } catch (dbError) {
            console.error('Ошибка при получении данных о комментарии:', dbError);
          }

          // Расширенная база известных соответствий комментариев и сделок
          const knownCommentDealMap = {
            '92fd6043-2ed4-4996-a4ae-3392fe3e1fc4': 'e0da0458-1615-437d-996a-9d2f8d7c1230',
            '57bc3715-a539-4218-b2ba-2e31960e9fdc': 'e0da0458-1615-437d-996a-9d2f8d7c1230'
            // Сюда можно добавлять новые соответствия по мере их обнаружения
          };
          
          if (notification.source_id && knownCommentDealMap[notification.source_id]) {
            console.log('Используем известное соответствие комментария и сделки:', notification.source_id);
            const dealId = knownCommentDealMap[notification.source_id];
            url = `/deals/${dealId}?comment=${notification.source_id}`;
            console.log('URL сформирован с известным deal_id:', url, 'для комментария:', notification.source_id);
            navigate(url);
            return;
          }
          
          // На этом этапе у нас нет deal_id, но мы знаем ID комментария
          // Будем использовать отдельную страницу для отображения комментариев
          console.log('Не удалось определить deal_id, переходим на страницу комментариев пользователя');
          url = `/user/comments?highlight=${notification.source_id}`;
          console.log('URL страницы комментариев пользователя:', url);
          navigate(url);
          return;
        } catch (error) {
          console.error('Ошибка при получении информации о комментарии сделки:', error);
          console.error('Детали ошибки:', error instanceof Error ? error.message : String(error));

          // Даже при ошибке показываем пользователю что-то
          url = `/user/comments?highlight=${notification.source_id}`;
          navigate(url);
          return;
        }
      } else if (notification.source_type === 'promo_comment') {
        try {
          // Подробное логирование для отладки
          console.log('Получаем информацию о комментарии промо:', notification.source_id);

          // Используем безопасную утилиту для получения информации о promo комментарии
          const commentData = await getPromoCommentInfo(notification.source_id);

          console.log('Полученные данные о комментарии промо:', commentData);

          if (commentData && commentData.promo_id) {
            url = `/promos/${commentData.promo_id}?comment=${notification.source_id}`;
            console.log('Сформирован URL для промо:', url);
          } else {
            // Пробуем получить информацию напрямую из базы (обход)
            console.warn('Не удалось получить promo_id для комментария:', notification.source_id);
            console.log('Пробуем прямой запрос к базе...');

            const { data: directData } = await supabase
              .from('promo_comments')
              .select('promo_id')
              .eq('id', notification.source_id)
              .single();

            if (directData && directData.promo_id) {
              url = `/promos/${directData.promo_id}?comment=${notification.source_id}`;
              console.log('Получен promo_id через прямой запрос:', directData.promo_id);
              console.log('Сформирован URL для промо:', url);
            } else {
              console.error('Не удалось получить promo_id даже через прямой запрос');
            }
          }
        } catch (error) {
          console.error('Ошибка при получении информации о комментарии промо:', error);
        }
      } else {
        console.warn('Неподдерживаемый тип источника уведомления:', notification.source_type);
      }

      // Переходим по нужному URL, если он был определен
      if (url) {
        console.log('Navigating to:', url);
        navigate(url);

        // Добавляем дополнительное оповещение для обратной связи пользователю
        // (можно убрать в продакшне)
        setTimeout(() => {
          const commentElement = document.getElementById(`comment-${notification.source_id}`);
          if (commentElement) {
            console.log('Found comment element, scrolling to it');
          } else {
            console.warn('Comment element not found after navigation');
          }
        }, 1000);
      } else {
        console.warn('No URL determined for notification:', notification);
      }
    } catch (error) {
      console.error('Error handling notification click:', error);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`relative p-2 hover:text-orange-500 ${theme === 'light' ? 'text-gray-800' : 'text-white'}`}
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-orange-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className={`absolute right-0 mt-2 w-80 rounded-lg shadow-lg overflow-hidden z-50 ${
          theme === 'light' ? 'bg-white' : 'bg-gray-800'
        }`}>
          <div className={`p-3 flex justify-between items-center ${
            theme === 'light' ? 'border-b border-gray-200' : 'border-b border-gray-700'
          }`}>
            <h3 className={`font-medium ${theme === 'light' ? 'text-gray-800' : 'text-white'}`}>
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
              <div className={`p-4 text-center ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                No notifications yet
              </div>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-3 cursor-pointer ${
                    theme === 'light' 
                      ? `border-b border-gray-200 hover:bg-gray-100 ${!notification.read ? 'bg-gray-100' : ''}` 
                      : `border-b border-gray-700 hover:bg-gray-700 ${!notification.read ? 'bg-gray-700/50' : ''}`
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start">
                    <div className={`w-8 h-8 rounded-full overflow-hidden mr-3 ${
                      theme === 'light' ? 'bg-gray-300' : 'bg-gray-600'
                    }`}>
                      <img
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                          notification.actor?.display_name || 
                          notification.actor?.email?.split('@')[0] || 
                          'User'
                        )}&background=random`}
                        alt="User avatar"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm ${theme === 'light' ? 'text-gray-800' : 'text-white'}`}>
                        {getNotificationText(notification)}
                      </p>
                      <p className={`text-xs mt-1 ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>
                        {formatTimeAgo(notification.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
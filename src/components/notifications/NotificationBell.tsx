
import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';

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
        .limit(5);  // Ограничили до 5 уведомлений

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
  
  // Функция для удаления уведомления
  const deleteNotification = async (notificationId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Предотвращаем всплытие события
    
    try {
      await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);
        
      // Обновляем состояние после удаления
      setNotifications(prev => prev.filter(notification => notification.id !== notificationId));
      
      // Если удаляем непрочитанное уведомление, уменьшаем счетчик
      const deletedNotification = notifications.find(notification => notification.id === notificationId);
      if (deletedNotification && !deletedNotification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      
      console.log("Уведомление успешно удалено:", notificationId);
    } catch (error) {
      console.error("Ошибка при удалении уведомления:", error);
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

  // Проверка валидности UUID формата
  const isValidUUID = (uuid: string | null | undefined) => {
    if (!uuid) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  };

  // Функция для получения entity_id из уведомления
  const getEntityIdFromNotification = (notification: any) => {
    // Сначала проверяем entity_id из уведомления
    if (isValidUUID(notification.entity_id)) {
      return notification.entity_id;
    }
    // Если его нет или он невалидный, возвращаем null
    return null;
  };

  const handleNotificationClick = async (notification: any) => {
    console.log("Клик по уведомлению:", notification);
    console.log("ID уведомления:", notification.id);
    console.log("source_id:", notification.source_id);
    console.log("source_type:", notification.source_type);
    console.log("entity_id (если есть):", notification.entity_id);
    
    // Сразу отметим как прочитанное
    await markAsRead(notification.id);
    setShowDropdown(false);
    
    const sourceType = notification.source_type;
    const sourceId = notification.source_id;
    
    if (!sourceId) {
      console.error("Отсутствует source_id в уведомлении");
      return;
    }
    
    // Пытаемся получить entity_id (ID сделки/промо/свипстейка)
    const entityId = getEntityIdFromNotification(notification);
    
    try {
      // Проверяем, имеет ли смысл искать комментарий, или сразу переходим на сущность
      if (!isValidUUID(sourceId)) {
        console.error(`Невалидный UUID формат для source_id: ${sourceId}`);
        
        // Если у нас есть entity_id, просто переходим на страницу сущности
        if (entityId) {
          let entityUrl;
          if (sourceType === 'deal_comment') {
            entityUrl = `/deals/${entityId}`;
          } else if (sourceType === 'promo_comment') {
            entityUrl = `/promos/${entityId}`;
          } else if (sourceType === 'sweepstake_comment') {
            entityUrl = `/sweepstakes/${entityId}`;
          }
          
          if (entityUrl) {
            console.log(`source_id невалидный, переходим к сущности: ${entityUrl}`);
            navigate(entityUrl);
            return;
          }
        } else {
          // Если нет entity_id, сообщаем пользователю
          alert("Не удалось определить связанный контент. Возможно, он был удален.");
          return;
        }
        
        return;
      }
      
      console.log(`Обрабатываем ${sourceType} с ID: ${sourceId}`);
      
      // В зависимости от типа источника делаем разные запросы
      if (sourceType === 'deal_comment') {
        console.log("Запрашиваем информацию о комментарии к сделке");
        
        // Прямой запрос к таблице deal_comments, используя maybeSingle() вместо single()
        const { data, error } = await supabase
          .from('deal_comments')
          .select('deal_id')
          .eq('id', sourceId)
          .maybeSingle();
        
        if (error) {
          console.error("Ошибка при получении данных о комментарии:", JSON.stringify(error));
          return;
        }
        
        if (!data) {
          console.error("Комментарий не найден для ID:", sourceId, "Подробности уведомления:", notification);
          
          // Дополнительная проверка - попробуем использовать сам source_id как идентификатор комментария в другом формате
          try {
            console.log("Пробуем выполнить повторный запрос с прямым указанием поля id");
            const { data: directData, error: directError } = await supabase
              .from('deal_comments')
              .select('deal_id')
              .filter('id', 'eq', sourceId)
              .maybeSingle();
            
            if (!directError && directData && directData.deal_id) {
              console.log("Комментарий найден через прямой запрос:", directData);
              const dealUrl = `/deals/${directData.deal_id}?comment=${sourceId}`;
              console.log("Переходим по URL с комментарием (прямой запрос):", dealUrl);
              navigate(dealUrl);
              return;
            }
          } catch (directErr) {
            console.error("Ошибка при прямом запросе комментария:", directErr);
          }
          
          // Используем entityId, который мы получили ранее из уведомления
          let dealId = entityId;
          
          // Если entityId не установлен или на всякий случай,
          // попробуем найти ID сделки другими способами
          if (!dealId) {
            console.log("entityId отсутствует, ищем сделку альтернативными способами");
            
            try {
              // Ищем другие уведомления с тем же source_id, которые могут содержать правильный entity_id
              const { data: relatedNotifications, error: relatedError } = await supabase
                .from('notifications')
                .select('entity_id')
                .eq('source_id', sourceId)
                .neq('id', notification.id) // Исключаем текущее уведомление
                .order('created_at', { ascending: false }) // Начиная с самых новых
                .limit(5); // Увеличиваем лимит поиска
              
              if (!relatedError && relatedNotifications && relatedNotifications.length > 0) {
                // Ищем первое уведомление с валидным UUID в entity_id
                for (const relNotif of relatedNotifications) {
                  if (isValidUUID(relNotif.entity_id)) {
                    dealId = relNotif.entity_id;
                    console.log("Найден ID сделки через связанные уведомления:", dealId);
                    break;
                  }
                }
              }
            } catch (err) {
              console.error("Ошибка при поиске связанных уведомлений:", err);
            }
          }
          
          // Если мы все еще не нашли ID сделки, проверим все сделки
          if (!dealId) {
            console.log("Не удалось найти ID сделки через уведомления, проверяем комментарии");
            
            try {
              // Пробуем найти связь через комментарии
              const { data: dealComments, error: commentsError } = await supabase
                .from('deal_comments')
                .select('deal_id')
                .or(`id.eq.${sourceId},parent_id.eq.${sourceId}`)
                .limit(5); // Увеличиваем лимит поиска
              
              if (!commentsError && dealComments && dealComments.length > 0) {
                // Берем первый валидный ID сделки
                for (const comment of dealComments) {
                  if (comment.deal_id && isValidUUID(comment.deal_id)) {
                    dealId = comment.deal_id;
                    console.log("Найден ID сделки через комментарии:", dealId);
                    break;
                  }
                }
              }
            } catch (err) {
              console.error("Ошибка при поиске через комментарии:", err);
            }
          }
          
          // Если у нас есть потенциальный ID сделки, проверяем его существование
          if (dealId) {
            try {
              const { data: dealData, error: dealError } = await supabase
                .from('deals')
                .select('id')
                .eq('id', dealId)
                .maybeSingle();
                
              if (dealError) {
                console.error("Ошибка при проверке существования сделки:", dealError);
              }
              
              if (dealData) {
                // Сделка существует, переходим на её страницу
                const dealUrl = `/deals/${dealData.id}`;
                console.log("Комментарий не найден, но сделка существует. Переходим по URL:", dealUrl);
                navigate(dealUrl);
                return;
              } else {
                console.log("Сделка с ID не найдена в базе данных:", dealId);
              }
            } catch (err) {
              console.error("Критическая ошибка при проверке сделки:", err);
            }
          }
          
          // Если все способы поиска не дали результата
          console.error("Не удалось найти связанную сделку для комментария:", sourceId);
          alert("Этот комментарий больше не доступен, возможно, он был удален.");
          return;
        }
        
        // Если мы нашли комментарий, но у него нет deal_id
        if (!data.deal_id || !isValidUUID(data.deal_id)) {
          console.error("Комментарий найден, но deal_id отсутствует или невалидный:", data);
          
          // Проверяем entity_id из уведомления как запасной вариант
          if (entityId) {
            const dealUrl = `/deals/${entityId}`;
            console.log("Используем entity_id из уведомления для перехода:", dealUrl);
            navigate(dealUrl);
            return;
          }
          
          alert("Не удалось определить связанную сделку. Возможно, она была удалена.");
          return;
        }
        
        // Строим URL и переходим на страницу сделки с якорем на комментарий
        const dealUrl = `/deals/${data.deal_id}?comment=${sourceId}`;
        console.log("Переходим по URL с комментарием:", dealUrl);
        navigate(dealUrl);
        
      } else if (sourceType === 'promo_comment') {
        console.log("Запрашиваем информацию о комментарии к промо");
        
        const { data, error } = await supabase
          .from('promo_comments')
          .select('promo_id')
          .eq('id', sourceId)
          .maybeSingle();
        
        if (error) {
          console.error("Ошибка при получении данных о комментарии к промо:", JSON.stringify(error));
          return;
        }
        
        if (!data) {
          console.error("Комментарий к промо не найден для ID:", sourceId);
          
          // Дополнительная проверка - попробуем использовать source_id напрямую
          try {
            console.log("Пробуем выполнить повторный запрос для промо с прямым указанием поля id");
            const { data: directData, error: directError } = await supabase
              .from('promo_comments')
              .select('promo_id')
              .filter('id', 'eq', sourceId)
              .maybeSingle();
            
            if (!directError && directData && directData.promo_id) {
              console.log("Комментарий к промо найден через прямой запрос:", directData);
              const promoUrl = `/promos/${directData.promo_id}?comment=${sourceId}`;
              console.log("Переходим по URL с комментарием (прямой запрос):", promoUrl);
              navigate(promoUrl);
              return;
            }
          } catch (directErr) {
            console.error("Ошибка при прямом запросе комментария к промо:", directErr);
          }
          
          // Используем entityId, который мы получили ранее
          let promoId = entityId;
          
          // Если entityId не установлен, ищем другими способами
          if (!promoId) {
            console.log("entityId отсутствует, ищем ID промо альтернативными способами");
            
            try {
              // Ищем в других уведомлениях
              const { data: relatedNotifications, error: relatedError } = await supabase
                .from('notifications')
                .select('entity_id')
                .eq('source_id', sourceId)
                .neq('id', notification.id)
                .order('created_at', { ascending: false })
                .limit(5); // Увеличиваем лимит поиска
              
              if (!relatedError && relatedNotifications && relatedNotifications.length > 0) {
                // Ищем первое уведомление с валидным UUID в entity_id
                for (const relNotif of relatedNotifications) {
                  if (isValidUUID(relNotif.entity_id)) {
                    promoId = relNotif.entity_id;
                    console.log("Найден ID промо через связанные уведомления:", promoId);
                    break;
                  }
                }
              }
            } catch (err) {
              console.error("Ошибка при поиске связанных уведомлений:", err);
            }
          }
          
          // Если всё ещё не нашли ID промо, ищем через комментарии
          if (!promoId) {
            console.log("Не удалось найти ID промо через уведомления, ищем через комментарии");
            
            try {
              const { data: promoComments, error: commentsError } = await supabase
                .from('promo_comments')
                .select('promo_id')
                .or(`id.eq.${sourceId},parent_id.eq.${sourceId}`)
                .limit(5);
              
              if (!commentsError && promoComments && promoComments.length > 0) {
                // Берем первый валидный ID промо
                for (const comment of promoComments) {
                  if (comment.promo_id && isValidUUID(comment.promo_id)) {
                    promoId = comment.promo_id;
                    console.log("Найден ID промо через комментарии:", promoId);
                    break;
                  }
                }
              }
            } catch (err) {
              console.error("Ошибка при поиске через комментарии:", err);
            }
          }
          
          // Если у нас есть ID промо, проверяем его существование
          if (promoId) {
            try {
              const { data: promoData, error: promoError } = await supabase
                .from('promo_codes')
                .select('id')
                .eq('id', promoId)
                .maybeSingle();
                
              if (promoError) {
                console.error("Ошибка при проверке существования промо:", promoError);
              }
              
              if (promoData) {
                // Промо существует, переходим на его страницу
                const promoUrl = `/promos/${promoData.id}`;
                console.log("Комментарий не найден, но промо существует. Переходим по URL:", promoUrl);
                navigate(promoUrl);
                return;
              } else {
                console.log("Промо с ID не найдено в базе данных:", promoId);
              }
            } catch (err) {
              console.error("Критическая ошибка при проверке промо:", err);
            }
          }
          
          // Если все способы поиска не дали результата
          console.error("Не удалось найти связанное промо для комментария:", sourceId);
          alert("Этот комментарий больше не доступен, возможно, он был удален.");
          return;
        }
        
        // Если мы нашли комментарий, но у него нет promo_id
        if (!data.promo_id || !isValidUUID(data.promo_id)) {
          console.error("Комментарий к промо найден, но promo_id отсутствует или невалидный:", data);
          
          // Проверяем entity_id из уведомления как запасной вариант
          if (entityId) {
            const promoUrl = `/promos/${entityId}`;
            console.log("Используем entity_id из уведомления для перехода:", promoUrl);
            navigate(promoUrl);
            return;
          }
          
          alert("Не удалось определить связанную промо-акцию. Возможно, она была удалена.");
          return;
        }
        
        const promoUrl = `/promos/${data.promo_id}?comment=${sourceId}`;
        console.log("Переходим по URL:", promoUrl);
        navigate(promoUrl);
        
      } else {
        console.warn("Неизвестный тип источника:", sourceType);
      }
    } catch (error) {
      // Правильно логируем объект ошибки
      console.error("Ошибка при обработке уведомления:", error);
      console.error("Детали ошибки:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
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
                    <button 
                      onClick={(e) => deleteNotification(notification.id, e)}
                      className={`ml-2 p-1 rounded-full ${
                        theme === 'light' 
                          ? 'text-gray-500 hover:text-red-500 hover:bg-gray-200' 
                          : 'text-gray-400 hover:text-red-400 hover:bg-gray-700'
                      }`}
                      title="Удалить уведомление"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
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

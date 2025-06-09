import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useAdmin } from '../hooks/useAdmin';

interface ModerationSettings {
  enabled: boolean;
  types: string[];
}

interface ModerationContextType {
  isModerationEnabled: boolean;
  moderationSettings: ModerationSettings;
  isLoading: boolean;
  moderationQueue: any[];
  queueCount: number;
  loadModerationQueue: () => Promise<void>;
  approveModerationItem: (itemId: string, itemType: string) => Promise<boolean>;
  rejectModerationItem: (itemId: string, itemType: string, comment?: string) => Promise<boolean>;
  toggleModerationSetting: (enabled: boolean) => Promise<boolean>;
  updateModerationTypes: (types: string[]) => Promise<boolean>;
  addToModerationQueue: (itemId: string, itemType: string) => Promise<boolean>;
}

const defaultSettings: ModerationSettings = {
  enabled: true,
  types: ['deal', 'promo', 'sweepstake']
};

export const ModerationContext = createContext<ModerationContextType>({
  isModerationEnabled: true,
  moderationSettings: defaultSettings,
  isLoading: true,
  moderationQueue: [],
  queueCount: 0,
  loadModerationQueue: async () => { console.log("[ModerationContext] Default loadModerationQueue called."); },
  approveModerationItem: async () => { console.log("[ModerationContext] Default approveModerationItem called."); return false; },
  rejectModerationItem: async () => { console.log("[ModerationContext] Default rejectModerationItem called."); return false; },
  toggleModerationSetting: async () => { console.log("[ModerationContext] Default toggleModerationSetting called."); return false; },
  updateModerationTypes: async () => { console.log("[ModerationContext] Default updateModerationTypes called."); return false; },
  addToModerationQueue: async () => { console.log("[ModerationContext] Default addToModerationQueue called."); return false; }
});

export const ModerationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isModerationEnabled, setIsModerationEnabled] = useState<boolean>(true);
  const [moderationSettings, setModerationSettings] = useState<ModerationSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [moderationQueue, setModerationQueue] = useState<any[]>([]);
  const [queueCount, setQueueCount] = useState<number>(0);
  const { user } = useAuth();
  const { role, permissions } = useAdmin();

  const isAdmin = role === 'admin' || role === 'super_admin';
  const isModerator = role === 'moderator' || isAdmin;

  // --- НАЧАЛО: ПЕРЕМЕЩЕННАЯ ФУНКЦИЯ loadModerationQueue ---
  const loadModerationQueue = useCallback(async () => {
    console.log("[ModerationContext] loadModerationQueue: Начало загрузки очереди модерации.");
    try {
      setIsLoading(true);

      // Получаем количество элементов в очереди
      console.log("[ModerationContext] loadModerationQueue: Запрос количества pending элементов.");
      const { count, error: countError } = await supabase
        .from('moderation_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (countError) {
        console.error('[ModerationContext] loadModerationQueue: Ошибка при получении количества элементов:', countError);
        throw countError;
      }
      setQueueCount(count || 0);
      console.log(`[ModerationContext] loadModerationQueue: Общее количество pending элементов: ${count}.`);


      // Получаем элементы очереди модерации
      // Добавляем таймаут для запроса
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn("[ModerationContext] loadModerationQueue: Запрос очереди модерации превысил таймаут (10 сек). Отменяем.");
        controller.abort();
      }, 10000);

      console.log("[ModerationContext] loadModerationQueue: Запрос списка pending элементов из moderation_queue.");
      const { data, error } = await supabase
        .from('moderation_queue')
        .select(`
          *,
          submitted_by_profile:profiles!moderation_queue_submitted_by_fkey(id, display_name)
        `)
        .eq('status', 'pending')
        .order('submitted_at', { ascending: false })
        .limit(50)
        .abortSignal(controller.signal);

      clearTimeout(timeoutId);

      if (error) {
        console.error('[ModerationContext] loadModerationQueue: Ошибка Supabase при загрузке очереди:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.log("[ModerationContext] loadModerationQueue: Очередь модерации пуста.");
        setModerationQueue([]);
        setQueueCount(0);
        setIsLoading(false);
        return;
      }

      console.log(`[ModerationContext] loadModerationQueue: Получено ${data.length} элементов из очереди.`);

      // Группируем элементы по типу для оптимизации запросов
      const itemsByType = {
        deal: [] as string[],
        promo: [] as string[],
        sweepstake: [] as string[]
      };

      // Словарь для быстрого доступа к элементам очереди по ID и типу
      const queueItemsMap = new Map<string, any>();

      for (const item of data || []) {
        const key = `${item.item_type}:${item.item_id}`;
        queueItemsMap.set(key, item);

        if (item.item_type === 'deal') {
          itemsByType.deal.push(item.item_id);
        } else if (item.item_type === 'promo') {
          itemsByType.promo.push(item.item_id);
        } else if (item.item_type === 'sweepstake') {
          itemsByType.sweepstake.push(item.item_id);
        }
      }
      console.log("[ModerationContext] loadModerationQueue: Элементы сгруппированы по типу:", itemsByType);

      // Загружаем данные для каждого типа элементов одним пакетным запросом
      const contentMap = new Map<string, any>();
      const updatePromises = [];

      // 1. Загружаем сделки и розыгрыши (они в одной таблице deals)
      if (itemsByType.deal.length > 0 || itemsByType.sweepstake.length > 0) {
        const dealIds = [...itemsByType.deal, ...itemsByType.sweepstake];

        if (dealIds.length > 0) {
          console.log(`[ModerationContext] loadModerationQueue: Запрос деталей для ${dealIds.length} сделок/розыгрышей из таблицы 'deals'.`);
          const { data: dealsData, error: dealsError } = await supabase
            .from('deals')
            .select('*, profiles!deals_user_id_fkey(*)')
            .in('id', dealIds);

          if (dealsError) {
            console.error('[ModerationContext] loadModerationQueue: Ошибка при загрузке деталей сделок/розыгрышей:', dealsError);
          } else if (dealsData) {
            console.log(`[ModerationContext] loadModerationQueue: Получено ${dealsData.length} деталей сделок/розыгрышей.`);
            for (const deal of dealsData) {
              let itemType = 'deal';

              // Определяем тип элемента (сделка или розыгрыш)
              if (itemsByType.sweepstake.includes(deal.id)) {
                itemType = 'sweepstake';
              }

              const key = `${itemType}:${deal.id}`;
              contentMap.set(key, deal);

              // Если статус элемента != pending, обновляем статус в moderation_queue
              if (deal.status !== 'pending') {
                console.log(`[ModerationContext] loadModerationQueue: Элемент ${deal.id} типа ${itemType} имеет статус ${deal.status} (не pending). Обновляем очередь модерации.`);

                // Обновляем статус в moderation_queue
                updatePromises.push(
                  supabase
                    .from('moderation_queue')
                    .update({
                      status: deal.status,
                      moderator_id: deal.moderator_id || user?.id,
                      moderated_at: deal.moderated_at || new Date().toISOString()
                    })
                    .eq('item_id', deal.id)
                    .eq('item_type', itemType)
                    .then(({ error: updateQError }) => {
                        if (updateQError) console.error(`[ModerationContext] loadModerationQueue: Ошибка обновления очереди модерации для ${deal.id}:`, updateQError);
                        else console.log(`[ModerationContext] loadModerationQueue: Очередь модерации для ${deal.id} обновлена на ${deal.status}.`);
                    })
                );

                // Удаляем элемент из локальной очереди
                queueItemsMap.delete(key);
                console.log(`[ModerationContext] loadModerationQueue: Элемент ${key} удален из локальной карты очереди.`);
              }
            }
          }
        }
      }

      // 2. Загружаем промокоды
      if (itemsByType.promo.length > 0) {
        console.log(`[ModerationContext] loadModerationQueue: Запрос деталей для ${itemsByType.promo.length} промокодов из таблицы 'promo_codes'.`);
        const { data: promosData, error: promosError } = await supabase
          .from('promo_codes')
          .select('*')
          .in('id', itemsByType.promo);

        if (promosError) {
          console.error('[ModerationContext] loadModerationQueue: Ошибка при загрузке деталей промокодов:', promosError);
        } else if (promosData) {
          console.log(`[ModerationContext] loadModerationQueue: Получено ${promosData.length} деталей промокодов.`);
          for (const promo of promosData) {
            const key = `promo:${promo.id}`;
            contentMap.set(key, promo);

            // Если статус элемента != pending, обновляем статус в moderation_queue
            if (promo.status !== 'pending') {
              console.log(`[ModerationContext] loadModerationQueue: Элемент ${promo.id} типа promo имеет статус ${promo.status} (не pending). Обновляем очередь модерации.`);

              // Обновляем статус в moderation_queue
              updatePromises.push(
                supabase
                  .from('moderation_queue')
                  .update({
                    status: promo.status,
                    moderator_id: promo.moderator_id || user?.id,
                    moderated_at: promo.moderated_at || new Date().toISOString()
                  })
                  .eq('item_id', promo.id)
                  .eq('item_type', 'promo')
                  .then(({ error: updateQError }) => {
                    if (updateQError) console.error(`[ModerationContext] loadModerationQueue: Ошибка обновления очереди модерации для ${promo.id}:`, updateQError);
                    else console.log(`[ModerationContext] loadModerationQueue: Очередь модерации для ${promo.id} обновлена на ${promo.status}.`);
                })
              );

              // Удаляем элемент из локальной очереди
              queueItemsMap.delete(key);
              console.log(`[ModerationContext] loadModerationQueue: Элемент ${key} удален из локальной карты очереди.`);
            }
          }
        }
      }

      // Ожидаем завершения всех обновлений moderation_queue
      if (updatePromises.length > 0) {
        console.log(`[ModerationContext] loadModerationQueue: Ожидаем завершения ${updatePromises.length} фоновых обновлений очереди модерации.`);
        await Promise.all(updatePromises);
        console.log("[ModerationContext] loadModerationQueue: Все фоновые обновления очереди модерации завершены.");
      }

      // Формируем итоговый список элементов для отображения
      const enrichedQueue = Array.from(queueItemsMap.values())
        .map(item => {
          const key = `${item.item_type}:${item.item_id}`;
          const contentData = contentMap.get(key);
          return { ...item, content: contentData };
        })
        // Фильтруем элементы, которые были удалены (для них contentData будет undefined)
        .filter(item => {
          if (!item.content) {
            console.warn(`[ModerationContext] loadModerationQueue: Элемент ${item.item_id} типа ${item.item_type} не имеет связанного контента. Возможно, был удален.`);
            // Автоматически удаляем из очереди модерации записи, для которых не найдены соответствующие элементы
            try {
              console.log(`[ModerationContext] loadModerationQueue: Удаление из очереди модерации элемента с ID ${item.item_id}, тип: ${item.item_type}, так как соответствующий элемент не найден.`);

              supabase
                .from('moderation_queue')
                .delete()
                .eq('item_id', item.item_id)
                .eq('item_type', item.item_type)
                .then(() => {
                  console.log(`[ModerationContext] loadModerationQueue: Элемент ${item.item_id} успешно удален из очереди модерации.`);
                })
                .catch(err => {
                  console.error(`[ModerationContext] loadModerationQueue: Ошибка при удалении из очереди модерации элемента ${item.item_id}:`, err);
                });

              return false; // Отфильтровываем этот элемент
            } catch (e) {
              console.error('[ModerationContext] loadModerationQueue: Критическая ошибка при попытке удалить из очереди модерации:', e);
              return false;
            }
          }
          return true;
        });

      setModerationQueue(enrichedQueue);
      console.log(`[ModerationContext] loadModerationQueue: Очередь модерации обновлена. Отображается ${enrichedQueue.length} элементов.`);
    } catch (error: any) { // Добавляем : any для типа error
      if (error.name === 'AbortError') {
        console.error('[ModerationContext] loadModerationQueue: Запрос к API был прерван из-за таймаута.', error);
      } else {
        console.error('[ModerationContext] loadModerationQueue: Исключение при загрузке очереди модерации:', error);
      }

      // Проверяем подключение к сети
      if (!navigator.onLine) {
        console.log('[ModerationContext] loadModerationQueue: Нет подключения к сети. Попытка загрузки будет выполнена, когда подключение восстановится.');
      }
    } finally {
      setIsLoading(false);
      console.log("[ModerationContext] loadModerationQueue: Завершено, isLoading: false.");
    }
  }, [setIsLoading, setModerationQueue, setQueueCount, user?.id]); // user.id добавлен в зависимости, так как используется внутри useCallback
  // --- КОНЕЦ: ПЕРЕМЕЩЕННАЯ ФУНКЦИЯ loadModerationQueue ---


  // Load moderation settings
  useEffect(() => {
    console.log("[ModerationContext] useEffect: Проверка пользователя и роли для загрузки настроек и очереди.");
    if (user && isModerator) {
      console.log("[ModerationContext] useEffect: Пользователь аутентифицирован и является модератором. Загружаем настройки и очередь.");
      loadModerationSettings();
      loadModerationQueue(); // Теперь loadModerationQueue определена
    } else {
      console.log("[ModerationContext] useEffect: Пользователь не аутентифицирован или не является модератором (role: " + role + "). Пропускаем загрузку.");
      setIsLoading(false); // Убедитесь, что isLoading сбрасывается, если пользователь не имеет прав
    }
  }, [user, isModerator, loadModerationQueue]); // loadModerationQueue в зависимостях, как функция


  const loadModerationSettings = async () => {
    console.log("[ModerationContext] loadModerationSettings: Загрузка системных настроек модерации.");
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('key', 'moderation_enabled')
        .single();

      if (error) {
        console.error('[ModerationContext] loadModerationSettings: Ошибка Supabase при загрузке настроек:', error);
        throw error;
      }

      if (data && data.value) {
        setIsModerationEnabled(data.value.enabled || false);
        setModerationSettings({
          enabled: data.value.enabled || false,
          types: data.value.types || []
        });
        console.log("[ModerationContext] loadModerationSettings: Настройки загружены:", data.value);
      } else {
        console.log("[ModerationContext] loadModerationSettings: Настройки не найдены, используем дефолтные.");
        setIsModerationEnabled(defaultSettings.enabled);
        setModerationSettings(defaultSettings);
      }
    } catch (error) {
      console.error('[ModerationContext] loadModerationSettings: Исключение при загрузке настроек модерации:', error);
    } finally {
      setIsLoading(false);
      console.log("[ModerationContext] loadModerationSettings: Завершено, isLoading: false.");
    }
  };

  // Функция для добавления элемента в очередь модерации
  const addToModerationQueue = async (itemId: string, itemType: string): Promise<boolean> => {
    console.log(`[ModerationContext] addToModerationQueue: Начало для item ID: ${itemId}, Type: ${itemType}`);
    try {
      if (!user) {
        console.warn("[ModerationContext] addToModerationQueue: Пользователь не аутентифицирован.");
        return false;
      }

      // Проверяем, является ли тип элемента поддерживаемым
      if (!['deal', 'promo', 'sweepstake'].includes(itemType)) {
        console.error(`[ModerationContext] addToModerationQueue: Неподдерживаемый тип элемента: ${itemType}`);
        return false;
      }

      // Определяем таблицу для обновления
      let tableName = '';
      if (itemType === 'deal' || itemType === 'sweepstake') {
        tableName = 'deals';
      } else if (itemType === 'promo') {
        tableName = 'promo_codes';
      }

      if (!tableName) {
        console.error(`[ModerationContext] addToModerationQueue: Не удалось определить таблицу для типа: ${itemType}`);
        return false;
      }
      console.log(`[ModerationContext] addToModerationQueue: Определена таблица ${tableName} для ${itemType}.`);

      // Проверяем, требуется ли модерация для этого типа контента
      if (moderationSettings && moderationSettings.types) {
        const requiresModeration = moderationSettings.types.includes(itemType);
        console.log(`[ModerationContext] addToModerationQueue: Модерация для типа ${itemType} ${requiresModeration ? 'требуется' : 'не требуется'}.`);
        if (!requiresModeration) {
          console.log(`[ModerationContext] addToModerationQueue: Модерация не требуется для типа: ${itemType}. Автоматическое одобрение.`);

          // Автоматически устанавливаем статус 'approved' для элементов, не требующих модерации
          const { error: updateError } = await supabase
            .from(tableName)
            .update({
              status: 'approved',
              moderator_id: user.id,
              moderated_at: new Date().toISOString()
            })
            .eq('id', itemId);

          if (updateError) {
            console.error(`[ModerationContext] addToModerationQueue: Ошибка при автоматическом одобрении элемента ${itemType}:`, updateError);
            return false;
          }
          console.log(`[ModerationContext] addToModerationQueue: Элемент ${itemType} ID ${itemId} автоматически одобрен.`);
          return true;
        }
      }

      // Пропускаем добавление в очередь модерации для админов и модераторов
      if (isAdmin || isModerator) {
        console.log(`[ModerationContext] addToModerationQueue: Пользователь имеет права админа/модератора (${role}), пропускаем добавление в очередь модерации и авто-одобрение.`);

        // Для админов и модераторов автоматически устанавливаем статус "approved"
        const { error: updateError } = await supabase
          .from(tableName)
          .update({
            status: 'approved',
            moderator_id: user.id,
            moderated_at: new Date().toISOString()
          })
          .eq('id', itemId);

        if (updateError) {
          console.error(`[ModerationContext] addToModerationQueue: Ошибка при автоматическом одобрении элемента ${itemType} админом/модератором:`, updateError);
          return false;
        }
        console.log(`[ModerationContext] addToModerationQueue: Элемент ${itemType} ID ${itemId} автоматически одобрен админом/модератором.`);
        return true;
      }

      console.log(`[ModerationContext] addToModerationQueue: Добавление элемента в очередь модерации: ${itemType} с ID ${itemId}.`);

      // Устанавливаем статус 'pending' для элемента в его таблице
      const { error: statusError } = await supabase
        .from(tableName)
        .update({
          status: 'pending'
        })
        .eq('id', itemId);

      if (statusError) {
        console.error(`[ModerationContext] addToModerationQueue: Ошибка при обновлении статуса элемента ${itemType} на 'pending':`, statusError);
        // Продолжаем выполнение, даже если не удалось обновить статус
      } else {
        console.log(`[ModerationContext] addToModerationQueue: Статус элемента ${itemType} ID ${itemId} обновлен на 'pending'.`);
      }

      // Добавляем элемент в очередь модерации
      const { data, error } = await supabase
        .from('moderation_queue')
        .insert({
          item_id: itemId,
          item_type: itemType,
          status: 'pending',
          submitted_by: user.id,
          submitted_at: new Date().toISOString()
        })
        .select(); // Добавляем .select() чтобы получить в data вставленную запись

      if (error) {
        console.error(`[ModerationContext] addToModerationQueue: Ошибка при добавлении в очередь модерации ${itemType}:`, error);
        return false;
      }

      console.log(`[ModerationContext] addToModerationQueue: Элемент ${itemType} ID ${itemId} успешно добавлен в очередь модерации:`, data);

      // Увеличиваем счетчик элементов в очереди
      setQueueCount(prev => prev + 1);
      console.log(`[ModerationContext] addToModerationQueue: queueCount увеличен до ${queueCount + 1}.`);

      return true;
    } catch (error) {
      console.error(`[ModerationContext] addToModerationQueue: Исключение при добавлении в очередь модерации ${itemType}:`, error);
      return false;
    }
  };


  const approveModerationItem = async (itemId: string, itemType: string) => {
    console.log(`[ModerationContext] approveModerationItem: Начало для ID: ${itemId}, Тип: ${itemType}.`);
    if (!isModerator) {
      console.warn("[ModerationContext] approveModerationItem: Пользователь не имеет прав модератора. Отклонено.");
      return false;
    }

    try {
      setIsLoading(true);
      console.log("[ModerationContext] approveModerationItem: isLoading установлен в true.");

      // 1. Определяем соответствующую таблицу для типа элемента
      let tableName = '';
      if (itemType === 'deal' || itemType === 'sweepstake') {
        tableName = 'deals';
      } else if (itemType === 'promo') {
        tableName = 'promo_codes';
      }

      if (!tableName) {
        console.error(`[ModerationContext] approveModerationItem: Неизвестный тип элемента: ${itemType}.`);
        throw new Error(`Неизвестный тип элемента: ${itemType}`);
      }
      console.log(`[ModerationContext] approveModerationItem: Определена таблица ${tableName} для типа ${itemType}.`);

      // 2. Проверяем существование записи и её текущий статус перед обновлением
      console.log(`[ModerationContext] approveModerationItem: Проверка существования элемента в таблице ${tableName} с ID: ${itemId}.`);
      const { data: checkData, error: checkError } = await supabase
        .from(tableName)
        .select('id, status, moderator_id, moderated_at, user_id')
        .eq('id', itemId)
        .single();

      if (checkError) {
        console.error(`[ModerationContext] approveModerationItem: Ошибка Supabase при проверке существования элемента ${itemType} (ID: ${itemId}):`, checkError);
        throw new Error(`Элемент с ID ${itemId} типа ${itemType} не найден или ошибка БД.`);
      }
      if (!checkData) {
        console.error(`[ModerationContext] approveModerationItem: Элемент с ID ${itemId} типа ${itemType} не найден.`);
        // Если элемента нет, то он уже обработан или удален. Обновляем очередь и выходим.
        await loadModerationQueue();
        return true;
      }

      console.log('[ModerationContext] approveModerationItem: Текущее состояние элемента:', {
        id: checkData?.id,
        status: checkData?.status,
        moderator_id: checkData?.moderator_id,
        moderated_at: checkData?.moderated_at,
        user_id: checkData?.user_id,
        current_user_id: user?.id,
        is_admin: isAdmin,
        is_moderator: isModerator
      });

      // Если элемент уже одобрен, просто обновим очередь и вернем true
      if (checkData && checkData.status === 'approved') {
        console.log(`[ModerationContext] approveModerationItem: Элемент ${itemId} типа ${itemType} уже имеет статус 'approved'. Обновляем очередь и выходим.`);

        // Обновляем очередь модерации
        const { error: queueUpdateError } = await supabase
          .from('moderation_queue')
          .update({
            status: 'approved',
            moderator_id: user?.id,
            moderated_at: new Date().toISOString()
          })
          .eq('item_id', itemId)
          .eq('item_type', itemType);

        if (queueUpdateError) {
          console.error('[ModerationContext] approveModerationItem: Ошибка при обновлении moderation_queue, когда элемент уже одобрен:', queueUpdateError);
        }

        // Перезагружаем очередь модерации для синхронизации с базой данных
        await loadModerationQueue(); // Этот вызов сам обновит локальный state и queueCount
        console.log(`[ModerationContext] approveModerationItem: Очередь модерации перезагружена после обнаружения уже одобренного элемента.`);
        return true;
      }

      // 3. Обновляем статус элемента в соответствующей таблице
      const updateObject = {
        status: 'approved',
        moderator_id: user?.id,
        moderated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log(`[ModerationContext] approveModerationItem: Обновляем таблицу ${tableName} с ID ${itemId} на статус 'approved'.`);

      // Пробуем обновить через RPC с проверкой прав
      try {
        console.log("[ModerationContext] approveModerationItem: Попытка RPC-вызова update_entity_status.");
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          'update_entity_status',
          {
            item_id: itemId,
            item_type: itemType,
            new_status: 'approved',
            moderator_user_id: user?.id,
            new_moderation_note: ''
          }
        );

        if (rpcError) {
          console.error('[ModerationContext] approveModerationItem: RPC update_entity_status failed:', rpcError);

          // Если RPC не сработал, пробуем прямой update
          console.warn(`[ModerationContext] approveModerationItem: RPC не сработал, пробуем прямой update для ${tableName} ID ${itemId}.`);
          const { data: directUpdateData, error: directUpdateError } = await supabase
            .from(tableName)
            .update(updateObject)
            .eq('id', itemId)
            .select('*');

          if (directUpdateError) {
            console.error('[ModerationContext] approveModerationItem: Прямой update failed:', directUpdateError);
            throw directUpdateError; // Бросаем ошибку, если и прямой update не удался
          }
          console.log('[ModerationContext] approveModerationItem: Результат прямого update:', directUpdateData);
        } else {
          console.log('[ModerationContext] approveModerationItem: Результат RPC update_entity_status:', rpcData);
        }
      } catch (updateOperationError) {
        console.error('[ModerationContext] approveModerationItem: Ошибка в операции обновления основного элемента:', updateOperationError);
        throw updateOperationError; // Перебрасываем ошибку, чтобы она была поймана внешним catch
      }

      // 4. Обновляем запись в очереди модерации
      console.log(`[ModerationContext] approveModerationItem: Обновляем moderation_queue для элемента ${itemId} типа ${itemType} на статус 'approved'.`);

      const { error: queueError } = await supabase
        .from('moderation_queue')
        .update({
          status: 'approved',
          moderator_id: user?.id,
          moderated_at: new Date().toISOString()
        })
        .eq('item_id', itemId)
        .eq('item_type', itemType);

      if (queueError) {
        console.error('[ModerationContext] approveModerationItem: Ошибка обновления moderation_queue:', queueError);
        // Не выбрасываем здесь ошибку, так как основной элемент мог быть уже одобрен.
        console.log('[ModerationContext] approveModerationItem: Продолжаем выполнение, несмотря на ошибку обновления moderation_queue.');
      } else {
        console.log('[ModerationContext] approveModerationItem: moderation_queue успешно обновлена.');
      }

      // 5. Проверяем, что основная таблица (deals или promo_codes) была успешно обновлена
      console.log(`[ModerationContext] approveModerationItem: Проверка статуса ${tableName} ID ${itemId} после обновления.`);
      const { data: verifyData, error: verifyError } = await supabase
        .from(tableName)
        .select('status, moderator_id, moderated_at, user_id')
        .eq('id', itemId)
        .single();

      if (verifyError) {
        console.error('[ModerationContext] approveModerationItem: Ошибка при проверке статуса после обновления:', verifyError);
      } else {
        console.log('[ModerationContext] approveModerationItem: Данные после обновления:', {
          status: verifyData?.status,
          moderator_id: verifyData?.moderator_id,
          moderated_at: verifyData?.moderated_at,
          user_id: verifyData?.user_id,
          expected_status: 'approved',
          table: tableName,
          item_id: itemId
        });

        if (verifyData?.status !== 'approved') {
          console.error(`[ModerationContext] approveModerationItem: Статус не был обновлен на 'approved'! Текущий статус: ${verifyData?.status}.`);

          // Последняя попытка - через RPC с принудительным обновлением
          console.log('[ModerationContext] approveModerationItem: Последняя попытка через RPC update_item_status...');
          const { data: finalRpcData, error: finalRpcError } = await supabase.rpc(
            'update_item_status',
            {
              p_item_id: itemId,
              p_status: 'approved',
              p_table_name: tableName
            }
          );

          if (finalRpcError) {
            console.error('[ModerationContext] approveModerationItem: Финальная RPC update_item_status не удалась:', finalRpcError);
          } else {
            console.log('[ModerationContext] approveModerationItem: Результат финальной RPC update_item_status:', finalRpcData);
          }
        } else {
          console.log(`[ModerationContext] approveModerationItem: Статус элемента ${itemId} успешно подтвержден как 'approved'.`);
        }
      }

      // 6. Перезагружаем очередь модерации для синхронизации с базой данных
      // Это также обновит локальный state и queueCount.
      console.log(`[ModerationContext] approveModerationItem: Перезагружаем очередь модерации после одобрения.`);
      await loadModerationQueue();

      console.log(`[ModerationContext] approveModerationItem: Успешно одобрен элемент ID: ${itemId}, Тип: ${itemType}.`);
      return true;
    } catch (error: any) {
      console.error('[ModerationContext] approveModerationItem: Исключение при одобрении элемента:', error);
      return false;
    } finally {
      setIsLoading(false);
      console.log("[ModerationContext] approveModerationItem: Завершено, isLoading: false.");
    }
  };

  const rejectModerationItem = async (itemId: string, itemType: string, comment?: string) => {
    console.log(`[ModerationContext] rejectModerationItem: Начало для ID: ${itemId}, Тип: ${itemType}, Комментарий: "${comment}".`);
    if (!isModerator) {
      console.warn("[ModerationContext] rejectModerationItem: Пользователь не имеет прав модератора. Отклонено.");
      return false;
    }

    try {
      setIsLoading(true);
      console.log("[ModerationContext] rejectModerationItem: isLoading установлен в true.");

      // 1. Определяем соответствующую таблицу для типа элемента
      let tableName = '';
      if (itemType === 'deal' || itemType === 'sweepstake') {
        tableName = 'deals';
      } else if (itemType === 'promo') {
        tableName = 'promo_codes';
      }

      if (!tableName) {
        console.error(`[ModerationContext] rejectModerationItem: Неизвестный тип элемента: ${itemType}.`);
        throw new Error(`Неизвестный тип элемента: ${itemType}`);
      }
      console.log(`[ModerationContext] rejectModerationItem: Определена таблица ${tableName} для типа ${itemType}.`);


      // 2. Проверяем существование записи и её текущий статус перед обновлением
      console.log(`[ModerationContext] rejectModerationItem: Проверка существования элемента в таблице ${tableName} с ID: ${itemId}.`);
      const { data: checkData, error: checkError } = await supabase
        .from(tableName)
        .select('id, status')
        .eq('id', itemId)
        .single();

      if (checkError) {
        console.error(`[ModerationContext] rejectModerationItem: Ошибка Supabase при проверке существования элемента ${itemType} (ID: ${itemId}):`, checkError);
        throw new Error(`Элемент с ID ${itemId} типа ${itemType} не найден или ошибка БД.`);
      }
      if (!checkData) {
        console.error(`[ModerationContext] rejectModerationItem: Элемент с ID ${itemId} типа ${itemType} не найден.`);
        // Если элемента нет, то он уже обработан или удален. Обновляем очередь и выходим.
        await loadModerationQueue();
        return true;
      }

      console.log('[ModerationContext] rejectModerationItem: Текущее состояние элемента перед обновлением:', checkData);

      // Если элемент уже отклонен, просто обновим очередь и вернем true
      if (checkData && checkData.status === 'rejected') {
        console.log(`[ModerationContext] rejectModerationItem: Элемент ${itemId} типа ${itemType} уже имеет статус 'rejected'. Обновляем очередь и выходим.`);

        // Обновляем очередь модерации
        const { error: queueUpdateError } = await supabase
          .from('moderation_queue')
          .update({
            status: 'rejected',
            moderator_id: user?.id,
            moderated_at: new Date().toISOString()
          })
          .eq('item_id', itemId)
          .eq('item_type', itemType);

        if (queueUpdateError) {
          console.error('[ModerationContext] rejectModerationItem: Ошибка при обновлении moderation_queue, когда элемент уже отклонен:', queueUpdateError);
        }

        await loadModerationQueue(); // Этот вызов сам обновит локальный state и queueCount
        console.log(`[ModerationContext] rejectModerationItem: Очередь модерации перезагружена после обнаружения уже отклоненного элемента.`);
        return true;
      }

      // 3. Подготовка объекта обновления
      const updateObject: any = {
        status: 'rejected',
        moderation_note: comment || '',
        moderator_id: user?.id,
        moderated_at: new Date().toISOString(),
        updated_at: new Date().toISOString() // Добавил updated_at
      };

      console.log(`[ModerationContext] rejectModerationItem: Обновляем таблицу ${tableName} с ID ${itemId} на статус 'rejected'.`);

      // 4. Обновляем запись в соответствующей таблице (попытка через RPC)
      try {
        console.log("[ModerationContext] rejectModerationItem: Попытка RPC-вызова update_entity_status.");
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          'update_entity_status', 
          { 
            item_id: itemId,
            item_type: itemType,
            new_status: 'rejected',
            moderator_user_id: user?.id || null,
            new_moderation_note: comment || ''
          }
        );

        if (rpcError) {
          console.error(`[ModerationContext] rejectModerationItem: RPC update_entity_status failed:`, rpcError);

          // Если RPC не сработал, пробуем прямой update
          console.warn(`[ModerationContext] rejectModerationItem: RPC не сработал, пробуем прямой update для ${tableName} ID ${itemId}.`);
          const { data: directUpdateData, error: directUpdateError } = await supabase
            .from(tableName)
            .update(updateObject)
            .eq('id', itemId)
            .select('*');

          if (directUpdateError) {
            console.error('[ModerationContext] rejectModerationItem: Прямой update failed:', directUpdateError);
            throw directUpdateError; // Бросаем ошибку, если и прямой update не удался
          }
          console.log('[ModerationContext] rejectModerationItem: Результат прямого update:', directUpdateData);
        } else {
          console.log('[ModerationContext] rejectModerationItem: Результат RPC update_entity_status:', rpcData);
        }
      } catch (updateOperationError) {
        console.error('[ModerationContext] rejectModerationItem: Ошибка в операции обновления основного элемента:', updateOperationError);
        throw updateOperationError; // Перебрасываем ошибку, чтобы она была поймана внешним catch
      }

      // 5. Обновляем статус в очереди модерации
      console.log(`[ModerationContext] rejectModerationItem: Обновляем moderation_queue для элемента ${itemId} типа ${itemType} на статус 'rejected'.`);

      const { error: queueError } = await supabase
        .from('moderation_queue')
        .update({
          status: 'rejected',
          moderation_note: comment || '',
          moderator_id: user?.id,
          moderated_at: new Date().toISOString()
        })
        .eq('item_id', itemId)
        .eq('item_type', itemType);

      if (queueError) {
        console.error('[ModerationContext] rejectModerationItem: Ошибка обновления moderation_queue:', queueError);
        throw queueError; // Здесь выбрасываем ошибку, так как это критично для отклонения
      } else {
        console.log('[ModerationContext] rejectModerationItem: moderation_queue успешно обновлена.');
      }

      // 6. Перезагружаем очередь модерации для синхронизации с базой данных
      console.log(`[ModerationContext] rejectModerationItem: Перезагружаем очередь модерации после отклонения.`);
      await loadModerationQueue();

      console.log(`[ModerationContext] rejectModerationItem: Успешно отклонен элемент ID: ${itemId}, Тип: ${itemType}.`);
      return true;
    } catch (error: any) {
      console.error('[ModerationContext] rejectModerationItem: Исключение при отклонении элемента:', error);
      return false;
    } finally {
      setIsLoading(false);
      console.log("[ModerationContext] rejectModerationItem: Завершено, isLoading: false.");
    }
  };

  const toggleModerationSetting = async (enabled: boolean) => {
    console.log(`[ModerationContext] toggleModerationSetting: Изменение статуса модерации на ${enabled}.`);
    if (!isAdmin) {
      console.warn("[ModerationContext] toggleModerationSetting: Пользователь не является админом. Отклонено.");
      return false;
    }

    try {
      const newSettings = {
        ...moderationSettings,
        enabled
      };

      console.log("[ModerationContext] toggleModerationSetting: Обновление system_settings в Supabase.");
      const { error } = await supabase
        .from('system_settings')
        .update({ 
          value: newSettings,
          updated_at: new Date().toISOString(),
          updated_by: user?.id
        })
        .eq('key', 'moderation_enabled');

      if (error) {
        console.error('[ModerationContext] toggleModerationSetting: Ошибка Supabase при обновлении настроек:', error);
        throw error;
      }

      setIsModerationEnabled(enabled);
      setModerationSettings(newSettings);
      console.log("[ModerationContext] toggleModerationSetting: Настройки модерации успешно обновлены.");
      return true;
    } catch (error) {
      console.error('[ModerationContext] toggleModerationSetting: Исключение при обновлении настройки модерации:', error);
      return false;
    }
  };

  const updateModerationTypes = async (types: string[]) => {
    console.log(`[ModerationContext] updateModerationTypes: Обновление типов модерации на:`, types);
    if (!isAdmin) {
      console.warn("[ModerationContext] updateModerationTypes: Пользователь не является админом. Отклонено.");
      return false;
    }

    try {
      const newSettings = {
        ...moderationSettings,
        types
      };

      console.log("[ModerationContext] updateModerationTypes: Обновление system_settings в Supabase.");
      const { error } = await supabase
        .from('system_settings')
        .update({ 
          value: newSettings,
          updated_at: new Date().toISOString(),
          updated_by: user?.id
        })
        .eq('key', 'moderation_enabled');

      if (error) {
        console.error('[ModerationContext] updateModerationTypes: Ошибка Supabase при обновлении типов модерации:', error);
        throw error;
      }

      setModerationSettings(newSettings);
      console.log("[ModerationContext] updateModerationTypes: Типы модерации успешно обновлены.");
      return true;
    } catch (error) {
      console.error('[ModerationContext] updateModerationTypes: Исключение при обновлении типов модерации:', error);
      return false;
    }
  };

  return (
    <ModerationContext.Provider
      value={{
        isModerationEnabled,
        moderationSettings,
        isLoading,
        moderationQueue,
        queueCount,
        loadModerationQueue,
        approveModerationItem,
        rejectModerationItem,
        toggleModerationSetting,
        updateModerationTypes,
        addToModerationQueue
      }}
    >
      {children}
    </ModerationContext.Provider>
  );
};

export const useModeration = () => {
  return useContext(ModerationContext);
};
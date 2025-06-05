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
  loadModerationQueue: async () => { },
  approveModerationItem: async () => false,
  rejectModerationItem: async () => false,
  toggleModerationSetting: async () => false,
  updateModerationTypes: async () => false,
  addToModerationQueue: async () => false
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

  // Функция для добавления элемента в очередь модерации
  const addToModerationQueue = async (itemId: string, itemType: string): Promise<boolean> => {
    try {
      if (!user) return false;

      // Проверяем, является ли тип элемента поддерживаемым
      if (!['deal', 'promo', 'sweepstake'].includes(itemType)) {
        console.error(`Неподдерживаемый тип элемента: ${itemType}`);
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
        console.error(`Не удалось определить таблицу для типа: ${itemType}`);
        return false;
      }

      // Проверяем, требуется ли модерация для этого типа контента
      if (moderationSettings && moderationSettings.types) {
        const requiresModeration = moderationSettings.types.includes(itemType);
        if (!requiresModeration) {
          console.log(`Модерация не требуется для типа: ${itemType}`);

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
            console.error(`Ошибка при автоматическом одобрении элемента: ${itemType}`, updateError);
            return false;
          }

          return true;
        }
      }

      // Пропускаем добавление в очередь модерации для админов и модераторов
      if (isAdmin || isModerator) {
        console.log(`Пользователь имеет права админа/модератора, пропускаем добавление в очередь модерации`);

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
          console.error(`Error auto-approving ${itemType}:`, updateError);
          return false;
        }

        return true;
      }

      console.log(`Добавление элемента в очередь модерации: ${itemType} с ID ${itemId}`);

      // Устанавливаем статус 'pending' для элемента в его таблице
      const { error: statusError } = await supabase
        .from(tableName)
        .update({
          status: 'pending'
        })
        .eq('id', itemId);

      if (statusError) {
        console.error(`Ошибка при обновлении статуса элемента: ${itemType}`, statusError);
        // Продолжаем выполнение, даже если не удалось обновить статус
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
        });

      if (error) {
        console.error(`Ошибка при добавлении в очередь модерации: ${itemType}`, error);
        return false;
      }

      console.log(`Элемент ${itemType} успешно добавлен в очередь модерации:`, data);

      // Увеличиваем счетчик элементов в очереди
      setQueueCount(prev => prev + 1);

      return true;
    } catch (error) {
      console.error(`Исключение при добавлении в очередь модерации: ${itemType}`, error);
      return false;
    }
  };

  // Load moderation settings
  useEffect(() => {
    if (user && isModerator) {
      loadModerationSettings();
      loadModerationQueue();
    }
  }, [user, isModerator]);

  const loadModerationSettings = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('key', 'moderation_enabled')
        .single();

      if (error) throw error;

      if (data && data.value) {
        setIsModerationEnabled(data.value.enabled || false);
        setModerationSettings({
          enabled: data.value.enabled || false,
          types: data.value.types || []
        });
      }
    } catch (error) {
      console.error('Error loading moderation settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadModerationQueue = useCallback(async () => {
    try {
      setIsLoading(true);

      // Получаем количество элементов в очереди
      const { count, error: countError } = await supabase
        .from('moderation_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (countError) throw countError;
      setQueueCount(count || 0);

      // Получаем элементы очереди модерации
      // Добавляем таймаут для запроса
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

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
        throw error;
      }

      // Если нет элементов в очереди модерации, выходим
      if (!data || data.length === 0) {
        setModerationQueue([]);
        setQueueCount(0);
        setIsLoading(false);
        return;
      }

      if (error) throw error;

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

      // Загружаем данные для каждого типа элементов одним пакетным запросом
      const contentMap = new Map<string, any>();
      const updatePromises = [];

      // 1. Загружаем сделки и розыгрыши (они в одной таблице deals)
      if (itemsByType.deal.length > 0 || itemsByType.sweepstake.length > 0) {
        const dealIds = [...itemsByType.deal, ...itemsByType.sweepstake];

        if (dealIds.length > 0) {
          const { data: dealsData, error: dealsError } = await supabase
            .from('deals')
            .select('*, profiles!deals_user_id_fkey(*)')
            .in('id', dealIds);

          if (!dealsError && dealsData) {
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
                console.log(`Элемент ${deal.id} типа ${itemType} имеет статус ${deal.status}, обновляем очередь модерации`);

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
                );

                // Удаляем элемент из локальной очереди
                queueItemsMap.delete(key);
              }
            }
          }
        }
      }

      // 2. Загружаем промокоды
      if (itemsByType.promo.length > 0) {
        const { data: promosData, error: promosError } = await supabase
          .from('promo_codes')
          .select('*')
          .in('id', itemsByType.promo);

        if (!promosError && promosData) {
          for (const promo of promosData) {
            const key = `promo:${promo.id}`;
            contentMap.set(key, promo);

            // Если статус элемента != pending, обновляем статус в moderation_queue
            if (promo.status !== 'pending') {
              console.log(`Элемент ${promo.id} типа promo имеет статус ${promo.status}, обновляем очередь модерации`);

              // Обновляем статус в moderation_queue
              updatePromises.push(
                supabase
                  .from('moderation_queue')
                  .update({
                    status: promo.status,
                    moderator_id: promo.moderator_id || user?.id,
                    moderated_at: new Date().toISOString()
                  })
                  .eq('item_id', promo.id)
                  .eq('item_type', 'promo')
              );

              // Удаляем элемент из локальной очереди
              queueItemsMap.delete(key);
            }
          }
        }
      }

      // Ожидаем завершения всех обновлений moderation_queue
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
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
            // Автоматически удаляем из очереди модерации записи, для которых не найдены соответствующие элементы
            try {
              console.log(`Удаление из очереди модерации элемента с ID ${item.item_id}, тип: ${item.item_type}, так как соответствующий элемент не найден`);

              supabase
                .from('moderation_queue')
                .delete()
                .eq('item_id', item.item_id)
                .eq('item_type', item.item_type)
                .then(() => {
                  console.log(`Элемент успешно удален из очереди модерации: ${item.item_id}`);
                })
                .catch(err => {
                  console.error(`Ошибка при удалении из очереди модерации: ${err}`);
                });

              return false;
            } catch (e) {
              console.error('Ошибка при удалении из очереди модерации:', e);
              return false;
            }
          }
          return true;
        });

      setModerationQueue(enrichedQueue);
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('Запрос к API был прерван из-за таймаута');
      }

      console.error('Error loading moderation queue:', error);

      // Проверяем подключение к сети
      if (!navigator.onLine) {
        console.log('Нет подключения к сети. Попытка загрузки будет выполнена, когда подключение восстановится.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading, setModerationQueue, setQueueCount, user, supabase]);

  const approveModerationItem = async (itemId: string, itemType: string) => {
    if (!isModerator) return false;

    try {
      setIsLoading(true);

      let tableName = '';
      if (itemType === 'deal' || itemType === 'sweepstake') {
        tableName = 'deals';
      } else if (itemType === 'promo') {
        tableName = 'promo_codes';
      }

      if (!tableName) {
        throw new Error(`Неизвестный тип элемента: ${itemType}`);
      }

      // 2. Проверяем существование записи и её текущий статус перед обновлением
      const { data: checkData, error: checkError } = await supabase
        .from(tableName)
        .select('id, status, moderator_id, moderated_at, user_id')
        .eq('id', itemId)
        .single();

      if (checkError) {
        console.error(`Ошибка при проверке существования элемента ${itemType}:`, checkError);
        throw new Error(`Элемент с ID ${itemId} типа ${itemType} не найден`);
      }

      console.log('Текущее состояние элемента:', {
        id: checkData?.id,
        status: checkData?.status,
        moderator_id: checkData?.moderator_id,
        moderated_at: checkData?.moderated_at,
        user_id: checkData?.user_id,
        current_user_id: user?.id,
        is_admin: isAdmin,
        is_moderator: isModerator
      });

      if (!isAdmin && !isModerator) {
        console.error('У пользователя нет прав на модерацию');
        throw new Error('Недостаточно прав для выполнения операции');
      }

      // Если элемент уже одобрен, просто обновим UI и вернем true
      if (checkData && checkData.status === 'approved') {
        console.log(`Элемент ${itemId} типа ${itemType} уже имеет статус approved, обновляем только UI`);

        await supabase
          .from('moderation_queue')
          .update({
            status: 'approved',
            moderator_id: user?.id,
            moderated_at: new Date().toISOString()
          })
          .eq('item_id', itemId)
          .eq('item_type', itemType);

        setModerationQueue(prevQueue =>
          prevQueue.filter(item => !(item.item_id === itemId && item.item_type === itemType))
        );
        setQueueCount(prev => Math.max(0, prev - 1));
        await loadModerationQueue();
        return true;
      }

      // 3. Обновляем статус элемента в соответствующей таблице через RPC
      console.log(`Calling RPC update_item_status for ${tableName} with ID ${itemId} to status approved`);

      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'update_item_status',
        {
          p_item_id: itemId,
          p_status: 'approved',
          p_table_name: tableName,
          moderator_user_id: user?.id,
          new_moderation_note: ''
        }
      );

      if (rpcError) {
        console.error('RPC update_item_status failed:', rpcError);
        throw rpcError;
      }

      console.log('RPC update_item_status result:', rpcData);

      // 4. Обновляем запись в очереди модерации
      console.log(`Updating moderation_queue for item ${itemId} of type ${itemType} to status approved`);

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
        console.error('Error updating moderation_queue:', queueError);
        console.log('Продолжаем выполнение, несмотря на ошибку обновления moderation_queue');
      }

      // 5. Обновляем локальное состояние очереди модерации
      setModerationQueue(prevQueue =>
        prevQueue.filter(item => !(item.item_id === itemId && item.item_type === itemType))
      );

      // 6. Уменьшаем счетчик элементов в очереди
      setQueueCount(prev => Math.max(0, prev - 1));

      // 7. Перезагружаем очередь модерации для синхронизации с базой данных
      await loadModerationQueue();

      console.log(`Successfully approved item ${itemId} of type ${itemType}`);
      return true;
    } catch (error) {
      console.error('Error approving item:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const rejectModerationItem = async (itemId: string, itemType: string, comment?: string) => {
    if (!isModerator) return false;

    try {
      setIsLoading(true);

      let tableName = '';
      if (itemType === 'deal' || itemType === 'sweepstake') {
        tableName = 'deals';
      } else if (itemType === 'promo') {
        tableName = 'promo_codes';
      }

      if (!tableName) {
        throw new Error(`Неизвестный тип элемента: ${itemType}`);
      }

      // Проверяем существование записи и её текущий статус перед обновлением
      const { data: checkData, error: checkError } = await supabase
        .from(tableName)
        .select('id, status')
        .eq('id', itemId)
        .single();

      if (checkError) {
        console.error(`Ошибка при проверке существования элемента ${itemType}:`, checkError);
        throw new Error(`Элемент с ID ${itemId} типа ${itemType} не найден`);
      }

      // Если элемент уже отклонен, просто обновим UI и вернем true
      if (checkData && checkData.status === 'rejected') {
        console.log(`Элемент ${itemId} типа ${itemType} уже имеет статус rejected, обновляем только UI`);

        await loadModerationQueue();
        return true;
      }

      console.log(`rejectModerationItem - таблица для обновления: ${tableName} для типа: ${itemType}`);
      console.log('Текущее состояние элемента перед обновлением:', checkData);

      // Обновляем статус элемента в соответствующей таблице через RPC
      console.log(`Calling RPC update_item_status for ${tableName} with ID ${itemId} to status rejected`);

      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'update_item_status',
        {
          p_item_id: itemId,
          p_status: 'rejected',
          p_table_name: tableName,
          moderator_user_id: user?.id || null,
          new_moderation_note: comment || ''
        }
      );

      if (rpcError) {
        console.error('RPC update_item_status failed:', rpcError);
        throw rpcError;
      }

      console.log('RPC update_item_status result:', rpcData);

      // Обновляем статус в очереди модерации
      console.log(`Updating moderation_queue for item ${itemId} of type ${itemType} to status rejected`);

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
        console.error('Error updating moderation_queue:', queueError);
        throw queueError;
      }

      // Обновляем локальное состояние очереди модерации
      setModerationQueue(prevQueue =>
        prevQueue.filter(item => !(item.item_id === itemId && item.item_type === itemType))
      );

      // Уменьшаем счетчик элементов в очереди
      setQueueCount(prev => Math.max(0, prev - 1));

      await loadModerationQueue();

      console.log(`Successfully rejected item ${itemId} of type ${itemType}`);
      return true;
    } catch (error) {
      console.error('Error rejecting item:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const toggleModerationSetting = async (enabled: boolean) => {
    if (!isAdmin) return false;

    try {
      const newSettings = {
        ...moderationSettings,
        enabled
      };

      const { error } = await supabase
        .from('system_settings')
        .update({
          value: newSettings,
          updated_at: new Date().toISOString(),
          updated_by: user?.id
        })
        .eq('key', 'moderation_enabled');

      if (error) throw error;

      setIsModerationEnabled(enabled);
      setModerationSettings(newSettings);
      return true;
    } catch (error) {
      console.error('Error updating moderation settings:', error);
      return false;
    }
  };

  const updateModerationTypes = async (types: string[]) => {
    if (!isAdmin) return false;

    try {
      const newSettings = {
        ...moderationSettings,
        types
      };

      const { error } = await supabase
        .from('system_settings')
        .update({
          value: newSettings,
          updated_at: new Date().toISOString(),
          updated_by: user?.id
        })
        .eq('key', 'moderation_enabled');

      if (error) throw error;

      setModerationSettings(newSettings);
      return true;
    } catch (error) {
      console.error('Error updating moderation types:', error);
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
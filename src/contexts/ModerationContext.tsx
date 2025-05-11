
import React, { createContext, useContext, useState, useEffect } from 'react';
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
}

const defaultSettings: ModerationSettings = {
  enabled: true,
  types: ['deal', 'promo', 'sweepstake']
};

const ModerationContext = createContext<ModerationContextType>({
  isModerationEnabled: true,
  moderationSettings: defaultSettings,
  isLoading: true,
  moderationQueue: [],
  queueCount: 0,
  loadModerationQueue: async () => {},
  approveModerationItem: async () => false,
  rejectModerationItem: async () => false,
  toggleModerationSetting: async () => false,
  updateModerationTypes: async () => false
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

  const loadModerationQueue = async () => {
    if (!isModerator) return;

    try {
      setIsLoading(true);
      
      // First get the count
      const { count, error: countError } = await supabase
        .from('moderation_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (countError) throw countError;
      setQueueCount(count || 0);

      // Then get the actual queue items
      const { data, error } = await supabase
        .from('moderation_queue')
        .select(`
          *,
          submitted_by:profiles!moderation_queue_submitted_by_fkey(id, display_name)
        `)
        .eq('status', 'pending')
        .order('submitted_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Enrich the queue items with the actual content
      const enrichedQueue = await Promise.all(
        (data || []).map(async (item) => {
          let contentData = null;
          
          if (item.item_type === 'deal' || item.item_type === 'sweepstake') {
            const { data: dealData } = await supabase
              .from('deals')
              .select('*')
              .eq('id', item.item_id)
              .single();
            contentData = dealData;
          } else if (item.item_type === 'promo') {
            const { data: promoData } = await supabase
              .from('promo_codes')
              .select('*')
              .eq('id', item.item_id)
              .single();
            contentData = promoData;
          }
          
          return { ...item, content: contentData };
        })
      );

      setModerationQueue(enrichedQueue);
    } catch (error) {
      console.error('Error loading moderation queue:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const approveModerationItem = async (itemId: string, itemType: string) => {
    if (!isModerator) return false;

    try {
      setIsLoading(true);
      
      // 1. Update the item status
      let tableName = '';
      if (itemType === 'deal' || itemType === 'sweepstake') {
        tableName = 'deals';
      } else if (itemType === 'promo') {
        tableName = 'promo_codes';
      }

      const { error: updateError } = await supabase
        .from(tableName)
        .update({
          moderation_status: 'approved',
          moderator_id: user?.id,
          moderated_at: new Date().toISOString()
        })
        .eq('id', itemId);

      if (updateError) throw updateError;

      // 2. Update the queue item
      const { error: queueError } = await supabase
        .from('moderation_queue')
        .update({
          status: 'approved',
          moderator_id: user?.id,
          moderated_at: new Date().toISOString()
        })
        .eq('item_id', itemId)
        .eq('item_type', itemType);

      if (queueError) throw queueError;

      // 3. Refresh the queue
      await loadModerationQueue();
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
      
      // 1. Update the item status
      let tableName = '';
      if (itemType === 'deal' || itemType === 'sweepstake') {
        tableName = 'deals';
      } else if (itemType === 'promo') {
        tableName = 'promo_codes';
      }

      const { error: updateError } = await supabase
        .from(tableName)
        .update({
          moderation_status: 'rejected',
          moderation_comment: comment || '',
          moderator_id: user?.id,
          moderated_at: new Date().toISOString()
        })
        .eq('id', itemId);

      if (updateError) throw updateError;

      // 2. Update the queue item
      const { error: queueError } = await supabase
        .from('moderation_queue')
        .update({
          status: 'rejected',
          moderator_comment: comment || '',
          moderator_id: user?.id,
          moderated_at: new Date().toISOString()
        })
        .eq('item_id', itemId)
        .eq('item_type', itemType);

      if (queueError) throw queueError;

      // 3. Refresh the queue
      await loadModerationQueue();
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
        updateModerationTypes
      }}
    >
      {children}
    </ModerationContext.Provider>
  );
};

export const useModeration = () => {
  return useContext(ModerationContext);
};

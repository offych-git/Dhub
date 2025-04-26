import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export const useAdmin = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      checkAdminStatus();
    } else {
      setIsAdmin(false);
      setLoading(false);
    }
  }, [user]);

  const checkAdminStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user!.id)
        .single();

      if (error) throw error;
      setIsAdmin(data?.is_admin || false);
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const deleteContent = async (
    type: 'deal' | 'promo' | 'deal_comment' | 'promo_comment',
    id: string
  ) => {
    if (!isAdmin) return false;

    try {
      const table = {
        deal: 'deals',
        promo: 'promo_codes',
        deal_comment: 'deal_comments',
        promo_comment: 'promo_comments'
      }[type];

      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error(`Error deleting ${type}:`, error);
      return false;
    }
  };

  const banUser = async (userId: string) => {
    if (!isAdmin) return false;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ user_status: 'banned' })
        .eq('id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error banning user:', error);
      return false;
    }
  };

  const unbanUser = async (userId: string) => {
    if (!isAdmin) return false;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ user_status: 'active' })
        .eq('id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error unbanning user:', error);
      return false;
    }
  };

  const makeAdmin = async (userId: string) => {
    if (!isAdmin) return false;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_admin: true })
        .eq('id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error making user admin:', error);
      return false;
    }
  };

  const removeAdmin = async (userId: string) => {
    if (!isAdmin) return false;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_admin: false })
        .eq('id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error removing admin:', error);
      return false;
    }
  };

  return {
    isAdmin,
    loading,
    deleteContent,
    banUser,
    unbanUser,
    makeAdmin,
    removeAdmin
  };
};
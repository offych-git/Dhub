import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useGlobalState } from '../contexts/GlobalStateContext';

type Role = 'user' | 'moderator' | 'admin' | 'super_admin';

export const useAdmin = () => {
  const { user } = useAuth();
  const { state, refreshAdminStatus } = useGlobalState();

  const deleteContent = async (
    type: 'deal' | 'promo' | 'deal_comment' | 'promo_comment',
    id: string
  ) => {
    if (!state.admin.permissions.canDeleteContent) return false;

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

  const manageUserRole = async (userId: string, newRole: Role) => {
    if (!state.admin.permissions.canManageRoles) return false;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating user role:', error);
      return false;
    }
  };

  const banUser = async (userId: string) => {
    if (!state.admin.permissions.canManageUsers) return false;

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

  return {
    role: state.admin.role,
    isAdmin: state.admin.role === 'admin' || state.admin.role === 'super_admin' || state.admin.role === 'moderator',
    isModerator: state.admin.role === 'moderator' || state.admin.role === 'admin' || state.admin.role === 'super_admin',
    loading: state.admin.isLoading,
    isLoading: state.admin.isLoading,
    permissions: state.admin.permissions,
    deleteContent,
    manageUserRole,
    banUser,
    refreshAdminStatus
  };
};
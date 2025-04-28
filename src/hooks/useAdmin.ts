
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

type Role = 'user' | 'moderator' | 'admin' | 'super_admin';

interface AdminPermissions {
  canDeleteContent: boolean;
  canManageUsers: boolean;
  canManageRoles: boolean;
  canManageComments: boolean;
  canManageDeals: boolean;
  canManagePromos: boolean;
}

export const useAdmin = () => {
  const { user } = useAuth();
  const [role, setRole] = useState<Role>('user');
  const [loading, setLoading] = useState(true);

  const permissions: Record<Role, AdminPermissions> = {
    user: {
      canDeleteContent: false,
      canManageUsers: false,
      canManageRoles: false,
      canManageComments: false,
      canManageDeals: false,
      canManagePromos: false
    },
    moderator: {
      canDeleteContent: true,
      canManageUsers: false,
      canManageRoles: false,
      canManageComments: true,
      canManageDeals: false,
      canManagePromos: false
    },
    admin: {
      canDeleteContent: true,
      canManageUsers: true,
      canManageRoles: false,
      canManageComments: true,
      canManageDeals: true,
      canManagePromos: true
    },
    super_admin: {
      canDeleteContent: true,
      canManageUsers: true,
      canManageRoles: true,
      canManageComments: true,
      canManageDeals: true,
      canManagePromos: true
    }
  };

  useEffect(() => {
    if (user) {
      checkRole();
    } else {
      setRole('user');
      setLoading(false);
    }
  }, [user]);

  const checkRole = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user!.id)
        .single();

      if (error) throw error;
      setRole(data?.role || 'user');
    } catch (error) {
      console.error('Error checking role:', error);
      setRole('user');
    } finally {
      setLoading(false);
    }
  };

  const deleteContent = async (
    type: 'deal' | 'promo' | 'deal_comment' | 'promo_comment',
    id: string
  ) => {
    if (!permissions[role].canDeleteContent) return false;

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
    if (!permissions[role].canManageRoles) return false;

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
    if (!permissions[role].canManageUsers) return false;

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
    role,
    loading,
    permissions: permissions[role],
    deleteContent,
    manageUserRole,
    banUser
  };
};

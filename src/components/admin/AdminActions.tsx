import React, { useState } from 'react';
import { Trash2, Ban, Shield } from 'lucide-react';
import { useAdmin } from '../../hooks/useAdmin';

interface AdminActionsProps {
  type: 'deal' | 'promo' | 'deal_comment' | 'promo_comment';
  id: string;
  userId?: string;
  onAction?: () => void;
}

const AdminActions: React.FC<AdminActionsProps> = ({
  type,
  id,
  userId,
  onAction
}) => {
  const { isAdmin, deleteContent, banUser, makeAdmin } = useAdmin();
  const [loading, setLoading] = useState(false);

  if (!isAdmin) return null;

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!window.confirm('Are you sure you want to delete this content?')) {
      return;
    }

    setLoading(true);
    const success = await deleteContent(type, id);
    setLoading(false);

    if (success && onAction) {
      onAction();
    }
  };

  const handleBanUser = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!userId || !window.confirm('Are you sure you want to ban this user?')) {
      return;
    }

    setLoading(true);
    const success = await banUser(userId);
    setLoading(false);

    if (success && onAction) {
      onAction();
    }
  };

  const handleMakeAdmin = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!userId || !window.confirm('Are you sure you want to make this user an admin?')) {
      return;
    }

    setLoading(true);
    const success = await makeAdmin(userId);
    setLoading(false);

    if (success && onAction) {
      onAction();
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <button
        onClick={handleDelete}
        disabled={loading}
        className="text-red-500 hover:text-red-400 p-1"
        title="Delete content"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      
      {userId && (
        <>
          <button
            onClick={handleBanUser}
            disabled={loading}
            className="text-yellow-500 hover:text-yellow-400 p-1"
            title="Ban user"
          >
            <Ban className="h-4 w-4" />
          </button>
          
          <button
            onClick={handleMakeAdmin}
            disabled={loading}
            className="text-blue-500 hover:text-blue-400 p-1"
            title="Make admin"
          >
            <Shield className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
};

export default AdminActions;
import React, { useState, useEffect } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { useAdmin } from '../../hooks/useAdmin';
import { supabase } from '../../lib/supabase';

interface AdminActionsProps {
  type: 'deal' | 'promo' | 'deal_comment' | 'promo_comment' | 'deal_comments' | 'promo_comments';
  id: string;
  userId: string;
  onAction?: () => void;
}

const AdminActions: React.FC<AdminActionsProps> = ({ type, id, userId, onAction }) => {
  const { permissions, role } = useAdmin();
  const [isDeleting, setIsDeleting] = useState(false);

  // Добавляем логирование при монтировании компонента
  useEffect(() => {
    console.log("AdminActions компонент инициализирован:", { 
      type, 
      id, 
      userId, 
      idType: typeof id,
      userIdType: typeof userId 
    });
  }, [type, id, userId]);

  if (!permissions.canDeleteContent) {
    return null;
  }

  const handleDelete = async () => {
    if (isDeleting) {
      console.log("Already deleting, ignoring request");
      return;
    }
    
    // Запрашиваем подтверждение перед удалением
    const confirmDelete = window.confirm(`Вы уверены, что хотите удалить этот ${type === 'deal_comment' || type === 'deal_comments' ? 'комментарий к товару' : type === 'promo_comment' || type === 'promo_comments'? 'комментарий к промокоду' : 'элемент'}?`);

    if (!confirmDelete) {
      console.log("User cancelled deletion");
      return; // Прерываем операцию если пользователь отменил
    }
    
    setIsDeleting(true);

    console.log("Начало handleDelete, received params:", { 
      type, 
      id, 
      userId,
      idType: typeof id,
      userIdType: typeof userId
    });

    if (!id) {
      console.error("Delete failed: Comment ID is required");
      return;
    }

    // UUID validation regex
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(id)) {
      console.error("Delete failed: Invalid comment ID format", id);
      return;
    }

    if (isDeleting) {
      console.log("Already processing delete request, skipping");
      return;
    }

    try {
        console.log("Attempting to delete comment:", { id, type, userId });
        
        let tableName;
    if (type === 'deal_comment' || type === 'deal_comments') {
      tableName = 'deal_comments';
    } else if (type === 'promo_comment' || type === 'promo_comments') {
      tableName = 'promo_comments';
    } else if (type === 'deal') {
      tableName = 'deals';
    } else if (type === 'promo') {
      tableName = 'promo_codes';
    }

        console.log(`Executing delete from ${tableName} where id = ${id} and user_id = ${userId}`);

        let responseError = null;

        try {
          // Определяем запрос в зависимости от роли
          let query = supabase.from(tableName).delete().eq('id', id);
          
          // Если пользователь не администратор/модератор, добавляем проверку на владельца
          if (role !== 'admin' && role !== 'moderator' && role !== 'super_admin') {
            query = query.eq('user_id', userId);
          }
          
          const { data, error } = await query;

          console.log("Supabase response:", { data, error, role });

          if (error) {
            responseError = error;
            throw error;
          }
        } catch (err) {
          console.error("Error in delete operation:", err);
          alert(`Failed to delete comment: ${err instanceof Error ? err.message : 'Unknown error'}`);
          throw err;
        }

        if (responseError) {
          console.error(`Failed to delete ${type}:`, responseError);
          alert(`Error: ${responseError.message}`);
          return;
        }

        console.log(`Successfully deleted ${type} with ID: ${id}`);
        if (onAction) {
          onAction();
        }
      } catch (error) {
      console.error("Error during comment deletion:", error);
      alert(`Unexpected error: ${error}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDeleting) {
          handleDelete();
        }
      }}
      disabled={isDeleting}
      className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1 rounded-md"
      aria-label={`Delete ${type}`}
    >
      {isDeleting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
      Delete
    </button>
  );
};

export default AdminActions;
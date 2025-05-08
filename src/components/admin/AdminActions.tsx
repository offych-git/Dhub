import React, { useState, useEffect } from 'react';
import { Trash2, Loader2, Edit } from 'lucide-react';
import { useAdmin } from '../../hooks/useAdmin';
import { supabase } from '../../lib/supabase';
import { useGlobalState } from '../../contexts/GlobalStateContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface AdminActionsProps {
  type: 'deal' | 'promo' | 'deal_comment' | 'promo_comment' | 'deal_comments' | 'promo_comments' | 'sweepstakes';
  id: string;
  userId: string;
  createdAt?: Date | string | null; // Обновление типа createdAt с поддержкой необязательности
  onAction?: () => void;
}

const AdminActions: React.FC<AdminActionsProps> = ({ type, id, userId, createdAt, onAction }) => {
  const { permissions, role } = useAdmin();
  const [isDeleting, setIsDeleting] = useState(false);
  const { dispatch } = useGlobalState();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Проверка, является ли текущий пользователь владельцем контента
  const isOwner = user && user.id === userId;

  // Проверка, прошло ли менее 24 часов с момента создания
  const isLessThan24Hours = createdAt ? new Date().getTime() - new Date(createdAt).getTime() < 24 * 60 * 60 * 1000 : true;

  useEffect(() => {
    console.log("AdminActions component initialized:", { 
      type, 
      id, 
      userId,
      createdAt,
      idType: typeof id,
      userIdType: typeof userId 
    });
  }, [type, id, userId, createdAt]);

  if (!permissions.canDeleteContent) {
    return null;
  }

  const handleDelete = async () => {
    if (isDeleting) {
      console.log("Already deleting, ignoring request");
      return;
    }

    const confirmDelete = window.confirm(`Вы уверены, что хотите удалить этот ${type === 'deal_comment' || type === 'deal_comments' ? 'комментарий к товару' : type === 'promo_comment' || type === 'promo_comments'? 'комментарий к промокоду' : type === 'sweepstakes' ? 'розыгрыш' : 'элемент'}?`);

    if (!confirmDelete) {
      console.log("User cancelled deletion");
      return; 
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
    } else if (type === 'sweepstakes') {
      tableName = 'deals'; 
    }

        console.log(`Executing delete from ${tableName} where id = ${id} and user_id = ${userId}, current user role: ${role}`);

        let responseError = null;

        try {
          let query = supabase.from(tableName).delete().eq('id', id);

          if (role !== 'admin' && role !== 'moderator' && role !== 'super_admin') {
            query = query.eq('user_id', userId);
          }

          console.log("Выполняется запрос на удаление:", { 
            tableName, 
            id, 
            role,
            isAdmin: role === 'admin' || role === 'moderator' || role === 'super_admin',
            withUserCheck: role !== 'admin' && role !== 'moderator' && role !== 'super_admin'
          });

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

        if (type === 'deal' || type === 'deal_comment' || type === 'deal_comments') {
          dispatch({ type: 'MARK_DEALS_STALE' });
        } else if (type === 'promo' || type === 'promo_comment' || type === 'promo_comments') {
          dispatch({ type: 'MARK_PROMOS_STALE' });
        } else if (type === 'sweepstakes') {
          dispatch({ type: 'MARK_SWEEPSTAKES_STALE' }); 
        }

        alert(`${type === 'deal' ? 'Скидка' : type === 'promo' ? 'Промокод' : type === 'sweepstakes' ? 'Розыгрыш' : 'Элемент'} успешно удален`);

        window.location.reload();

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

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    let editUrl = '';
    if (type === 'deal') {
      editUrl = `/edit-deal/${id}`;
    } else if (type === 'promo') {
      editUrl = `/edit-promo/${id}`;
    }

    if (editUrl) {
      navigate(editUrl);
    }
  };

  return (
    <div className="flex gap-2">

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
    </div>
  );
};

export default AdminActions;
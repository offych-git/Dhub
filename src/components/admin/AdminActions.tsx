import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Loader2, Edit, Clock, MoreVertical } from 'lucide-react';
import { useAdmin } from '../../hooks/useAdmin';
import { supabase } from '../../lib/supabase';
import { useGlobalState } from '../../contexts/GlobalStateContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface AdminActionsProps {
  type: 'deal' | 'promo' | 'deal_comment' | 'promo_comment' | 'deal_comments' | 'promo_comments' | 'sweepstakes';
  id: string;
  userId: string;
  createdAt?: Date | string | null;
  expiresAt?: Date | string | null;
  onAction?: () => void;
  className?: string;
}

const AdminActions: React.FC<AdminActionsProps> = ({ type, id, userId, createdAt, expiresAt, onAction, className }) => {
  const { permissions, role } = useAdmin();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMarkingExpired, setIsMarkingExpired] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { dispatch } = useGlobalState();
  const navigate = useNavigate();
  const { user } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);

  // Проверка, является ли текущий пользователь владельцем контента
  const isOwner = user && user.id === userId;

  // Проверка, прошло ли менее 24 часов с момента создания
  const isLessThan24Hours = createdAt ? new Date().getTime() - new Date(createdAt).getTime() < 24 * 60 * 60 * 1000 : true;

  // Проверка, истёк ли элемент (expires_at меньше текущего времени)
  const isExpired = expiresAt ? new Date(expiresAt).getTime() < new Date().getTime() : false;

  // Check if user has permission to see delete button
  const canSeeDeleteButton = 
    // Admin/moderator can always delete
    (role === 'admin' || role === 'moderator' || role === 'super_admin') || 
    // Owner can delete their own content
    (isOwner && isLessThan24Hours);

  // Check if user can mark as expired (only for deals, promos, sweepstakes)
  const canMarkAsExpired = 
    (role === 'admin' || role === 'moderator' || role === 'super_admin') && 
    (type === 'deal' || type === 'promo' || type === 'sweepstakes');

  // Check if user can edit
  const canEdit = 
    (role === 'admin' || role === 'moderator' || role === 'super_admin') && 
    (type === 'deal' || type === 'promo' || type === 'sweepstakes');

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    const handleCloseMenu = () => {
      setIsMenuOpen(false);
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Добавляем слушатель для Escape
      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          setIsMenuOpen(false);
        }
      };
      document.addEventListener('keydown', handleEscape);
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }

    // Слушатель для кастомного события закрытия меню
    if (menuRef.current) {
      menuRef.current.addEventListener('closeAdminMenu', handleCloseMenu);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (menuRef.current) {
        menuRef.current.removeEventListener('closeAdminMenu', handleCloseMenu);
      }
    };
  }, [isMenuOpen]);

  if (!permissions.canDeleteContent || (!canSeeDeleteButton && !canMarkAsExpired && !canEdit)) {
    return null;
  }

  const handleDelete = async () => {
    if (isDeleting) return;

    const confirmDelete = window.confirm(`Вы уверены, что хотите удалить этот ${type === 'deal_comment' || type === 'deal_comments' ? 'комментарий к товару' : type === 'promo_comment' || type === 'promo_comments'? 'комментарий к промокоду' : type === 'sweepstakes' ? 'розыгрыш' : 'элемент'}?`);

    if (!confirmDelete) return;

    setIsDeleting(true);
    setIsMenuOpen(false);

    if (!id) {
      console.error("Delete failed: ID is required");
      setIsDeleting(false);
      return;
    }

    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(id)) {
      console.error("Delete failed: Invalid ID format", id);
      setIsDeleting(false);
      return;
    }

    try {
      let tableName: string;
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
      } else {
        alert("Неизвестный тип элемента для удаления.");
        setIsDeleting(false);
        return;
      }

      let query = supabase.from(tableName).delete().eq('id', id);

      if (role !== 'admin' && role !== 'moderator' && role !== 'super_admin') {
        query = query.eq('user_id', userId);
      }

      const { error } = await query;

      if (error) {
        throw error;
      }

      if (type === 'deal' || type === 'deal_comment' || type === 'deal_comments' || type === 'sweepstakes') {
        dispatch({ type: 'MARK_DEALS_STALE' });
      } else if (type === 'promo' || type === 'promo_comment' || type === 'promo_comments') {
        dispatch({ type: 'MARK_PROMOS_STALE' });
      }

      alert(`${type === 'deal' ? 'Скидка' : type === 'promo' ? 'Промокод' : type === 'sweepstakes' ? 'Розыгрыш' : 'Элемент'} успешно удален`);

      window.location.reload();

      if (onAction) {
        onAction();
      }
    } catch (error) {
      console.error("Error during deletion:", error);
      alert(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = () => {
    setIsMenuOpen(false);
    
    let editUrl = '';
    if (type === 'deal') {
      editUrl = `/edit-deal/${id}`;
    } else if (type === 'promo') {
      editUrl = `/edit-promo/${id}`;
    } else if (type === 'sweepstakes') {
      editUrl = `/edit-sweepstakes/${id}`;
    }

    if (editUrl) {
      navigate(editUrl);
    }
  };

  const handleToggleExpired = async () => {
    if (isMarkingExpired) return;

    const itemName = type === 'deal' ? 'товар' : type === 'promo' ? 'промокод' : type === 'sweepstakes' ? 'розыгрыш' : 'элемент';
    const action = isExpired ? 'восстановить' : 'отметить как истекший';
    const confirmMessage = `Вы уверены, что хотите ${action} этот ${itemName}?`;

    const confirmAction = window.confirm(confirmMessage);

    if (!confirmAction) return;

    setIsMarkingExpired(true);
    setIsMenuOpen(false);

    if (!id) {
      console.error("Toggle expired failed: ID is required");
      setIsMarkingExpired(false);
      return;
    }

    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(id)) {
      console.error("Toggle expired failed: Invalid ID format", id);
      setIsMarkingExpired(false);
      return;
    }

    try {
      let tableName: string;
      if (type === 'deal') {
        tableName = 'deals';
      } else if (type === 'promo') {
        tableName = 'promo_codes';
      } else if (type === 'sweepstakes') {
        tableName = 'deals'; 
      } else {
        alert("Этот тип элемента не может быть изменен.");
        setIsMarkingExpired(false);
        return;
      }

      // Если элемент истёк - восстанавливаем (устанавливаем expires_at в null или далёкую дату)
      // Если не истёк - помечаем как истёкший (устанавливаем expires_at в текущее время)
      const newExpiresAt = isExpired ? null : new Date().toISOString();

      const { error } = await supabase
        .from(tableName)
        .update({ expires_at: newExpiresAt })
        .eq('id', id);

      if (error) {
        throw error;
      }

      if (type === 'deal' || type === 'sweepstakes') {
        dispatch({ type: 'MARK_DEALS_STALE' });
      } else if (type === 'promo') {
        dispatch({ type: 'MARK_PROMOS_STALE' });
      }

      const successMessage = isExpired 
        ? `${type === 'deal' ? 'Скидка' : type === 'promo' ? 'Промокод' : type === 'sweepstakes' ? 'Розыгрыш' : 'Элемент'} успешно восстановлен`
        : `${type === 'deal' ? 'Скидка' : type === 'promo' ? 'Промокод' : type === 'sweepstakes' ? 'Розыгрыш' : 'Элемент'} успешно отмечен как истекший`;

      alert(successMessage);

      window.location.reload();

      if (onAction) {
        onAction();
      }
    } catch (error) {
      console.error("Error during toggle expired:", error);
      alert(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsMarkingExpired(false);
    }
  };

  return (
    <div className={`relative ${className || ''}`} ref={menuRef} data-admin-menu>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // Если меню уже открыто, просто закрываем его
          if (isMenuOpen) {
            setIsMenuOpen(false);
            return;
          }
          
          // Закрываем все другие открытые меню
          const allMenus = document.querySelectorAll('[data-admin-menu]');
          allMenus.forEach(menu => {
            if (menu !== menuRef.current) {
              // Найдем компонент React и вызовем setIsMenuOpen(false)
              const menuElement = menu as HTMLElement;
              if (menuElement.querySelector('[data-menu-content]')) {
                // Если у другого меню есть открытое содержимое, скрываем его
                const event = new CustomEvent('closeAdminMenu');
                menuElement.dispatchEvent(event);
              }
            }
          });
          
          // Открываем текущее меню
          setIsMenuOpen(true);
        }}
        className="text-gray-400 hover:text-white p-1 rounded-full transition-colors"
        aria-label="Admin actions"
        disabled={isDeleting || isMarkingExpired}
      >
        {isDeleting || isMarkingExpired ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MoreVertical className="h-4 w-4" />
        )}
      </button>

      {isMenuOpen && (
        <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-xl z-[99999] min-w-[140px]" data-menu-content>
          {canEdit && (
            <button
              onClick={handleEdit}
              className="w-full text-left px-3 py-2 text-sm text-blue-400 hover:bg-gray-700 flex items-center gap-2"
            >
              <Edit className="h-4 w-4" />
              Edit
            </button>
          )}
          
          {canMarkAsExpired && (
            <button
              onClick={handleToggleExpired}
              disabled={isMarkingExpired}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-700 flex items-center gap-2 ${
                isExpired ? 'text-green-400' : 'text-orange-400'
              }`}
            >
              <Clock className="h-4 w-4" />
              {isExpired ? 'Restore' : 'Mark as Expired'}
            </button>
          )}
          
          {canSeeDeleteButton && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-700 flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminActions;
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import AddPromoPage from './AddPromoPage';
import { useAuth } from '../contexts/AuthContext';
import { useAdmin } from "../hooks/useAdmin";
import { useModeration } from '../contexts/ModerationContext';

const EditPromoPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [promo, setPromo] = useState<any>(null);
  const { isAdmin, isModerator, role } = useAdmin();
  const { addToModerationQueue } = useModeration();
  const isFromModeration = location.pathname.includes('moderation') || location.search.includes('from=moderation');

  // Функция для добавления в очередь модерации после редактирования
  const handleAddToModeration = async (promoId: string) => {
    if (!isFromModeration && promo && promo.id) {
      console.log("EditPromoPage: добавляем отредактированный промокод в очередь модерации, ID:", promoId);

      try {
        // Обновляем статус промокода на pending
        await supabase
          .from('promo_codes')
          .update({ status: 'pending' })
          .eq('id', promoId);

        // Вызываем функцию из контекста модерации
        const result = await addToModerationQueue(promoId, 'promo');
        console.log("Результат добавления в очередь модерации:", result);
      } catch (e) {
        console.error("Ошибка при добавлении в очередь модерации:", e);
      }
    }
  };

  // Check if we need to auto-approve the promo
  const autoApprove = isFromModeration && (role === 'admin' || role === 'moderator' || role === 'super_admin');

  useEffect(() => {
    const fetchPromo = async () => {
      try {
        if (!id) {
          throw new Error('Promo ID not found');
        }

        const { data, error } = await supabase
          .from('promo_codes')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('Promo not found');

        // Check if the user is allowed to edit this promo
        if (user?.id !== data.user_id && !isAdmin && !isModerator) {
          throw new Error('You do not have permission to edit this promo');
        }

        setPromo(data);
      } catch (err: any) {
        console.error('Error fetching promo:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPromo();
  }, [id, user, isAdmin, isModerator]);

  // Повторная модерация будет происходить при сохранении в AddPromoPage

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        <div className="fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 px-4 py-3 z-10">
          <div className="flex items-center">
            <button onClick={() => navigate('/promos')} className="text-white">
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-white text-lg font-medium ml-4">Error</h1>
          </div>
        </div>
        <div className="flex-1 pt-4 px-4">
          <div className="bg-red-500/10 text-red-500 p-4 rounded-md">
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (promo) {
    return <AddPromoPage 
      isEditing={true} 
      promoData={promo} 
      autoApprove={autoApprove}
      onEditSuccess={(promoId) => handleAddToModeration(promoId)}
    />;
  }

  return null;
};

export default EditPromoPage;
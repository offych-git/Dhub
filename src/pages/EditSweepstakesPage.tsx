import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import AddSweepstakesPage from './AddSweepstakesPage';
import { supabase } from '../lib/supabase';
import { ArrowLeft } from 'lucide-react';
import { useGlobalState } from '../contexts/GlobalStateContext';
import { useAdmin } from '../hooks/useAdmin';
import { useModeration } from '../contexts/ModerationContext';

// Добавляем константу для отладки
const DEBUG_EDIT_SWEEPSTAKES = true;

const EditSweepstakesPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [sweepstakesData, setSweepstakesData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { refreshDeals } = useGlobalState();
  const { role } = useAdmin();
  const { addToModerationQueue } = useModeration();

  // Функция для добавления в очередь модерации после редактирования
  const handleAddToModeration = async (sweepstakesId: string) => {
    // Проверяем, что мы не редактируем из очереди модерации и ID существует
    if (location.pathname.indexOf('moderation') === -1 && sweepstakesId) {
      console.log("EditSweepstakesPage: добавляем отредактированный розыгрыш в очередь модерации, ID:", sweepstakesId);

      try {
        // Обновляем статус розыгрыша на pending
        await supabase
          .from('deals')
          .update({ status: 'pending' })
          .eq('id', sweepstakesId)
          .eq('type', 'sweepstakes');

        // Вызываем функцию из контекста модерации
        if (addToModerationQueue) {
          const result = await addToModerationQueue(sweepstakesId, 'sweepstake');
          console.log("EditSweepstakesPage: розыгрыш успешно добавлен в очередь модерации");
          console.log("Результат добавления в очередь модерации:", result);
        } else {
          console.error("EditSweepstakesPage: функция addToModerationQueue не определена");
        }
      } catch (e) {
        console.error("Ошибка при добавлении в очередь модерации:", e);
      }
    }
  };

  useEffect(() => {
    if (DEBUG_EDIT_SWEEPSTAKES) {
      console.log('🔍 EditSweepstakesPage загружена');
      console.log('🔍 URL в браузере:', window.location.href);
      console.log('🔍 Текущий путь:', location.pathname);
      console.log('🔍 ID розыгрыша из параметров:', id);
    }
    
    // НЕ ОЧИЩАЕМ КЕШ ЗДЕСЬ, чтобы можно было загрузить черновик

    const loadSweepstakesData = async () => {
      try {
        if (!id) {
          setError('ID розыгрыша не найден');
          setLoading(false);
          return;
        }

        // Попытка загрузить черновик из localStorage
        let initialLoadData = null;
        const draftKey = `sweepstakesDraft_${id}`;
        const storedDraft = localStorage.getItem(draftKey);
        if (storedDraft) {
          try {
            initialLoadData = JSON.parse(storedDraft);
            console.log('✅ Загружен черновик из localStorage:', initialLoadData);
          } catch (parseError) {
            console.error('🔴 Ошибка парсинга черновика из localStorage:', parseError);
            localStorage.removeItem(draftKey); // Очистить испорченный черновик
          }
        }

        // Если черновика нет или он испорчен, загружаем свежие данные с сервера
        if (!initialLoadData) {
          console.log('Загружаем свежие данные розыгрыша с сервера...');
          const { data, error } = await supabase
            .from('deals')
            .select(`
              *,
              profiles:user_id(id, email, display_name)
            `)
            .eq('id', id)
            .eq('type', 'sweepstakes')
            .maybeSingle();

          if (error) {
            console.error('🔴 Ошибка при загрузке данных розыгрыша:', error);
            throw error;
          }

          if (!data) {
            console.error('🔴 Ошибка: розыгрыш не найден');
            setError('Розыгрыш не найден');
            setLoading(false);
            return;
          }

          console.log('✅ Данные розыгрыша успешно загружены с сервера:', data);

          initialLoadData = {
            id: data.id,
            title: data.title,
            description: data.description,
            dealUrl: data.deal_url,
            expiryDate: data.expires_at
              ? (() => {
                  const expiresAtDate = new Date(data.expires_at);
                  const year = expiresAtDate.getFullYear();
                  const month = (expiresAtDate.getMonth() + 1).toString().padStart(2, '0');
                  const day = expiresAtDate.getDate().toString().padStart(2, '0');
                  return `${year}-${month}-${day}`;
                })()
              : '',
            image: data.image_url,
            isHot: !!data.is_hot
          };
        }

        setSweepstakesData(initialLoadData);

      } catch (err: any) {
        console.error('🔴 Ошибка:', err);
        setError(err.message || 'Ошибка при загрузке данных розыгрыша');
      } finally {
        setLoading(false);
      }
    };

    loadSweepstakesData();

    // Обработчик события восстановления фокуса на вкладке
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshDeals();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [id, location, refreshDeals]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center">
        <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-white">Загрузка данных розыгрыша...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        <div className="fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 px-4 py-3 z-10">
          <div className="flex items-center">
            <button onClick={() => navigate(-1)} className="text-white">
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-white text-lg font-medium ml-4">Ошибка</h1>
          </div>
        </div>
        <div className="flex-1 pt-16 px-4">
          <div className="bg-red-500/10 text-red-500 p-4 rounded-md">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <AddSweepstakesPage
      isEditing={true}
      sweepstakesId={id}
      initialData={sweepstakesData}
      allowHotToggle={role === 'admin' || role === 'moderator'}
      labelOverrides={{ 
        submitButton: 'Обновить розыгрыш',
        pageTitle: 'Редактирование розыгрыша'
      }}
      onEditSuccess={async (editedId) => {
        await handleAddToModeration(editedId);
        // Очищаем черновик после успешного редактирования и отправки
        localStorage.removeItem(`sweepstakesDraft_${editedId}`);
      }}
    />
  );
};

export default EditSweepstakesPage;
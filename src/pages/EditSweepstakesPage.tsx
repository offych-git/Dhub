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
        const result = await addToModerationQueue(sweepstakesId, 'sweepstake');
        console.log("Результат добавления в очередь модерации:", result);
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

    const loadSweepstakesData = async () => {
      if (!id) {
        console.error('🔴 Ошибка: ID розыгрыша отсутствует');
        setError('ID розыгрыша не указан');
        setLoading(false);
        return;
      }

      // Проверяем, есть ли сохраненные данные формы в localStorage
      const savedData = localStorage.getItem(`form_sweepstake_edit_${id}`);
      if (savedData) {
        try {
          const parsedData = JSON.parse(savedData);
          console.log('Восстановлены сохраненные данные розыгрыша из localStorage:', parsedData);
          setSweepstakesData(parsedData);
          setLoading(false);
          return;
        } catch (e) {
          console.error('Ошибка при парсинге сохраненных данных розыгрыша:', e);
          // Продолжаем загрузку с сервера в случае ошибки
        }
      }

      try {
        console.log('🔍 Загрузка данных розыгрыша с ID:', id);

        // Обновлено: используем правильный тип 'sweepstakes'
        const { data, error } = await supabase
          .from('deals')
          .select(`
            *,
            profiles:user_id(id, email, display_name)
          `)
          .eq('id', id)
          .eq('type', 'sweepstakes') // Уточняем, что нужен розыгрыш
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

        console.log('✅ Данные розыгрыша успешно загружены:', data);

        // Трансформируем данные для AddSweepstakesPage
        const sweepstakeFullData = {
          id: data.id,
          title: data.title,
          description: data.description,
          dealUrl: data.deal_url,
          expiryDate: data.expires_at || '',
          image: data.image_url,
          isHot: !!data.is_hot
        };

        setSweepstakesData(sweepstakeFullData);

        // Сохраняем данные в localStorage для восстановления при переключении вкладок
        localStorage.setItem(`form_sweepstake_edit_${id}`, JSON.stringify(sweepstakeFullData));

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
        refreshDeals()
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
        <div className="flex-1 mt-16 flex flex-col items-center justify-center p-4">
          <div className="bg-red-500/10 text-red-500 p-4 rounded-md mb-4 max-w-md">
            <p>{error}</p>
          </div>
          <button 
            onClick={() => navigate('/sweepstakes')} 
            className="bg-orange-500 text-white py-2 px-4 rounded-md"
          >
            Вернуться к розыгрышам
          </button>
        </div>
      </div>
    );
  }

  const onEditSuccess = async (sweepstakesId: string) => {
    // Очищаем сохраненные данные из localStorage после успешного сохранения
    localStorage.removeItem(`form_sweepstake_edit_${id}`);
    await handleAddToModeration(sweepstakesId);
  }

  return (
    <AddSweepstakesPage 
      isEditing={true}
      sweepstakesId={id}
      initialData={sweepstakesData}
      allowHotToggle={role === 'admin' || role === 'moderator'}
      labelOverrides={{
        pageTitle: 'Редактирование розыгрыша',
        submitButton: 'Сохранить изменения'
      }}
      onEditSuccess={onEditSuccess}
    />
  );
};

export default EditSweepstakesPage;

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import AddSweepstakesPage from './AddSweepstakesPage';
import { supabase } from '../lib/supabase';
import { ArrowLeft } from 'lucide-react';
import { useGlobalState } from '../contexts/GlobalStateContext';
import { useAdmin } from '../hooks/useAdmin';

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

      try {
        console.log('🔍 Загрузка данных розыгрыша с ID:', id);
        
        // Обновлено: используем правильный тип 'sweepstakes'
        const { data, error } = await supabase
          .from('deals')
          .select(`
            *,
            profiles(id, email, display_name)
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
        setSweepstakesData({
          id: data.id,
          title: data.title,
          description: data.description,
          dealUrl: data.deal_url,
          expiryDate: data.expires_at || '',
          image: data.image_url,
          isHot: !!data.is_hot
        });
      } catch (err: any) {
        console.error('🔴 Ошибка:', err);
        setError(err.message || 'Ошибка при загрузке данных розыгрыша');
      } finally {
        setLoading(false);
      }
    };

    loadSweepstakesData();
  }, [id, location]);

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
    />
  );
};

export default EditSweepstakesPage;

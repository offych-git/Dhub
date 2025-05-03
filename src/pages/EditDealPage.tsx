import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AddDealPage from '../components/deals/AddDealPage';
import { supabase } from '../lib/supabase';
import { ArrowLeft } from 'lucide-react';
import { useGlobalState } from '../contexts/GlobalStateContext'; // Assuming this context exists

const EditDealPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [dealData, setDealData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { dispatch } = useGlobalState();

  useEffect(() => {
    // Полностью очищаем кеш сделок при монтировании компонента редактирования
    // Это гарантирует, что после редактирования мы загрузим свежие данные
    dispatch({ type: 'SET_DEALS', payload: [] });
    dispatch({ type: 'MARK_DEALS_STALE' });
    console.log("EditDealPage: полная очистка кеша сделок для обеспечения актуальности");
    
    const fetchDeal = async () => {
      if (!id) {
        navigate('/');
        return;
      }

      const { data, error } = await supabase
        .from('deals')
        .select(`
          *,
          profiles (
            id,
            display_name,
            email
          )
        `)
        .eq('id', id)
        .single();

      if (error || !data) {
        console.error('Error fetching deal:', error);
        navigate('/');
        return;
      }

      if (data) {
        console.log('Raw deal data from DB:', data);

        // Преобразование данных для формы редактирования с дополнительной проверкой
        const transformedData = {
          id: data.id,
          store_id: data.store_id || null,
          title: data.title || '',
          current_price: data.current_price !== null ? data.current_price.toString() : '',
          original_price: data.original_price !== null ? data.original_price.toString() : '',
          description: data.description || '',
          category_id: data.category_id || '',
          deal_url: data.deal_url || '',
          expires_at: data.expires_at || '',
          is_hot: Boolean(data.is_hot), // Убедимся, что is_hot правильно конвертируется в boolean
          image_url: data.image_url || '',
          postedBy: {
            id: data.profiles?.id,
            name: data.profiles?.display_name || data.profiles?.email?.split('@')[0] || 'Anonymous'
          }
        };
        console.log('Transformed data:', transformedData);
        console.log('Fields to check:');
        console.log('- title:', transformedData.title);
        console.log('- current_price:', transformedData.current_price);
        console.log('- category_id:', transformedData.category_id);
        console.log('- is_hot:', transformedData.is_hot, 'type:', typeof transformedData.is_hot);

        // Проверка корректности основных полей перед установкой
        if (!transformedData.title) console.warn('Warning: Deal title is empty');
        if (!transformedData.current_price) console.warn('Warning: Current price is empty');
        if (!transformedData.description) console.warn('Warning: Description is empty');

        setDealData(transformedData);
      }
      setLoading(false);
    };

    fetchDeal();
  }, [id, navigate]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
    </div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-white mb-6">Edit Deal</h1>
      <AddDealPage isEditing={true} dealId={id} initialData={dealData} />
    </div>
  );
};

export default EditDealPage;
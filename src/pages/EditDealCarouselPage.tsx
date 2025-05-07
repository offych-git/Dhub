
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AddDealPageNew from './AddDealPageNew';
import { supabase } from '../lib/supabase';
import { ArrowLeft } from 'lucide-react';
import { useGlobalState } from '../contexts/GlobalStateContext';
import { useAdmin } from '../hooks/useAdmin';

const EditDealCarouselPage: React.FC = () => {
  // Получаем роль пользователя для проверки доступа к функции HOT
  const { role } = useAdmin();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [dealData, setDealData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { dispatch } = useGlobalState();

  useEffect(() => {
    // Очищаем кеш сделок при монтировании компонента
    dispatch({ type: 'SET_DEALS', payload: [] });
    dispatch({ type: 'MARK_DEALS_STALE' });
    console.log("EditDealCarouselPage: очистка кеша сделок для обеспечения актуальности");

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
        console.log('Raw carousel deal data from DB:', data);

        // Переданные данные в AddDealPageNew должны быть правильно трансформированы
        // Учитываем формат карусели в комментарии DEAL_IMAGES
        const transformedData = {
          id: data.id,
          title: data.title || '',
          description: data.description || '',
          current_price: data.current_price !== null ? data.current_price.toString() : '',
          original_price: data.original_price !== null ? data.original_price.toString() : '',
          category: data.category_id || '',
          deal_url: data.deal_url || '',
          expiry_date: data.expires_at || '',
          is_hot: !!data.is_hot,
          store_id: data.store_id || null,
          dealImages: [] // Будет заполнено ниже
        };

        // Извлекаем карусель изображений из описания
        let imageUrls: string[] = [];
        
        // Всегда добавляем основное изображение первым элементом массива
        if (data.image_url) {
          imageUrls.push(data.image_url);
          console.log('Added main image URL:', data.image_url);
        }
        
        // Далее пытаемся извлечь дополнительные изображения из комментария в описании
        if (data.description) {
          const match = data.description.match(/<!-- DEAL_IMAGES: (.*?) -->/);
          if (match && match[1]) {
            try {
              const parsedImages = JSON.parse(match[1]);
              console.log('Found carousel images in description:', parsedImages.length);
              
              // Проверяем, есть ли основное изображение в массиве из описания
              // Если есть и оно совпадает с первым элементом, берем только остальные
              if (parsedImages.length > 0 && parsedImages[0] === data.image_url) {
                imageUrls = imageUrls.concat(parsedImages.slice(1));
              } else {
                // Если не совпадает, добавляем все дополнительные изображения
                imageUrls = imageUrls.concat(parsedImages);
              }
              
              // Очищаем описание от JSON с изображениями
              transformedData.description = data.description.replace(/<!-- DEAL_IMAGES: .*? -->/, '').trim();
            } catch (e) {
              console.error('Error parsing carousel images:', e);
            }
          }
        }
        
        console.log('Final image URLs array:', imageUrls);

        console.log('Transformed carousel data:', transformedData);

        // Сохраняем данные для передачи в компонент AddDealPageNew
        setDealData({
          ...transformedData,
          imageUrls,
          postedBy: {
            id: data.profiles?.id,
            name: data.profiles?.display_name || data.profiles?.email?.split('@')[0] || 'Anonymous'
          }
        });
      }
      setLoading(false);
    };

    fetchDeal();
  }, [id, navigate, dispatch]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
    </div>;
  }

  return (
    <AddDealPageNew 
      isEditing={true} 
      dealId={id} 
      initialData={dealData}
      // Передаем информацию о возможности пометки как HOT только для админов и модераторов
      allowHotToggle={role === 'admin' || role === 'moderator'}
      labelOverrides={{
        expiryDate: "Expired date"
      }}
      customHeaderComponent={
        <div className="flex items-center">
          <button onClick={() => navigate('/deals')} className="text-white">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-white text-lg font-medium ml-4">Edit Carousel Deal</h1>
        </div>
      }
    />
  );
};

export default EditDealCarouselPage;

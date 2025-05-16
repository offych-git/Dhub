import React, { useEffect, useState, useContext } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import AddDealPage from '../components/deals/AddDealPage';
import { supabase } from '../lib/supabase';
import { ArrowLeft } from 'lucide-react';
import { useGlobalState } from '../contexts/GlobalStateContext';
import { useAdmin } from '../hooks/useAdmin';
import { ModerationContext, useModeration } from '../contexts/ModerationContext';

const EditDealPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [dealData, setDealData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCarousel, setHasCarousel] = useState(false);
  const { dispatch } = useGlobalState();
  const { role } = useAdmin();
  const isFromModeration = location.pathname.includes('moderation') || location.search.includes('from=moderation');

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
          profiles!deals_user_id_fkey(id, email, display_name)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        console.error('Error fetching deal:', error);
        navigate('/');
        return;
      }

      if (data) {
        console.log('Raw deal data from DB:', data);

        // Проверяем, есть ли у скидки карусель
        let hasCarouselImages = false;
        if (data.description && data.description.includes('<!-- DEAL_IMAGES:')) {
          try {
            const match = data.description.match(/<!-- DEAL_IMAGES: (.*?) -->/);
            if (match && match[1]) {
              const carouselImages = JSON.parse(match[1]);
              if (carouselImages.length > 1) { // Если больше одного изображения, это карусель
                hasCarouselImages = true;
                setHasCarousel(true);
                console.log('Deal has carousel, redirecting to carousel editor');
                // Перенаправляем на страницу редактирования карусели
                navigate(`/edit-carousel/${id}`);
                return;
              }
            }
          } catch (e) {
            console.error('Error checking for carousel:', e);
          }
        }

        // Если нет карусели, продолжаем с обычным редактированием
        if (!hasCarouselImages) {
          // Извлечение дополнительных изображений из комментария в описании
          let additionalImages: string[] = [];
          if (data.description) {
            const match = data.description.match(/<!-- DEAL_IMAGES: (.*?) -->/);
            if (match && match[1]) {
              try {
                const allImages = JSON.parse(match[1]);
                // Если первое изображение совпадает с основным, используем остальные как дополнительные
                if (allImages.length > 0) {
                  if (allImages[0] === data.image_url) {
                    additionalImages = allImages.slice(1);
                  } else {
                    // Если первое изображение не совпадает с основным, используем все
                    additionalImages = [...allImages];
                  }
                  console.log('Found carousel images:', additionalImages.length);
                }
              } catch (e) {
                console.error('Error parsing carousel images:', e);
              }
            }
          }

          // Преобразование данных для формы редактирования с дополнительной проверкой
          const transformedData = {
            id: data.id,
            store_id: data.store_id || null,
            title: data.title || '',
            current_price: data.current_price !== null ? data.current_price.toString() : '',
            original_price: data.original_price !== null ? data.original_price.toString() : '',
            description: data.description ? data.description.replace(/<!-- DEAL_IMAGES: .*? -->/, '') : '',
            category_id: data.category_id || '',
            deal_url: data.deal_url || '',
            expires_at: data.expires_at || '',
            is_hot: Boolean(data.is_hot), // Убедимся, что is_hot правильно конвертируется в boolean
            image_url: data.image_url || '',
            carousel_images: additionalImages, // Добавляем изображения карусели
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
          console.log('- carousel_images:', transformedData.carousel_images.length);

          // Проверка корректности основных полей перед установкой
          if (!transformedData.title) console.warn('Warning: Deal title is empty');
          if (!transformedData.current_price) console.warn('Warning: Current price is empty');
          if (!transformedData.description) console.warn('Warning: Description is empty');

          setDealData(transformedData);
        }
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

  if (hasCarousel) {
    return null; // Компонент не рендерится, т.к. произойдет редирект
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center mb-6">
        <button onClick={() => navigate('/deals')} className="text-white mr-4">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-2xl font-bold text-white">Edit Deal</h1>
      </div>
      <AddDealPage 
        isEditing={true} 
        dealId={id} 
        initialData={dealData} 
        autoApprove={isFromModeration && (role === 'admin' || role === 'moderator' || role === 'super_admin')}
      />
    </div>
  );
};

export default EditDealPage;
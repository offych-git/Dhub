import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import AddDealPage from '../components/deals/AddDealPage';
import { supabase } from '../lib/supabase';
import { ArrowLeft } from 'lucide-react';
import { useGlobalState } from '../contexts/GlobalStateContext';
import { useAdmin } from '../hooks/useAdmin';
import { useModeration } from '../contexts/ModerationContext';

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
  const { addToModerationQueue } = useModeration();
  const isFromModeration = new URLSearchParams(location.search).get('from') === 'moderation';

  console.log("EditDealPage - Компонент инициализирован с параметрами:");
  console.log(" - id скидки:", id);
  console.log(" - роль пользователя:", role);
  console.log(" - isFromModeration:", isFromModeration);
  console.log(" - autoApprove:", isFromModeration && (role === 'admin' || role === 'moderator' || role === 'super_admin'));

  useEffect(() => {
    dispatch({ type: 'SET_DEALS', payload: [] });
    dispatch({ type: 'MARK_DEALS_STALE' });
    console.log("EditDealPage: полная очистка кеша сделок для обеспечения актуальности");
    console.log("EditDealPage: ID редактируемой скидки:", id);
    console.log("EditDealPage: autoApprove:", isFromModeration && (role === 'admin' || role === 'moderator' || role === 'super_admin'));

    const fetchDeal = async () => {
      if (!id) {
        navigate('deals');
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
        navigate('deals');
        return;
      }

      if (data) {
        console.log('Raw deal data from DB:', data);

        // ИСПРАВЛЕНИЕ 1: Блок проверки карусели обернут в try-catch и используется валидное регулярное выражение
        // Это исправляет ошибку 'Unterminated string literal' и связанные с ней ошибки синтаксиса.
        const imageJsonRegex = /(\[".*?"\])/; // Валидное регулярное выражение для поиска JSON-массива

        try {
          if (data.description) {
            const match = data.description.match(imageJsonRegex);
            if (match && match[1]) {
              const carouselImages = JSON.parse(match[1]);
              if (carouselImages.length > 1) { // Если больше одного изображения, это карусель
                setHasCarousel(true);
                console.log('Deal has carousel, redirecting to carousel editor');
                // Перенаправляем на страницу редактирования карусели
                navigate(`/edit-carousel/${id}`);
                return;
              }
            }
          }
        } catch (e) {
          console.error('Error checking for carousel:', e);
        }


        if (!hasCarousel) {
          console.log('Загружаем актуальные данные сделки с сервера');
          let additionalImages: string[] = [];
          if (data.description) {
            // ИСПРАВЛЕНИЕ 2: Пустое регулярное выражение заменено на валидное
            const match = data.description.match(imageJsonRegex);
            if (match && match[1]) {
              try {
                const allImages = JSON.parse(match[1]);
                if (allImages.length > 0) {
                  if (allImages[0] === data.image_url) {
                    additionalImages = allImages.slice(1);
                  } else {
                    additionalImages = [...allImages];
                  }
                  console.log('Found carousel images:', additionalImages.length);
                }
              } catch (e) {
                console.error('Error parsing carousel images:', e);
              }
            }
          }

          const transformedData = {
            id: data.id,
            store_id: data.store_id || null,
            title: data.title || '',
            current_price: data.current_price !== null ? data.current_price.toString() : '',
            original_price: data.original_price !== null ? data.original_price.toString() : '',
            // ИСПРАВЛЕНИЕ 3: Пустое регулярное выражение заменено на валидное для очистки описания
            description: data.description ? data.description.replace(imageJsonRegex, '') : '',
            category_id: data.category_id || '',
            deal_url: data.deal_url || '',
            expires_at: data.expires_at
              ? (() => {
                  const expiryUtcDate = new Date(data.expires_at);
                  expiryUtcDate.setDate(expiryUtcDate.getDate() - 1);
                  return expiryUtcDate.toISOString().split('T')[0];
                })()
              : '',
            is_hot: Boolean(data.is_hot),
            image_url: data.image_url || '',
            carousel_images: additionalImages,
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

  const handleAddToModeration = async (dealId: string) => {
    if (!isFromModeration && dealData && dealData.id) {
      console.log("EditDealPage: добавляем отредактированную сделку в очередь модерации, ID:", dealId);

      try {
        await supabase
          .from('deals')
          .update({ status: 'pending' })
          .eq('id', dealId);

        if (addToModerationQueue) {
          const result = await addToModerationQueue(dealId, 'deal');
          console.log("EditDealPage: сделка успешно добавлена в очередь модерации");
          console.log("Результат добавления в очередь модерации:", result);
        } else {
          console.error("EditDealPage: функция addToModerationQueue не определена");
        }
      } catch (e) {
        console.error("Ошибка при добавлении в очередь модерации:", e);
      }
    }
  };

  const autoApprove = isFromModeration && (role === 'admin' || role === 'moderator' || role === 'super_admin');

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
    </div>;
  }

  if (hasCarousel) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center mb-6">
        <button onClick={() => navigate('deals')} className="text-white mr-4">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-2xl font-bold text-white">Edit Deal</h1>
      </div>
      <AddDealPage
        isEditing={true}
        dealId={id}
        initialData={dealData}
        autoApprove={autoApprove}
        onSave={(id) => handleAddToModeration(id)}
      />
    </div>
  );
};

export default EditDealPage;
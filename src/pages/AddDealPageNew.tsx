import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bold, Italic, Underline as UnderlineIcon, List, Image as ImageIcon, Link as LinkIcon, Info, ChevronDown, X, Plus, ArrowLeftCircle, ArrowRightCircle } from 'lucide-react';
import { categories, stores, categoryIcons } from '../data/mockData';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAdmin } from '../hooks/useAdmin';
import { supabase } from '../lib/supabase';
import ImageUploader from '../components/deals/ImageUploader';
import imageCompression from 'browser-image-compression';
import { createPortal } from 'react-dom';
import CategorySimpleBottomSheet from '../components/deals/CategorySimpleBottomSheet';
import StoreBottomSheet from '../components/deals/StoreBottomSheet';
import { useGlobalState } from '../contexts/GlobalStateContext'; // Import useGlobalState

interface ImageWithId {
  file: File;
  id: string;
  publicUrl: string;
}

interface AddDealPageNewProps {
  isEditing?: boolean;
  dealId?: string;
  initialData?: any;
  customHeaderComponent?: React.ReactNode; // Added custom header prop
}

const AddDealPageNew: React.FC<AddDealPageNewProps> = ({ isEditing = false, dealId, initialData, customHeaderComponent }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { dispatch } = useGlobalState(); // Added dispatch
  const { role } = useAdmin();
  const { t, language } = useLanguage();
  const canMarkHot = role === 'admin' || role === 'moderator';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false);
  const [isStoreSheetOpen, setIsStoreSheetOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const selectedStoreName = stores.find(store => store.id === selectedStoreId)?.name || '';

  // Images for carousel
  const [dealImages, setDealImages] = useState<ImageWithId[]>([]);
  // В новой системе нам не нужен активный индекс, так как первое изображение всегда главное
  const [mainImageIndex, setMainImageIndex] = useState(0); // Оставляем для совместимости с существующим кодом

  // Загрузка существующих изображений при редактировании
  useEffect(() => {
    if (isEditing && initialData?.imageUrls && initialData.imageUrls.length > 0) {
      const existingImages: ImageWithId[] = initialData.imageUrls.map((url: string, index: number) => ({
        publicUrl: url,
        id: `existing-${index}`,
        file: new File([], `image-${index}.jpg`)
      }));
      setDealImages(existingImages);
      console.log('Initialized carousel with images:', existingImages.length);
    }
  }, [isEditing, initialData]);

  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    currentPrice: initialData?.current_price || '',
    originalPrice: initialData?.original_price || '',
    description: initialData?.description || '',
    category: initialData?.category || '',
    dealUrl: initialData?.deal_url || '',
    expiryDate: initialData?.expiry_date || '',
    isHot: initialData?.is_hot || false
  });

  const compressImage = async (file: File): Promise<File> => {
    const options = {
      maxSizeMB: 0.2,
      maxWidthOrHeight: 1200,
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: 0.8,
    };

    try {
      return await imageCompression(file, options);
    } catch (error) {
      console.error('Error compressing image:', error);
      return file;
    }
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      setError('Title is required');
      return false;
    }

    if (!formData.description.trim()) {
      setError('Description is required');
      return false;
    }

    if (!formData.currentPrice || isNaN(Number(formData.currentPrice))) {
      setError('Current price is required and must be a number');
      return false;
    }

    if (formData.originalPrice && isNaN(Number(formData.originalPrice))) {
      setError('Original price must be a number');
      return false;
    }

    if (Number(formData.currentPrice) > Number(formData.originalPrice)) {
      setError('Current price cannot be higher than original price');
      return false;
    }

    if (!formData.category) {
      setError('Please select a category');
      return false;
    }

    if (dealImages.length === 0) {
      setError('At least one image is required');
      return false;
    }

    if (!formData.dealUrl) {
      setError('Deal URL is required');
      return false;
    }

    // Более гибкая проверка URL, которая принимает query-параметры и фрагменты
    const urlRegex = /^(https?:\/\/)?([a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\/[^\s]*)?$/;
    if (!urlRegex.test(formData.dealUrl)) {
      setError('Please enter a valid URL starting with http:// or https://');
      return false;
    }

    if (!formData.dealUrl.startsWith('http://') && !formData.dealUrl.startsWith('https://')) {
      setFormData(prev => ({
        ...prev,
        dealUrl: `https://${prev.dealUrl}`
      }));
    }

    return true;
  };

  // Создаем редактор
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          HTMLAttributes: {
            class: 'list-disc pl-4',
          },
        },
        paragraph: {
          HTMLAttributes: {
            class: 'mb-3',
          },
        },
        hardBreak: {
          keepMarks: true,
          HTMLAttributes: {
            class: 'inline-block',
          },
        },
      }),
      Underline,
      Image,
    ],
    content: '',
    parseOptions: {
      preserveWhitespace: 'full',
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[200px]',
      },
      handleKeyDown: (view, event) => {
        if (event.key === 'Enter') {
          view.dispatch(view.state.tr.replaceSelectionWith(
            view.state.schema.nodes.hardBreak.create()
          ).scrollIntoView());
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();

      setFormData(prev => ({
        ...prev,
        description: html
      }));
    },
  });

  // Устанавливаем содержимое редактора при загрузке существующих данных
  useEffect(() => {
    if (isEditing && initialData?.description && editor) {
      editor.commands.setContent(initialData.description);
      console.log('Set editor content from initial data');
    }
  }, [isEditing, initialData, editor]);

  // Отслеживаем состояние валидации каждого поля отдельно
  const [validationState, setValidationState] = useState({
    title: true,
    description: true,
    currentPrice: true,
    originalPrice: true,
    category: true,
    dealImages: true,
    dealUrl: true,
  });

  useEffect(() => {
    // Проверяем каждое обязательное поле отдельно
    const titleValid = formData.title.trim() !== '';
    const descriptionValid = formData.description.trim() !== '';
    const currentPriceValid = formData.currentPrice !== '' && !isNaN(Number(formData.currentPrice));
    const originalPriceValid = !formData.originalPrice || 
                              (Number(formData.currentPrice) <= Number(formData.originalPrice) && !isNaN(Number(formData.originalPrice)));
    const categoryValid = formData.category !== '';
    const imagesValid = dealImages.length > 0;
    const urlValid = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(formData.dealUrl);
    
    // Обновляем состояние валидации
    setValidationState({
      title: titleValid,
      description: descriptionValid,
      currentPrice: currentPriceValid,
      originalPrice: originalPriceValid,
      category: categoryValid,
      dealImages: imagesValid,
      dealUrl: urlValid,
    });

    // Общая проверка формы
    const isFormValid = titleValid && 
      descriptionValid && 
      currentPriceValid && 
      originalPriceValid &&
      categoryValid && 
      imagesValid && 
      urlValid;

    setIsValid(isFormValid);
    console.log('Form validation:', { 
      titleValid, 
      descriptionValid, 
      currentPriceValid, 
      originalPriceValid,
      categoryValid, 
      imagesValid: dealImages.length, 
      urlValid 
    });
  }, [formData, dealImages]);

  const handleDealImageUpload = async (files: FileList | null) => {
    if (!files || !files.length) {
      return;
    }

    setIsUploadingImage(true);
    try {
      const newImages: ImageWithId[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (!file.type.startsWith('image/')) {
          throw new Error('Please select only image files');
        }

        const compressedImage = await compressImage(file);
        const imageId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const fileExt = compressedImage.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${user?.id}/deal-images/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('deal-images')
          .upload(filePath, compressedImage, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Error uploading deal image:', uploadError);
          throw new Error('Failed to upload deal image');
        }

        const { data: { publicUrl } } = supabase.storage
          .from('deal-images')
          .getPublicUrl(filePath);

        newImages.push({
          file: compressedImage,
          id: imageId,
          publicUrl: publicUrl
        });
      }

      setDealImages(prev => [...prev, ...newImages]);
    } catch (error) {
      console.error('Error in image upload process:', error);
      alert(`Failed to process images: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = (imageId: string) => {
    setDealImages(prev => {
      const newImages = prev.filter(img => img.id !== imageId);
      // В новой системе первое изображение всегда главное
      setMainImageIndex(0);
      return newImages;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      if (dealImages.length === 0) throw new Error('At least one image is required');

      // Убедимся, что у нас есть актуальное содержимое из редактора
      const currentDescription = editor ? editor.getHTML() : formData.description;

      // В новой системе, первое изображение в массиве всегда главное
      const mainImageUrl = dealImages[0].publicUrl;

      // Добавим все URL изображений в описание в специальном JSON-формате
      // Это позволит нам хранить дополнительные изображения без изменения структуры БД
      let enhancedDescription = currentDescription;

      // Если есть дополнительные изображения, добавим их в описание в формате JSON
      if (dealImages.length > 1) {
        const allImagesJson = JSON.stringify(dealImages.map(img => img.publicUrl));
        // Добавляем JSON с изображениями в конец описания в специальном формате
        // который можно будет распознать в DealDetailPage
        enhancedDescription += `\n\n<!-- DEAL_IMAGES: ${allImagesJson} -->`;
      }

      console.log('Saving description:', enhancedDescription);

      const dealData = {
        title: formData.title,
        description: enhancedDescription,
        current_price: Number(formData.currentPrice),
        original_price: formData.originalPrice ? Number(formData.originalPrice) : null,
        store_id: selectedStoreId,
        category_id: formData.category,
        image_url: mainImageUrl,
        deal_url: formData.dealUrl,
        expires_at: formData.expiryDate || null,
        is_hot: formData.isHot
      };

      // Проверяем режим - создание или редактирование
      if (isEditing && dealId) {
        // Обновление существующей скидки
        console.log('Updating existing deal:', dealId);

        // Отмечаем все сделки как устаревшие для последующей перезагрузки
        try {
          if (dispatch) {
            dispatch({ type: 'MARK_DEALS_STALE' });
          } else {
            console.warn('dispatch is undefined, cannot mark deals as stale');
          }
        } catch (dispatchError) {
          console.error('Error dispatching MARK_DEALS_STALE:', dispatchError);
        }

        const { error: updateError } = await supabase
          .from('deals')
          .update(dealData)
          .eq('id', dealId);

        if (updateError) {
          console.error('Error updating deal:', updateError);
          throw new Error('Failed to update deal');
        }

        // Перенаправляем на страницу деталей
        navigate(`/deals/${dealId}`);
      } else {
        // Создание новой скидки
        // Добавляем ID пользователя только при создании
        const { data: deal, error: dealError } = await supabase
          .from('deals')
          .insert({
            ...dealData,
            user_id: user?.id
          })
          .select()
          .single();

        if (dealError) {
          console.error('Error creating deal:', dealError);
          throw new Error('Failed to create deal');
        }

        // Отмечаем все сделки как устаревшие, если есть dispatch
        try {
          if (dispatch) {
            dispatch({ type: 'MARK_DEALS_STALE' });
          } else {
            console.warn('dispatch is undefined in create flow, cannot mark deals as stale');
          }
        } catch (dispatchError) {
          console.error('Error dispatching MARK_DEALS_STALE in create flow:', dispatchError);
        }

        navigate(`/deals/${deal.id}`);
      }
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      setError(error instanceof Error ? error.message : `Failed to ${isEditing ? 'update' : 'create'} deal`);
    } finally {
      setLoading(false);
    }
  };

  const calculateDiscount = useCallback(() => {
    if (formData.currentPrice && formData.originalPrice) {
      const current = Number(formData.currentPrice);
      const original = Number(formData.originalPrice);
      if (current && original && current <= original) {
        return Math.round(((original - current) / original) * 100);
      }
    }
    return null;
  }, [formData.currentPrice, formData.originalPrice]);

  const handleCategorySelect = (categoryId: string) => {
    setFormData(prev => ({...prev, category: categoryId}));
    setIsCategorySheetOpen(false);
  };

  const handleStoreSelect = (storeId: string | null) => {
    setSelectedStoreId(storeId);
    setIsStoreSheetOpen(false);
  };

  // Упрощенная обработка URL, без автоматического извлечения данных
  const handleUrlInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setFormData(prev => ({ ...prev, dealUrl: url }));
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 px-4 py-3 z-10">
        <div className="flex items-center justify-between">
          {customHeaderComponent ? (
            customHeaderComponent
          ) : (
            <div className="flex items-center">
              <button onClick={() => navigate(-1)} className="text-white">
                <ArrowLeft className="h-6 w-6" />
              </button>
              <h1 className="text-white text-lg font-medium ml-4">
                {isEditing ? 'Edit Deal' : 'Add New Deal'}
              </h1>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pt-4 pb-24">
        <div className="px-4">
          {error && (
            <div className="bg-red-500 text-white px-4 py-3 rounded-md mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Title *"
                  className={`w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3 ${
                    !validationState.title && formData.title !== '' ? 'border border-red-500' : 
                    !validationState.title ? 'border border-yellow-500' : ''
                  }`}
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
                {validationState.title && formData.title && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
              {!validationState.title && (
                <p className="text-orange-500 text-xs mt-1">Title is required</p>
              )}
            </div>

            <div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsCategorySheetOpen(true)}
                  className={`w-full bg-gray-800 text-white rounded-md px-4 py-3 flex items-center justify-between ${
                    formData.category ? 'text-white' : 'text-gray-500'
                  } ${
                    !validationState.category ? 'border border-yellow-500' : ''
                  }`}
                >
                  <span>
                    {formData.category 
                      ? language === 'ru' 
                        ? categories.find(cat => cat.id === formData.category)?.name 
                        : t(formData.category)
                      : 'Select Category *'
                    }
                  </span>
                  <div className="flex items-center">
                    {validationState.category && formData.category && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  </div>
                </button>
              </div>
              {!validationState.category && (
                <p className="text-orange-500 text-xs mt-1">Category selection is required</p>
              )}
            </div>

            <div className="flex space-x-4">
              <div className="flex-1 relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Current Price *"
                  className={`w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3 ${
                    !validationState.currentPrice && formData.currentPrice !== '' ? 'border border-red-500' : 
                    !validationState.currentPrice ? 'border border-yellow-500' : ''
                  }`}
                  value={formData.currentPrice}
                  onChange={(e) => setFormData({ ...formData, currentPrice: e.target.value })}
                  required
                />
                {validationState.currentPrice && formData.currentPrice && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                {!validationState.currentPrice && (
                  <p className="text-orange-500 text-xs mt-1">Valid current price is required</p>
                )}
              </div>
              <div className="flex-1 relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Original Price"
                  className={`w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3 ${
                    !validationState.originalPrice ? 'border border-red-500' : ''
                  }`}
                  value={formData.originalPrice}
                  onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })}
                />
                {validationState.originalPrice && formData.originalPrice && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                {!validationState.originalPrice && (
                  <p className="text-red-500 text-xs mt-1">Original price should be greater than or equal to current price</p>
                )}
              </div>
            </div>

            {calculateDiscount() !== null && (
              <div className="text-green-500 text-sm">
                Discount: {calculateDiscount()}%
              </div>
            )}

            {/* Deal Images */}
            <div>
              <label className="block text-gray-400 mb-2">Deal Images * ({dealImages.length}/4)</label>

              {dealImages.length > 0 && (
                <div className="mb-4">
                  {/* Отображение главного изображения */}
                  <div className="relative h-48 bg-gray-800 rounded-lg overflow-hidden main-image-container">
                    <img 
                      key={dealImages[0]?.id} 
                      src={dealImages[0]?.publicUrl} 
                      alt="Main deal image"
                      className="w-full h-full object-contain main-image"
                    />

                    {dealImages.length > 1 && (
                      <div className="absolute bottom-2 left-2 bg-green-500/80 text-white font-semibold text-xs px-2 py-1 rounded-md">
                        Главное изображение
                      </div>
                    )}

                    <div className="absolute top-2 right-2 bg-gray-900/70 text-white font-medium text-xs px-2 py-1 rounded-md">
                      {`${dealImages.length}/4 изображений`}
                    </div>
                  </div>

                  {/* Миниатюры с улучшенным интерфейсом управления порядком */}
                  {dealImages.length > 1 && (
                    <div className="mt-4">
                      <div className="text-gray-400 text-sm mb-2">Измените порядок изображений (первое — главное):</div>
                      <div className="grid grid-cols-4 gap-3">
                        {dealImages.map((image, index) => (
                          <div
                            key={image.id}
                            className={`relative rounded-lg overflow-hidden border-2 ${
                              index === 0 ? 'border-green-500 ring-2 ring-green-500' : 'border-gray-700'
                            }`}
                          >
                            {/* Кнопка удаления в правом верхнем углу */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveImage(image.id);
                              }}
                              className="absolute top-0 right-0 z-20 bg-red-500 hover:bg-red-600 text-white rounded-bl-md p-1"
                              aria-label="Remove image"
                              style={{ fontSize: 0 }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                              </svg>
                            </button>
                            <img
                              src={image.publicUrl}
                              alt={`Изображение ${index + 1}`}
                              className="w-full h-16 object-cover"
                            />

                            {/* Метка позиции */}
                            <div className="absolute top-0 left-0 bg-black bg-opacity-70 text-white text-xs font-bold px-1.5 py-0.5 rounded-br-md">
                              {index + 1}
                            </div>

                            {/* Кнопки перемещения */}
                            <div className="absolute bottom-0 left-0 right-0 flex justify-between bg-black bg-opacity-80 p-1">
                              {/* Кнопка влево */}
                              <button 
                                type="button"
                                disabled={index === 0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (index > 0) {
                                    const newImages = [...dealImages];
                                    [newImages[index-1], newImages[index]] = [newImages[index], newImages[index-1]];
                                    setDealImages(newImages);
                                  }
                                }}
                                className={`text-white rounded-full p-1 ${
                                  index === 0 ? 'opacity-30' : 'bg-gray-700 hover:bg-gray-600'
                                }`}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M15 18l-6-6 6-6" />
                                </svg>
                              </button>

                              {/* Кнопка вправо */}
                              <button 
                                type="button"
                                disabled={index === dealImages.length - 1}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (index < dealImages.length - 1) {
                                    const newImages = [...dealImages];
                                    [newImages[index], newImages[index+1]] = [newImages[index+1], newImages[index]];
                                    setDealImages(newImages);
                                  }
                                }}
                                className={`text-white rounded-full p-1 ${
                                  index === dealImages.length - 1 ? 'opacity-30' : 'bg-gray-700 hover:bg-gray-600'
                                }`}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M9 18l6-6-6-6" />
                                </svg>
                              </button>
                            </div>

                            {/* Индикатор главного изображения */}
                            {index === 0 && (
                              <div className="absolute top-0 right-0 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-bl-md font-bold">
                                Главное
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Кнопки для быстрой установки главного изображения удалены */}
                    </div>
                  )}

                  {/* Подсказка удалена */}
                </div>
              )}

              {dealImages.length < 4 && (
                <>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleDealImageUpload(e.target.files)}
                    className="hidden"
                    id="deal-images-upload"
                    multiple={dealImages.length < 3}
                  />
                  <label
                    htmlFor="deal-images-upload"
                    className={`block w-full bg-gray-800 text-white rounded-md px-4 py-3 cursor-pointer hover:bg-gray-700 text-center ${
                      !validationState.dealImages ? 'border border-yellow-500' : ''
                    }`}
                  >
                    {isUploadingImage ? (
                      <div className="flex items-center justify-center">
                        <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Uploading...
                      </div>
                    ) : (
                      <>
                        <Plus className="h-5 w-5 inline-block mr-2" />
                        {dealImages.length === 0 ? 'Add Images *' : 'Add More Images'}
                      </>
                    )}
                  </label>
                  {!validationState.dealImages && (
                    <p className="text-orange-500 text-xs mt-1">At least one image is required</p>
                  )}
                  {validationState.dealImages && dealImages.length > 0 && (
                    <div className="text-green-500 text-xs font-medium mt-1 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Images uploaded successfully
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="relative">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  className={`formatting-button p-2 rounded ${editor?.isActive('bold') ? 'bg-gray-700 text-white active' : 'text-gray-400 hover:text-white'}`}
                >
                  <Bold className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                  className={`formatting-button p-2 rounded ${editor?.isActive('italic') ? 'bg-gray-700 text-white active' : 'text-gray-400 hover:text-white'}`}
                >
                  <Italic className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleUnderline().run()}
                  className={`formatting-button p-2 rounded ${editor?.isActive('underline') ? 'bg-gray-700 text-white active' : 'text-gray-400 hover:text-white'}`}
                >
                  <UnderlineIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleBulletList().run()}
                  className={`formatting-button p-2 rounded ${editor?.isActive('bulletList') ? 'bg-gray-700 text-white active' : 'text-gray-400 hover:text-white'}`}
                >
                  <List className="h-5 w-5" />
                </button>
              </div>
              <div className={`bg-gray-800 rounded-lg p-4 min-h-[200px] ${
                !validationState.description ? 'border border-yellow-500' : ''
              }`}>
                {!editor?.getText() && (
                  <div className="absolute text-gray-500 pointer-events-none p-1">Description *</div>
                )}
                <EditorContent editor={editor} />
              </div>
              {!validationState.description && (
                <p className="text-orange-500 text-xs mt-1">Description is required</p>
              )}
              {validationState.description && formData.description && (
                <div className="text-green-500 text-xs font-medium mt-1 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Description looks good!
                </div>
              )}
            </div>

            <div>
              <input
                type="url"
                placeholder="Deal URL *"
                className={`w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3 ${
                  !validationState.dealUrl && formData.dealUrl !== '' ? 'border border-red-500' : 
                  !validationState.dealUrl ? 'border border-yellow-500' : ''
                }`}
                value={formData.dealUrl}
                onChange={handleUrlInput}
                required
              />
              {!validationState.dealUrl && formData.dealUrl ? (
                <p className="text-red-500 text-xs mt-1">
                  Please enter a valid URL (e.g. example.com or https://example.com)
                </p>
              ) : !validationState.dealUrl ? (
                <p className="text-orange-500 text-xs mt-1">
                  Deal URL is required
                </p>
              ) : (
                <div className="flex justify-between items-center mt-1">
                  <p className="text-gray-500 text-sm">
                    Add a link where users can find and purchase this deal
                  </p>
                  {validationState.dealUrl && formData.dealUrl && (
                    <div className="text-green-500 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <div className="relative">
                <input
                  type="date"
                  className="w-full bg-gray-800 text-white rounded-md px-4 py-3"
                  value={formData.expiryDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) =>{
                    const selectedDate = new Date(e.target.value);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    if (selectedDate < today) {
                      setError('Expiry date cannot be earlier than today');
                      return;
                    }
                    setError(null);
                    setFormData({ ...formData, expiryDate: e.target.value });
                  }}
                />
                {formData.expiryDate && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, expiryDate: '' })}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
              <p className="text-gray-500 text-sm mt-1">
                Expired date (optional)
              </p>
            </div>

            {/* Проверка на роль пользователя для отображения HOT кнопки */}
            {canMarkHot && (
              <div className="flex items-center space-x-2 mt-4">
                <input
                  type="checkbox"
                  id="isHot"
                  checked={formData.isHot}
                  onChange={(e) => setFormData({ ...formData, isHot: e.target.checked })}
                  className="form-checkbox h-5 w-5 text-orange-500"
                />
                <label htmlFor="isHot" className="text-white">Mark as HOT</label>
              </div>
            )}

            <div className="bg-gray-800 rounded-md p-4">
              <h3 className="text-white font-medium mb-2">Preview</h3>
              <pre 
                className="bg-gray-900 rounded-md p-4 whitespace-pre-wrap font-sans text-sm description-preview"
                dangerouslySetInnerHTML={{ 
                  __html: formData.description
                    .replace(/(https?:\/\/[^\s<>"]+)/g, (match) => {
                      const lastChar = match.charAt(match.length - 1);
                      if ([',', '.', ':', ';', '!', '?', ')', ']', '}'].includes(lastChar)) {
                        return `<a href="${match.slice(0, -1)}" target="_blank" rel="noopener noreferrer" class="text-orange-500 hover:underline">${match.slice(0, -1)}</a>${lastChar}`;
                      }
                      return `<a href="${match}" target="_blank" rel="noopener noreferrer" class="text-orange-500 hover:underline">${match}</a>`;
                    })
                    .replace(/\n\n/g, '<br><br>')
                    .replace(/\n/g, '<br>')
                    .replace(/class="[^"]+"/g, '') 
                    .replace(/class='[^']+'/g, '') 
                }}
              />
            </div>
          </form>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 p-4 z-50">
        <div className="flex flex-col space-y-2">
          <button
            onClick={handleSubmit}
            disabled={loading || !isValid}
            className={`w-full py-3 rounded-md font-medium flex items-center justify-center ${
              isValid ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              'Post Deal'
            )}
          </button>
        </div>
      </div>

      <CategorySimpleBottomSheet
        isOpen={isCategorySheetOpen}
        onClose={() => setIsCategorySheetOpen(false)}
        onCategorySelect={handleCategorySelect}
      />

      <StoreBottomSheet
        isOpen={isStoreSheetOpen}
        selectedStore={selectedStoreId}
        onStoreSelect={handleStoreSelect}
        onClose={() => setIsStoreSheetOpen(false)}
      />

      <style>
        {`
          .formatting-button {
            padding: 8px !important;
            margin: 0 2px !important;
            min-width: 40px !important;
            height: 40px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }

          .formatting-button svg {
            width: 20px !important;
            height: 20px !important;
          }

          .formatting-button.active {
            background-color: #4B5563 !important;
            transform: scale(1.05);
          }

          .description-preview {
            white-space: pre-wrap;
          }

          .description-preview p {
            margin-bottom: 0.75rem;
          }

          .description-preview a {
            color: #f97316;
            text-decoration: underline;
          }

          /* Анимация смены главного изображения */
          .main-image-container {
            position: relative;
            overflow: hidden;
          }

          .main-image {
            transition: opacity 0.3s ease, transform 0.3s ease;
          }

          .main-image-container img {
            animation: fadeIn 0.4s ease-out;
          }

          @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }

          /* Стили для мобильных устройств */
          @media (max-width: 640px) {
            .image-controls button {
              padding: 8px;
              min-width: 30px;
              height: 30px;
            }

            .image-controls button svg {
              width: 16px;
              height: 16px;
            }
          }
        `}
      </style>
    </div>
  );
};

export default AddDealPageNew;
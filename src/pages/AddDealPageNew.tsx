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

interface ImageWithId {
  file: File;
  id: string;
  publicUrl: string;
}

const AddDealPageNew: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
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

  const [formData, setFormData] = useState({
    title: '',
    currentPrice: '',
    originalPrice: '',
    description: '',
    category: '',
    dealUrl: '',
    expiryDate: '',
    isHot: false
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

  useEffect(() => {
    // Проверяем все обязательные поля
    const isFormValid = formData.title.trim() !== '' &&
      formData.description.trim() !== '' &&
      formData.currentPrice !== '' &&
      formData.category !== '' &&
      dealImages.length > 0 &&
      formData.dealUrl !== '' &&
      (!formData.originalPrice || Number(formData.currentPrice) <= Number(formData.originalPrice));

    // Проверка URL менее строгая для большей совместимости
    const urlValid = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(formData.dealUrl);

    setIsValid(isFormValid && urlValid);
    console.log('Form validation:', { isFormValid, urlValid, dealImages: dealImages.length });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      if (dealImages.length === 0) throw new Error('At least one image is required');

      // В новой системе, первое изображение в массиве всегда главное
      const mainImageUrl = dealImages[0].publicUrl;

      // Добавим все URL изображений в описание в специальном JSON-формате
      // Это позволит нам хранить дополнительные изображения без изменения структуры БД
      let enhancedDescription = formData.description;
      
      // Если есть дополнительные изображения, добавим их в описание в формате JSON
      if (dealImages.length > 1) {
        const allImagesJson = JSON.stringify(dealImages.map(img => img.publicUrl));
        // Добавляем JSON с изображениями в конец описания в специальном формате
        // который можно будет распознать в DealDetailPage
        enhancedDescription += `\n\n<!-- DEAL_IMAGES: ${allImagesJson} -->`;
      }

      const { data: deal, error: dealError } = await supabase
        .from('deals')
        .insert({
          title: formData.title,
          description: enhancedDescription,
          current_price: Number(formData.currentPrice),
          original_price: formData.originalPrice ? Number(formData.originalPrice) : null,
          store_id: selectedStoreId,
          category_id: formData.category,
          image_url: mainImageUrl,
          deal_url: formData.dealUrl,
          user_id: user?.id,
          expires_at: formData.expiryDate || null,
          is_hot: formData.isHot
        })
        .select()
        .single();

      if (dealError) {
        console.error('Error creating deal:', dealError);
        throw new Error('Failed to create deal');
      }

      navigate(`/deals/${deal.id}`);
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      setError(error instanceof Error ? error.message : 'Failed to create deal');
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
      <div className="fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 px-4 py-3 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => navigate(-1)} className="text-white">
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-white text-lg font-medium ml-4">{t('common.add')} {t('common.deal')}</h1>
          </div>
          <button className="text-white">
            <Info className="h-6 w-6" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pt-16 pb-24">
        <div className="px-4">
          {error && (
            <div className="bg-red-500 text-white px-4 py-3 rounded-md mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                placeholder="Title *"
                className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div>
              <button
                type="button"
                onClick={() => setIsCategorySheetOpen(true)}
                className={`w-full bg-gray-800 text-white rounded-md px-4 py-3 flex items-center justify-between ${
                  formData.category ? 'text-white' : 'text-gray-500'
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
                <ChevronDown className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="flex space-x-4">
              <div className="flex-1">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Current Price *"
                  className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3"
                  value={formData.currentPrice}
                  onChange={(e) => setFormData({ ...formData, currentPrice: e.target.value })}
                  required
                />
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Original Price"
                  className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3"
                  value={formData.originalPrice}
                  onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })}
                />
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
                  <div className="relative h-48 bg-gray-800 rounded-lg overflow-hidden">
                    <img 
                      src={dealImages[0]?.publicUrl} 
                      alt="Main deal image"
                      className="w-full h-full object-contain"
                    />

                    {dealImages.length > 1 && (
                      <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                        Главное изображение
                      </div>
                    )}
                  </div>

                  {/* Миниатюры с возможностью перетаскивания */}
                  {dealImages.length > 1 && (
                    <div className="flex overflow-x-auto space-x-2 py-2 mt-2">
                      {dealImages.map((image, index) => (
                        <div
                          key={image.id}
                          className={`relative flex-shrink-0 w-16 h-16 cursor-move ${
                            index === 0 ? 'ring-2 ring-green-500' : ''
                          }`}
                          draggable={true}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', index.toString());
                            // Визуальный эффект при перетаскивании
                            setTimeout(() => {
                              if (e.currentTarget) {
                                e.currentTarget.style.opacity = '0.5';
                              }
                            }, 0);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                          }}
                          onDragEnter={(e) => {
                            e.preventDefault();
                            e.currentTarget.classList.add('bg-gray-700');
                          }}
                          onDragLeave={(e) => {
                            e.preventDefault();
                            e.currentTarget.classList.remove('bg-gray-700');
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.currentTarget.classList.remove('bg-gray-700');

                            const dragIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
                            const dropIndex = index;

                            if (dragIndex === dropIndex) return;

                            // Переставляем изображения
                            const newImages = [...dealImages];
                            const [removed] = newImages.splice(dragIndex, 1);
                            newImages.splice(dropIndex, 0, removed);

                            setDealImages(newImages);
                            setMainImageIndex(0); // Первое изображение всегда главное
                          }}
                          onDragEnd={(e) => {
                            // Восстанавливаем прозрачность
                            if (e.currentTarget) {
                              e.currentTarget.style.opacity = '1';
                            }
                          }}
                        >
                          <img
                            src={image.publicUrl}
                            alt={`Thumbnail ${index + 1}`}
                            className="w-full h-full object-cover rounded-md"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(image.id)}
                            className="absolute top-0 right-0 p-1 bg-red-500 rounded-full scale-75"
                          >
                            <X className="h-3 w-3 text-white" />
                          </button>
                          {index === 0 && (
                            <div className="absolute top-0 left-0 bg-green-500 text-white text-xs px-1 py-0.5 rounded-sm">
                              1
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 text-xs text-gray-400">
                    {dealImages.length > 1 && 'Перетаскивайте изображения для изменения порядка. Первое изображение слева будет главным.'}
                  </div>
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
                    className="block w-full bg-gray-800 text-white rounded-md px-4 py-3 cursor-pointer hover:bg-gray-700 text-center"
                  >
                    {isUploadingImage ? (
                      <div className="flex items-center justify-center">
                        <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Uploading...
                      </div>
                    ) : (
                      <>
                        <Plus className="h-5 w-5 inline-block mr-2" />
                        {dealImages.length === 0 ? 'Add Images' : 'Add More Images'}
                      </>
                    )}
                  </label>
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
              <div className="bg-gray-800 rounded-lg p-4 min-h-[200px]">
                {!editor?.getText() && (
                  <div className="absolute text-gray-500 pointer-events-none p-1">Description *</div>
                )}
                <EditorContent editor={editor} />
              </div>
            </div>

            <div>
              <input
                type="url"
                placeholder="Deal URL *"
                className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3"
                value={formData.dealUrl}
                onChange={handleUrlInput}
                required
              />
              <p className="text-gray-500 text-sm mt-1">
                Add a link where users can find and purchase this deal
              </p>
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
                Expiry date (optional)
              </p>
            </div>

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
        <div className="flex space-x-4">
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
        `}
      </style>
    </div>
  );
};

export default AddDealPageNew;
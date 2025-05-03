import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import StoreBottomSheet from './StoreBottomSheet';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import { Bold, Italic, Underline as UnderlineIcon, List } from 'lucide-react';
import CategorySimpleBottomSheet from './CategorySimpleBottomSheet';
import { useGlobalState } from '../../contexts/GlobalStateContext'; // Added import

interface AddDealPageProps {
  isEditing?: boolean;
  dealId?: string;
  initialData?: any;
}

const AddDealPage: React.FC<AddDealPageProps> = ({ isEditing = false, dealId, initialData }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { dispatch } = useGlobalState(); // Added dispatch
  const [availableStores, setAvailableStores] = useState<{id: string, name: string, url: string}[]>([]);
  const [isStoreBottomSheetOpen, setIsStoreBottomSheetOpen] = useState(false);
  const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selectedStoreName, setSelectedStoreName] = useState('');
  const [mainImage, setMainImage] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    currentPrice: '',
    originalPrice: '',
    description: '',
    category: '',
    subcategories: [] as string[],
    dealUrl: '',
    expiryDate: '',
    isHot: false
  });

  useEffect(() => {
    const fetchStores = async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('*');

      if (!error && data) {
        setAvailableStores(data);
        console.log('Fetched stores:', data.length);
      }
    };

    fetchStores();
  }, []);

  // Initialize form when first rendered
  useEffect(() => {
    if (initialData) {
      console.log('Initializing form with data:', initialData);
      setFormData({
        title: initialData.title || '',
        currentPrice: initialData.current_price || '',
        originalPrice: initialData.original_price || '',
        description: initialData.description || '',
        category: initialData.category_id || '',
        subcategories: initialData.subcategories || [],
        dealUrl: initialData.deal_url || '',
        expiryDate: initialData.expires_at || '',
        isHot: Boolean(initialData.is_hot)
      });

      // Set store ID if it exists
      if (initialData.store_id) {
        console.log('Setting store ID:', initialData.store_id);
        setSelectedStoreId(initialData.store_id);

        // Find store name
        const store = availableStores.find(s => s.id === initialData.store_id);
        if (store) {
          setSelectedStoreName(store.name);
        }
      }
    }
  }, [initialData, availableStores]); 

  // Get store name
  const getStoreName = (storeId: string | null) => {
    if (!storeId) return '';
    const store = availableStores.find(s => s.id === storeId);
    return store ? store.name : '';
  };

  // Store bottom sheet handlers
  const handleStoreBottomSheetClose = () => {
    console.log('Closing store bottom sheet');
    setIsStoreBottomSheetOpen(false);
  };

  const handleStoreAdd = async (newStore: { id: string; name: string; url: string }) => {
    console.log('AddDealPage - handleStoreAdd called with new store:', newStore);

    setAvailableStores(prev => {
      const updated = [...prev, newStore];
      console.log('AddDealPage - availableStores updated, new length:', updated.length);
      return updated;
    });

    console.log('AddDealPage - setting selected store to:', newStore.id);
    setSelectedStoreId(newStore.id);
    setSelectedStoreName(newStore.name);
    console.log('AddDealPage - selectedStoreName set to:', newStore.name);
    setIsStoreBottomSheetOpen(false);
  };

  const handleStoreSelect = (storeId: string) => {
    console.log('Selected store ID:', storeId);
    setSelectedStoreId(storeId);

    const selectedStore = availableStores.find(s => s.id === storeId);
    if (selectedStore) {
      setSelectedStoreName(selectedStore.name);
    }
    setIsStoreBottomSheetOpen(false);
  };

  // Category selection handler
  const handleCategorySelect = (categoryId: string) => {
    setFormData(prev => ({...prev, category: categoryId}));
    setIsCategorySheetOpen(false);
  };

  // Handle main image upload
  const handleMainImageUpload = async (files: FileList | null) => {
    if (!files || !files[0]) return;
    const file = files[0];
    setMainImage(file);
  };

  // Calculate discount
  const calculateDiscount = () => {
    if (formData.currentPrice && formData.originalPrice) {
      const current = Number(formData.currentPrice);
      const original = Number(formData.originalPrice);
      if (current && original && current <= original) {
        return Math.round(((original - current) / original) * 100);
      }
    }
    return null;
  };

  // Editor setup
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
      }),
      Underline,
      Image,
    ],
    content: formData.description,
    onUpdate: ({ editor }) => {
      setFormData(prev => ({
        ...prev,
        description: editor.getHTML()
      }));
    }
  });

  useEffect(() => {
    if (editor && initialData && initialData.description) {
      editor.commands.setContent(initialData.description);
    }
  }, [editor, initialData]);

  // Log form data changes
  useEffect(() => {
    console.log('formData updated:', formData);
    console.log('Title:', formData.title, typeof formData.title);
    console.log('Current Price:', formData.currentPrice, typeof formData.currentPrice);
    console.log('Original Price:', formData.originalPrice, typeof formData.originalPrice);
    console.log('Category:', formData.category, typeof formData.category);
    console.log('Deal URL:', formData.dealUrl, typeof formData.dealUrl);
    console.log('Is Hot:', formData.isHot, typeof formData.isHot);
  }, [formData]);

  // Log store sheet open/close
  useEffect(() => {
    console.log('AddDealPage - isStoreSheetOpen state changed:', isStoreBottomSheetOpen);
  }, [isStoreBottomSheetOpen]);

  console.log('AddDealPage - StoreBottomSheet props:', {
    isOpen: isStoreBottomSheetOpen,
    selectedStore: selectedStoreId,
    onStoreSelect: handleStoreSelect
  });

  return (
    <>
      <StoreBottomSheet
        isOpen={isStoreBottomSheetOpen}
        onClose={handleStoreBottomSheetClose}
        selectedStore={selectedStoreId}
        onStoreSelect={handleStoreSelect}
        onStoreAdd={handleStoreAdd}
        stores={availableStores}
      />

      <CategorySimpleBottomSheet
        isOpen={isCategorySheetOpen}
        onClose={() => setIsCategorySheetOpen(false)}
        onCategorySelect={handleCategorySelect}
      />

      {/* Компонент не содержит элемент выбора магазина */}

      {/* Title */}
      <div className="mb-4">
        <label className="block text-gray-400 mb-2">Title *</label>
        <input
          type="text"
          placeholder="Enter deal title"
          className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
        />
        {isEditing && formData.title && <p className="mt-1 text-xs text-orange-500">Current title: {formData.title}</p>}
      </div>

      {/* Category */}
      <div className="mb-4">
        <label className="block text-gray-400 mb-2">Category *</label>
        <button
          type="button"
          onClick={() => setIsCategorySheetOpen(true)}
          className={`w-full bg-gray-800 text-white rounded-md px-4 py-3 flex items-center justify-between ${
            formData.category ? 'text-white' : 'text-gray-500'
          }`}
        >
          <span>{formData.category ? formData.category : 'Select Category'}</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Price fields */}
      <div className="flex space-x-4 mb-4">
        <div className="flex-1">
          <label className="block text-gray-400 mb-2">Current Price *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="Current Price"
            className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3"
            value={formData.currentPrice}
            onChange={(e) => setFormData({ ...formData, currentPrice: e.target.value })}
            required
          />
        </div>
        <div className="flex-1">
          <label className="block text-gray-400 mb-2">Original Price</label>
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

      {/* Discount display */}
      {calculateDiscount() !== null && (
        <div className="text-green-500 text-sm mb-4">
          Discount: {calculateDiscount()}%
        </div>
      )}

      {/* Description editor */}
      <div className="mb-4">
        <label className="block text-gray-400 mb-2">Description *</label>
        <div className="flex items-center gap-1 mb-2 bg-gray-900 p-2 rounded-t-md">
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleBold().run()}
            className={`p-2 rounded ${editor?.isActive('bold') ? 'bg-gray-700 text-white' : 'text-gray-400'}`}
          >
            <Bold className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            className={`p-2 rounded ${editor?.isActive('italic') ? 'bg-gray-700 text-white' : 'text-gray-400'}`}
          >
            <Italic className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
            className={`p-2 rounded ${editor?.isActive('underline') ? 'bg-gray-700 text-white' : 'text-gray-400'}`}
          >
            <UnderlineIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            className={`p-2 rounded ${editor?.isActive('bulletList') ? 'bg-gray-700 text-white' : 'text-gray-400'}`}
          >
            <List className="h-5 w-5" />
          </button>
        </div>
        <div className="bg-gray-800 rounded-b-md p-4 min-h-[200px]">
          <EditorContent editor={editor} />
        </div>

        {/* Preview */}
        {formData.description && (
          <div className="mt-4">
            <div className="text-sm text-gray-400 mb-2">Preview:</div>
            <div 
              className="bg-gray-800 text-white rounded-md p-4 description-preview" 
              dangerouslySetInnerHTML={{ __html: formData.description }}
            />
          </div>
        )}
      </div>

      {/* Main image */}
      <div className="mb-4">
        <label className="block text-gray-400 mb-2">Main Image *</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleMainImageUpload(e.target.files)}
          className="hidden"
          id="main-image-upload"
        />
        <label
          htmlFor="main-image-upload"
          className="block w-full bg-gray-800 text-white rounded-md px-4 py-3 cursor-pointer hover:bg-gray-700"
        >
          {mainImage ? 'Change Main Image' : 'Select Main Image'}
        </label>
        {mainImage && (
          <img
            src={URL.createObjectURL(mainImage)}
            alt="Main deal image"
            className="mt-2 w-full h-48 object-cover rounded-lg"
          />
        )}
        {initialData && initialData.image_url && !mainImage && (
          <img
            src={initialData.image_url}
            alt="Current main image"
            className="mt-2 w-full h-48 object-cover rounded-lg"
          />
        )}
      </div>

      {/* Deal URL */}
      <div className="mb-4">
        <label className="block text-gray-400 mb-2">Deal URL *</label>
        <input
          type="url"
          placeholder="https://..."
          className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3"
          value={formData.dealUrl}
          onChange={(e) => setFormData({ ...formData, dealUrl: e.target.value })}
          required
        />
      </div>

      {/* Expiry date */}
      <div className="mb-4">
        <label className="block text-gray-400 mb-2">Expiry Date (Optional)</label>
        <input
          type="date"
          className="w-full bg-gray-800 text-white rounded-md px-4 py-3"
          value={formData.expiryDate}
          min={new Date().toISOString().split('T')[0]}
          onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
        />
      </div>

      {/* Is hot checkbox */}
      <div className="mb-4">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="isHot"
            checked={formData.isHot}
            onChange={(e) => setFormData({ ...formData, isHot: e.target.checked })}
            className="form-checkbox h-5 w-5 text-orange-500"
          />
          <label htmlFor="isHot" className="text-white">Mark as HOT</label>
        </div>
      </div>

      {/* Submit Button */}
      <div className="mt-6 mb-20">
        <button
          type="button"
          onClick={async () => {
            // Валидация формы
            if (!formData.title || !formData.currentPrice || !formData.category || !formData.dealUrl || !formData.description) {
              setError('Пожалуйста, заполните все обязательные поля');
              return;
            }

            // Отобразить сообщение о загрузке
            setIsLoading(true);
            setError(null);

            try {
              // Подготовка данных для отправки
              const dealData = {
                title: formData.title,
                current_price: parseFloat(formData.currentPrice),
                original_price: formData.originalPrice ? parseFloat(formData.originalPrice) : null,
                description: formData.description,
                category_id: formData.category,
                deal_url: formData.dealUrl,
                expires_at: formData.expiryDate || null,
                is_hot: formData.isHot,
                store_id: selectedStoreId
              };

              console.log('Отправляем данные сделки:', dealData);

              let imageUrl = null;

              // Загрузка изображения, если оно выбрано
              if (mainImage) {
                const fileExt = mainImage.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = user ? `${user.id}/${fileName}` : `anonymous/${fileName}`;

                console.log('Загружаем изображение:', filePath);

                const { data: uploadData, error: uploadError } = await supabase.storage
                  .from('deal-images')
                  .upload(filePath, mainImage);

                if (uploadError) {
                  throw new Error(`Ошибка загрузки изображения: ${uploadError.message}`);
                }

                const { data: urlData } = supabase.storage
                  .from('deal-images')
                  .getPublicUrl(filePath);

                imageUrl = urlData.publicUrl;
                dealData.image_url = imageUrl;
              }

              let result;

              // Если редактируем существующую сделку
              if (isEditing && dealId) {
                console.log('Обновляем существующую сделку ID:', dealId);
                // Mark deals as stale before updating
                if (dispatch) {
                  dispatch({ type: 'MARK_DEALS_STALE' });
                }
                result = await supabase
                  .from('deals')
                  .update(dealData)
                  .eq('id', dealId);
                if (result.error) throw result.error;

                // Помечаем состояние сделок как устаревшее, чтобы обновить список

                navigate(`/deals/${dealId}`);
              } else {
                // Создаем новую сделку
                console.log('Создаем новую сделку');
                result = await supabase
                  .from('deals')
                  .insert(dealData);
                if (result.error) throw result.error;
                navigate('/deals');
              }

              console.log('Сделка успешно сохранена!', result);

              console.log('Сделка успешно сохранена, перенаправление...');


            } catch (err) {
              console.error('Ошибка при сохранении:', err);
              setError(err.message || 'Произошла ошибка при сохранении сделки');
            } finally {
              setIsLoading(false);
            }
          }}
          className="w-full py-3 rounded-md font-medium bg-orange-500 text-white flex items-center justify-center"
        >
          {isLoading ? (
            <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            isEditing ? 'Save Changes' : 'Post Deal'
          )}
        </button>
        {error && <p className="mt-2 text-red-500 text-sm">{error}</p>}
      </div>

      {/* CSS стили для превью */}
      <style>{`
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
        .description-preview ul {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin-bottom: 0.75rem;
        }
      `}</style>
    </>
  );
};

export default AddDealPage;
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bold, Italic, Underline as UnderlineIcon, List, Image as ImageIcon, Link as LinkIcon, Info, ChevronDown, X, Plus } from 'lucide-react';
import { categories, stores, categoryIcons } from '../data/mockData'; // Убедитесь, что этот путь корректен
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAdmin } from '../hooks/useAdmin';
import { supabase } from '../lib/supabase';
import ImageUploader from '../components/deals/ImageUploader'; // Убедитесь, что этот путь корректен
import imageCompression from 'browser-image-compression';
import { createPortal } from 'react-dom';
import CategorySimpleBottomSheet from '../components/deals/CategorySimpleBottomSheet'; // Убедитесь, что этот путь корректен
import StoreBottomSheet from '../components/deals/StoreBottomSheet'; // Убедитесь, что этот путь корректен
import { useModeration } from '../contexts/ModerationContext'; // <<< ДОБАВЛЕН ИМПОРТ

interface Subcategory {
  id: string;
  name: string;
}

interface ImageWithId {
  file: File;
  id: string;
  publicUrl: string;
}

interface AddDealPageProps {
  isEditing?: boolean;
  dealId?: string;
  initialData?: any;
  autoApprove?: boolean;
}

const AddDealPage: React.FC<AddDealPageProps> = ({ isEditing = false, dealId, initialData, autoApprove }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { role } = useAdmin();
  const { t, language } = useLanguage();
  const { addToModerationQueue } = useModeration(); // <<< ХУК ВЫЗВАН ЗДЕСЬ, НА ВЕРХНЕМ УРОВНЕ

  const canMarkHot = role === 'admin' || role === 'moderator';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [selectedMainCategory, setSelectedMainCategory] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [mainImage, setMainImage] = useState<File | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const selectedStoreName = stores.find(store => store.id === selectedStoreId)?.name || '';
  const categoryRef = useRef<HTMLDivElement>(null);
  const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false);
  const [isStoreSheetOpen, setIsStoreSheetOpen] = useState(false);

  const [formData, setFormData] = useState({
    title: initialData?.title || '', // Добавлена инициализация из initialData
    currentPrice: initialData?.current_price?.toString() || '', // Добавлена инициализация
    originalPrice: initialData?.original_price?.toString() || '', // Добавлена инициализация
    description: initialData?.description || '', // Добавлена инициализация
    category: initialData?.category_id || '', // Добавлена инициализация
    subcategories: [] as string[],
    dealUrl: initialData?.deal_url || '', // Добавлена инициализация
    expiryDate: initialData?.expires_at ? new Date(initialData.expires_at).toISOString().split('T')[0] : '', // Добавлена инициализация
    isHot: initialData?.is_hot || false // Добавлена инициализация
  });

  const [descriptionImages, setDescriptionImages] = useState<ImageWithId[]>([]);
  const [showDeleteButton, setShowDeleteButton] = useState<{ [key: string]: boolean }>({});
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [selectedImagePosition, setSelectedImagePosition] = useState<{ top: number; left: number } | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);


useEffect(() => {
  console.log('AddDealPage - isStoreSheetOpen state changed:', isStoreSheetOpen);
}, [isStoreSheetOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setCategoryMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Загрузка главного изображения при редактировании, если оно есть в initialData
  useEffect(() => {
    if (isEditing && initialData?.image_url) {
      // Для mainImage мы не можем просто установить File из URL,
      // но можем показать его как уже загруженное или предложить заменить.
      // Здесь просто для примера выведем в консоль.
      // Отображение существующего mainImage потребует другой логики,
      // например, хранить initialData.image_url и показывать его,
      // а mainImage будет использоваться только для нового файла.
      console.log('Editing mode: main image URL from initialData:', initialData.image_url);
      // Если вы хотите, чтобы mainImage не было обязательным при редактировании, если оно уже есть:
      // setMainImage(new File([], "existing_main_image.jpg")); // Это "заглушка", чтобы форма считала, что изображение есть
    }
  }, [isEditing, initialData]);


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

  const handleImageClick = (imageId: string) => {
    setShowDeleteButton(prev => ({
        ...prev,
      [imageId]: !prev[imageId]
    }));
  };

  const handleDeleteImage = (imageId: string) => {
    if (editor) {
      const imageNode = editor.view.dom.querySelector(`img[alt="${imageId}"]`);
      if (imageNode) {
        const pos = editor.view.posAtDOM(imageNode, 0);
        editor.chain().focus().deleteRange({ from: pos, to: pos + 1 }).run();

        setDescriptionImages(prev => {
          const newImages = prev.filter(img => img.id !== imageId);
          return newImages;
        });

        const wrapperElement = editor.view.dom.querySelector(`[data-image-id="${imageId}"]`);
        if (wrapperElement) {
          wrapperElement.remove();
        }

        setSelectedImageId(null);
      }
    }
  };

  const checkImagesInEditor = () => {
    if (editor) {
      const imgElements = editor.view.dom.querySelectorAll('img[alt^="img-"]');
      const currentImageIds = new Set<string>();

      imgElements.forEach(img => {
        const imgId = img.getAttribute('alt');
        if (imgId) {
          currentImageIds.add(imgId);
        }
      });

      setDescriptionImages(prev => {
        const imagesInEditor = prev.filter(img => currentImageIds.has(img.id));
        if (imagesInEditor.length !== prev.length) {
          prev
            .filter(img => !currentImageIds.has(img.id))
            .forEach(deletedImg => {
              const wrapperElement = editor.view.dom.querySelector(`[data-image-id="${deletedImg.id}"]`);
              if (wrapperElement) {
                wrapperElement.remove();
              }
            });
        }
        return imagesInEditor;
      });
    }
  };

  const handleDescriptionImageUpload = async (files: FileList | null) => {
    if (!files || !files.length || !editor) {
      return;
    }

    const imgElements = editor.view.dom.querySelectorAll('img[alt^="img-"]');
    const currentImageCount = imgElements.length;
    const newImageCount = currentImageCount + files.length;
    if (newImageCount > 4) {
      alert('You can upload a maximum of 4 images');
      return;
    }

    setIsUploadingImage(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (!file.type.startsWith('image/')) {
          throw new Error('Please select only image files');
        }

        const compressedImage = await compressImage(file);

        const imageId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const fileExt = compressedImage.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${user?.id}/description/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('deal-images')
          .upload(filePath, compressedImage, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Error uploading description image:', uploadError);
          throw new Error('Failed to upload description image');
        }

        const { data: { publicUrl } } = supabase.storage
          .from('deal-images')
          .getPublicUrl(filePath);

        setDescriptionImages(prev => [...prev, {
          file: compressedImage,
          id: imageId,
          publicUrl: publicUrl
        }]);

        editor.chain()
          .focus()
          .insertContent(`
            <div class="image-wrapper" data-image-id="${imageId}">
              <img src="${publicUrl}" alt="${imageId}" class="max-w-full h-auto rounded-lg my-4" />
            </div>
          `)
          .run();

        editor.chain().focus().insertContent('<p></p>').run();
      }
    } catch (error) {
      console.error('Error in image upload process:', error);
      alert(`Failed to process images: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleMainImageUpload = async (files: FileList | null) => {
    if (!files || !files[0]) return;
    const file = files[0];
    const compressedImage = await compressImage(file);
    setMainImage(compressedImage);
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

    // Позволяем originalPrice быть равным currentPrice
    if (formData.originalPrice && Number(formData.currentPrice) > Number(formData.originalPrice)) {
      setError('Current price cannot be higher than original price');
      return false;
    }

    if (!formData.category) {
      setError('Please select a category');
      return false;
    }

    // Main image is required only when creating, or if not already present in initialData when editing
    if (!isEditing && !mainImage) {
      setError('Main image is required');
      return false;
    }
    if (isEditing && !initialData?.image_url && !mainImage) {
        setError('Main image is required');
        return false;
    }


    if (!formData.dealUrl) {
      setError('Deal URL is required');
      return false;
    }

    // Более простая и общая проверка URL
    const urlRegex = /^(https?:\/\/)?([^\s(["<,>]*)\.([^\s(["<,>]*){2,}(\/[^\s]*)?$/i;
    if (!urlRegex.test(formData.dealUrl)) {
      setError('Please enter a valid URL');
      return false;
    }

    // Автоматическое добавление https:// если протокол отсутствует
    if (!formData.dealUrl.startsWith('http://') && !formData.dealUrl.startsWith('https://')) {
      // Используем callback-форму setFormData, чтобы гарантировать работу с актуальным состоянием
      setFormData(prev => ({
        ...prev,
        dealUrl: `https://${prev.dealUrl}`
      }));
    }

    return true;
  };

  useEffect(() => {
    const isMainImagePresent = isEditing ? (initialData?.image_url || mainImage) : mainImage;
    const isUrlValid = /^(https?:\/\/)?([^\s(["<,>]*)\.([^\s(["<,>]*){2,}(\/[^\s]*)?$/i.test(formData.dealUrl);

    const isFormValid = formData.title.trim() !== '' &&
      formData.description.trim() !== '' &&
      formData.currentPrice !== '' && !isNaN(Number(formData.currentPrice)) &&
      (!formData.originalPrice || (!isNaN(Number(formData.originalPrice)) && Number(formData.currentPrice) <= Number(formData.originalPrice))) &&
      formData.category !== '' &&
      isMainImagePresent !== null &&
      formData.dealUrl !== '' &&
      isUrlValid;

    setIsValid(isFormValid);
  }, [formData, mainImage, isEditing, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    console.log('AddDealPage - Значение autoApprove при handleSubmit:', autoApprove);
    console.log('AddDealPage - isEditing:', isEditing, 'dealId:', dealId);
    console.log('AddDealPage - user role:', role);
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      let currentImageUrl = isEditing ? initialData?.image_url : null;

      if (mainImage) { // Если загружено новое главное изображение (или при создании)
        const fileExt = mainImage.name.split('.').pop();
        const fileName = `${user?.id}-${Date.now()}.${fileExt}`; // Более уникальное имя файла
        const filePath = `${user?.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('deal-images')
          .upload(filePath, mainImage, {
            cacheControl: '3600',
            upsert: isEditing // true если редактируем и хотим перезаписать, false если создаем
          });

        if (uploadError) {
          console.error('Error uploading main image:', uploadError);
          throw new Error('Failed to upload main image');
        }

        const { data: { publicUrl } } = supabase.storage
          .from('deal-images')
          .getPublicUrl(filePath);
        currentImageUrl = publicUrl;
      }

      if (!currentImageUrl) { // Проверка, что URL изображения точно есть
          throw new Error('Main image URL is missing');
      }

      const dealPayload: any = {
        title: formData.title,
        description: formData.description, // Убедитесь, что editor.getHTML() используется, если нужно
        current_price: Number(formData.currentPrice),
        original_price: formData.originalPrice ? Number(formData.originalPrice) : null,
        store_id: selectedStoreId,
        category_id: formData.category,
        // subcategories: formData.subcategories, // Если это поле есть в БД
        image_url: currentImageUrl,
        deal_url: formData.dealUrl,
        expires_at: formData.expiryDate ? `${formData.expiryDate}T23:59:59.999Z` : null, // Устанавливаем конец дня
        is_hot: formData.isHot,
      };


      if (isEditing && dealId) {
        // Обновление существующей скидки
        console.log('Updating existing deal:', dealId);

        if (autoApprove) {
          dealPayload.status = 'approved';
          dealPayload.moderator_id = user?.id;
          dealPayload.moderated_at = new Date().toISOString();
        } else {
           // Если не авто-одобрение, и скидка была 'approved', возможно, нужно снова на 'pending'
           // Эта логика должна быть более сложной и учитывать текущий статус
           if (initialData?.status === 'approved' || initialData?.status === 'published') {
             // dealPayload.status = 'pending'; // Решите, нужна ли повторная модерация
           }
        }
        
        const { error: updateError } = await supabase
          .from('deals')
          .update(dealPayload)
          .eq('id', dealId);

        if (updateError) {
          console.error('Error updating deal:', updateError);
          throw new Error(`Failed to update deal: ${updateError.message}`);
        }

        if (autoApprove) {
          console.log('AddDealPage - Deal updated and auto-approved, removing from moderation queue if present');
          await supabase
            .from('moderation_queue')
            .delete()
            .eq('item_id', dealId)
            .eq('item_type', 'deal'); // Убедитесь, что item_type правильный
          navigate('/moderation');
          alert('Deal successfully updated and approved.');
        } else {
          // Если не авто-одобрение, но статус был изменен на pending, добавить в очередь
          if (dealPayload.status === 'pending') {
             await addToModerationQueue(dealId, 'deal');
          }
          navigate(`/deals/${dealId}`);
        }

      } else {
        // Создание новой скидки
        dealPayload.user_id = user?.id;
        // Для новых сделок статус по умолчанию будет 'pending' или тот, что установит БД
        // или же его нужно явно устанавливать здесь перед отправкой в addToModerationQueue

        const { data: newDeal, error: dealError } = await supabase
          .from('deals')
          .insert(dealPayload)
          .select()
          .single();

        if (dealError) {
          console.error('Error creating deal:', dealError);
          throw new Error(`Failed to create deal: ${dealError.message}`);
        }

        if (newDeal) {
            // После создания, если не autoApprove (которого нет для новых по умолчанию)
            // или если роль не админ/модератор, добавляем в очередь модерации
            // Функция addToModerationQueue сама проверит, нужно ли добавлять или авто-одобрить
            // await addToModerationQueue(newDeal.id, 'deal');
    console.log('ВРЕМЕННО: Вызов addToModerationQueue пропущен для теста');

            navigate(`/deals/${newDeal.id}`);
        } else {
            throw new Error('Failed to create deal, no data returned.');
        }
      }
    } catch (err) {
      console.error('Error in handleSubmit:', err);
      // Проверяем, является ли err экземпляром Error
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(isEditing ? 'Failed to update deal' : 'Failed to create deal');
      }
    } finally {
      setLoading(false);
    }
  };

  const calculateDiscount = useCallback(() => {
    if (formData.currentPrice && formData.originalPrice) {
      const current = Number(formData.currentPrice);
      const original = Number(formData.originalPrice);
      if (!isNaN(current) && !isNaN(original) && original > 0 && current <= original) { // original > 0 to avoid division by zero
        return Math.round(((original - current) / original) * 100);
      }
    }
    return null;
  }, [formData.currentPrice, formData.originalPrice]);

  const handleCategorySelect = (categoryId: string) => {
    setFormData(prev => ({...prev, category: categoryId}));
    setIsCategorySheetOpen(false);
  };

  const handleSubcategoryChange = (subcategory: string) => {
    setFormData(prev => ({
      ...prev,
      subcategories: prev.subcategories.includes(subcategory)
        ? prev.subcategories.filter((sub: string) => sub !== subcategory)
        : [...prev.subcategories, subcategory]
    }));
  };

  const selectedCategory = categories.find(cat => cat.id === selectedMainCategory);

  useEffect(() => {
    (window as any).handleImageClick = handleImageClick;
    (window as any).handleDeleteImage = handleDeleteImage;
  }, [showDeleteButton]); // Зависимость от showDeleteButton может быть не нужна, если функции не меняются

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
            class: 'mb-3', // Можно настроить отступы по умолчанию
          },
        },
        hardBreak: { // Для <br> по Shift+Enter или Enter (как настроено ниже)
          keepMarks: true,
          HTMLAttributes: {
            class: 'inline-block', // Или другие классы, если нужны
          },
        },
      }),
      Underline,
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg my-4 relative delete-button-container',
        },
        allowBase64: true, // Разрешаем вставку base64, но лучше загружать на сервер
      }),
    ],
    content: formData.description, // Инициализация редактора из formData
    parseOptions: {
      preserveWhitespace: 'full',
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[200px]',
      },
      handleKeyDown: (view, event) => {
        if (event.key === 'Enter' && !event.shiftKey) { // Обычный Enter создает <br>
          event.preventDefault(); // Предотвращаем стандартное поведение Enter (новый параграф)
          view.dispatch(view.state.tr.replaceSelectionWith(
            view.state.schema.nodes.hardBreak.create()
          ).scrollIntoView());
          return true; // Сообщаем, что событие обработано
        }
        // Для Shift+Enter (если нужен новый параграф) можно не обрабатывать, он сработает по умолчанию
        return false; // Для других клавиш передаем управление дальше
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setFormData(prev => ({
        ...prev,
        description: html
      }));
      checkImagesInEditor(); // Проверяем изображения после каждого обновления
    },
  });
  
  // Инициализация редактора содержимым при редактировании
  useEffect(() => {
    if (isEditing && initialData?.description && editor && !editor.isDestroyed) {
        if (editor.getHTML() !== initialData.description) { // Обновляем только если контент реально отличается
            editor.commands.setContent(initialData.description);
        }
    }
  }, [isEditing, initialData, editor]);


  useEffect(() => {
    if (editor) {
      console.log('Editor initialized with extensions:', editor.extensionManager.extensions);
    }
  }, [editor]);

  useEffect(() => {
    if (editor) {
      const handleClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const imageNode = target.closest('img[alt^="img-"]');
        if (imageNode) {
          const imageId = imageNode.getAttribute('alt');
          if (imageId) {
            setSelectedImageId(imageId);
          }
        } else {
          setSelectedImageId(null); // Сбрасываем выделение, если клик не по изображению
        }
      };

      // Используем editor.view.dom для добавления слушателя
      if (editor.view && editor.view.dom) {
        editor.view.dom.addEventListener('click', handleClick);
        return () => {
          if (editor.view && editor.view.dom && !editor.isDestroyed) { // Проверка на isDestroyed
            editor.view.dom.removeEventListener('click', handleClick);
          }
        };
      }
    }
  }, [editor]);

  useEffect(() => {
    console.log('descriptionImages updated:', descriptionImages.length);
  }, [descriptionImages]);

  useEffect(() => {
    if (editor && editor.view.dom && !editor.isDestroyed) { // Проверка на isDestroyed
      const editorDom = editor.view.dom;

      const observer = new MutationObserver((mutations) => {
        let needsCheck = false;

        mutations.forEach(mutation => {
          if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
            Array.from(mutation.removedNodes).forEach(node => {
              if (node instanceof HTMLElement) {
                if (node.classList?.contains('image-wrapper') ||
                    node.tagName === 'IMG' ||
                    node.querySelector('img')) {
                  needsCheck = true;
                }
              }
            });
          }
        });

        if (needsCheck) {
          setTimeout(checkImagesInEditor, 0); // Вызов с задержкой для корректной работы
        }
      });

      observer.observe(editorDom, {
        childList: true,
        subtree: true,
        characterData: false, // Обычно не нужно для отслеживания удаления элементов
        attributes: false // Обычно не нужно для отслеживания удаления элементов
      });

      return () => {
        observer.disconnect();
      };
    }
  }, [editor]); // Добавляем editor как зависимость

  const handleStoreSelect = (storeId: string | null) => {
    setSelectedStoreId(storeId);
    setIsStoreSheetOpen(false);
  };

  // Логирование пропсов для StoreBottomSheet
  useEffect(() => {
    console.log('AddDealPage - StoreBottomSheet props:', {
      isOpen: isStoreSheetOpen,
      selectedStore: selectedStoreId,
      onStoreSelect: handleStoreSelect // Это сама функция, её содержимое не логируется так просто
    });
  }, [isStoreSheetOpen, selectedStoreId]); // Добавил handleStoreSelect в зависимости на всякий случай, хотя она и так стабильна из-за useCallback (если бы был)

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 px-4 py-3 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => navigate(-1)} className="text-white">
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-white text-lg font-medium ml-4">{isEditing ? t('common.edit') : t('common.add')} {t('common.deal')}</h1>
          </div>
          {/* <button className="text-white">
            <Info className="h-6 w-6" />
          </button> */}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto pt-16 pb-24"> {/* pt-16 чтобы контент не уходил под фиксированный хедер */}
        <div className="px-4"> {/* Отступы по бокам */}
          {error && (
            <div className="bg-red-500 text-white px-4 py-3 rounded-md mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title Input */}
            <div>
              <input
                type="text"
                placeholder={`${t('deals.title')} *`}
                className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            {/* Category Selector */}
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
                    ? (language === 'ru'
                      ? categories.find(cat => cat.id === formData.category)?.name
                      : t(`categories.${formData.category}`)) || formData.category // Fallback to ID if translation not found
                    : `${t('deals.selectCategory')} *`
                  }
                </span>
                <ChevronDown className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            {/* Price Inputs */}
            <div className="flex space-x-4">
              <div className="flex-1">
                <input
                  type="number" // Используем number для лучшей валидации и клавиатуры на мобильных
                  step="0.01" // Для копеек/центов
                  min="0"
                  placeholder={`${t('deals.currentPrice')} *`}
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
                  placeholder={t('deals.originalPrice')}
                  className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3"
                  value={formData.originalPrice}
                  onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })}
                />
              </div>
            </div>

            {/* Discount Display */}
            {calculateDiscount() !== null && (
              <div className="text-green-500 text-sm">
                {t('deals.discount')}: {calculateDiscount()}%
              </div>
            )}

            {/* Tiptap Editor */}
            <div className="relative" ref={editorRef}>
              <div className="flex flex-wrap items-center justify-between gap-1 mb-2">
                <div className="flex flex-wrap items-center gap-1">
                  {/* Formatting Buttons */}
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
                  {/* Image Upload Button */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => document.getElementById('description-image-upload')?.click()}
                      className={`formatting-button p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors duration-200 ${
                        descriptionImages.length >= 4 ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      disabled={descriptionImages.length >= 4}
                      title={descriptionImages.length >= 4 ? 'Maximum 4 images allowed' : 'Add images to description'}
                    >
                      <div className="flex items-center">
                        <ImageIcon className="h-5 w-5" />
                        <span className="text-xs ml-1 text-gray-500">({descriptionImages.length}/4)</span>
                      </div>
                    </button>
                    <input
                      type="file"
                      accept="image/*"
                      id="description-image-upload"
                      className="hidden"
                      multiple // Разрешаем множественный выбор файлов
                      onChange={(e) => {
                        const files = e.target.files;
                        if (files) {
                          const remainingSlots = 4 - descriptionImages.length;
                          if (files.length > remainingSlots) {
                            alert(`You can only add ${remainingSlots} more image${remainingSlots === 1 ? '' : 's'}`);
                            // Очищаем input, чтобы пользователь мог выбрать заново
                            e.target.value = ''; 
                            return;
                          }
                          handleDescriptionImageUpload(files);
                          e.target.value = ''; // Очищаем input после успешной обработки
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Delete Image Button (conditionally rendered) */}
                <div className="ml-auto">
                  {selectedImageId && (
                    <button
                      type="button"
                      className="delete-image-button flex items-center justify-center px-2 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors duration-200"
                      onClick={() => {
                        if (selectedImageId) {
                          handleDeleteImage(selectedImageId);
                          setSelectedImageId(null); // Сбрасываем выделение после удаления
                        }
                      }}
                      title="Delete selected image"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 min-h-[200px]">
                {!editor?.getText() && <div className="absolute text-gray-500 pointer-events-none">{`${t('deals.description')} *`}</div>}
                <EditorContent editor={editor} />
              </div>
            </div>

            {/* Main Image Upload */}
            <div>
              <label className="block text-gray-400 mb-2">{t('deals.mainImage')} *</label>
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
                {mainImage ? t('deals.changeMainImage') : `${t('deals.selectMainImage')} *`}
              </label>
              {/* Preview for newly selected main image */}
              {mainImage && (
                <img
                  src={URL.createObjectURL(mainImage)}
                  alt="Main deal image preview"
                  className="mt-2 w-full h-48 object-cover rounded-lg"
                />
              )}
              {/* Preview for existing main image when editing */}
              {isEditing && initialData?.image_url && !mainImage && (
                <img
                  src={initialData.image_url}
                  alt="Current main deal image"
                  className="mt-2 w-full h-48 object-cover rounded-lg"
                />
              )}
            </div>

            {/* Deal URL Input */}
            <div>
              <input
                type="url" // тип url для семантики и возможной валидации браузером
                placeholder={`${t('deals.dealUrl')} *`}
                className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3"
                value={formData.dealUrl}
                onChange={(e) => setFormData({ ...formData, dealUrl: e.target.value })}
                required
              />
              <p className="text-gray-500 text-sm mt-1">
                {t('deals.dealUrlHint')}
              </p>
            </div>

            {/* Expiry Date Input */}
            <div>
              <div className="relative">
                <input
                  type="date"
                  className="w-full bg-gray-800 text-white rounded-md px-4 py-3"
                  value={formData.expiryDate}
                  min={new Date().toISOString().split('T')[0]} // Сегодняшняя дата как минимальная
                  onChange={(e) =>{
                    const selectedDate = new Date(e.target.value);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0); // Устанавливаем время на начало дня для корректного сравнения

                    if (selectedDate < today) {
                      setError('Expiry date cannot be earlier than today');
                      // Можно не устанавливать дату, если она невалидна, или оставить как есть,
                      // но тогда валидация формы должна это учитывать.
                      // setFormData({ ...formData, expiryDate: '' }); // Опционально - сбросить дату
                      return;
                    }
                    setError(null); // Сбрасываем ошибку, если дата валидна
                    setFormData({ ...formData, expiryDate: e.target.value });
                  }}
                />
                {/* Кнопка для очистки даты */}
                {formData.expiryDate && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, expiryDate: '' })}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                    title="Clear date"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
              <p className="text-gray-500 text-sm mt-1">
                {t('deals.expiryDateOptional')}
              </p>
            </div>

            {/* Mark as HOT Checkbox */}
            {canMarkHot && (
              <div className="flex items-center space-x-2 mt-4">
                <input
                  type="checkbox"
                  id="isHot"
                  checked={formData.isHot}
                  onChange={(e) => setFormData({ ...formData, isHot: e.target.checked })}
                  className="form-checkbox h-5 w-5 text-orange-500 rounded focus:ring-orange-500" // Стилизация для чекбокса
                />
                <label htmlFor="isHot" className="text-white select-none">{t('deals.markAsHot')}</label>
              </div>
            )}

            {/* Preview and Submit Button Block */}
            <div className="bg-gray-800 rounded-md p-4">
              <h3 className="text-white font-medium mb-2">{t('common.preview')}</h3>
              <div // Используем div вместо pre для лучшего рендеринга HTML
                className="bg-gray-900 rounded-md p-4 whitespace-pre-wrap font-sans text-sm description-preview min-h-[100px]"
                dangerouslySetInnerHTML={{
                  __html: formData.description
                    .replace(/(https?:\/\/[^\s<>"]+)/g, (match) => { // Улучшенный regex для ссылок
                      const lastChar = match.charAt(match.length - 1);
                      // Проверяем знаки препинания в конце ссылки
                      if ([',', '.', ':', ';', '!', '?', ')', ']', '}'].includes(lastChar)) {
                        return `<a href="${match.slice(0, -1)}" target="_blank" rel="noopener noreferrer" class="text-orange-500 hover:underline">${match.slice(0, -1)}</a>${lastChar}`;
                      }
                      return `<a href="${match}" target="_blank" rel="noopener noreferrer" class="text-orange-500 hover:underline">${match}</a>`;
                    })
                    // Замена переносов строк на <br> для HTML (Tiptap обычно сам это делает)
                    // .replace(/\n\n/g, '<br><br>')
                    // .replace(/\n/g, '<br>')
                    // Удаляем классы, если не хотим их в превью (Tiptap может добавлять свои)
                    // .replace(/class="[^"]+"/g, '') 
                    // .replace(/class='[^']+'/g, '') 
                }}
              />
              {/* Кнопка отправки находится в футере, здесь можно убрать или оставить для больших экранов */}
               <button
                type="submit" // Важно для отправки формы из этого места, если футер скрыт
                disabled={loading || !isValid}
                className={`w-full mt-4 py-3 rounded-md font-medium flex items-center justify-center sm:hidden ${ /* Скрываем на sm и больше, если есть футер */ ''}
                  isValid ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
                // onClick={handleSubmit} // onClick на кнопке типа submit не обязателен, если есть form onSubmit
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  isEditing ? t('common.updateDeal') : t('common.postDeal')
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Fixed Footer with Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 p-4">
        <div className="flex space-x-4">
          <button
            type="button"
            onClick={() => navigate(-1)} // Возвращает на предыдущую страницу
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-md font-medium"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit} // Вызывает handleSubmit при клике
            // type="submit" // Можно и так, если эта кнопка внутри тега <form> (но она вне)
            disabled={loading || !isValid}
            className={`flex-1 py-3 rounded-md font-medium flex items-center justify-center ${
              isValid ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
            ) : null}
            {isEditing ? t('common.updateDeal') : t('common.postDeal')}
          </button>
        </div>
      </div>

      {/* CSS Styles */}
      <style>
        {`
          /* Стили для кнопок форматирования редактора */
          .formatting-button {
            padding: 8px !important; /* Убедитесь, что эти стили не конфликтуют с Tailwind */
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

          .formatting-button.active { /* Стиль для активной кнопки */
            background-color: #4B5563 !important; /* Пример цвета фона для активной кнопки (серый) */
            transform: scale(1.05); /* Небольшое увеличение для эффекта */
          }
          
          /* Стили для обертки изображения в редакторе и кнопки удаления */
          .image-wrapper {
            margin: 1rem 0;
            position: relative; /* Для позиционирования кнопки удаления */
            display: inline-block; /* Чтобы обертка была по размеру изображения */
          }
          .image-wrapper img {
            transition: opacity 0.2s;
          }
          .image-wrapper:hover img {
            opacity: 0.8; /* Легкое затемнение при наведении для видимости кнопки */
          }
          .image-wrapper:hover .delete-button {
            opacity: 1; /* Показываем кнопку удаления при наведении на обертку */
          }

          /* Кнопка удаления изображения в редакторе (скрыта по умолчанию) */
          .delete-button {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 40px;
            height: 40px;
            background-color: rgba(239, 68, 68, 0.8); /* Полупрозрачный красный */
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            transition: all 0.2s;
            opacity: 0; /* Скрыта по умолчанию */
            z-index: 10; /* Поверх изображения */
          }
          .delete-button:hover {
            background-color: #dc2626; /* Более насыщенный красный при наведении */
          }
          .delete-button svg {
            width: 20px;
            height: 20px;
            color: white;
          }

          /* Стили для превью описания */
          .description-preview {
            white-space: pre-wrap; /* Сохраняем переносы строк и пробелы */
          }
          .description-preview p { /* Стили для параграфов внутри превью (если Tiptap их генерирует) */
            margin-bottom: 0.75rem; /* Отступ снизу для параграфов */
          }
          .description-preview a { /* Стили для ссылок в превью */
            color: #f97316; /* Оранжевый цвет для ссылок */
            text-decoration: underline;
          }

          /* Адаптивные стили для мобильных устройств */
          @media (max-width: 640px) {
            .formatting-button {
              /* Можно уменьшить размеры кнопок на мобильных, если нужно */
            }
            .delete-image-button { /* Стили для кнопки удаления на мобильных */
              /* Можно настроить размер и позиционирование */
            }
          }
        `}
      </style>

      {/* Bottom Sheets */}
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
    </div>
  );
};

export default AddDealPage;
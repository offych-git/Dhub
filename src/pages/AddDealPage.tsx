import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bold, Italic, Underline as UnderlineIcon, List, Image as ImageIcon, Link as LinkIcon, Info, ChevronDown, X, Plus } from 'lucide-react';
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
import { useModeration } from '../contexts/ModerationContext';

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
  const { addToModerationQueue } = useModeration();

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
    title: initialData?.title || '',
    currentPrice: initialData?.current_price?.toString() || '',
    originalPrice: initialData?.original_price?.toString() || '',
    description: initialData?.description || '',
    category: initialData?.category_id || '',
    subcategories: [] as string[],
    dealUrl: initialData?.deal_url || '',
    // ИСПРАВЛЕНО: Правильная инициализация expiryDate
    expiryDate: initialData?.expires_at
      ? (() => {
          const expiryUtcDate = new Date(initialData.expires_at);
          // Отнимаем один день, чтобы получить дату, которую пользователь изначально выбрал
          expiryUtcDate.setDate(expiryUtcDate.getDate() - 1);
          return expiryUtcDate.toISOString().split('T')[0];
        })()
      : '',
    isHot: initialData?.is_hot || false
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

  useEffect(() => {
    if (isEditing && initialData?.image_url) {
      console.log('Editing mode: main image URL from initialData:', initialData.image_url);
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

    if (formData.originalPrice && Number(formData.currentPrice) > Number(formData.originalPrice)) {
      setError('Current price cannot be higher than original price');
      return false;
    }

    if (!formData.category) {
      setError('Please select a category');
      return false;
    }

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

    const urlRegex = /^(https?:\/\/)?([^\s(["<,>]*)\.([^\s(["<,>]*){2,}(\/[^\s]*)?$/i;
    if (!urlRegex.test(formData.dealUrl)) {
      setError('Please enter a valid URL');
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

      if (mainImage) {
        const fileExt = mainImage.name.split('.').pop();
        const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
        const filePath = `${user?.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('deal-images')
          .upload(filePath, mainImage, {
            cacheControl: '3600',
            upsert: isEditing
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

      if (!currentImageUrl) {
          throw new Error('Main image URL is missing');
      }

      const dealPayload: any = {
        title: formData.title,
        description: formData.description,
        current_price: Number(formData.currentPrice),
        original_price: formData.originalPrice ? Number(formData.originalPrice) : null,
        store_id: selectedStoreId,
        category_id: formData.category,
        image_url: currentImageUrl,
        deal_url: formData.dealUrl,
        expires_at: formData.expiryDate
          ? (() => {
              const selectedDate = new Date(formData.expiryDate);
              selectedDate.setDate(selectedDate.getDate() + 1);
              selectedDate.setUTCHours(0, 0, 0, 0);
              return selectedDate.toISOString();
            })()
          : null,
        is_hot: formData.isHot,
      };


      if (isEditing && dealId) {
        console.log('Updating existing deal:', dealId);

        if (autoApprove) {
          dealPayload.status = 'approved';
          dealPayload.moderator_id = user?.id;
          dealPayload.moderated_at = new Date().toISOString();
        } else {
           if (initialData?.status === 'approved' || initialData?.status === 'published') {
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
            .eq('item_type', 'deal');
          navigate('/moderation');
          alert('Deal successfully updated and approved.');
        } else {
          if (dealPayload.status === 'pending') {
             await addToModerationQueue(dealId, 'deal');
          }
          navigate(`/deals/${dealId}`);
        }

      } else {
        dealPayload.user_id = user?.id;

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
            console.log('ВРЕМЕННО: Вызов addToModerationQueue пропущен для теста');

            navigate(`/deals/${newDeal.id}`);
        } else {
            throw new Error('Failed to create deal, no data returned.');
        }
      }
    } catch (err) {
      console.error('Error in handleSubmit:', err);
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
      if (!isNaN(current) && !isNaN(original) && original > 0 && current <= original) {
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
  }, [showDeleteButton]);

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
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg my-4 relative delete-button-container',
        },
        allowBase64: true,
      }),
    ],
    content: formData.description,
    parseOptions: {
      preserveWhitespace: 'full',
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[200px]',
      },
      handleKeyDown: (view, event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
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
      checkImagesInEditor();
    },
  });
  
  useEffect(() => {
    if (isEditing && initialData?.description && editor && !editor.isDestroyed) {
        if (editor.getHTML() !== initialData.description) {
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
          setSelectedImageId(null);
        }
      };

      if (editor.view && editor.view.dom) {
        editor.view.dom.addEventListener('click', handleClick);
        return () => {
          if (editor.view && editor.view.dom && !editor.isDestroyed) {
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
    if (editor && editor.view.dom && !editor.isDestroyed) {
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
          setTimeout(checkImagesInEditor, 0);
        }
      });

      observer.observe(editorDom, {
        childList: true,
        subtree: true,
        characterData: false,
        attributes: false
      });

      return () => {
        observer.disconnect();
      };
    }
  }, [editor]);

  const handleStoreSelect = (storeId: string | null) => {
    setSelectedStoreId(storeId);
    setIsStoreSheetOpen(false);
  };

  useEffect(() => {
    console.log('AddDealPage - StoreBottomSheet props:', {
      isOpen: isStoreSheetOpen,
      selectedStore: selectedStoreId,
      onStoreSelect: handleStoreSelect
    });
  }, [isStoreSheetOpen, selectedStoreId]);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <div className="fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 px-4 py-3 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => navigate(-1)} className="text-white">
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-white text-lg font-medium ml-4">{isEditing ? t('common.edit') : t('common.add')} {t('common.deal')}</h1>
          </div>
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
                placeholder={`${t('deals.title')} *`}
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
                    ? (language === 'ru'
                      ? categories.find(cat => cat.id === formData.category)?.name
                      : t(`categories.${formData.category}`)) || formData.category
                    : `${t('deals.selectCategory')} *`
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

            {calculateDiscount() !== null && (
              <div className="text-green-500 text-sm">
                {t('deals.discount')}: {calculateDiscount()}%
              </div>
            )}

            <div className="relative" ref={editorRef}>
              <div className="flex flex-wrap items-center justify-between gap-1 mb-2">
                <div className="flex flex-wrap items-center gap-1">
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
                      multiple
                      onChange={(e) => {
                        const files = e.target.files;
                        if (files) {
                          const remainingSlots = 4 - descriptionImages.length;
                          if (files.length > remainingSlots) {
                            alert(`You can only add ${remainingSlots} more image${remainingSlots === 1 ? '' : 's'}`);
                            e.target.value = ''; 
                            return;
                          }
                          handleDescriptionImageUpload(files);
                          e.target.value = '';
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="ml-auto">
                  {selectedImageId && (
                    <button
                      type="button"
                      className="delete-image-button flex items-center justify-center px-2 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors duration-200"
                      onClick={() => {
                        if (selectedImageId) {
                          handleDeleteImage(selectedImageId);
                          setSelectedImageId(null);
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
              {mainImage && (
                <img
                  src={URL.createObjectURL(mainImage)}
                  alt="Main deal image preview"
                  className="mt-2 w-full h-48 object-cover rounded-lg"
                />
              )}
              {isEditing && initialData?.image_url && !mainImage && (
                <img
                  src={initialData.image_url}
                  alt="Current main deal image"
                  className="mt-2 w-full h-48 object-cover rounded-lg"
                />
              )}
            </div>

            <div>
              <input
                type="url"
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

            {canMarkHot && (
              <div className="flex items-center space-x-2 mt-4">
                <input
                  type="checkbox"
                  id="isHot"
                  checked={formData.isHot}
                  onChange={(e) => setFormData({ ...formData, isHot: e.target.checked })}
                  className="form-checkbox h-5 w-5 text-orange-500 rounded focus:ring-orange-500"
                />
                <label htmlFor="isHot" className="text-white select-none">{t('deals.markAsHot')}</label>
              </div>
            )}

            <div className="bg-gray-800 rounded-md p-4">
              <h3 className="text-white font-medium mb-2">{t('common.preview')}</h3>
              <div
                className="bg-gray-900 rounded-md p-4 whitespace-pre-wrap font-sans text-sm description-preview min-h-[100px]"
                dangerouslySetInnerHTML={{
                  __html: formData.description
                    .replace(/(https?:\/\/[^\s<>"]+)/g, (match) => {
                      const lastChar = match.charAt(match.length - 1);
                      if ([',', '.', ':', ';', '!', '?', ')', ']', '}'].includes(lastChar)) {
                        return `<a href="${match.slice(0, -1)}" target="_blank" rel="noopener noreferrer" class="text-orange-500 hover:underline">${match.slice(0, -1)}</a>${lastChar}`;
                      }
                      return `<a href="${match}" target="_blank" rel="noopener noreferrer" class="text-orange-500 hover:underline">${match}</a>`;
                    })
                }}
              />
               <button
                type="submit"
                disabled={loading || !isValid}
                className={`w-full mt-4 py-3 rounded-md font-medium flex items-center justify-center sm:hidden ${
                  isValid ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
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

      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 p-4">
        <div className="flex space-x-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-md font-medium"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
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
          
          .image-wrapper {
            margin: 1rem 0;
            position: relative;
            display: inline-block;
          }
          .image-wrapper img {
            transition: opacity 0.2s;
          }
          .image-wrapper:hover img {
            opacity: 0.8;
          }
          .image-wrapper:hover .delete-button {
            opacity: 1;
          }

          .delete-button {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 40px;
            height: 40px;
            background-color: rgba(239, 68, 68, 0.8);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            transition: all 0.2s;
            opacity: 0;
            z-index: 10;
          }
          .delete-button:hover {
            background-color: #dc2626;
          }
          .delete-button svg {
            width: 20px;
            height: 20px;
            color: white;
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

          @media (max-width: 640px) {
            .formatting-button {
            }
            .delete-image-button {
            }
          }
        `}
      </style>

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
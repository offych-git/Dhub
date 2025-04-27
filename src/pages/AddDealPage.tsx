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
import { supabase } from '../lib/supabase';
import ImageUploader from '../components/deals/ImageUploader';
import imageCompression from 'browser-image-compression';
import { createPortal } from 'react-dom';
import CategoryBottomSheet from '../components/deals/CategoryBottomSheet';
import StoreBottomSheet from '../components/deals/StoreBottomSheet';

interface Subcategory {
  id: string;
  name: string;
}

interface ImageWithId {
  file: File;
  id: string;
  publicUrl: string;
}

const AddDealPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useLanguage();
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
  
  const [formData, setFormData] = useState({
    title: '',
    currentPrice: '',
    originalPrice: '',
    description: '',
    category: '',
    subcategories: [] as string[],
    // store: '', // Удалено
    dealUrl: '',
    expiryDate: ''
  });

  const [descriptionImages, setDescriptionImages] = useState<ImageWithId[]>([]);
  const [showDeleteButton, setShowDeleteButton] = useState<{ [key: string]: boolean }>({});
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [selectedImagePosition, setSelectedImagePosition] = useState<{ top: number; left: number } | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false);
  const [isStoreSheetOpen, setIsStoreSheetOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setCategoryMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        
        // Remove the image from descriptionImages state using the ID
        setDescriptionImages(prev => {
          console.log('Current images in state:', prev.length);
          const newImages = prev.filter(img => img.id !== imageId);
          console.log('Images after filtering:', newImages.length);
          return newImages;
        });
        
        setSelectedImageId(null);
      }
    }
  };

  const handleDescriptionImageUpload = async (files: FileList | null) => {
    if (!files || !files.length || !editor) {
      console.log('Missing required data:', { files, editor });
      return;
    }

    // Check if adding new images would exceed the limit
    const newImageCount = descriptionImages.length + files.length;
    if (newImageCount > 4) {
      alert('You can upload a maximum of 4 images');
      return;
    }

    setIsUploadingImage(true);
    try {
      // Process all selected files
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log('Processing file:', file.name, file.size, file.type);

        // Validate file type
        if (!file.type.startsWith('image/')) {
          throw new Error('Please select only image files');
        }

        const compressedImage = await compressImage(file);
        console.log('Compressed file:', compressedImage.name, compressedImage.size, compressedImage.type);
        
        // Generate unique ID for the image
        const imageId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Upload image to Supabase Storage first
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
        
        // Store the image in state with its ID and public URL
        setDescriptionImages(prev => [...prev, { 
          file: compressedImage, 
          id: imageId,
          publicUrl: publicUrl 
        }]);
        
        // Insert image with wrapper for better styling
        editor.chain()
          .focus()
          .insertContent(`
            <div class="image-wrapper" data-image-id="${imageId}">
              <img src="${publicUrl}" alt="${imageId}" class="max-w-full h-auto rounded-lg my-4" />
            </div>
          `)
          .run();

        // Add one paragraph after each image for spacing
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

    if (Number(formData.currentPrice) > Number(formData.originalPrice)) {
      setError('Current price cannot be higher than original price');
      return false;
    }

    if (!formData.category) {
      setError('Please select a category');
      return false;
    }

    if (!formData.subcategories.length) {
      setError('Please select at least one subcategory');
      return false;
    }

    if (!mainImage) {
      setError('Main image is required');
      return false;
    }

    if (!formData.dealUrl) {
      setError('Deal URL is required');
      return false;
    }

    // URL validation
    const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
    if (!urlRegex.test(formData.dealUrl)) {
      setError('Please enter a valid URL starting with http:// or https://');
      return false;
    }

    // Ensure URL has protocol
    if (!formData.dealUrl.startsWith('http://') && !formData.dealUrl.startsWith('https://')) {
      setFormData(prev => ({
        ...prev,
        dealUrl: `https://${prev.dealUrl}`
      }));
    }

    return true;
  };

  useEffect(() => {
    const isFormValid = formData.title.trim() !== '' &&
      formData.description.trim() !== '' &&
      formData.currentPrice !== '' &&
      formData.category !== '' &&
      formData.subcategories.length > 0 &&
      mainImage !== null &&
      formData.dealUrl !== '' &&
      (!formData.originalPrice || Number(formData.currentPrice) <= Number(formData.originalPrice)) &&
      /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(formData.dealUrl);

    setIsValid(isFormValid);
  }, [formData, mainImage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Upload main image to Supabase Storage
      if (!mainImage) throw new Error('Main image is required');

      const fileExt = mainImage.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user?.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('deal-images')
        .upload(filePath, mainImage, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Error uploading main image:', uploadError);
        throw new Error('Failed to upload main image');
      }

      const { data: { publicUrl } } = supabase.storage
        .from('deal-images')
        .getPublicUrl(filePath);

      // Find the store name from the selected store ID
      // const selectedStore = stores.find(s => s.id === formData.store);
      // if (!selectedStore) {
      //   throw new Error('Selected store not found');
      // }
      
      const { data: deal, error: dealError } = await supabase
        .from('deals')
        .insert({
          title: formData.title,
          description: formData.description,
          current_price: Number(formData.currentPrice),
          original_price: formData.originalPrice ? Number(formData.originalPrice) : null,
          store_id: selectedStoreId,
          category_id: formData.category,
          subcategories: formData.subcategories,
          image_url: publicUrl,
          deal_url: formData.dealUrl,
          user_id: user?.id,
          expires_at: formData.expiryDate || null
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

  const handleMainCategorySelect = (categoryId: string) => {
    if (selectedMainCategory === categoryId) {
      setSelectedMainCategory(null);
      setFormData(prev => ({
        ...prev,
        category: '',
        subcategories: []
      }));
    } else {
      setSelectedMainCategory(categoryId);
      setFormData(prev => ({
        ...prev,
        category: categoryId,
        subcategories: []
      }));
    }
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

  // Add global handlers
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
      }),
      Underline,
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg my-4 relative delete-button-container',
        },
        allowBase64: true,
      }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      console.log('Editor content updated:', html);
      setFormData(prev => ({
        ...prev,
        description: html
      }));
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[200px]',
      },
    },
  });

  // Add effect to log editor state
  useEffect(() => {
    if (editor) {
      console.log('Editor initialized with extensions:', editor.extensionManager.extensions);
    }
  }, [editor]);

  // Track image selection
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

      editor.view.dom.addEventListener('click', handleClick);
      return () => {
        editor.view.dom.removeEventListener('click', handleClick);
      };
    }
  }, [editor]);

  // Add effect to track descriptionImages changes
  useEffect(() => {
    console.log('descriptionImages updated:', descriptionImages.length);
  }, [descriptionImages]);

  const handleStoreSelect = (storeId: string | null) => {
    console.log('AddDealPage - Выбран магазин с ID (обновляем отдельное состояние):', storeId);
    console.log('AddDealPage - handleStoreSelect called with storeId:', storeId);
    setSelectedStoreId(storeId);
    setIsStoreSheetOpen(false);
  };

  // Add debug logging for StoreBottomSheet props
  useEffect(() => {
    console.log('AddDealPage - StoreBottomSheet props:', {
      isOpen: isStoreSheetOpen,
      selectedStore: selectedStoreId,
      onStoreSelect: handleStoreSelect
    });
  }, [isStoreSheetOpen, selectedStoreId]);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
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

      {/* Scrollable content area */}
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

            {/* Category Selection */}
            <div>
              <button
                type="button"
                className={`w-full bg-gray-800 text-white rounded-md px-4 py-3 flex items-center justify-between ${
                  formData.category ? 'text-white' : 'text-gray-500'
                }`}
                onClick={() => setIsCategorySheetOpen(true)}
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

            {/* Selected Subcategories */}
            {formData.subcategories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.subcategories.map((sub: string) => {
                  const subcategory = selectedCategory?.subcategories?.find((s: Subcategory) => s.id === sub);
                  return subcategory ? (
                    <span key={sub} className="inline-flex items-center px-2 py-1 rounded-full text-sm font-medium bg-gray-700 text-white">
                      {sub}
                      <button
                        type="button"
                        onClick={() => handleSubcategoryChange(sub)}
                        className="ml-1 text-gray-400 hover:text-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </span>
                  ) : null;
                })}
              </div>
            )}

            {/* <div>
              {selectedStoreId ? (
                <div className="w-full bg-gray-800 text-white rounded-md px-4 py-3 flex items-center justify-between">
                  <span>
                    {selectedStoreName}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsStoreSheetOpen(true)}
                    className="text-gray-400 hover:text-white"
                  >
                    <ChevronDown className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="w-full bg-gray-800 text-gray-500 rounded-md px-4 py-3 flex items-center justify-between"
                  onClick={() => setIsStoreSheetOpen(true)}
                >
                  <span>Select Store *</span>
                  <ChevronDown className="h-5 w-5" />
                </button>
              )}
            </div> */}
            
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

            {/* Description Editor */}
            <div className="relative" ref={editorRef}>
              <div className="flex items-center space-x-2 mb-2">
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
                    title={descriptionImages.length >= 4 ? 'Maximum 4 images allowed' : 'Add images'}
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
                          return;
                        }
                        handleDescriptionImageUpload(files);
                      }
                    }}
                  />
                </div>
                {selectedImageId && (
                  <button
                    type="button"
                    className="delete-image-button flex items-center justify-center px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors duration-200"
                    onClick={() => {
                      if (selectedImageId) {
                        handleDeleteImage(selectedImageId);
                        setSelectedImageId(null);
                      }
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18"></path>
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    </svg>
                  </button>
                )}
                </div>
              <div className="bg-gray-800 rounded-lg p-4 min-h-[200px]">
                <EditorContent editor={editor} />
              </div>
            </div>

            {/* Main Image Upload */}
            <div>
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
            </div>

            <div>
              <input
                type="url"
                placeholder="Deal URL *"
                className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3"
                value={formData.dealUrl}
                onChange={(e) => setFormData({ ...formData, dealUrl: e.target.value })}
                required
              />
              <p className="text-gray-500 text-sm mt-1">
                Add a link where users can find and purchase this deal
              </p>
            </div>

            <div>
              <input
                type="date"
                className="w-full bg-gray-800 text-white rounded-md px-4 py-3"
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
              />
              <p className="text-gray-500 text-sm mt-1">
                Expiry date (optional)
              </p>
            </div>

            {/* Preview */}
            <div className="bg-gray-800 rounded-md p-4">
              <h3 className="text-white font-medium mb-2">Preview</h3>
              <div className="bg-gray-900 rounded-md p-4">
                {formData.title && (
                  <h4 className="text-white font-medium">{formData.title}</h4>
                )}
                {formData.currentPrice && (
                  <div className="text-orange-500 font-bold mt-2">
                    ${Number(formData.currentPrice).toFixed(2)}
                    {formData.originalPrice && (
                      <span className="text-gray-400 line-through ml-2">
                        ${Number(formData.originalPrice).toFixed(2)}
                      </span>
                    )}
                    {calculateDiscount() !== null && (
                      <span className="text-green-500 ml-2">
                        (-{calculateDiscount()}%)
                      </span>
                    )}
                  </div>
                )}
                {formData.description && (
                  <div 
                    className="text-gray-300 mt-2"
                    dangerouslySetInnerHTML={{ __html: formData.description }}
                  />
                )}
                {formData.subcategories.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.subcategories.map((sub: string) => {
                      const subcategory = selectedCategory?.subcategories?.find((s: Subcategory) => s.id === sub);
                      return subcategory ? (
                        <span key={sub} className="bg-gray-800 text-gray-300 px-2 py-1 rounded-md text-sm">
                          {language === 'ru' ? subcategory.name : t(subcategory.id)}
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={loading || !isValid}
                className={`w-full mt-4 py-3 rounded-md font-medium flex items-center justify-center ${
                  isValid ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
                onClick={handleSubmit}
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  'Post Deal'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Submit Button - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 p-4">
        <div className="flex space-x-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex-1 bg-gray-800 text-white py-3 rounded-md font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !isValid}
            className={`flex-1 py-3 rounded-md font-medium flex items-center justify-center ${
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

      <style>
        {`
          .image-wrapper {
            margin: 1rem 0;
          }
          .image-container {
            position: relative;
            display: inline-block;
          }
          .delete-button {
            position: absolute;
            top: 8px;
            right: 8px;
            width: 32px;
            height: 32px;
            background-color: #ef4444;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            transition: background-color 0.2s;
          }
          .delete-button:hover {
            background-color: #dc2626;
          }
          .delete-button svg {
            width: 20px;
            height: 20px;
            color: white;
          }

          /* Mobile-friendly formatting buttons */
          @media (max-width: 640px) {
            .formatting-button {
              padding: 12px !important;
              margin: 0 4px !important;
              min-width: 48px !important;
              height: 48px !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
            }
            
            .formatting-button svg {
              width: 24px !important;
              height: 24px !important;
            }

            .formatting-button.active {
              background-color: #4B5563 !important;
              transform: scale(1.1);
            }

            .delete-image-button {
              padding: 8px !important;
              margin-left: 4px !important;
              height: 40px !important;
              width: 40px !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
            }

            .delete-image-button svg {
              width: 20px !important;
              height: 20px !important;
            }
          }
        `}
      </style>

      <CategoryBottomSheet
        isOpen={isCategorySheetOpen}
        onClose={() => setIsCategorySheetOpen(false)}
        selectedCategory={selectedMainCategory}
        onCategorySelect={handleMainCategorySelect}
        selectedSubcategories={formData.subcategories}
        onSubcategorySelect={handleSubcategoryChange}
      />

      <StoreBottomSheet
        isOpen={isStoreSheetOpen}
        selectedStore={selectedStoreId}
        onStoreSelect={(storeId) => {
          console.log('AddDealPage - StoreBottomSheet onStoreSelect called with:', storeId);
          handleStoreSelect(storeId);
        }}
        onClose={() => {
          console.log('AddDealPage - StoreBottomSheet onClose called');
          setIsStoreSheetOpen(false);
        }}
      />
    </div>
  );
};

export default AddDealPage;
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bold, Italic, Underline as UnderlineIcon, List, Info, X, Upload } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { stores } from '../data/mockData';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { useAuth } from '../contexts/AuthContext';
import { useAdmin } from '../hooks/useAdmin'; // Fixed import path for useAdmin hook
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import StoreBottomSheet from '../components/deals/StoreBottomSheet';

interface AddSweepstakesPageProps {
  isEditing?: boolean;
  sweepstakesId?: string;
  initialData?: any;
}

const AddSweepstakesPage: React.FC<AddSweepstakesPageProps> = ({ isEditing = false, sweepstakesId, initialData, allowHotToggle, labelOverrides }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { role } = useAdmin();
  const { t, language } = useLanguage();
  const canMarkHot = role === 'admin' || role === 'moderator';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const selectedStoreName = stores.find(store => store.id === selectedStoreId)?.name || '';
  const [isStoreSheetOpen, setIsStoreSheetOpen] = useState(false);
  const [sweepstakesImage, setSweepstakesImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dealUrl: '',
    expiryDate: ''
  });

  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log('AddSweepstakesPage - isStoreSheetOpen state changed:', isStoreSheetOpen);
  }, [isStoreSheetOpen]);

  // Image compression function
  const compressImage = async (file: File): Promise<File> => {
    const options = {
      maxSizeMB: 0.2, // 200KB
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

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || !files.length) return;

    try {
      setIsUploadingImage(true);
      const file = files[0]; // Take only the first file

      if (!file.type.startsWith('image/')) {
        throw new Error('Please select only image files');
      }

      const compressedImage = await compressImage(file);
      setSweepstakesImage(compressedImage);
      setImageUrl(URL.createObjectURL(compressedImage));
    } catch (error) {
      console.error('Error uploading image:', error);
      setError(error instanceof Error ? error.message : 'Failed to upload image');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Category functionality removed as per requirements

  const validateForm = () => {
    if (!formData.title.trim()) {
      setError('Title is required');
      return false;
    }

    if (!formData.description.trim()) {
      setError('Description is required');
      return false;
    }

    if (!sweepstakesImage) {
      setError('Please upload an image');
      return false;
    }

    if (!formData.dealUrl) {
      setError('Deal URL is required');
      return false;
    }

    const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
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
    const isFormValid = formData.title.trim() !== '' &&
      formData.description.trim() !== '' &&
      sweepstakesImage !== null &&
      formData.dealUrl !== '' &&
      /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(formData.dealUrl);

    setIsValid(isFormValid);
  }, [formData, sweepstakesImage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      let uploadedImageUrl = '';

      // Upload image if available
      if (sweepstakesImage) {
        const fileExt = sweepstakesImage.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${user?.id}/sweepstakes-images/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('deal-images')
          .upload(filePath, sweepstakesImage);

        if (uploadError) {
          throw new Error(`Error uploading image: ${uploadError.message}`);
        }

        const { data: urlData } = supabase.storage
          .from('deal-images')
          .getPublicUrl(filePath);

        uploadedImageUrl = urlData.publicUrl;
      }

      // Create sweepstakes data with type field
      const sweepstakesData = {
        title: formData.title,
        description: formData.description,
        current_price: 0,
        original_price: null,
        store_id: selectedStoreId || null,
        category_id: 1, // Установка дефолтной категории вместо null
        subcategories: [],
        image_url: uploadedImageUrl,
        deal_url: formData.dealUrl,
        user_id: user?.id,
        expires_at: formData.expiryDate || null,
        is_hot: false,
        type: 'sweepstakes'
      };
      
      const { data: sweepstakes, error: sweepstakesError } = await supabase
        .from('deals')
        .insert(sweepstakesData)
        .select()
        .single();

      if (sweepstakesError) {
        console.error('Error creating sweepstakes:', sweepstakesError);
        throw new Error('Failed to create sweepstakes');
      }

      navigate(`/sweepstakes/${sweepstakes.id}`);
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      setError(error instanceof Error ? error.message : 'Failed to create sweepstakes');
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

      checkImagesInEditor();
    },
  });

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

      editor.view.dom.addEventListener('click', handleClick);
      return () => {
        editor.view.dom.removeEventListener('click', handleClick);
      };
    }
  }, [editor]);



  useEffect(() => {
    if (editor && editor.view.dom) {
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
    console.log('AddSweepstakesPage - StoreBottomSheet props:', {
      isOpen: isStoreSheetOpen,
      selectedStore: selectedStoreId,
      onStoreSelect: handleStoreSelect
    });
  }, [isStoreSheetOpen, selectedStoreId]);

  // Define checkImagesInEditor function that was missing
  const checkImagesInEditor = () => {
    if (!editor) return;

    // This is just a stub function since you removed image management functionality
    console.log('Editor content checked');
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <div className="fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 px-4 py-3 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => navigate(-1)} className="text-white">
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-white text-lg font-medium ml-4">Add Sweepstakes</h1>
          </div>
          <button className="text-white">
            <Info className="h-6 w-6" />
          </button>
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
              <input
                type="text"
                placeholder="Title *"
                className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-400 mb-2">Image *</label>
              {imageUrl ? (
                <div className="relative">
                  <img
                    src={imageUrl}
                    alt="Sweepstakes image"
                    className="w-full h-48 object-contain rounded-lg bg-gray-800 mb-2"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSweepstakesImage(null);
                      setImageUrl(null);
                    }}
                    className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div
                  className={`border-2 border-dashed rounded-lg p-4 text-center ${
                    isUploadingImage ? 'border-orange-500 bg-orange-500/10' : 'border-gray-700'
                  }`}
                >
                  <input
                    type="file"
                    accept="image/*"
                    id="sweepstakes-image"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e.target.files)}
                  />
                  <label
                    htmlFor="sweepstakes-image"
                    className="flex flex-col items-center justify-center cursor-pointer"
                  >
                    <Upload className="h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-gray-400">
                      {isUploadingImage ? 'Uploading...' : 'Click to upload image'}
                    </p>
                  </label>
                </div>
              )}
            </div>

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
                </div>

                <div className="ml-auto">
                  {selectedImageId && (
                    <button
                      type="button"
                      className="delete-image-button flex items-center justify-center px-2 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors duration-200"
                      onClick={() => {
                        setSelectedImageId(null);
                      }}
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
                <EditorContent editor={editor} />
              </div>
            </div>

            <div>
              <input
                type="url"
                placeholder="Sweepstakes URL *"
                className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3"
                value={formData.dealUrl}
                onChange={(e) => setFormData({ ...formData, dealUrl: e.target.value })}
                required
              />
              <p className="text-gray-500 text-sm mt-1">
                Add a link where users can participate in this sweepstakes
              </p>
            </div>

            <div>
              <div className="relative">
                <input
                  type="date"
                  className="w-full bg-gray-800 text-white rounded-md px-4 py-3"
                  value={formData.expiryDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => {
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
                End date of sweepstakes (required)
              </p>
            </div>


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
                  'Post Sweepstakes'
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
              'Post Sweepstakes'
            )}
          </button>
        </div>
      </div>

      <style>
        {`
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
            background-color: #ef4444;
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

          /* Mobile-friendly formatting buttons */
          @media (max-width: 640px) {
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

            .delete-image-button {
              padding: 4px !important;
              margin: 4px 0 !important;
              height: 32px !important;
              width: auto !important;
              max-width: 32px !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
              overflow: hidden !important;
            }

            .delete-image-button svg {
              width: 16px !important;
              height: 16px !important;
            }
          }
        `}
      </style>

      <StoreBottomSheet
        isOpen={isStoreSheetOpen}
        selectedStore={selectedStoreId}
        onStoreSelect={handleStoreSelect}
        onClose={() => setIsStoreSheetOpen(false)}
      />
    </div>
  );
};

export default AddSweepstakesPage;
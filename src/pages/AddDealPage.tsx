import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bold, Italic, Underline as UnderlineIcon, List, Image as ImageIcon, Link as LinkIcon, Info, ChevronDown, X } from 'lucide-react';
import { categories, stores, categoryIcons } from '../data/mockData';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';

const AddDealPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [selectedMainCategory, setSelectedMainCategory] = useState<string | null>(null);
  const categoryRef = useRef<HTMLDivElement>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    currentPrice: '',
    originalPrice: '',
    description: '',
    imageUrl: '',
    category: '',
    subcategories: [] as string[],
    store: '',
    dealUrl: '',
    expiryDate: ''
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setCategoryMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline
    ],
    content: '',
    onUpdate: ({ editor }) => {
      setFormData(prev => ({
        ...prev,
        description: editor.getHTML()
      }));
    }
  });

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

    if (!formData.store) {
      setError('Store is required');
      return false;
    }

    if (!formData.imageUrl) {
      setError('Image URL is required');
      return false;
    }

    if (!formData.dealUrl) {
      setError('Deal URL is required');
      return false;
    }

    return true;
  };

  useEffect(() => {
    const isFormValid = formData.title.trim() !== '' &&
      formData.description.trim() !== '' &&
      formData.currentPrice !== '' &&
      formData.category !== '' &&
      formData.subcategories.length > 0 &&
      formData.store !== '' &&
      formData.imageUrl !== '' &&
      formData.dealUrl !== '' &&
      (!formData.originalPrice || Number(formData.currentPrice) <= Number(formData.originalPrice));

    setIsValid(isFormValid);
  }, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Find the store name from the selected store ID
      const selectedStore = stores.find(s => s.id === formData.store);
      
      const { data: deal, error: dealError } = await supabase
        .from('deals')
        .insert({
          title: formData.title,
          description: formData.description,
          current_price: Number(formData.currentPrice),
          original_price: formData.originalPrice ? Number(formData.originalPrice) : null,
          store_id: selectedStore?.name || formData.store,
          category_id: formData.category,
          subcategories: formData.subcategories,
          image_url: formData.imageUrl,
          deal_url: formData.dealUrl,
          user_id: user?.id,
          expires_at: formData.expiryDate || null
        })
        .select()
        .single();

      if (dealError) throw dealError;

      navigate(`/deals/${deal.id}`);
    } catch (err: any) {
      console.error('Error creating deal:', err);
      setError(err.message);
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

  const handleSubcategoryToggle = (subcategoryId: string) => {
    setFormData(prev => {
      const subcategories = prev.subcategories.includes(subcategoryId)
        ? prev.subcategories.filter(id => id !== subcategoryId)
        : [...prev.subcategories, subcategoryId];
      return { ...prev, subcategories };
    });
  };

  const selectedCategory = categories.find(cat => cat.id === selectedMainCategory);

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
            <div className="relative" ref={categoryRef}>
              <button
                type="button"
                className={`w-full bg-gray-800 text-white rounded-md px-4 py-3 flex items-center justify-between ${
                  formData.category ? 'text-white' : 'text-gray-500'
                }`}
                onClick={() => setCategoryMenuOpen(!categoryMenuOpen)}
              >
                <span>
                  {formData.category 
                    ? language === 'ru' 
                      ? categories.find(cat => cat.id === formData.category)?.name 
                      : t(formData.category)
                    : 'Select Category *'
                  }
                </span>
                <ChevronDown className={`h-5 w-5 text-gray-400 transform transition-transform ${
                  categoryMenuOpen ? 'rotate-180' : ''
                }`} />
              </button>

              {categoryMenuOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-md shadow-lg z-20 max-h-[300px] overflow-y-auto">
                  <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-2 flex justify-between items-center">
                    <span className="text-white font-medium">{t('filters.categories')}</span>
                    {formData.category && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, category: '', subcategories: [] }));
                          setSelectedMainCategory(null);
                        }}
                        className="text-gray-400 hover:text-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="divide-y divide-gray-700">
                    {categories.map(category => {
                      const Icon = categoryIcons[category.name];
                      const isSelected = category.id === selectedMainCategory;

                      return (
                        <div key={category.id}>
                          <button
                            type="button"
                            className={`w-full px-4 py-2 flex items-center justify-between ${
                              isSelected ? 'bg-gray-700' : ''
                            }`}
                            onClick={() => handleMainCategorySelect(category.id)}
                          >
                            <div className="flex items-center">
                              {Icon && <Icon className="h-5 w-5 mr-2 text-orange-500" />}
                              <span className="text-white">
                                {language === 'ru' ? category.name : t(category.id)}
                              </span>
                            </div>
                            <ChevronDown className={`h-4 w-4 text-gray-400 transform transition-transform ${
                              isSelected ? 'rotate-180' : ''
                            }`} />
                          </button>

                          {isSelected && category.subcategories && (
                            <div className="bg-gray-700 p-2 grid grid-cols-2 gap-1">
                              {category.subcategories.map(subcategory => (
                                <button
                                  key={subcategory.id}
                                  type="button"
                                  onClick={() => handleSubcategoryToggle(subcategory.id)}
                                  className={`px-2 py-1 text-sm text-left rounded ${
                                    formData.subcategories.includes(subcategory.id)
                                      ? 'bg-orange-500 text-white'
                                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                                  }`}
                                >
                                  {language === 'ru' ? subcategory.name : t(subcategory.id)}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Selected Subcategories */}
            {formData.subcategories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.subcategories.map(subId => {
                  const subcategory = selectedCategory?.subcategories?.find(sub => sub.id === subId);
                  return subcategory ? (
                    <span key={subId} className="bg-gray-700 text-white px-2 py-1 rounded-md text-sm">
                      {language === 'ru' ? subcategory.name : t(subcategory.id)}
                    </span>
                  ) : null;
                })}
              </div>
            )}

            <div>
              <select
                className="w-full bg-gray-800 text-white rounded-md px-4 py-3"
                value={formData.store}
                onChange={(e) => setFormData({ ...formData, store: e.target.value })}
                required
              >
                <option value="">Select Store *</option>
                {stores.map(store => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
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

            {/* Description Editor */}
            <div>
              <div className="bg-gray-800 rounded-md">
                <div className="flex items-center space-x-2 px-3 py-2 border-b border-gray-700">
                  <button
                    type="button"
                    onClick={() => editor?.chain().focus().toggleBold().run()}
                    className={`text-gray-400 hover:text-white ${editor?.isActive('bold') ? 'text-white' : ''}`}
                  >
                    <Bold className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => editor?.chain().focus().toggleItalic().run()}
                    className={`text-gray-400 hover:text-white ${editor?.isActive('italic') ? 'text-white' : ''}`}
                  >
                    <Italic className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => editor?.chain().focus().toggleUnderline().run()}
                    className={`text-gray-400 hover:text-white ${editor?.isActive('underline') ? 'text-white' : ''}`}
                  >
                    <UnderlineIcon className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => editor?.chain().focus().toggleBulletList().run()}
                    className={`text-gray-400 hover:text-white ${editor?.isActive('bulletList') ? 'text-white' : ''}`}
                  >
                    <List className="h-5 w-5" />
                  </button>
                </div>
                <EditorContent
                  editor={editor}
                  className="w-full bg-transparent text-white placeholder-gray-500 px-4 py-3 min-h-[100px] focus:outline-none"
                />
                <div className="px-4 py-2 text-gray-500 text-sm">
                  Description is required *
                </div>
              </div>
            </div>

            {/* Image Upload */}
            <div className="bg-gray-800 rounded-md p-4">
              <input
                type="url"
                placeholder="Enter image URL *"
                className="w-full bg-gray-700 text-white placeholder-gray-500 rounded-md px-4 py-2"
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                required
              />
              {formData.imageUrl && (
                <div className="mt-2 relative w-full h-40 bg-gray-700 rounded-md overflow-hidden">
                  <img
                    src={formData.imageUrl}
                    alt="Deal preview"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.currentTarget.src = 'https://via.placeholder.com/400x300?text=Invalid+Image+URL';
                    }}
                  />
                </div>
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
                    {formData.subcategories.map(subId => {
                      const subcategory = selectedCategory?.subcategories?.find(sub => sub.id === subId);
                      return subcategory ? (
                        <span key={subId} className="bg-gray-800 text-gray-300 px-2 py-1 rounded-md text-sm">
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
    </div>
  );
};

export default AddDealPage;
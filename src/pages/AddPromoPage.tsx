import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Info, ChevronDown } from 'lucide-react';
import { categories, categoryIcons } from '../data/mockData';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import CategorySimpleBottomSheet from '../components/deals/CategorySimpleBottomSheet';
import { useLanguage } from '../contexts/LanguageContext'; // Assuming this context exists


const AddPromoPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [formData, setFormData] = useState({
    promoCode: '',
    title: '',
    description: '',
    category: '',
    discountUrl: '',
    expiryDate: ''
  });

  const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isFormValid = formData.promoCode.trim() !== '' &&
      formData.title.trim() !== '' &&
      formData.description.trim() !== '' &&
      formData.category !== '' &&
      formData.discountUrl.trim() !== '';

    setIsValid(isFormValid);
  }, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isValid) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);

    try {
      const { data: promo, error: promoError } = await supabase
        .from('promo_codes')
        .insert({
          code: formData.promoCode,
          title: formData.title,
          description: formData.description,
          category_id: formData.category,
          discount_url: formData.discountUrl,
          expires_at: formData.expiryDate || null,
          user_id: user?.id
        })
        .select()
        .single();

      if (promoError) throw promoError;

      navigate('/promos');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = (selectedCategoryId: string) => {
    setFormData({ ...formData, category: selectedCategoryId });
    setIsCategorySheetOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 px-4 py-3 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => navigate(-1)} className="text-white">
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-white text-lg font-medium ml-4">Add New Promo Code</h1>
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
                type="url"
                placeholder="Discount URL *"
                className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3"
                value={formData.discountUrl}
                onChange={(e) => setFormData({ ...formData, discountUrl: e.target.value })}
              />
              <p className="text-gray-500 text-sm mt-1">
                Add a link where users can find more information.
              </p>
            </div>

            <div>
              <input
                type="text"
                placeholder="Promo Code *"
                className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3"
                value={formData.promoCode}
                onChange={(e) => setFormData({ ...formData, promoCode: e.target.value })}
              />
            </div>

            <div>
              <input
                type="text"
                placeholder="Title *"
                className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div>
              <textarea
                placeholder="Description *"
                rows={4}
                className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-md px-4 py-3 resize-none"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div>
              <button
                type="button"
                className="w-full bg-gray-800 text-white rounded-md px-4 py-3 flex items-center justify-between"
                onClick={() => setIsCategorySheetOpen(true)}
              >
                <span>
                  {formData.category
                    ? (language === 'ru' ? categories.find(c => c.id === formData.category)?.name : t(formData.category))
                    : language === 'ru' ? 'Выберите категорию' : 'Select Category'}
                </span>
                <ChevronDown className="h-5 w-5" />
              </button>
              <CategorySimpleBottomSheet
                isOpen={isCategorySheetOpen}
                onClose={() => setIsCategorySheetOpen(false)}
                categories={categories}
                categoryIcons={categoryIcons}
                selectedCategory={formData.category}
                onCategorySelect={handleCategorySelect}
              />
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
                {formData.promoCode && (
                  <div className="mt-2 inline-block bg-gray-800 px-3 py-1 rounded border border-gray-700">
                    <span className="text-orange-500 font-mono">{formData.promoCode}</span>
                  </div>
                )}
                {formData.description && (
                  <p className="text-gray-300 mt-2">{formData.description}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={loading || !isValid}
                className={`w-full mt-4 py-3 rounded-md font-medium flex items-center justify-center ${
                  isValid ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  'Post Promo Code'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Submit Buttons - Fixed at bottom */}
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
              'Publish'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddPromoPage;
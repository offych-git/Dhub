import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Info, ChevronDown } from 'lucide-react';
import { categories, categoryIcons } from '../data/mockData';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import CategorySimpleBottomSheet from '../components/deals/CategorySimpleBottomSheet';
import { useLanguage } from '../contexts/LanguageContext'; 
import { useGlobalState } from '../contexts/GlobalStateContext';
import { useAdmin } from '../hooks/useAdmin';

interface PromoData {
  id: string;
  code: string;
  title: string;
  description: string;
  category_id: string;
  discount_url: string;
  expires_at: string | null;
}

interface AddPromoPageProps {
  isEditing?: boolean;
  promoData?: PromoData;
}

const AddPromoPage: React.FC<AddPromoPageProps> = ({ isEditing = false, promoData }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { dispatch } = useGlobalState();
  const { isAdmin, isModerator } = useAdmin();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [formData, setFormData] = useState({
    promoCode: '',
    title: '',
    description: '',
    category: '',
    discountUrl: '',
    expiryDate: ''
  });

  useEffect(() => {
    if (isEditing && promoData) {
      setFormData({
        promoCode: promoData.code || '',
        title: promoData.title || '',
        description: promoData.description || '',
        category: promoData.category_id || '',
        discountUrl: promoData.discount_url || '',
        expiryDate: promoData.expires_at ? promoData.expires_at.split('T')[0] : ''
      });
    }
  }, [isEditing, promoData]);

  const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isFormValid = formData.promoCode.trim() !== '' &&
      formData.title.trim() !== '' &&
      formData.description.trim() !== '' &&
      formData.category !== '' &&
      formData.discountUrl.trim() !== '' &&
      (!formData.expiryDate || new Date(formData.expiryDate) > new Date());

    setIsValid(isFormValid);
  }, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isValid) {
      if (formData.expiryDate && new Date(formData.expiryDate) <= new Date()) {
        setError('Expiry date must be in the future');
      } else {
        setError('Please fill in all required fields');
      }
      return;
    }

    setLoading(true);

    try {
      if (isEditing && promoData) {
        // Update existing promo
        const { data: updatedPromo, error: updateError } = await supabase
          .from('promo_codes')
          .update({
            code: formData.promoCode,
            title: formData.title,
            description: formData.description,
            category_id: formData.category,
            discount_url: formData.discountUrl,
            expires_at: formData.expiryDate || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', promoData.id)
          .select()
          .single();

        if (updateError) throw updateError;

        // Dispatch update to global state
        dispatch({ 
          type: 'UPDATE_PROMO', 
          payload: updatedPromo 
        });

        navigate('/promos');
      } else {
        // Используем значения из хука useAdmin
        const isAdminOrModerator = isAdmin || isModerator;

        // Проверяем настройки модерации
        const { data: settings } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'moderation_enabled')
          .single();

        const moderationEnabled = settings?.value?.enabled && 
                                 settings?.value?.types?.includes('promo');

        const moderationStatus = isAdminOrModerator || !moderationEnabled ? 'approved' : 'pending';

        // Insert new promo
        const { data: promo, error: promoError } = await supabase
          .from('promo_codes')
          .insert({
            code: formData.promoCode,
            title: formData.title,
            description: formData.description,
            category_id: formData.category,
            discount_url: formData.discountUrl,
            expires_at: formData.expiryDate || null,
            user_id: user?.id,
            status: moderationStatus // Используем правильное имя поля
          })
          .select()
          .single();

        if (promoError) throw promoError;

        // Если требуется модерация, то добавляем в очередь модерации
        if (moderationStatus === 'pending') {
          const { error: queueError } = await supabase
            .from('moderation_queue')
            .insert({
              item_id: promo.id,
              item_type: 'promo',
              submitted_by: user?.id,
              submitted_at: new Date().toISOString(),
              status: 'pending'
            });

          if (queueError) console.error('Error adding to moderation queue:', queueError);

          // Показываем пользователю сообщение о модерации
          setSuccess('Промокод отправлен на модерацию');
          setTimeout(() => navigate('/promos'), 2000);
        } else {
          navigate('/promos');
        }
      }
    } catch (err: any) {
      console.error('Error saving promo:', err);
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
            <h1 className="text-white text-lg font-medium ml-4">
              {isEditing ? 'Edit Promo Code' : 'Add New Promo Code'}
            </h1>
          </div>
          <button className="text-white">
            <Info className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto pt-4 pb-24">
        <div className="px-4">
          {error && (
            <div className="bg-red-500 text-white px-4 py-3 rounded-md mb-4">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-500 text-white px-4 py-3 rounded-md mb-4">
              {success}
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
                Expired date (optional) - must be in the future
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
                  isEditing ? 'Update Promo Code' : 'Post Promo Code'
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
            onClick={() => navigate(isEditing ? '/promos' : -1)}
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
              isEditing ? 'Save Changes' : 'Publish'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddPromoPage;
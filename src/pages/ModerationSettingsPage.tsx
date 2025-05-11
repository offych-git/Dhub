
import React, { useState } from 'react';
import { useModeration } from '../contexts/ModerationContext';
import { useAdmin } from '../hooks/useAdmin';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Save, ArrowLeft } from 'lucide-react';

const ModerationSettingsPage: React.FC = () => {
  const { 
    moderationSettings, 
    isModerationEnabled,
    toggleModerationSetting,
    updateModerationTypes
  } = useModeration();
  const { role } = useAdmin();
  const navigate = useNavigate();
  
  const [enabled, setEnabled] = useState<boolean>(isModerationEnabled);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(moderationSettings.types || []);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Check if user has access to this page
  if (role !== 'admin' && role !== 'super_admin') {
    return (
      <div className="p-4 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h1 className="text-xl font-bold mb-2">Доступ запрещен</h1>
        <p className="mb-4">У вас нет прав для доступа к этой странице.</p>
        <button 
          onClick={() => navigate('/moderation')}
          className="px-4 py-2 bg-orange-500 text-white rounded-md"
        >
          Вернуться к модерации
        </button>
      </div>
    );
  }

  const handleTypeToggle = (type: string) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter(t => t !== type));
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    
    try {
      // Update enabled status
      const enabledSuccess = await toggleModerationSetting(enabled);
      
      // Update selected types
      const typesSuccess = await updateModerationTypes(selectedTypes);
      
      if (enabledSuccess && typesSuccess) {
        alert('Настройки модерации успешно сохранены');
      } else {
        alert('Произошла ошибка при сохранении настроек');
      }
    } catch (error) {
      console.error('Error saving moderation settings:', error);
      alert('Произошла ошибка при сохранении настроек');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 pb-20">
      <div className="flex items-center mb-6">
        <button 
          onClick={() => navigate('/moderation')}
          className="mr-4 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold">Настройки модерации</h1>
      </div>

      <div className="bg-white rounded-md shadow p-6 max-w-2xl mx-auto">
        <div className="mb-6">
          <h2 className="text-lg font-medium mb-4">Общие настройки</h2>
          
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-md">
            <div>
              <h3 className="font-medium">Модерация контента</h3>
              <p className="text-sm text-gray-600 mt-1">
                Включить или отключить систему модерации для всего контента
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={enabled} 
                onChange={() => setEnabled(!enabled)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
            </label>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-medium mb-4">Типы модерируемого контента</h2>
          
          <div className="space-y-3">
            <div className="flex items-center">
              <input
                id="deal-checkbox"
                type="checkbox"
                checked={selectedTypes.includes('deal')}
                onChange={() => handleTypeToggle('deal')}
                className="w-4 h-4 text-orange-500 bg-gray-100 border-gray-300 rounded focus:ring-orange-500"
              />
              <label htmlFor="deal-checkbox" className="ml-2 block">
                Скидки
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                id="promo-checkbox"
                type="checkbox"
                checked={selectedTypes.includes('promo')}
                onChange={() => handleTypeToggle('promo')}
                className="w-4 h-4 text-orange-500 bg-gray-100 border-gray-300 rounded focus:ring-orange-500"
              />
              <label htmlFor="promo-checkbox" className="ml-2 block">
                Промокоды
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                id="sweepstake-checkbox"
                type="checkbox"
                checked={selectedTypes.includes('sweepstake')}
                onChange={() => handleTypeToggle('sweepstake')}
                className="w-4 h-4 text-orange-500 bg-gray-100 border-gray-300 rounded focus:ring-orange-500"
              />
              <label htmlFor="sweepstake-checkbox" className="ml-2 block">
                Розыгрыши
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="px-4 py-2 bg-orange-500 text-white rounded-md flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                Сохранение...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Сохранить настройки
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModerationSettingsPage;

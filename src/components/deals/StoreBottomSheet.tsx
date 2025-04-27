import React, { useRef, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../contexts/LanguageContext';

// Удаляем неиспользуемый импорт
// import { supabase } from '../../lib/supabase';

interface StoreBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedStore: string | null;
  onStoreSelect: (storeId: string) => void;
  selectedStores?: string[];
  onStoresSelect?: (storeIds: string[]) => void;
  allowMultiple?: boolean;
  onStoreAdd?: (store: { id: string; name: string; url: string }) => void;
  stores: { id: string; name: string; url: string }[]; // <--- добавьте этот проп
}

const StoreBottomSheet: React.FC<StoreBottomSheetProps> = ({
  isOpen,
  onClose,
  selectedStore,
  onStoreSelect,
  selectedStores = [],
  onStoresSelect,
  allowMultiple = false,
  onStoreAdd,
}) => {
  const { t, language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [recentStores, setRecentStores] = useState<string[]>([]);
  const [showAddStore, setShowAddStore] = useState(false);
  const [newStore, setNewStore] = useState({ name: '', url: '' });
  const [errors, setErrors] = useState({ name: '', url: '' });
  const [localStores, setLocalStores] = useState<{id: string, name: string, url: string}[]>([]);

  useEffect(() => {
    const fetchStores = async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('*');
      
      if (!error && data) {
        setLocalStores(data);
      }
    };
    
    fetchStores();
  }, []);

  // Добавляем функцию для обработки выбора магазина
  const handleStoreClick = (storeId: string) => {
    console.log('StoreBottomSheet - handleStoreClick called with storeId:', storeId, 'current selectedStore:', selectedStore);
    if (allowMultiple && onStoresSelect) {
      let newSelected: string[];
      if (selectedStores.includes(storeId)) {
        newSelected = selectedStores.filter(id => id !== storeId);
      } else {
        newSelected = [...selectedStores, storeId];
      }
      console.log('StoreBottomSheet - calling onStoresSelect with:', newSelected);
      onStoresSelect(newSelected);
    } else {
      console.log('StoreBottomSheet - calling onStoreSelect with:', storeId);
      onStoreSelect(storeId);
      onClose(); // Добавляем закрытие шторки после выбора
    }
    // Добавим в недавние магазины
    setRecentStores(prev => {
      const updated = [storeId, ...prev.filter(id => id !== storeId)];
      return updated; // максимум 5 последних
    });
  };
  
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);
  
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Add debug logging for component mounting and props
  useEffect(() => {
    console.log('StoreBottomSheet - Component mounted with props:', {
      isOpen,
      selectedStore,
      onStoreSelect,
      onClose
    });
  }, []);

  useEffect(() => {
    const currentProps = { isOpen, selectedStore };
    console.log('StoreBottomSheet - Props updated (snapshot):', currentProps);
  }, [isOpen, selectedStore]);

  // Обработчики жестов для закрытия шторки
  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'BUTTON') return;
    startY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'BUTTON') return;
    
    if (!sheetRef.current) return;
    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;
    
    if (diff > 0) { // Only allow dragging down
      sheetRef.current.style.transform = `translateY(${diff}px)`;
    }
  };

  const handleTouchEnd = () => {
    if (!sheetRef.current) return;
    
    const diff = currentY.current - startY.current;
    if (diff > 100) { // If dragged more than 100px, close the sheet
      onClose();
    } else {
      sheetRef.current.style.transform = 'translateY(0)';
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    // Check if the click was on the overlay itself, not the bottom sheet
    if (e.target === e.currentTarget) {
      console.log('StoreBottomSheet - Overlay clicked, closing. Current selectedStore:', selectedStore);
      onClose();
    }
  };



  if (!isOpen) {
    console.log('StoreBottomSheet - Not rendering (isOpen is false)');
    console.log('StoreBottomSheet - Not rendering (isOpen is false)');
    return null;
  }

  console.log('StoreBottomSheet render', { isOpen, selectedStore });
    console.log('StoreBottomSheet - Rendering with props:', { isOpen, selectedStore });

  

const handleAddStore = async () => {
    console.log('StoreBottomSheet - handleAddStore called with newStore:', newStore);
    if (validateNewStore()) {
      let url = newStore.url;
      // Автоматически добавляем https:// если нет протокола
      if (!url.match(/^https?:\/\//)) {
        url = `https://${url}`;
      }
  
      const { data: newStoreWithId, error } = await supabase
        .from('stores')
        .insert([{ 
          name: newStore.name, 
          url: url,
          created_at: new Date().toISOString()
        }])
        .select('*')
        .single();
      
      if (error) {
        console.error('Error adding store:', error);
        alert(`Ошибка при добавлении магазина: ${error.message}`);
        return;
      }
      console.log('StoreBottomSheet - created new store:', newStoreWithId);
      
      // Добавляем новый магазин в локальный список
      setLocalStores(prev => {
        const updated = [...prev, newStoreWithId];
        console.log('StoreBottomSheet - localStores updated, new length:', updated.length);
        console.log('StoreBottomSheet - localStores content:', updated);
        return updated;
      });
      
      // Добавляем в недавние с использованием актуального localStores
      setRecentStores(prev => {
        const updated = [newStoreWithId.id, ...prev.filter(id => id !== newStoreWithId.id)];
        console.log('StoreBottomSheet - recentStores updated:', updated);
        console.log('StoreBottomSheet - recentStores content:', updated.map(id => 
          [...localStores, newStoreWithId].find(s => s.id === id)
        ));
        return updated;
      });

      // Уведомляем родительский компонент о новом магазине
      if (onStoreAdd) {
        console.log('StoreBottomSheet - calling onStoreAdd with:', newStoreWithId);
        onStoreAdd(newStoreWithId);
      }
      
      

      // Выбираем новый магазин
      console.log('StoreBottomSheet - calling handleStoreClick with:', newStoreWithId.id);
      handleStoreClick(newStoreWithId.id);
      
      // Очищаем форму и закрываем её
      setShowAddStore(false);
      setNewStore({ name: '', url: '' });
      setSearchQuery(newStore.name);
      
      console.log('StoreBottomSheet - handleAddStore completed successfully');
    } else {
      console.log('StoreBottomSheet - validation failed for new store');
    }
  };

  const validateNewStore = () => {
    const newErrors = { name: '', url: '' };
    let isValid = true;

    if (!newStore.name.trim()) {
      newErrors.name = 'Название магазина обязательно';
      isValid = false;
    }

    if (!newStore.url.trim()) {
      newErrors.url = 'URL магазина обязателен';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40" 
        onClick={handleOverlayClick}
      />
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 bg-gray-900 rounded-t-2xl z-50 max-h-[80vh] flex flex-col"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle */}
        <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto my-3" />
        
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <button onClick={onClose} className="text-white">
            <X className="h-6 w-6" />
          </button>
          <h2 className="text-white text-lg font-medium">
            {showAddStore ? 'Добавить магазин' : t('filters.stores')}
          </h2>
          <div className="w-6" />
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-y-auto" style={{ maxHeight: '60vh', overflowY: 'auto', height: '100%' }}>
          {!showAddStore ? (
            <>
              {/* Search input */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Поиск магазинов"
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Recent stores */}
              {recentStores.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-gray-400 text-sm mb-2">Недавние магазины</h3>
                  <div className="flex flex-wrap gap-2">
                    {recentStores.map(storeId => {
                      const store = localStores.find(s => s.id === storeId);
                      return store ? (
                        <button
                          key={store.id}
                          className={`px-3 py-1 rounded-full text-sm ${
                            selectedStores.includes(store.id) || selectedStore === store.id
                              ? 'bg-orange-500 text-white'
                              : 'bg-gray-700 text-gray-300'
                          }`}
                          onClick={() => handleStoreClick(store.id)}
                        >
                          {store.name}
                        </button>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              {/* Search results */}
              {searchQuery.trim() && (
                <div className="grid grid-cols-1 gap-2">
                  {localStores
                    .filter(store => {
                      const query = searchQuery.toLowerCase().trim();
                      const storeName = (store.name || '').toLowerCase();
                      const storeId = (store.id || '').toLowerCase();
                      const storeUrl = (store.url || '').toLowerCase();
                      
                      return storeName.includes(query);
                    })
                    
                    .map(store => (
                      <button
                        key={store.id}
                        type="button"
                        className={`w-full text-left px-4 py-3 rounded-lg ${
                          selectedStore === store.id || selectedStores.includes(store.id)
                            ? 'bg-orange-500 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleStoreClick(store.id);
                        }}
                      >
                        {store.name}
                      </button>
                    ))}
                </div>
              )}

              {/* Add store button */}
              {searchQuery.trim() && !stores.some(store => 
                store.name.toLowerCase().includes(searchQuery.toLowerCase())
              ) && (
                <button
                  onClick={() => {
                    setShowAddStore(true);
                    setNewStore(prev => ({ ...prev, name: searchQuery }));
                  }}
                  className="mt-4 w-full bg-orange-500 text-white py-2 px-4 rounded-lg hover:bg-orange-600"
                >
                  Добавить новый магазин
                </button>
              )}
            </>
          ) : (
            /* Add store form */
            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-1">Название магазина</label>
                <input
                  type="text"
                  value={newStore.name}
                  onChange={(e) => setNewStore(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  placeholder="Например: Amazon"
                />
                {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1">URL магазина</label>
                <input
                  type="url"
                  value={newStore.url}
                  onChange={(e) => setNewStore(prev => ({ ...prev, url: e.target.value }))}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  placeholder="https://www.amazon.com"
                />
                {errors.url && <p className="text-red-500 text-sm mt-1">{errors.url}</p>}
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setShowAddStore(false)}
                  className="flex-1 bg-gray-700 text-white py-2 px-4 rounded-lg hover:bg-gray-600"
                >
                  Отмена
                </button>
                <button
                  onClick={handleAddStore}
                  className="flex-1 bg-orange-500 text-white py-2 px-4 rounded-lg hover:bg-orange-600"
                >
                  Добавить
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default React.memo(StoreBottomSheet);
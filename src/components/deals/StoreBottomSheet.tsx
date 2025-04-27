import React, { useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { stores } from '../../data/mockData';
import { useLanguage } from '../../contexts/LanguageContext';

interface StoreBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedStore: string | null;
  onStoreSelect: (storeId: string) => void;
}

const StoreBottomSheet: React.FC<StoreBottomSheetProps> = ({
  isOpen,
  onClose,
  selectedStore,
  onStoreSelect,
}) => {
  const { t, language } = useLanguage();
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);

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
    console.log('StoreBottomSheet - Props updated:', {
      isOpen,
      selectedStore
    });
  }, [isOpen, selectedStore]);

  useEffect(() => {
    if (!isOpen) return;

    console.log('StoreBottomSheet - Setting up touch handlers');

    const handleTouchStart = (e: TouchEvent) => {
      console.log('StoreBottomSheet - Touch start');
      startY.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      currentY.current = e.touches[0].clientY;
      const diff = startY.current - currentY.current;
      
      if (sheetRef.current) {
        sheetRef.current.style.transform = `translateY(${Math.min(0, diff)}px)`;
      }
    };

    const handleTouchEnd = () => {
      console.log('StoreBottomSheet - Touch end');
      if (sheetRef.current) {
        const diff = startY.current - currentY.current;
        if (diff > 100) {
          onClose();
        } else {
          sheetRef.current.style.transform = 'translateY(0)';
        }
      }
    };

    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      console.log('StoreBottomSheet - Cleaning up touch handlers');
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isOpen, onClose]);

  const handleStoreClick = (storeId: string) => {
    console.log('StoreBottomSheet - Store clicked:', storeId);
    console.log('StoreBottomSheet - Current selected store:', selectedStore);
    console.log('StoreBottomSheet - Store data:', stores.find(s => s.id === storeId));
    console.log('StoreBottomSheet - Calling onStoreSelect with:', storeId);
    onStoreSelect(storeId);
    console.log('StoreBottomSheet - After onStoreSelect call');
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    // Check if the click was on the overlay itself, not the bottom sheet
    if (e.target === e.currentTarget) {
      console.log('StoreBottomSheet - Overlay clicked, closing');
      onClose();
    }
  };

  if (!isOpen) {
    console.log('StoreBottomSheet - Not rendering (isOpen is false)');
    return null;
  }

  console.log('StoreBottomSheet - Rendering with props:', { isOpen, selectedStore });

  return (
    <>
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40" 
        onClick={handleOverlayClick}
      />
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 bg-gray-800 rounded-t-xl z-50 max-h-[80vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
          <button onClick={onClose} className="text-white">
            <X className="h-6 w-6" />
          </button>
          <h2 className="text-white text-lg font-medium">{t('filters.stores')}</h2>
          <div className="w-6" /> {/* Spacer for alignment */}
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="grid grid-cols-1 gap-2">
            {stores.map(store => (
              <button
                key={store.id}
                type="button"
                className={`w-full text-left px-4 py-3 rounded-lg ${
                  selectedStore === store.id
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('StoreBottomSheet - Store button clicked:', store.id, store.name);
                  handleStoreClick(store.id);
                }}
              >
                {store.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default StoreBottomSheet; 
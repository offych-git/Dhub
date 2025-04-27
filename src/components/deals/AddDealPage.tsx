// ... existing code ...
const [availableStores, setAvailableStores] = useState<{id: string, name: string, url: string}[]>([]);

  useEffect(() => {
    const fetchStores = async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('*');
      
      if (!error && data) {
        setAvailableStores(data);
      }
    };
    
    fetchStores();
  }, []);
const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
const [formData, setFormData] = useState({
  title: '',
  currentPrice: '',
  originalPrice: '',
  description: '',
  category: '',
});

// Добавляем функцию для получения названия магазина
const getStoreName = (storeId: string | null) => {
  console.log('AddDealPage - getStoreName (selectedStoreId approach) вызывается с:', storeId);
  console.log('AddDealPage - getStoreName (selectedStoreId approach) видит availableStores длиной:', availableStores.length);
  if (!storeId) return '';
  const store = availableStores.find(s => s.id === storeId);
  console.log('AddDealPage - getStoreName (selectedStoreId approach) нашел магазин:', store ? store.name : 'Не найден');
  return store ? store.name : '';
};

// Обработчик добавления нового магазина
const handleStoreAdd = async (newStore: { id: string; name: string; url: string }) => {
  console.log('AddDealPage - handleStoreAdd called with new store:', newStore);
  
  // Удаляем дублирующий запрос к Supabase, так как он уже выполняется в StoreBottomSheet
  setAvailableStores(prev => {
    const updated = [...prev, newStore];
    console.log('AddDealPage - availableStores updated, new length:', updated.length);
    return updated;
  });
  
  console.log('AddDealPage - setting selected store to:', newStore.id);
  setSelectedStoreId(newStore.id);
  setSelectedStoreName(newStore.name);
  console.log('AddDealPage - selectedStoreName set to:', newStore.name);
};

const handleStoreSelect = (storeId: string) => {
  setSelectedStoreId(storeId);
  
  const selectedStore = availableStores.find(s => s.id === storeId);
  if (selectedStore) {
    setSelectedStoreName(selectedStore.name);
  }
};

useEffect(() => {
  console.log('formData updated:', formData);
}, [formData]);

return (
  <StoreBottomSheet
    isOpen={isStoreBottomSheetOpen}
    onClose={handleStoreBottomSheetClose}
    selectedStore={selectedStoreId}
    onStoreSelect={handleStoreSelect}
    onStoreAdd={handleStoreAdd}
    stores={availableStores}
  />
  
  {/* Отображение выбранного магазина */}
  <div>
    <button
      onClick={() => setIsStoreBottomSheetOpen(true)}
      className="w-full text-left px-4 py-2 bg-gray-700 rounded-lg text-white"
    >
      {getStoreName(selectedStoreId) || 'Выберите магазин'}
    </button>
  </div>
  // ... existing code ...
);
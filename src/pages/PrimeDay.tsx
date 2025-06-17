// PrimeDay.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext'; // Убедитесь, что путь к вашему AuthContext верный
import { supabase } from '../lib/supabase'; // Убедитесь, что путь к вашему supabase клиенту верный
import { FaPlus, FaCheck, FaSpinner, FaHandPointer, FaRocket } from 'react-icons/fa';

// --- Типы данных ---
interface Subscription {
  id: string;
  keyword: string;
}

// --- Конфигурация товаров ---
const productData = {
    "🔥 Главные Хиты Prime Day": ["iPhone", "Apple Watch", "Apple Airpods", "Labubu", "PS5 Pro", "Dyson пылесос", "Dyson airwrap", "Nintendo Switch", "наушники Sony", "Телевизор", "MacBook", "DJI Osmo Pocket 3"],
    "Электроника и Гаджеты": ["iPad", "Google Pixel", "Samsung телефон", "Samsung планшет", "Garmin часы", "Kindle", "Ноутбук", "Принтер", "Видеорегистратор", "Air Fryer", "Bluetooth колонка", "GoPro", "Meta Quest", "Ray Ban Meta очки", "Beats", "Shark", "Ring", "Nikon", "Canon", "Echo", "Fire TV", "Blink", "eero", "Power bank", "Steam Deck", "Razer"],
    "Бытовая Техника": ["Робот пылесос", "Roborock пылесос", "Breville кофемашина", "Philips кофемашина", "DeLonghi кофемашина", "KitchenAid", "KENWOOD", "Instant pot", "Крупная бытовая техника", "Очиститель воздуха", "Ninja Creami", "Nespresso", "Lavazza", "Электробритвы", "Le Creuset", "Anova", "T-fal", "Braun", "Philips"],
    "Дом и Сад": ["Dewalt", "Makita", "Гриль газовый", "Гриль на углях", "Коптильня", "Матрас", "Мебель для дома", "Уличная мебель", "Инструменты", "Генератор"],
    "Мода и Аксессуары": ["Nike", "Adidas", "New Balance", "Victoria's Secret", "Tiffany", "Puma", "Carhartt", "Michael Kors", "Timberland", "Polo Ralph Lauren", "Crocs", "UGG", "Парфюмерия", "Lancome", "Чемоданы"],
    "Дети": ["Roblox", "Minecraft", "Play-Doh", "Bluey", "Barbie", "MARVEL", "LEGO", "LOL", "Hot Wheels", "Britax", "Graco Nuna", "Stokke", "Bugaboo", "Все для детей"],
"Животные": ["Litter Robot", "Товары для животных", "Корма", "Наполнитель"],
    "Разное": ["Tide", "Рюкзак", "Гифт карты", "Товары для охоты", "Maybelline", "CeraVe", "Olay", "Revlon", "Laneige", "Электрическая зубная щетка"],

};

// --- Стили для компонентов (можно вынести в отдельный CSS-файл) ---
const styles = `
    .tag-animation { transition: all 0.2s ease-in-out; }
    .tag-selected { transform: translateY(-2px); }
    .tag-featured-selected { box-shadow: 0 4px 15px rgba(245, 158, 11, 0.5); }
    .tag-normal-selected { box-shadow: 0 4px 15px rgba(37, 99, 235, 0.4); }
    .tag-processing { cursor: wait; opacity: 0.7; }

    .modal-backdrop {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background-color: rgba(0, 0, 0, 0.6); display: flex;
        justify-content: center; align-items: center; z-index: 50;
        opacity: 0; visibility: hidden; transition: opacity 0.3s ease;
    }
    .modal-backdrop.visible { opacity: 1; visibility: visible; }
    .modal-content {
        transform: scale(0.9); transition: transform 0.3s ease;
    }
    .modal-backdrop.visible .modal-content { transform: scale(1); }
`;

// --- Основной компонент страницы ---
const PrimeDayPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [userSubscriptions, setUserSubscriptions] = useState<Map<string, string>>(new Map());
  const [processingKeywords, setProcessingKeywords] = useState<Set<string>>(new Set());
  const [customKeyword, setCustomKeyword] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);

  const [modalState, setModalState] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      type: 'success' | 'error' | 'info';
  }>({ isOpen: false, title: '', message: '', type: 'success' });

  // --- Загрузка подписок пользователя ---
  const loadSubscriptions = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_keyword_subscriptions')
        .select('id, keyword')
        .eq('user_id', user.id);

      if (error) throw error;
      
      const subsMap = new Map(data.map(sub => [sub.keyword, sub.id]));
      setUserSubscriptions(subsMap);

    } catch (error) {
      console.error('Error loading subscriptions:', error);
      showModal('Ошибка', 'Не удалось загрузить ваши подписки.', 'error');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  // --- Обработка клика по тегу (добавление/удаление) ---
  const handleTagClick = async (keyword: string) => {
    if (!user || processingKeywords.has(keyword)) return;

    setProcessingKeywords(prev => new Set(prev).add(keyword));

    const isSubscribed = userSubscriptions.has(keyword);

    try {
      if (isSubscribed) {
        // Удаление подписки
        const subscriptionId = userSubscriptions.get(keyword);
        const { error } = await supabase
          .from('user_keyword_subscriptions')
          .delete()
          .match({ id: subscriptionId, user_id: user.id });
        if (error) throw error;
        
        setUserSubscriptions(prev => {
          const newMap = new Map(prev);
          newMap.delete(keyword);
          return newMap;
        });

      } else {
        // Добавление подписки
        const { data, error } = await supabase
          .from('user_keyword_subscriptions')
          .insert({ user_id: user.id, keyword: keyword })
          .select('id, keyword')
          .single();
        if (error) throw error;

        setUserSubscriptions(prev => new Map(prev).set(data.keyword, data.id));
      }
    } catch (error) {
      console.error('Error toggling subscription:', error);
      showModal('Ошибка', 'Не удалось обновить подписку. Попробуйте еще раз.', 'error');
    } finally {
      setProcessingKeywords(prev => {
        const newSet = new Set(prev);
        newSet.delete(keyword);
        return newSet;
      });
    }
  };

  // --- Обработка добавления кастомного товара ---
  const handleAddCustomKeyword = async () => {
    if (!user || !customKeyword.trim()) return;

    const keyword = customKeyword.trim();
    if (userSubscriptions.has(keyword)) {
      showModal('Уже добавлено', `Товар "${keyword}" уже есть в ваших подписках.`, 'info');
      return;
    }
    
    setIsAddingCustom(true);
    await handleTagClick(keyword);
    setCustomKeyword('');
    setIsAddingCustom(false);
    showModal('Готово!', `Товар "${keyword}" добавлен в ваши подписки.`, 'success');
  };
  
  // --- Управление модальным окном ---
  const showModal = (title: string, message: string, type: 'success' | 'error' | 'info' = 'success') => {
      setModalState({ isOpen: true, title, message, type });
  };
  
  const closeModal = () => {
      setModalState({ isOpen: false, title: '', message: '', type: 'success' });
  };

  // --- Рендеринг компонента ---
  return (
    <>
      <style>{styles}</style>
      <div className="bg-gray-50 pt-[30px]">
        
        {/* ЗОНА 1: ГЕРОЙСКИЙ БЛОК */}
        <div className="hero-section bg-gradient-to-br from-indigo-600 to-purple-600 text-white text-center py-8 sm:py-10 px-4">
            <div className="max-w-3xl mx-auto">
                <div className="inline-block bg-white/25 text-white font-bold rounded-full px-4 py-2 text-sm mb-4 shadow-lg">
                    <i className="fa-solid fa-calendar-check mr-2"></i>Распродажа: 8 – 11 июля
                </div>
                <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">УСПЕЙ НА PRIME DAY!</h1>
                <p className="mt-4 text-lg text-indigo-200">Добавь товары в свои подписки, чтобы не пропустить лучшие цены.</p>
            </div>
        </div>

        {/* ЗОНА 2: КАК ЭТО РАБОТАЕТ */}
        <div className="how-it-works-section bg-gray-100 py-10 sm:py-12 px-4">
            <div className="max-w-4xl mx-auto text-center">
                <h2 className="text-3xl font-bold text-gray-800 mb-8">Всего 2 простых шага</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">
                    <div className="step">
                        <div className="flex items-center justify-center h-16 w-16 bg-blue-100 text-blue-600 rounded-full mx-auto mb-4"><FaHandPointer className="text-2xl" /></div>
                        <h3 className="text-xl font-semibold text-gray-800">1. Добавь товары</h3>
                        <p className="text-gray-600 mt-2">Просто кликни на интересующие тебя товары из списка ниже.</p>
                    </div>
                    <div className="step">
                        <div className="flex items-center justify-center h-16 w-16 bg-blue-100 text-blue-600 rounded-full mx-auto mb-4"><FaRocket className="text-2xl" /></div>
                        <h3 className="text-xl font-semibold text-gray-800">2. Участвуй!</h3>
                        <p className="text-gray-600 mt-2">Получи email, как только появится скидка.</p>
                    </div>
                </div>
            </div>
        </div>

        {/* ЗОНА 3: ОСНОВНОЙ КОНТЕНТ */}
        <div className="main-content-section bg-white pt-10 sm:pt-12 px-4 pb-12 sm:pb-16">
            <div className="max-w-4xl w-full mx-auto">
              {loading ? (
                <div className="text-center py-10">
                  <FaSpinner className="h-10 w-10 text-blue-500 animate-spin mx-auto"/>
                  <p className="mt-4 text-gray-600">Загружаем ваши подписки...</p>
                </div>
              ) : (
                <>
                  <div className="space-y-10">
                    {Object.entries(productData).map(([category, items]) => {
                      const isFeatured = category.includes('🔥');
                      return (
                        <div key={category}>
                          <h2 className="text-2xl font-bold text-gray-800 mb-5">{category}</h2>
                          <div className="flex flex-wrap gap-3">
                            {items.map(item => {
                              const isSelected = userSubscriptions.has(item);
                              const isProcessing = processingKeywords.has(item);
                              
                              const baseClasses = "tag-animation cursor-pointer px-4 py-2 rounded-full font-medium border flex items-center gap-2";
                              const featuredClasses = isSelected ? "bg-amber-400 text-black border-amber-500 tag-selected tag-featured-selected" : "bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200";
                              const normalClasses = isSelected ? "bg-blue-600 text-white border-blue-600 tag-selected tag-normal-selected" : "bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200";
                              const processingClasses = "tag-processing bg-gray-200 text-gray-500";
                              
                              return (
                                <div
                                  key={item}
                                  onClick={() => handleTagClick(item)}
                                  className={`${baseClasses} ${isProcessing ? processingClasses : (isFeatured ? featuredClasses : normalClasses)}`}
                                >
                                  {isProcessing ? <FaSpinner className="animate-spin" /> : (isSelected ? <FaCheck /> : <FaPlus />)}
                                  <span>{item}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="extra-cta text-center bg-indigo-50 border-2 border-dashed border-indigo-200 p-6 rounded-xl mt-12">
                      <h3 className="text-xl font-semibold text-gray-800">Не нашли нужный товар?</h3>
                      <p className="text-gray-600 mt-2 mb-4">Просто впиши его название, и мы добавим его в ваши подписки!</p>
                      <div className="flex flex-col sm:flex-row gap-2 max-w-lg mx-auto">
                          <input 
                            type="text" 
                            value={customKeyword}
                            onChange={(e) => setCustomKeyword(e.target.value)}
                            placeholder="Например, GoPro 12" 
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                          />
                          <button 
                            onClick={handleAddCustomKeyword}
                            disabled={!customKeyword.trim() || isAddingCustom}
                            className="w-full sm:w-auto bg-blue-600 text-white font-bold px-6 py-3 rounded-lg shadow-md hover:bg-blue-700 transition duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                          >
                            {isAddingCustom ? <FaSpinner className="animate-spin h-5 w-5"/> : 'Добавить'}
                          </button>
                      </div>
                  </div>
                </>
              )}
            </div>
        </div>
      </div>

      {/* Модальное окно */}
      {modalState.isOpen && (
          <div className="modal-backdrop visible" onClick={closeModal}>
              <div className="modal-content bg-white p-6 rounded-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">{modalState.title}</h2>
                  <p className="text-gray-600 mb-6">{modalState.message}</p>
                  <button onClick={closeModal} className="bg-blue-500 text-white font-bold px-6 py-2 rounded-lg hover:bg-blue-600 transition">
                      Отлично!
                  </button>
              </div>
          </div>
      )}
    </>
  );
};

export default PrimeDayPage;


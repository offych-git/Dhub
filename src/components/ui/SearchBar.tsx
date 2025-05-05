import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { useNavigate, useLocation, useSearchParams, createSearchParams } from 'react-router-dom';
import { useDebounce } from '../../hooks/useDebounce';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../contexts/LanguageContext';

const SearchBar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [isSearching, setIsSearching] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    if (debouncedSearch) {
      setIsSearching(true);
      setNoResults(false);

      const searchAllContent = async () => {
        // Преобразуем поисковый запрос в формат, который поддерживает tsquery 
        // Избегаем синтаксических ошибок при работе с кириллицей и короткими запросами
        let searchTerms = debouncedSearch.trim().split(/\s+/).filter(Boolean);

        // Если запрос слишком короткий или содержит некорректные символы для tsquery, 
        // используем ILIKE вместо tsquery
        let useILike = searchTerms.length === 0 || searchTerms.some(term => term.length < 2);

        if (useILike) {
          // Поиск через ILIKE выполняется прямо в компоненте без использования search_all_content
          try {
            // Поиск по deals
            const { data: dealsResult, error: dealsError } = await supabase
              .from('deals')
              .select('id')
              .or(`title.ilike.%${debouncedSearch}%,description.ilike.%${debouncedSearch}%`);

            if (dealsError) throw dealsError;

            // Поиск по promos
            const { data: promosResult, error: promosError } = await supabase
              .from('promos')
              .select('id')
              .or(`title.ilike.%${debouncedSearch}%,description.ilike.%${debouncedSearch}%`);

            if (promosError) throw promosError;

            // Формируем результаты в том же формате, как ожидается от search_all_content
            const deals = new Set(dealsResult?.map(item => item.id) || []);
            const promos = new Set(promosResult?.map(item => item.id) || []);

            // Проверяем, есть ли результаты поиска
            const hasResults = deals.size > 0 || promos.size > 0;
            setNoResults(!hasResults);

            const params = {
              q: debouncedSearch,
              deals: Array.from(deals).join(','),
              promos: Array.from(promos).join(','),
              timestamp: Date.now().toString(),
              no_results: hasResults ? null : 'true'
            };
            setSearchParams(params);
            setIsSearching(false);

          } catch (err) {
            console.error('ILIKE search error:', err);
            setIsSearching(false);
          }
          return;
        }

        // Для нормальных запросов используем tsquery через функцию search_all_content
        const searchQuery = searchTerms.join(' & ');

        try {
          const { data: searchResults, error } = await supabase.rpc('search_all_content', {
            search_query: searchQuery
          });

          if (error) {
            console.error('Search error:', error);
            setIsSearching(false);
            return;
          }

          const deals = new Set();
          const promos = new Set();

          searchResults?.forEach(result => {
            if (result.type === 'deal' || result.type === 'deal_comment') {
              deals.add(result.id);
            } else if (result.type === 'promo' || result.type === 'promo_comment') {
              promos.add(result.id);
            }
          });

          // Проверяем, есть ли результаты поиска
          const hasResults = deals.size > 0 || promos.size > 0;
          setNoResults(!hasResults);

          const params = {
            q: debouncedSearch,
            deals: Array.from(deals).join(','),
            promos: Array.from(promos).join(','),
            timestamp: Date.now().toString(),
            no_results: hasResults ? null : 'true'
          };
          setSearchParams(params);
          setIsSearching(false);
        } catch (error) {
          console.error('Ошибка при поиске:', error);
          setIsSearching(false);
        }
      };

      // Добавляем обработку ошибок при вызове функции поиска
      try {
        searchAllContent();
      } catch (err) {
        console.error('Ошибка при выполнении поиска:', err);
        setIsSearching(false);
      }
    } else {
      searchParams.delete('q');
      searchParams.delete('deals');
      searchParams.delete('promos');
      searchParams.delete('no_results');
      setSearchParams(searchParams);
      setNoResults(false);
    }
  }, [debouncedSearch]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const clearSearch = () => {
    setSearchTerm('');
    searchParams.delete('q');
    searchParams.delete('deals');
    searchParams.delete('promos');
    setSearchParams(searchParams);
  };

  return (
    <div className="relative mx-4 mt-3 mb-0">
      <div className="flex items-center bg-gray-700 rounded-lg px-4 py-2">
        <Search className="h-5 w-5 text-gray-400 mr-2" />
        <input
          type="text"
          value={searchTerm}
          onChange={handleSearch}
          placeholder="Search deals, promos..."
          className="search-input bg-transparent text-gray-300 placeholder-gray-400 outline-none flex-1"
        />
        {searchTerm && (
          <button
            onClick={clearSearch}
            className="text-gray-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        )}
        {isSearching && (
          <div className="h-4 w-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin ml-2"></div>
        )}
      </div>
      {/* Блок "нет результатов" был удален */}
    </div>
  );
};

export default SearchBar;
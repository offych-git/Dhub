import React, { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import {
  useNavigate,
  useLocation,
  useSearchParams,
  createSearchParams,
} from "react-router-dom";
import { useDebounce } from "../../hooks/useDebounce";
import { supabase } from "../../lib/supabase";
import { useLanguage } from "../../contexts/LanguageContext";

const SearchBar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [isSearching, setIsSearching] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const { t } = useLanguage();

  // Синхронизируем searchTerm с URL при возвращении на страницу
  useEffect(() => {
    const queryParam = searchParams.get("q") || "";
    if (queryParam !== searchTerm) {
      setSearchTerm(queryParam);
    }
  }, [location.key]);

  // Функция выполнения поиска
  const performSearch = async (query: string) => {
    if (!query.trim()) return;

    console.log("SearchBar: Выполняем поиск с запросом:", query);
    setIsSearching(true);
    setNoResults(false);

    // Преобразуем поисковый запрос в формат, который поддерживает tsquery
    // Избегаем синтаксических ошибок при работе с кириллицей и короткими запросами
    let searchTerms = query.trim().split(/\s+/).filter(Boolean);

    // Если запрос слишком короткий или содержит некорректные символы для tsquery,
    // используем ILIKE вместо tsquery
    let useILike =
      searchTerms.length === 0 || searchTerms.some((term) => term.length < 2);

    try {
      if (useILike) {
        // Поиск через ILIKE выполняется прямо в компоненте без использования search_all_content
        // Поиск по deals
        const { data: dealsResult, error: dealsError } = await supabase
          .from("deals")
          .select("id")
          .or(`title.ilike.%${query}%,description.ilike.%${query}%`);

        if (dealsError) throw dealsError;

        // Поиск по promos
        const { data: promosResult, error: promosError } = await supabase
          .from("promo_codes")
          .select("id")
          .or(`title.ilike.%${query}%,description.ilike.%${query}%`);

        if (promosError) throw promosError;

        // Формируем результаты в том же формате, как ожидается от search_all_content
        const deals = new Set(dealsResult?.map((item) => item.id) || []);
        const promos = new Set(promosResult?.map((item) => item.id) || []);

        // Проверяем, есть ли результаты поиска
        const hasResults = deals.size > 0 || promos.size > 0;
        setNoResults(!hasResults);

        // Перенаправляем на страницу поиска с результатами
        navigate(
          `/search?q=${encodeURIComponent(query)}&deals=${Array.from(deals).join(",")}&promos=${Array.from(promos).join(",")}&timestamp=${Date.now()}${!hasResults ? "&no_results=true" : ""}`,
        );
      } else {
        // Для нормальных запросов используем tsquery через функцию search_all_content
        const searchQuery = searchTerms.join(" & ");

        const { data: searchResults, error } = await supabase.rpc(
          "search_all_content",
          {
            search_query: searchQuery,
          },
        );

        if (error) {
          console.error("Search error:", error);
          setIsSearching(false);
          return;
        }

        const deals = new Set();
        const promos = new Set();

        searchResults?.forEach((result) => {
          if (result.type === "deal" || result.type === "deal_comment") {
            deals.add(result.id);
          } else if (
            result.type === "promo" ||
            result.type === "promo_comment"
          ) {
            promos.add(result.id);
          }
        });

        // Проверяем, есть ли результаты поиска
        const hasResults = deals.size > 0 || promos.size > 0;
        setNoResults(!hasResults);

        // Перенаправляем на страницу поиска с результатами
        navigate(
          `/search?q=${encodeURIComponent(query)}&deals=${Array.from(deals).join(",")}&promos=${Array.from(promos).join(",")}&timestamp=${Date.now()}${!hasResults ? "&no_results=true" : ""}`,
        );
      }
    } catch (error) {
      console.error("Ошибка при поиске:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      performSearch(searchTerm.trim());
    }
  };

  const clearSearch = () => {
    setSearchTerm("");
    searchParams.delete("q");
    searchParams.delete("deals");
    searchParams.delete("promos");
    searchParams.delete("no_results");
    setSearchParams(searchParams);
  };

  return (
    <div className="relative mx-4 mt-2 mb-0">
      <form onSubmit={handleSearchSubmit} autoComplete="off">
        <div className="flex items-center bg-gray-700 rounded-lg px-4 py-2">
          {/* Иконка лупы слева удалена */}
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearch}
            onInput={(e) =>
              console.log("SearchBar: onInput event", e.currentTarget.value)
            }
            placeholder="Search deals, promos and sweepstakes"
            className="search-input bg-transparent text-gray-300 placeholder-gray-400 outline-none flex-1 w-full"
            autoComplete="off"
            aria-label="Search"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={clearSearch}
              className="text-gray-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          )}
          <button
            type="submit"
            className="ml-2 bg-orange-500 text-white px-3 py-1 rounded-md text-sm"
            disabled={isSearching}
          >
            {isSearching ? (
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Search className="h-5 w-5" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SearchBar;
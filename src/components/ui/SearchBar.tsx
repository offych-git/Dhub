
import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useDebounce } from '../../hooks/useDebounce';
import { supabase } from '../../lib/supabase';

const SearchBar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const debouncedSearch = useDebounce(searchTerm, 300);

  useEffect(() => {
    if (debouncedSearch) {
      const searchAllContent = async () => {
        const searchQuery = debouncedSearch.split(' ').join(' & ');
        
        const { data: searchResults, error } = await supabase.rpc('search_all_content', {
          search_query: searchQuery
        });

        if (error) {
          console.error('Search error:', error);
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

        setSearchParams({ 
          q: debouncedSearch,
          deals: Array.from(deals).join(','),
          promos: Array.from(promos).join(',')
        });
      };

      searchAllContent();
    } else {
      searchParams.delete('q');
      searchParams.delete('deals');
      searchParams.delete('promos');
      setSearchParams(searchParams);
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
    <div className="relative mx-4 my-3">
      <div className="flex items-center bg-gray-700 rounded-lg px-4 py-2">
        <Search className="h-5 w-5 text-gray-400 mr-2" />
        <input
          type="text"
          value={searchTerm}
          onChange={handleSearch}
          placeholder="Search deals, promos, comments..."
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
      </div>
    </div>
  );
};

export default SearchBar;

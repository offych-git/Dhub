import React, { useState } from 'react';
import FilterMenu from '../ui/FilterMenu';

interface FilterBarProps {
  selectedCategories: string[];
  selectedStores: string[];
  onFilterChange: (type: 'categories' | 'stores', ids: string[]) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({
  selectedCategories,
  selectedStores,
  onFilterChange,
}) => {
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [storeMenuOpen, setStoreMenuOpen] = useState(false);

  const handleCategoryClick = () => {
    setStoreMenuOpen(false);
    setCategoryMenuOpen(!categoryMenuOpen);
  };

  const handleStoreClick = () => {
    setCategoryMenuOpen(false);
    setStoreMenuOpen(!storeMenuOpen);
  };

  const handleCategorySelect = (id: string) => {
    const newCategories = selectedCategories.includes(id)
      ? selectedCategories.filter((catId) => catId !== id)
      : [...selectedCategories, id];
    onFilterChange('categories', newCategories);
    setCategoryMenuOpen(false);
  };

  const handleStoreSelect = (id: string) => {
    const newStores = selectedStores.includes(id)
      ? selectedStores.filter((storeId) => storeId !== id)
      : [...selectedStores, id];
    onFilterChange('stores', newStores);
    setStoreMenuOpen(false);
  };

  return (
    <div className="px-4 mb-4">
      <div className="flex items-center text-gray-400 mb-2">
        <span>Filters</span>
        <div className="flex space-x-2 ml-4">
          <FilterMenu
            type="categories"
            isOpen={categoryMenuOpen}
            onToggle={handleCategoryClick}
            selectedItems={selectedCategories}
            onSelect={handleCategorySelect}
            onClear={() => {
              onFilterChange('categories', []);
              setCategoryMenuOpen(false);
            }}
          />
          <FilterMenu
            type="stores"
            isOpen={storeMenuOpen}
            onToggle={handleStoreClick}
            selectedItems={selectedStores}
            onSelect={handleStoreSelect}
            onClear={() => {
              onFilterChange('stores', []);
              setStoreMenuOpen(false);
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
import React, { useState } from 'react';
import FilterMenu from '../ui/FilterMenu';

interface FilterBarProps {
  selectedCategories: string[];
  selectedStores: string[];
  selectedStatus: string[];
  onFilterChange: (type: 'categories' | 'stores' | 'status', ids: string[]) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({
  selectedCategories,
  selectedStores,
  selectedStatus,
  onFilterChange,
}) => {
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [storeMenuOpen, setStoreMenuOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  const handleCategoryClick = () => {
    setStoreMenuOpen(false);
    setStatusMenuOpen(false);
    setCategoryMenuOpen(!categoryMenuOpen);
  };

  const handleStoreClick = () => {
    setCategoryMenuOpen(false);
    setStatusMenuOpen(false);
    setStoreMenuOpen(!storeMenuOpen);
  };

  const handleStatusClick = () => {
    setCategoryMenuOpen(false);
    setStoreMenuOpen(false);
    setStatusMenuOpen(!statusMenuOpen);
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

  const handleStatusSelect = (id: string) => {
    const newStatus = selectedStatus.includes(id)
      ? selectedStatus.filter((statusId) => statusId !== id)
      : [...selectedStatus, id];
    onFilterChange('status', newStatus);
    setStatusMenuOpen(false);
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
            type="status"
            isOpen={statusMenuOpen}
            onToggle={handleStatusClick}
            selectedItems={selectedStatus}
            onSelect={handleStatusSelect}
            onClear={() => {
              onFilterChange('status', []);
              setStatusMenuOpen(false);
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
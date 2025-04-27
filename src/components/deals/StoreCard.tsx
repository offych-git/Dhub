import React from 'react';
import { Store } from '../../data/mockData';

interface StoreCardProps {
  store: Store;
  isSelected?: boolean;
  onClick?: () => void;
}

const StoreCard: React.FC<StoreCardProps> = ({ store, isSelected = false, onClick }) => {
  return (
    <div 
      className={`p-4 rounded-lg border ${isSelected ? 'border-orange-500 bg-orange-50' : 'border-gray-200'} cursor-pointer`}
      onClick={onClick}
    >
      <div className="flex items-center">
        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center mr-3">
          {store.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h3 className="font-medium">{store.name}</h3>
          {store.url && (
            <a 
              href={store.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-gray-500 hover:text-orange-500"
              onClick={e => e.stopPropagation()}
            >
              {store.url.replace(/^https?:\/\//, '')}
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default StoreCard;
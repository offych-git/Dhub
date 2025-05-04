import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';

interface AddDealMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddDealMenu: React.FC<AddDealMenuProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute right-4 top-24 w-64 bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <div className="p-4 text-2xl font-bold text-orange-500">
          {t('common.add')}
        </div>
        <div className="divide-y divide-gray-700">
          <Link 
            to="/deals/new-carousel" 
            className="block px-4 py-3 text-white hover:bg-gray-700"
          >
            {t('common.deal')}
          </Link>
          <Link 
            to="/promos/new" 
            className="block px-4 py-3 text-white hover:bg-gray-700"
          >
            {t('common.promoCode')}
          </Link>
          <Link 
            to="/feedback" 
            className="block px-4 py-3 text-white hover:bg-gray-700"
          >
            {t('common.feedback')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AddDealMenu;
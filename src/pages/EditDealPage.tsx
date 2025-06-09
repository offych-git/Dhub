// Dhub/src/pages/EditDealPage.tsx (ФИНАЛЬНАЯ ВЕРСИЯ)

import React, { useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

const EditDealPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (id) {
      // Убедитесь, что здесь используются ОБРАТНЫЕ КАВЫЧКИ (тильда/ё на клавиатуре)
      navigate(`/edit-carousel/${id}${location.search}`, { replace: true });
    }
  }, [id, navigate, location.search]);

  // Пока происходит перенаправление, показываем заглушку
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
    </div>
  );
};

export default EditDealPage;
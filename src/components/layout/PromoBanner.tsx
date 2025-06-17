// src/components/layout/PromoBanner.tsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Rocket, X } from 'lucide-react';

const PromoBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);

  // Если пользователь закрыл баннер, больше его не показываем
  if (!isVisible) {
    return null;
  }

  return (
    <div className="relative bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
      <div className="mx-auto max-w-7xl px-3 py-2 text-center sm:px-6 lg:px-8">
        <p className="font-medium">
          <Rocket className="mr-2 inline h-5 w-5 animate-pulse" />
          <span className="md:hidden">Prime Day уже скоро!</span>
          <span className="hidden md:inline">Главная распродажа года: Prime Day уже скоро! Успейте подписаться на скидки.</span>
          <span className="ml-2 inline-block">
            <Link
              to="/primeday" // Ссылка на нашу новую страницу
              className="font-bold underline hover:text-indigo-200"
            >
              Подписаться 🔥<span aria-hidden="true">&rarr;</span>
            </Link>
          </span>
        </p>
      </div>
      <div className="absolute inset-y-0 right-0 flex items-start pt-1 pr-1 sm:items-start sm:pt-1 sm:pr-2">
        <button
          type="button"
          onClick={() => setIsVisible(false)}
          className="flex rounded-md p-1 text-white/80 hover:text-white focus:outline-none focus:ring-2 focus:ring-white"
        >

        </button>
      </div>
    </div>
  );
};

export default PromoBanner;


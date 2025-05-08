import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Tag, Ticket, Layers, User, Gift } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

const Navigation: React.FC = () => {
  const location = useLocation();
  const { t } = useLanguage();

  const navItems = [
    { path: '/', icon: Tag, label: t('navigation.deals') },
    { path: '/promos', icon: Ticket, label: t('navigation.promos') },
    { path: '/sweepstakes', icon: Gift, label: t('navigation.sweepstakes') },
    { path: '/profile', icon: User, label: t('navigation.profile') },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex justify-around py-2 z-10">
      {navItems.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          className={`flex flex-col items-center p-2 ${
            isActive(item.path) ? 'text-orange-500' : 'text-gray-400'
          }`}
        >
          <item.icon className="h-6 w-6" />
          <span className="text-xs mt-1">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
};

export default Navigation;
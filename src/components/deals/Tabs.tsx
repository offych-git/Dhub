import React from 'react';

interface TabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Tabs: React.FC<TabsProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'hot', label: 'HOT' },
    { id: 'new', label: 'NEW' },
    { id: 'discussed', label: 'MOST DISCUSSED' }
  ];

  return (
    <div className="flex border-b border-gray-800">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`py-3 px-4 text-sm font-medium ${
            activeTab === tab.id
              ? 'text-white border-b-2 border-orange-500'
              : 'text-gray-400'
          }`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default Tabs;
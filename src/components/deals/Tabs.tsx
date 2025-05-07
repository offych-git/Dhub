import React, { useState, useEffect } from 'react';

interface TabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Tabs: React.FC<TabsProps> = ({ activeTab, onTabChange }) => {
  const [selectedTab, setSelectedTab] = useState(activeTab); // Added state to manage active tab

  useEffect(() => {
    const storedTab = sessionStorage.getItem('activeDealsTab');
    if (storedTab) {
      setSelectedTab(storedTab); //Set active tab from session storage on mount
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem('activeDealsTab', selectedTab); //Persist tab on change
  }, [selectedTab]);

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
            selectedTab === tab.id
              ? 'text-white border-b-2 border-orange-500'
              : 'text-gray-400'
          }`}
          onClick={() => {
            setSelectedTab(tab.id); // Update local state first
            onTabChange(tab.id);
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default Tabs;
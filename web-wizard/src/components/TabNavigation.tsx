import React from 'react';
import '../styles/components/TabNavigation.css';

interface TabNavigationProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
}

const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange }) => {
    const tabs = [
        { id: 'supervisor', label: 'Supervisor' },
        { id: 'status', label: 'Estado' },
        { id: 'autonomous', label: 'Autonomo' },
        { id: 'planner', label: 'Planificador de ruta' },
    ];

    return (
        <div className="tab-navigation">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => onTabChange(tab.id)}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
};

export default TabNavigation;

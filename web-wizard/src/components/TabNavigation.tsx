import React from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/components/TabNavigation.css';

export type TabType = 'wizard' | 'route-generator' | 'supervision' | 'status' | 'autonomous';

interface TabNavigationProps {
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
}

const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange }) => {
    const { t } = useTranslation();

    const tabs: { id: TabType; label: string }[] = [
        { id: 'supervision', label: 'Supervision' },
        { id: 'status', label: 'Estado' },
        { id: 'autonomous', label: 'Autonomo' },
        { id: 'wizard', label: t('tabs.mapWizard') },
        // { id: 'route-generator', label: t('tabs.routeGenerator') },
    ];

    return (
        <div className="tab-nav-container">
            <div className="tab-nav-wrapper">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`tab-button ${activeTab === tab.id ? 'active' : 'inactive'}`}
                        style={{ marginLeft: '8px' }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default TabNavigation;

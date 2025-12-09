import React from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/components/TabNavigation.css';

interface TabNavigationProps {
    activeTab: 'wizard' | 'route-generator';
    onTabChange: (tab: 'wizard' | 'route-generator') => void;
}

const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange }) => {
    const { t } = useTranslation();

    return (
        <div className="tab-nav-container">
            <div className="tab-nav-wrapper">
                <button
                    onClick={() => onTabChange('wizard')}
                    className={`tab-button ${activeTab === 'wizard' ? 'active' : 'inactive'}`}
                >
                    {t('tabs.mapWizard')}
                </button>
                <button
                    onClick={() => onTabChange('route-generator')}
                    className={`tab-button tab-button-margin ${activeTab === 'route-generator' ? 'active' : 'inactive'}`}
                >
                    {t('tabs.routeGenerator')}
                </button>
            </div>
        </div>
    );
};

export default TabNavigation;

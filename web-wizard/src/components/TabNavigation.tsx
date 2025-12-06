import React from 'react';
import { useTranslation } from 'react-i18next';

interface TabNavigationProps {
    activeTab: 'wizard' | 'route-generator';
    onTabChange: (tab: 'wizard' | 'route-generator') => void;
}

const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange }) => {
    const { t } = useTranslation();

    return (
        <div className="flex justify-center mb-8">
            <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 inline-flex">
                <button
                    onClick={() => onTabChange('wizard')}
                    className={`
            px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ease-in-out
            ${activeTab === 'wizard'
                            ? 'bg-blue-600 text-white shadow-md transform scale-105'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        }
          `}
                >
                    {t('tabs.mapWizard')}
                </button>
                <button
                    onClick={() => onTabChange('route-generator')}
                    className={`
            px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ease-in-out ml-1
            ${activeTab === 'route-generator'
                            ? 'bg-blue-600 text-white shadow-md transform scale-105'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        }
          `}
                >
                    {t('tabs.routeGenerator')}
                </button>
            </div>
        </div>
    );
};

export default TabNavigation;

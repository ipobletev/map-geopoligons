import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Wizard from './components/Wizard';
import RouteGenerator from './components/RouteGenerator';
import TabNavigation from './components/TabNavigation';
import LanguageSwitcher from './components/LanguageSwitcher';

function App() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'wizard' | 'route-generator'>('wizard');

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="text-center space-y-2 relative">
          <div className="absolute right-0 top-0">
            <LanguageSwitcher />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {t('app.title')}
          </h1>
          <p className="text-lg text-slate-600">
            {t('app.subtitle')}
          </p>
        </div>

        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="transition-all duration-300 ease-in-out">
          {activeTab === 'wizard' ? (
            <div className="animate-fade-in">
              <Wizard />
            </div>
          ) : (
            <div className="animate-fade-in">
              <RouteGenerator />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;

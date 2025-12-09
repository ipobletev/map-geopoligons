import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Wizard from './components/Wizard';
import RouteGenerator from './components/RouteGenerator';
import TabNavigation from './components/TabNavigation';
import LanguageSwitcher from './components/LanguageSwitcher';
import './styles/App.css';

function App() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'wizard' | 'route-generator'>('wizard');

  return (
    <div className="app-container">
      <div className="app-content">
        <div className="app-header">
          <div className="lang-switcher-wrapper">
            <LanguageSwitcher />
          </div>
          <h1 className="app-title">
            {t('app.title')}
          </h1>
          <p className="app-subtitle">
            {t('app.subtitle')}
          </p>
        </div>

        {/* <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} /> */}

        <div className="content-transition">
          {activeTab === 'wizard' ? (
            <div className="fade-in-wrapper">
              <Wizard />
            </div>
          ) : (
            <div className="fade-in-wrapper">
              <RouteGenerator />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;

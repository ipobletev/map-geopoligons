import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Wizard from './components/Wizard';
import RouteGenerator from './components/RouteGenerator';
import Supervision from './components/Supervision';
import Status from './components/Status';
import Autonomous from './components/Autonomous';
import TabNavigation, { type TabType } from './components/TabNavigation';
import LanguageSwitcher from './components/LanguageSwitcher';
import './styles/App.css';

function App() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('wizard');

  const renderContent = () => {
    switch (activeTab) {
      case 'supervision':
        return <Supervision />;
      case 'status':
        return <Status />;
      case 'autonomous':
        return <Autonomous />;
      case 'wizard':
        return <Wizard />;
      case 'route-generator':
        return <RouteGenerator />;
      default:
        return <Wizard />;
    }
  };

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

        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="content-transition">
          <div className="fade-in-wrapper">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

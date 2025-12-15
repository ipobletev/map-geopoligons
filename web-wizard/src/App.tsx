import { useState } from 'react';
import Wizard from './components/Wizard';
import LanguageSwitcher from './components/LanguageSwitcher';
import TabNavigation from './components/TabNavigation';
import './styles/App.css';

function App() {
  const [activeTab, setActiveTab] = useState('planner');

  const renderContent = () => {
    switch (activeTab) {
      case 'supervisor':
        return <div className="fade-in-wrapper"><h2>Supervisor Component (Empty)</h2></div>;
      case 'status':
        return <div className="fade-in-wrapper"><h2>Estado Component (Empty)</h2></div>;
      case 'autonomous':
        return <div className="fade-in-wrapper"><h2>Autonomo Component (Empty)</h2></div>;
      case 'planner':
        return (
          <div className="fade-in-wrapper">
            <Wizard />
          </div>
        );
      default:
        return <div className="fade-in-wrapper"><h2>Select a tab</h2></div>;
    }
  };

  return (
    <div className="app-container">
      <div className="app-content">
        <div className="app-header">
          <div className="lang-switcher-wrapper">
            <LanguageSwitcher />
          </div>
        </div>

        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="content-transition">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

export default App;

import { useState } from 'react';
import Wizard from './components/Wizard';
import Supervisor from './components/Supervisor';
import Sidebar from './components/Sidebar';
import LanguageSwitcher from './components/LanguageSwitcher';
import TabNavigation from './components/TabNavigation';
import './styles/App.css';

function App() {
  const [activeTab, setActiveTab] = useState('planner');

  const renderContent = () => {
    switch (activeTab) {
      case 'supervisor':
        return <Supervisor />;
      case 'status':
        return <div className="p-4"><h2>Estado Component (Empty)</h2></div>;
      case 'autonomous':
        return <div className="p-4"><h2>Autonomo Component (Empty)</h2></div>;
      case 'planner':
        return (
          <div className="h-full">
            <Wizard />
          </div>
        );
      default:
        return <div className="p-4"><h2>Select a tab</h2></div>;
    }
  };

  return (
    <div className="flex flex-row h-screen w-screen overflow-hidden bg-gray-50">

      {/* Global Sidebar (Left) */}
      <Sidebar />

      {/* Main Content (Right) */}
      <div className="flex flex-col flex-1 h-full overflow-hidden">

        {/* Header / Tabs Area */}
        <div className="bg-gray-200 border-b border-gray-300 shrink-0">
          <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
            <h1 className="font-bold text-slate-700">Enaex Open Pit</h1>
            <LanguageSwitcher />
          </div>
          <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto bg-gray-100 relative">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

export default App;

import { useState } from 'react';
import Wizard from './components/Wizard';
import RouteGenerator from './components/RouteGenerator';
import TabNavigation from './components/TabNavigation';

function App() {
  const [activeTab, setActiveTab] = useState<'wizard' | 'route-generator'>('wizard');

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Web Wizard
          </h1>
          <p className="text-lg text-slate-600">
            Advanced map processing and route generation tools
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

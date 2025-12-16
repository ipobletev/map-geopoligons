import React, { useState } from 'react';
import Wizard from './components/Wizard';
import Supervisor from './components/Supervisor';
import Status from './components/Status';
import Autonomous from './components/Autonomous';
import Sidebar from './components/Sidebar';

function App() {
  const [activeTab, setActiveTab] = useState('supervisor');

  return (
    <div className="flex h-screen w-screen bg-gray-100 overflow-hidden font-sans text-slate-800">
      {/* Global Sidebar - Persistent across tabs */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Navigation Bar */}
        <header className="bg-white shadow-sm border-b border-gray-200 h-16 flex-none z-10">
          <div className="flex items-center h-full px-6">
            <h1 className="text-xl font-bold text-blue-900 mr-12 tracking-tight">
              ENAEX <span className="text-gray-400 font-light">|</span> WEB WIZARD
            </h1>

            <nav className="flex space-x-1 h-full">
              {[
                { id: 'supervisor', label: 'Supervisor' },
                { id: 'status', label: 'Estado' },
                { id: 'autonomous', label: 'Autónomo' },
                { id: 'planner', label: 'Planificador' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    px-6 h-full flex items-center text-sm font-medium transition-colors relative
                    ${activeTab === tab.id
                      ? 'text-blue-600 bg-blue-50/50'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }
                  `}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />
                  )}
                </button>
              ))}
            </nav>

            <div className="ml-auto flex items-center text-sm text-gray-400">
              <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
              System Ready
            </div>
          </div>
        </header>

        {/* Dynamic Tab Content */}
        <div className="flex-1 relative overflow-hidden">
          {activeTab === 'planner' && <Wizard />}
          {activeTab === 'supervisor' && <Supervisor />}
          {activeTab === 'autonomous' && <Autonomous />}
          {activeTab === 'status' && <Status />}
        </div>
      </div>
    </div>
  );
}


export default App;

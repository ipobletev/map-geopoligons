import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Wizard from './app/Wizard';
import Supervisor from './app/Supervisor';
import Status from './app/Status';
import Autonomous from './app/Autonomous';
import Sidebar from './app/Sidebar';
import ConnectionModal from './components/ConnectionModal';
import RosConnection from './ros/RosConnection';

function App() {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState('supervisor');
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  // const [language, setLanguage] = useState('es'); // Removed local state

  const toggleLanguage = () => {
    const newLang = i18n.language === 'es' ? 'en' : 'es';
    i18n.changeLanguage(newLang);
  };

  useEffect(() => {
    const rosConnection = RosConnection.getInstance();

    // Initial check
    setIsConnected(rosConnection.getRos().isConnected);

    const handleConnect = () => {
      setIsConnected(true);
      setIsReconnecting(false);
    };
    const handleClose = () => {
      setIsConnected(false);
      setIsReconnecting(false); // Immediately revert to disconnected state
    };
    const handleConnecting = () => {
      setIsReconnecting(true);
    };
    const handleError = () => {
      setIsConnected(false);
      setIsReconnecting(false); // Immediately revert to disconnected state
    };

    rosConnection.on('connection', handleConnect);
    rosConnection.on('close', handleClose);
    rosConnection.on('error', handleError);
    rosConnection.on('connecting', handleConnecting);

    return () => {
      rosConnection.off('connection', handleConnect);
      rosConnection.off('close', handleClose);
      rosConnection.off('error', handleError);
      rosConnection.off('connecting', handleConnecting);
    };
  }, []);

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
                { id: 'supervisor', label: t('tabs.supervisor') },
                { id: 'status', label: t('tabs.status') },
                { id: 'autonomous', label: t('tabs.autonomous') },
                { id: 'planner', label: t('tabs.planner') }
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

            <div className="ml-auto flex items-center text-sm text-gray-400 gap-4">
              {/* Language Selector */}
              <button
                onClick={toggleLanguage}
                className="flex items-center gap-1 p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-600 transition-colors font-medium"
                title="Switch Language"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                <span>{i18n.language.toUpperCase()}</span>
              </button>

              {/* Connection Settings Button */}
              <button
                onClick={() => setIsConnectionModalOpen(true)}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-600 transition-colors"
                title="Configure Connection"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.35a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              </button>

              <div className="flex items-center">
                <span className={`w-2 h-2 rounded-full mr-2 transition-all duration-500
                      ${isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' :
                    isReconnecting ? 'bg-yellow-500 animate-pulse shadow-[0_0_8px_rgba(234,179,8,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}
                  `}></span>

                <div className="flex items-center gap-2">
                  {isReconnecting && (
                    <svg className="animate-spin h-3 w-3 text-yellow-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  <span className={`${isConnected ? 'text-green-600 font-medium' : isReconnecting ? 'text-yellow-600 italic' : 'text-red-500'}`}>
                    {isConnected ? t('status.systemReady') : isReconnecting ? t('status.connecting') : t('status.disconnected')}
                  </span>
                </div>
              </div>
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

      <ConnectionModal
        isOpen={isConnectionModalOpen}
        onClose={() => setIsConnectionModalOpen(false)}
      />
    </div>
  );
}


export default App;

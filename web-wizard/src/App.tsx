import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Wizard from './app/Wizard';
import Supervisor from './app/Supervisor';
import Status from './app/Status';
import Autonomous from './app/Autonomous';
import Sidebar from './app/Sidebar';
import ConnectionModal from './components/ConnectionModal';
import RosConnection from './ros/RosConnection';
import './styles/components/TabNavigation.css';

import './styles/App.css';
import { useMachineInfo } from './ros/topics/MachineInfo';
import { usePrimerInfo } from './ros/topics/PrimerInfo';

function App() {
  const { t, i18n } = useTranslation();
  const { data: machineData } = useMachineInfo();
  const { data: primerData } = usePrimerInfo();
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
    <div className="app-container">
      {/* Global Sidebar - Persistent across tabs */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="main-content">
        {/* Top Navigation Bar */}
        <header className="app-header">
          <div className="header-content">
            <h1 className="header-title">
              ENAEX <span className="header-separator">|</span> WEB WIZARD
            </h1>

            <nav className="header-nav">
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
                    nav-tab
                    ${activeTab === tab.id ? 'nav-tab-active' : ''}
                  `}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <span className="nav-tab-indicator" />
                  )}
                </button>
              ))}
            </nav>

            <div className="header-controls">
              {/* Robot Mode Badge */}
              <div className={`robot-mode-badge
                    ${!isConnected
                  ? 'disconnected'
                  : machineData?.mode_op_autonomous
                    ? 'auto'
                    : machineData?.mode_op_manual
                      ? 'manual'
                      : 'unknown'}`}
              >
                {!isConnected
                  ? 'DISCONNECTED'
                  : machineData?.mode_op_autonomous
                    ? 'AUTO'
                    : machineData?.mode_op_manual
                      ? 'MANUAL'
                      : 'UNKNOWN'}
              </div>

              {/* Error Badges */}
              <div className="system-indicators-group">
                {/* Primador */}
                <div className={`system-badge
                        ${!isConnected
                    ? 'disconnected'
                    : (primerData?.primer_error_code?.code ?? 0) !== 0
                      ? 'error'
                      : 'ok'}`}
                  title={t('status.subsystemPrimador')}
                >
                  PRI
                  {isConnected && (primerData?.primer_error_code?.code ?? 0) !== 0 && (
                    <span className="system-error-popup">
                      E: {primerData?.primer_error_code?.code}
                    </span>
                  )}
                </div>
                {/* Pozometro */}
                <div className={`system-badge
                        ${!isConnected
                    ? 'disconnected'
                    : (primerData?.level_probe_error_code?.code ?? 0) !== 0
                      ? 'error'
                      : 'ok'}`}
                  title={t('status.subsystemPozometro')}
                >
                  POZ
                  {isConnected && (primerData?.level_probe_error_code?.code ?? 0) !== 0 && (
                    <span className="system-error-popup">
                      E: {primerData?.level_probe_error_code?.code}
                    </span>
                  )}
                </div>
                {/* Dieci */}
                <div className={`system-badge
                        ${!isConnected
                    ? 'disconnected'
                    : machineData?.estop_dieci
                      ? 'error'
                      : 'ok'}`}
                  title={t('status.subsystemDieci')}
                >
                  DIE
                  {isConnected && machineData?.estop_dieci && machineData?.emergency_stop_code?.code !== undefined && machineData?.emergency_stop_code?.code !== 0 && (
                    <span className="system-error-popup">
                      E: {machineData?.emergency_stop_code?.code}
                    </span>
                  )}
                </div>
              </div>

              {/* Language Selector */}
              <button
                onClick={toggleLanguage}
                className="btn-icon btn-lang"
                title="Switch Language"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                <span>{i18n.language.toUpperCase()}</span>
              </button>

              {/* Connection Settings Button */}
              <button
                onClick={() => setIsConnectionModalOpen(true)}
                className="btn-icon"
                title="Configure Connection"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.35a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              </button>

              <div className="status-container">
                <span className={`status-dot
                      ${isConnected ? 'status-dot-connected' :
                    isReconnecting ? 'status-dot-connecting' : 'status-dot-disconnected'}
                  `}></span>

                <div className="status-text-wrapper">
                  {isReconnecting && (
                    <svg className="status-spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="spinner-track" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="spinner-path" fill="currentColor" d="M4 12a8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  <span className={`status-label ${isConnected ? 'status-label-connected' : isReconnecting ? 'status-label-connecting' : 'status-label-disconnected'}`}>
                    {isConnected ? t('status.systemReady') : isReconnecting ? t('status.connecting') : t('status.disconnected')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Tab Content */}
        <div className="content-area">
          {activeTab === 'planner' && <Wizard />}
          {activeTab === 'supervisor' && <Supervisor isConnected={isConnected} />}
          {activeTab === 'autonomous' && <Autonomous isConnected={isConnected} />}
          {activeTab === 'status' && <Status isConnected={isConnected} />}
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

import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { UploadSection } from './components/UploadSection';
import { DataExplorer } from './components/DataExplorer';
import { CleaningView } from './components/CleaningView';
import { AnomalyEngine } from './components/AnomalyEngine';
import { RulesManager } from './components/RulesManager';
import { Visualizations } from './components/Visualizations';
import { Predictions } from './components/Predictions';
import { ExecutiveDashboard } from './components/ExecutiveDashboard';
import { AppStudio } from './components/studio/AppStudio';
import { DatasetMetadata } from './types';
import { api } from './services/api';

export function App() {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [metadata, setMetadata] = useState<DatasetMetadata | null>(null);

  // Automatically load initial manufacturing sample on start
  useEffect(() => {
    async function init() {
      try {
        const res = await api.loadSample('manufacturing');
        setMetadata(res);
      } catch (err) {
        console.error("Failed to load initial sample", err);
      }
    }
    init();
  }, []);

  const handleSwitchSheet = async (sheet: string) => {
    if (!metadata) return;
    try {
      const res = await api.switchSheet(metadata.dataset_id, sheet);
      setMetadata(res);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 overflow-hidden font-sans">
      {/* Navigation Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        datasetName={metadata?.filename}
        domain={metadata?.profile.domain}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-50">
        <header className="h-14 border-b border-blue-950/20 bg-slate-950 text-white px-8 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center space-x-3">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Workspace</span>
            <span className="text-slate-600">/</span>
            <span className="text-xs font-bold text-blue-300 capitalize">
              {currentTab.replace('_', ' ')}
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-xs text-slate-400">
              DataForge AI <strong className="text-blue-400 font-mono">v1.0.0</strong>
            </span>
          </div>
        </header>

        <div className="p-8 max-w-7xl w-full mx-auto space-y-6">
          {currentTab === 'studio' && (
            <AppStudio />
          )}

          {currentTab === 'upload' && (
            <UploadSection
              metadata={metadata}
              onDatasetLoaded={(meta) => {
                setMetadata(meta);
                setCurrentTab('dashboard');
              }}
              onSwitchSheet={handleSwitchSheet}
            />
          )}

          {metadata && (
            <>
              {currentTab === 'dashboard' && (
                <ExecutiveDashboard metadata={metadata} onNavigate={setCurrentTab} />
              )}
              {currentTab === 'preview' && (
                <DataExplorer
                  datasetId={metadata.dataset_id}
                  metadata={metadata}
                  onSwitchSheet={handleSwitchSheet}
                />
              )}
              {currentTab === 'clean' && (
                <CleaningView metadata={metadata} onUpdateMetadata={setMetadata} />
              )}
              {currentTab === 'anomalies' && (
                <AnomalyEngine metadata={metadata} />
              )}
              {currentTab === 'rules' && (
                <RulesManager metadata={metadata} />
              )}
              {currentTab === 'visuals' && (
                <Visualizations metadata={metadata} />
              )}
              {currentTab === 'predictions' && (
                <Predictions metadata={metadata} />
              )}
            </>
          )}

          {!metadata && currentTab !== 'upload' && currentTab !== 'studio' && (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 shadow-sm">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              Loading workspace dataset...
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;

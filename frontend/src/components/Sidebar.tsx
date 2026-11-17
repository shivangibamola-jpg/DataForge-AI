import React from 'react';
import { 
  LayoutDashboard, 
  UploadCloud, 
  Table, 
  SlidersHorizontal, 
  ShieldAlert, 
  ScrollText, 
  LineChart as LineChartIcon, 
  Lightbulb,
  FileSpreadsheet,
  Sparkles
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  datasetName?: string;
  domain?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, datasetName, domain }) => {
  const navItems = [
    { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
    { id: 'studio', label: 'AI App Generator', icon: Sparkles, badge: 'NEW' },
    { id: 'upload', label: 'Upload & Profile', icon: UploadCloud },
    { id: 'preview', label: 'Data Explorer', icon: Table },
    { id: 'clean', label: 'Clean & Transform', icon: SlidersHorizontal },
    { id: 'anomalies', label: 'ML Anomaly Engine', icon: ShieldAlert },
    { id: 'rules', label: 'Business Rules & Exceptions', icon: ScrollText },
    { id: 'visuals', label: 'Smart Visualizations', icon: LineChartIcon },
    { id: 'predictions', label: 'Predictions & Insights', icon: Lightbulb },
  ];

  return (
    <aside className="w-64 bg-slate-950 text-white border-r border-blue-900/60 flex flex-col justify-between shrink-0 shadow-2xl z-20">
      <div>
        {/* Brand header */}
        <div className="p-4 border-b border-blue-950/80 flex items-center space-x-3 bg-gradient-to-r from-slate-950 via-blue-950 to-slate-950">
          <div className="h-11 w-11 rounded-lg bg-white p-1 flex items-center justify-center shadow-lg shadow-blue-950/60 shrink-0 overflow-hidden border border-blue-400/40">
            <img src="/logo.jpg" alt="C&S Electric Logo" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-white tracking-wide truncate">DataForge AI</h1>
            <p className="text-[11px] text-blue-400 font-semibold truncate">C&amp;S Electric</p>
          </div>
        </div>

        {/* Active dataset card */}
        {datasetName && (
          <div className="mx-4 my-3 p-3 bg-blue-950/40 rounded-xl border border-blue-900/50 backdrop-blur-sm shadow-inner">
            <div className="flex items-center space-x-2 text-xs text-blue-300 mb-1">
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />
              <span>Active Dataset</span>
            </div>
            <div className="text-xs font-semibold text-white truncate">{datasetName}</div>
            {domain && (
              <span className="inline-block mt-1.5 text-[10px] font-medium bg-blue-900/60 text-blue-200 border border-blue-700/60 rounded-md px-2 py-0.5">
                {domain}
              </span>
            )}
          </div>
        )}

        {/* Navigation links */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-semibold border border-blue-400/30'
                    : 'text-slate-300 hover:text-white hover:bg-blue-950/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-blue-400'}`} />
                <span className="truncate">{item.label}</span>
                {item.badge && (
                  <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                    isActive 
                      ? 'bg-white/20 text-white' 
                      : 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Engine status footer */}
      <div className="p-4 border-t border-blue-950/80 bg-slate-950 text-xs text-slate-400">
        <div className="flex items-center justify-between">
          <span>Engine Status</span>
          <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50"></span>
            Ready
          </span>
        </div>
      </div>
    </aside>
  );
};

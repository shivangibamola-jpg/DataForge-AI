import React from 'react';
import { 
  ShieldAlert, 
  Layers, 
  Database, 
  CheckCircle, 
  ArrowUpRight
} from 'lucide-react';
import { DatasetMetadata } from '../types';

interface ExecutiveDashboardProps {
  metadata: DatasetMetadata;
  onNavigate: (tab: string) => void;
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({ metadata, onNavigate }) => {
  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-slate-950 via-blue-950 to-slate-950 border border-blue-900/60 rounded-xl p-6 relative overflow-hidden shadow-md text-white">
        <div className="relative z-10">
          <h2 className="text-xl font-bold text-white mb-1">
            Data Overview for {metadata.filename}
          </h2>
          <p className="text-xs text-blue-200">
            Active Dataset Profile: <strong className="text-white">{metadata.profile.domain}</strong>
          </p>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div 
          onClick={() => onNavigate('preview')} 
          className="bg-white hover:border-blue-700 border border-slate-200 rounded-xl p-5 cursor-pointer transition-all shadow-sm group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Dataset Records</span>
            <Database className="w-4 h-4 text-blue-800 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{metadata.profile.total_rows.toLocaleString()}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>{metadata.profile.total_cols} monitored fields</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-800 transition-colors" />
          </div>
        </div>

        <div 
          onClick={() => onNavigate('upload')} 
          className="bg-white hover:border-emerald-500 border border-slate-200 rounded-xl p-5 cursor-pointer transition-all shadow-sm group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Data Integrity Health</span>
            <CheckCircle className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">{metadata.profile.quality_scores.overall}%</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>{metadata.profile.total_missing_cells} missing data points</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
          </div>
        </div>

        <div 
          onClick={() => onNavigate('anomalies')} 
          className="bg-white hover:border-amber-500 border border-slate-200 rounded-xl p-5 cursor-pointer transition-all shadow-sm group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Anomaly Detection</span>
            <ShieldAlert className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-amber-600">Adaptive ML</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Isolation Forest + IQR</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-500 transition-colors" />
          </div>
        </div>

        <div 
          onClick={() => onNavigate('rules')} 
          className="bg-white hover:border-blue-900 border border-slate-200 rounded-xl p-5 cursor-pointer transition-all shadow-sm group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Business Rules Engine</span>
            <Layers className="w-4 h-4 text-blue-900 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-blue-900">Exceptions Active</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Audit trail maintained</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-900 transition-colors" />
          </div>
        </div>
      </div>

      {/* Fast Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800 mb-1">Explore Visualizations</h3>
            <p className="text-xs text-slate-500 mb-4">
              Review automatically synthesized time-series charts, category benchmarks, and dispersion scatter graphs.
            </p>
          </div>
          <button
            onClick={() => onNavigate('visuals')}
            className="w-full py-2.5 px-4 rounded-lg bg-blue-950 hover:bg-blue-900 text-white text-xs font-bold transition-all text-center shadow-xs"
          >
            Open Interactive Visualizations →
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800 mb-1">Predictive Trajectory</h3>
            <p className="text-xs text-slate-500 mb-4">
              Inspect statistical trend regressions and grounded natural language operational insights.
            </p>
          </div>
          <button
            onClick={() => onNavigate('predictions')}
            className="w-full py-2.5 px-4 rounded-lg bg-blue-950 hover:bg-blue-900 text-white text-xs font-bold transition-all text-center shadow-xs"
          >
            View Predictions & Insights →
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  UploadCloud, 
  Layers, 
  Plus, 
  Trash2, 
  ArrowRight, 
  ExternalLink, 
  FileSpreadsheet, 
  CheckCircle2, 
  RefreshCw, 
  Database,
  Users,
  Truck,
  Cpu,
  Package,
  Boxes,
  HelpCircle
} from 'lucide-react';
import { StudioAppSummary, StudioTemplate, StudioAnalysisReport, StudioBlueprint } from '../../types';
import { api } from '../../services/api';
import { SummaryReportView } from './SummaryReportView';
import { GeneratedAppRunner } from './GeneratedAppRunner';

export const AppStudio: React.FC = () => {
  // Mode: 'directory' | 'upload_analysis' | 'runner'
  const [mode, setMode] = useState<'directory' | 'upload_analysis' | 'runner'>('directory');
  
  // Data states
  const [apps, setApps] = useState<StudioAppSummary[]>([]);
  const [templates, setTemplates] = useState<StudioTemplate[]>([]);
  const [activeAppId, setActiveAppId] = useState<string | null>(null);

  // Analysis / Generation states
  const [analysisReport, setAnalysisReport] = useState<StudioAnalysisReport | null>(null);
  const [cacheId, setCacheId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Load existing applications and templates on mount
  const loadStudioData = async () => {
    try {
      const [appsList, tplList] = await Promise.all([
        api.studio.listApps(),
        api.studio.getTemplates()
      ]);
      setApps(appsList);
      setTemplates(tplList);
    } catch (err) {
      console.error('Failed to load studio apps', err);
    }
  };

  useEffect(() => {
    loadStudioData();
  }, []);

  // Drag-and-drop state
  const [isDragging, setIsDragging] = useState(false);

  // Upload handler
  const handleFileUpload = async (file: File) => {
    try {
      setIsAnalyzing(true);
      setUploadError(null);
      const res = await api.studio.analyzeWorkbook(file);
      setCacheId(res.cache_id);
      setAnalysisReport(res.report);
      setMode('upload_analysis');
    } catch (err: any) {
      setUploadError(err.message || 'Failed to analyze workbook');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  // Sample dataset analysis handler
  const handleAnalyzeSample = async (sampleName: string) => {
    try {
      setIsAnalyzing(true);
      setUploadError(null);
      const res = await api.studio.analyzeSample(sampleName);
      setCacheId(res.cache_id);
      setAnalysisReport(res.report);
      setMode('upload_analysis');
    } catch (err: any) {
      setUploadError(err.message || 'Failed to analyze sample dataset');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 1-Click Template Instantiate
  const handleInstantiateTemplate = async (templateId: string) => {
    try {
      setIsGenerating(true);
      const res = await api.studio.instantiateTemplate(templateId);
      await loadStudioData();
      setActiveAppId(res.app.app_id);
      setMode('runner');
    } catch (err: any) {
      alert(`Failed to launch template: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate App from Blueprint
  const handleGenerateApp = async (customizedBlueprint: StudioBlueprint, appName: string, description: string) => {
    if (!cacheId) return;
    try {
      setIsGenerating(true);
      const res = await api.studio.generateApp({
        cache_id: cacheId,
        app_name: appName,
        description: description,
        blueprint: customizedBlueprint
      });
      await loadStudioData();
      setActiveAppId(res.app.app_id);
      setMode('runner');
    } catch (err: any) {
      alert(`App Generation failed: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Delete Application
  const handleDeleteApp = async (appId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this application and drop all its database records?')) {
      try {
        await api.studio.deleteApp(appId);
        await loadStudioData();
        if (activeAppId === appId) {
          setActiveAppId(null);
          setMode('directory');
        }
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const getTemplateIcon = (iconName: string) => {
    switch (iconName) {
      case 'Users': return <Users className="w-5 h-5 text-blue-500" />;
      case 'Truck': return <Truck className="w-5 h-5 text-indigo-500" />;
      case 'Cpu': return <Cpu className="w-5 h-5 text-amber-500" />;
      case 'Package': return <Package className="w-5 h-5 text-emerald-500" />;
      default: return <Boxes className="w-5 h-5 text-blue-500" />;
    }
  };

  // Render Mode 3: Active Application Runner
  if (mode === 'runner' && activeAppId) {
    return (
      <GeneratedAppRunner
        appId={activeAppId}
        onExit={() => {
          setActiveAppId(null);
          setMode('directory');
          loadStudioData();
        }}
      />
    );
  }

  // Render Mode 2: Workbook Analysis & Pre-Generation Summary Report
  if (mode === 'upload_analysis' && analysisReport) {
    return (
      <SummaryReportView
        report={analysisReport}
        onGenerate={handleGenerateApp}
        onCancel={() => {
          setAnalysisReport(null);
          setCacheId(null);
          setMode('directory');
        }}
        isGenerating={isGenerating}
      />
    );
  }

  // Render Mode 1: Directory Hub
  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Studio Header Hero */}
      <div 
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`bg-gradient-to-r from-slate-950 via-blue-950 to-slate-950 border ${isDragging ? 'border-blue-400 ring-4 ring-blue-500/20' : 'border-blue-900/60'} rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden transition-all`}
      >
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Universal Data-to-App Studio</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              AI-Powered Excel-to-Application Generator
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Convert any Excel workbook (.xlsx, .xls) or CSV into a full, customizable, database-driven business tool with its own persistent SQLite database, data-entry forms, search, CRUD, and analytics. Drag & drop a file here or use the upload button.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            <label className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-600/40 flex items-center justify-center space-x-2 cursor-pointer transition">
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Analyzing Workbook...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload Excel Workbook</span>
                </>
              )}
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                disabled={isAnalyzing}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    handleFileUpload(f);
                    e.target.value = '';
                  }
                }}
              />
            </label>
            <button
              onClick={() => handleAnalyzeSample('logistics')}
              disabled={isAnalyzing}
              className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-300 text-sm font-semibold flex items-center justify-center space-x-2 transition"
            >
              <FileSpreadsheet className="w-4 h-4 text-blue-400" />
              <span>Load Sample Multi-Sheet</span>
            </button>
          </div>
        </div>

        {isDragging && (
          <div className="mt-4 p-4 rounded-xl border-2 border-dashed border-blue-400 bg-blue-900/40 text-blue-200 text-center text-sm font-semibold animate-pulse">
            Drop your Excel or CSV file here to begin AI analysis...
          </div>
        )}

        {uploadError && (
          <div className="mt-4 p-3 rounded-xl bg-red-950/60 border border-red-800/60 text-red-300 text-xs flex items-center space-x-2">
            <span>{uploadError}</span>
          </div>
        )}
      </div>

      {/* Section 1: User's Generated Applications */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Database className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">My Database Applications</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold font-mono">
              {apps.length}
            </span>
          </div>
          <span className="text-xs text-slate-500">
            Backed by live persistent SQLite engine
          </span>
        </div>

        {apps.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center text-slate-500">
            <Layers className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">No applications created yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Upload an Excel workbook above or pick one of the instant starter templates below to generate your first application.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {apps.map((app) => (
              <div
                key={app.id}
                onClick={() => {
                  setActiveAppId(app.id);
                  setMode('runner');
                }}
                className="bg-white border border-slate-200 hover:border-blue-500 rounded-2xl p-5 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {app.domain}
                      </span>
                      <button
                        onClick={(e) => handleDeleteApp(app.id, e)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                        title="Delete application"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition">
                      {app.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {app.description}
                    </p>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="space-x-3 text-slate-500">
                    <span><strong className="text-slate-800 font-semibold">{app.total_records.toLocaleString()}</strong> records</span>
                    <span>&bull;</span>
                    <span><strong className="text-slate-800 font-semibold">{app.entities_count}</strong> {app.entities_count === 1 ? 'entity' : 'entities'}</span>
                  </div>
                  <span className="text-blue-600 font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition">
                    Launch &rarr;
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Quick Start Business Templates */}
      <div className="space-y-4 pt-4 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">Instant Ready-to-Launch Templates</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              1-Click generate full persistent business applications with realistic datasets across major domains.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-indigo-400 transition"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                    {getTemplateIcon(tpl.icon)}
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {tpl.sample_records_count} rows
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900">{tpl.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {tpl.description}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1 pt-1">
                  {tpl.features.slice(0, 3).map((f) => (
                    <span key={f} className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600">
                      {f}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100">
                <button
                  onClick={() => handleInstantiateTemplate(tpl.id)}
                  disabled={isGenerating}
                  className="w-full py-2 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white text-xs font-semibold rounded-lg transition flex items-center justify-center space-x-1.5 disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Launch Template</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

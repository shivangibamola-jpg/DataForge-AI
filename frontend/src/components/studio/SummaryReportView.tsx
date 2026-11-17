import React, { useState } from 'react';
import { 
  Sparkles, 
  Layers, 
  Table, 
  Key, 
  Link2, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  FileSpreadsheet, 
  ChevronDown, 
  ChevronUp, 
  Sliders, 
  Calculator,
  RefreshCw
} from 'lucide-react';
import { StudioAnalysisReport, StudioBlueprint } from '../../types';

interface SummaryReportViewProps {
  report: StudioAnalysisReport;
  onGenerate: (customizedBlueprint: StudioBlueprint, appName: string, description: string) => void;
  onCancel: () => void;
  isGenerating: boolean;
}

export const SummaryReportView: React.FC<SummaryReportViewProps> = ({
  report,
  onGenerate,
  onCancel,
  isGenerating
}) => {
  const [appName, setAppName] = useState(report.blueprint.app_name);
  const [description, setDescription] = useState(report.blueprint.description);
  const [activeSheetTab, setActiveSheetTab] = useState<string>(Object.keys(report.sheets)[0]);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [blueprint, setBlueprint] = useState<StudioBlueprint>(report.blueprint);

  const activeSheet = report.sheets[activeSheetTab];

  const handleFieldTypeChange = (sheetName: string, fieldName: string, newType: any) => {
    setBlueprint(prev => {
      const updatedEntities = prev.entities.map(ent => {
        if (ent.source_sheet === sheetName) {
          return {
            ...ent,
            fields: ent.fields.map(f => f.name === fieldName ? { ...f, type: newType } : f)
          };
        }
        return ent;
      });
      return { ...prev, entities: updatedEntities };
    });
  };

  const handleFieldRequiredToggle = (sheetName: string, fieldName: string) => {
    setBlueprint(prev => {
      const updatedEntities = prev.entities.map(ent => {
        if (ent.source_sheet === sheetName) {
          return {
            ...ent,
            fields: ent.fields.map(f => f.name === fieldName ? { ...f, required: !f.required } : f)
          };
        }
        return ent;
      });
      return { ...prev, entities: updatedEntities };
    });
  };

  const handleEntityDisplayNameChange = (sheetName: string, newName: string) => {
    setBlueprint(prev => {
      const updatedEntities = prev.entities.map(ent => {
        if (ent.source_sheet === sheetName) {
          return { ...ent, display_name: newName, entity_name: newName };
        }
        return ent;
      });
      return { ...prev, entities: updatedEntities };
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Domain and Quick Actions */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-blue-800/40 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                AI Workbook Analysis Complete
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                {report.domain}
              </span>
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-white">
              {report.filename}
            </h2>
            <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
              {report.purpose}
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={onCancel}
              disabled={isGenerating}
              className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
            >
              Upload Different File
            </button>
            <button
              onClick={() => onGenerate(blueprint, appName, description)}
              disabled={isGenerating}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold shadow-lg shadow-blue-600/30 flex items-center space-x-2 transition disabled:opacity-60"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generating Application...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Application Now</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* High-Level Dataset Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-6 pt-6 border-t border-blue-900/40">
          <div className="bg-slate-950/40 rounded-xl p-3 border border-blue-900/30">
            <span className="text-xs text-slate-400 font-medium">Worksheets</span>
            <div className="text-xl font-bold text-white mt-1">{report.worksheets_count}</div>
          </div>
          <div className="bg-slate-950/40 rounded-xl p-3 border border-blue-900/30">
            <span className="text-xs text-slate-400 font-medium">Total Records</span>
            <div className="text-xl font-bold text-white mt-1">{report.total_records.toLocaleString()}</div>
          </div>
          <div className="bg-slate-950/40 rounded-xl p-3 border border-blue-900/30">
            <span className="text-xs text-slate-400 font-medium">Total Fields</span>
            <div className="text-xl font-bold text-white mt-1">{report.total_columns}</div>
          </div>
          <div className="bg-slate-950/40 rounded-xl p-3 border border-blue-900/30">
            <span className="text-xs text-slate-400 font-medium">Relationships</span>
            <div className="text-xl font-bold text-blue-400 mt-1">{report.relationships.length} detected</div>
          </div>
          <div className="bg-slate-950/40 rounded-xl p-3 border border-blue-900/30">
            <span className="text-xs text-slate-400 font-medium">Data Quality</span>
            <div className="text-xl font-bold text-emerald-400 mt-1">{report.data_quality_score}%</div>
          </div>
        </div>
      </div>

      {/* Relationships Banner if detected */}
      {report.relationships.length > 0 && (
        <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-xl p-4">
          <div className="flex items-center space-x-2 text-indigo-300 font-semibold text-sm mb-2">
            <Link2 className="w-4 h-4 text-indigo-400" />
            <span>Detected Cross-Worksheet Relationships</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {report.relationships.map((rel, idx) => (
              <div key={idx} className="bg-slate-900/80 rounded-lg p-2.5 text-xs text-slate-300 border border-indigo-900/30 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-white">{rel.from_sheet}</span>
                  <span className="text-slate-500 mx-1.5">.{rel.from_field}</span>
                  <span className="text-indigo-400 font-bold mx-1">&rarr;</span>
                  <span className="font-semibold text-white">{rel.to_sheet}</span>
                  <span className="text-slate-500 mx-1.5">.{rel.to_field}</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-900/50 text-indigo-200">
                  Many-to-One
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* App Blueprint Customization Accordion */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <button
          onClick={() => setShowCustomizer(!showCustomizer)}
          className="w-full px-6 py-4 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition text-left"
        >
          <div className="flex items-center space-x-3">
            <Sliders className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-800">Customize Application Blueprint</h3>
              <p className="text-xs text-slate-500">Edit app name, target entity titles, field types, and required constraints prior to generation.</p>
            </div>
          </div>
          {showCustomizer ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </button>

        {showCustomizer && (
          <div className="p-6 border-t border-slate-200 bg-white space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Application Name</label>
                <input
                  type="text"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Business Purpose Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Worksheets Breakdown & Field Schema Inspector */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {/* Worksheet Tabs */}
        <div className="border-b border-slate-200 bg-slate-50 px-6 pt-3 flex items-center space-x-2 overflow-x-auto">
          {Object.keys(report.sheets).map((sName) => {
            const sm = report.sheets[sName];
            const isActive = activeSheetTab === sName;
            return (
              <button
                key={sName}
                onClick={() => setActiveSheetTab(sName)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-t-lg text-sm font-semibold transition border-b-2 ${
                  isActive
                    ? 'bg-white border-blue-600 text-blue-600 shadow-sm'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{sName}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-mono">
                  {sm.total_rows}
                </span>
              </button>
            );
          })}
        </div>

        {activeSheet && (
          <div className="p-6 space-y-6">
            {/* Sheet Summary Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 rounded-xl p-4 border border-slate-200">
              <div>
                <span className="text-xs text-slate-500 font-medium">Inferred Entity Name</span>
                <div className="flex items-center space-x-2 mt-1">
                  <input
                    type="text"
                    value={blueprint.entities.find(e => e.source_sheet === activeSheetTab)?.display_name || activeSheet.entity_name}
                    onChange={(e) => handleEntityDisplayNameChange(activeSheetTab, e.target.value)}
                    className="text-sm font-bold text-slate-800 bg-white border border-slate-300 rounded px-2 py-0.5"
                  />
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-500 font-medium">Primary Key</span>
                <div className="flex items-center space-x-1.5 text-sm font-bold text-slate-800 mt-1">
                  <Key className="w-4 h-4 text-amber-500" />
                  <span>{activeSheet.primary_key}</span>
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-500 font-medium">Records & Columns</span>
                <div className="text-sm font-bold text-slate-800 mt-1">
                  {activeSheet.total_rows.toLocaleString()} rows &bull; {activeSheet.total_cols} cols
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-500 font-medium">Missing Cells & Duplicates</span>
                <div className="text-sm font-bold text-slate-800 mt-1">
                  {activeSheet.missing_cells} missing &bull; {activeSheet.duplicate_rows} dupes
                </div>
              </div>
            </div>

            {/* Numerical Aggregations if any */}
            {activeSheet.numerical_summaries && Object.keys(activeSheet.numerical_summaries).length > 0 && (
              <div>
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  <Calculator className="w-4 h-4 text-blue-600" />
                  <span>Important Numerical Aggregations</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(activeSheet.numerical_summaries).slice(0, 4).map(([col, stats]: [string, any]) => (
                    <div key={col} className="bg-blue-50/50 border border-blue-100 rounded-lg p-3">
                      <div className="text-xs font-semibold text-slate-700 truncate">{col}</div>
                      <div className="text-base font-bold text-blue-700 mt-1">
                        {stats.sum ? stats.sum.toLocaleString() : 'N/A'} <span className="text-[10px] text-slate-500 font-normal">sum</span>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        Avg: {stats.mean ? stats.mean.toLocaleString() : 'N/A'} &bull; Min: {stats.min} &bull; Max: {stats.max}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Schema & Data Types Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Field Schema & Inferred Data Types ({activeSheet.fields.length})
                </span>
                <span className="text-xs text-slate-500">
                  You can change inferred types before building
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Field Name</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Inferred Type</th>
                      <th className="py-2.5 px-3">Required</th>
                      <th className="py-2.5 px-3">Unique / Missing</th>
                      <th className="py-2.5 px-3">Sample Values</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeSheet.fields.map((f) => {
                      const isPk = f.name === activeSheet.primary_key || f.is_primary_key;
                      const hasFk = !!f.foreign_key;
                      return (
                        <tr key={f.name} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            <div className="flex items-center space-x-1.5">
                              {isPk && <Key className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                              {hasFk && <Link2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />}
                              <span>{f.name}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            {isPk ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                Primary Key
                              </span>
                            ) : hasFk ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300" title={f.foreign_key?.target_entity}>
                                Ref &rarr; {f.foreign_key?.target_sheet}
                              </span>
                            ) : (
                              <span className="text-slate-500">Data Field</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <select
                              value={blueprint.entities.find(e => e.source_sheet === activeSheetTab)?.fields.find(fi => fi.name === f.name)?.type || f.type}
                              onChange={(e) => handleFieldTypeChange(activeSheetTab, f.name, e.target.value)}
                              className="px-2 py-1 rounded bg-white border border-slate-300 text-xs font-medium text-slate-800 focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="text">Text</option>
                              <option value="textarea">Long Text (Textarea)</option>
                              <option value="integer">Integer</option>
                              <option value="number">Number (Float)</option>
                              <option value="currency">Currency ($)</option>
                              <option value="percentage">Percentage (%)</option>
                              <option value="date">Date</option>
                              <option value="category">Category (Dropdown)</option>
                              <option value="email">Email</option>
                              <option value="phone">Phone</option>
                              <option value="boolean">Boolean</option>
                              <option value="id">Identifier</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="checkbox"
                              checked={blueprint.entities.find(e => e.source_sheet === activeSheetTab)?.fields.find(fi => fi.name === f.name)?.required ?? f.required}
                              onChange={() => handleFieldRequiredToggle(activeSheetTab, f.name)}
                              className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">
                            {f.unique_count ?? 'N/A'} unique &bull; {f.missing_count ?? 0} null
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px] truncate max-w-xs">
                            {f.sample_values && f.sample_values.length > 0
                              ? f.sample_values.slice(0, 3).map(v => String(v)).join(', ')
                              : 'None'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="flex items-center space-x-3 text-sm text-slate-600">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>Application blueprint is verified and ready to be compiled into a database-backed tool.</span>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={onCancel}
            disabled={isGenerating}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={() => onGenerate(blueprint, appName, description)}
            disabled={isGenerating}
            className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md flex items-center space-x-2 transition disabled:opacity-60"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Building App Database...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate &amp; Launch Application</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useRef, useState } from 'react';
import { Upload, FileType, CheckCircle2, AlertTriangle, Layers, ArrowRight } from 'lucide-react';
import { DatasetMetadata } from '../types';
import { api } from '../services/api';

interface UploadSectionProps {
  metadata: DatasetMetadata | null;
  onDatasetLoaded: (data: DatasetMetadata) => void;
  onSwitchSheet: (sheet: string) => void;
}

export const UploadSection: React.FC<UploadSectionProps> = ({ metadata, onDatasetLoaded, onSwitchSheet }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const processFile = async (file: File) => {
    const validExtensions = ['.csv', '.xlsx', '.xls', '.xlsm'];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValid) {
      setError(`Unsupported file format "${file.name}". Please upload a CSV (.csv) or Excel (.xlsx, .xls, .xlsm) file.`);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await api.uploadFile(file);
      onDatasetLoaded(data);
    } catch (err: any) {
      setError(err.message || 'Error uploading file');
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const loadSample = async (sampleName: 'manufacturing' | 'logistics') => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.loadSample(sampleName);
      onDatasetLoaded(data);
    } catch (err: any) {
      setError(err.message || 'Error loading sample dataset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Zone & Quick Samples */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-1">Upload Business Dataset</h2>
          <p className="text-sm text-slate-500 mb-5">
            Accepts CSV and multi-worksheet Excel (.xlsx, .xls, .xlsm) files. Your original data is preserved unchanged.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            onChange={handleFileUpload}
            className="hidden"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all group ${
              isDragging
                ? 'border-blue-600 bg-blue-100/60 ring-2 ring-blue-400'
                : 'border-blue-200 hover:border-blue-600 bg-blue-50/30 hover:bg-blue-50/70'
            }`}
          >
            <div className="h-12 w-12 rounded-full bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center mx-auto mb-3 transition-colors">
              <Upload className="w-6 h-6 text-blue-600 group-hover:text-blue-700 transition-colors" />
            </div>
            <p className="text-sm font-semibold text-slate-800 mb-1">
              Click to select or drag and drop a file
            </p>
            <p className="text-xs text-slate-500">
              CSV, Excel (.xlsx, .xls, .xlsm) with multiple sheets supported
            </p>
          </div>

          {loading && (
            <div className="mt-4 flex items-center justify-center space-x-2 text-blue-600 text-sm py-2">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span>Ingesting and automatically profiling dataset...</span>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Quick Sample Selector */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800 mb-1">Quick Sample Datasets</h2>
            <p className="text-sm text-slate-500 mb-4">
              Explore immediate realistic business data with pre-configured patterns.
            </p>

            <div className="space-y-3">
              <button
                disabled={loading}
                onClick={() => loadSample('manufacturing')}
                className="w-full text-left p-3 rounded-xl border border-slate-200 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50 transition-all flex items-center justify-between group shadow-2xs"
              >
                <div>
                  <div className="text-sm font-bold text-slate-800 group-hover:text-blue-700">
                    Manufacturing Operations
                  </div>
                  <div className="text-xs text-slate-500">500 rows • Cycle times, defect rates, shifts</div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
              </button>

              <button
                disabled={loading}
                onClick={() => loadSample('logistics')}
                className="w-full text-left p-3 rounded-xl border border-slate-200 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50 transition-all flex items-center justify-between group shadow-2xs"
              >
                <div>
                  <div className="text-sm font-bold text-slate-800 group-hover:text-blue-700">
                    Supply Chain (Multi-Sheet Excel)
                  </div>
                  <div className="text-xs text-slate-500">400 shipments • Suppliers, facilities, SLAs</div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-500 mt-4 border-t border-slate-100 pt-3">
            Includes both statistical outliers and deliberate business-rule boundary conditions.
          </div>
        </div>
      </div>

      {/* Dataset Profiling Overview */}
      {metadata && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <FileType className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-slate-800">{metadata.filename}</h3>
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                  {metadata.profile.domain}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {metadata.profile.total_rows} records &nbsp;•&nbsp; {metadata.profile.total_cols} columns &nbsp;•&nbsp; 
                {metadata.profile.duplicate_rows} duplicate rows &nbsp;•&nbsp; {metadata.profile.total_missing_cells} missing values
              </p>
            </div>

            {/* Multi-Worksheet Selector */}
            {metadata.sheets.length > 1 && (
              <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                <Layers className="w-4 h-4 text-blue-600" />
                <span className="text-xs text-slate-600 font-medium">Sheet:</span>
                <select
                  value={metadata.active_sheet}
                  onChange={(e) => onSwitchSheet(e.target.value)}
                  className="bg-transparent text-sm font-bold text-blue-700 focus:outline-none cursor-pointer"
                >
                  {metadata.sheets.map((sheet) => (
                    <option key={sheet} value={sheet}>
                      {sheet}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Quality Indicators Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-2xs">
              <div className="text-xs font-semibold text-slate-500 mb-1">Overall Data Quality</div>
              <div className="text-2xl font-bold text-emerald-600">
                {metadata.profile.quality_scores.overall}%
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Weighted metric & completeness health</div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-2xs">
              <div className="text-xs font-semibold text-slate-500 mb-1">Field Completeness</div>
              <div className="text-2xl font-bold text-blue-600">
                {metadata.profile.quality_scores.completeness}%
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {metadata.profile.total_missing_cells === 0 ? 'Zero missing cells detected' : `${metadata.profile.total_missing_cells} missing values`}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-2xs">
              <div className="text-xs font-semibold text-slate-500 mb-1">Record Uniqueness</div>
              <div className="text-2xl font-bold text-indigo-600">
                {metadata.profile.quality_scores.uniqueness}%
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {metadata.profile.duplicate_rows === 0 ? 'No redundant duplicates' : `${metadata.profile.duplicate_rows} duplicate rows`}
              </div>
            </div>
          </div>

          {/* Column Profile Table */}
          <div>
            <h4 className="text-sm font-bold text-slate-800 mb-3">Automatic Column Interpretation & Profiling</h4>
            <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="py-3 px-4 font-bold">Column Name</th>
                    <th className="py-3 px-4 font-bold">Semantic Classification</th>
                    <th className="py-3 px-4 font-bold">Missing Audit</th>
                    <th className="py-3 px-4 font-bold">Cardinality</th>
                    <th className="py-3 px-4 font-bold">Statistical Summary / Distribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white font-mono text-[11px]">
                  {metadata.profile.columns.map((col) => (
                    <tr key={col.name} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-2.5 px-4 font-bold text-slate-800">{col.name}</td>
                      <td className="py-2.5 px-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          col.semantic_type === 'id' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                          col.semantic_type === 'date' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          col.semantic_type === 'numeric' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          col.semantic_type === 'currency' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          col.semantic_type === 'percentage' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                          'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {col.semantic_type.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        {col.missing_count === 0 ? (
                          <span className="text-emerald-600 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> 100% Valid
                          </span>
                        ) : (
                          <span className="text-amber-600 font-semibold">
                            {col.missing_count} missing ({col.missing_pct}%)
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {col.unique_count} unique ({Math.round((col.unique_count / metadata.profile.total_rows) * 100)}%)
                      </td>
                      <td className="py-2.5 px-4 text-slate-700">
                        {col.stats ? (
                          <span className="font-mono text-[11px] text-slate-600">
                            Mean: <strong className="text-slate-800">{col.stats.mean}</strong> | 
                            Med: <strong className="text-slate-800">{col.stats.median}</strong> | 
                            Range: [{col.stats.min} → {col.stats.max}]
                          </span>
                        ) : col.top_categories ? (
                          <span className="text-slate-600 text-[11px] font-sans">
                            {Object.entries(col.top_categories).slice(0, 3).map(([k, v]) => `${k} (${v})`).join(', ')}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic font-sans">Textual sequence</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

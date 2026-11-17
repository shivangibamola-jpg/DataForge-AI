import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldAlert, 
  Cpu, 
  Filter, 
  Search, 
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle, 
  BarChart3, 
  Activity, 
  Info, 
  X,
  FileSpreadsheet,
  Download
} from 'lucide-react';
import { api } from '../services/api';
import { DatasetMetadata, AnomalyItem } from '../types';

interface AnomalyEngineProps {
  metadata: DatasetMetadata;
}

export const AnomalyEngine: React.FC<AnomalyEngineProps> = ({ metadata }) => {
  // Extract columns
  const numericColumns = metadata.profile.columns.filter(c => 
    c.semantic_type === 'numeric' || c.semantic_type === 'currency' || c.semantic_type === 'percentage'
  );
  const categoryColumns = metadata.profile.columns.filter(c => c.semantic_type === 'category');

  // Multi-worksheet options
  const sheets = metadata.sheets || ['Default'];

  // Query & Scope Filters
  const [selectedSheet, setSelectedSheet] = useState<string>('all');
  const [selectedMetric, setSelectedMetric] = useState<string>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  
  // Interactive Filters
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterNature, setFilterNature] = useState<string>('all');
  const [filterColumn, setFilterColumn] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Engine state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Active expanded item for investigation drawer
  const [activeItem, setActiveItem] = useState<AnomalyItem | null>(null);

  useEffect(() => {
    runAnalysis();
  }, [metadata.dataset_id, selectedSheet, selectedMetric, selectedGroup]);

  const runAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getAnomalies(metadata.dataset_id, {
        metric: selectedMetric,
        sheet: selectedSheet,
        groupBy: selectedGroup
      });
      setResult(res);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to execute anomaly analysis');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = (index: number, newStatus: any) => {
    if (!result) return;
    const updated = { ...result };
    updated.anomalies[index].review_status = newStatus;
    setResult(updated);
  };

  // Unique anomaly types & columns present in the results
  const availableAnomalyTypes = useMemo<string[]>(() => {
    if (!result?.anomalies) return [];
    return Array.from(new Set<string>(result.anomalies.map((a: AnomalyItem) => a.anomaly_type))).filter(Boolean);
  }, [result]);

  const availableNatures = useMemo<string[]>(() => {
    if (!result?.anomalies) return [];
    return Array.from(new Set<string>(result.anomalies.map((a: AnomalyItem) => a.nature))).filter(Boolean);
  }, [result]);

  const availableColumns = useMemo<string[]>(() => {
    if (!result?.anomalies) return [];
    return Array.from(new Set<string>(result.anomalies.map((a: AnomalyItem) => a.column))).filter(Boolean);
  }, [result]);

  // Client-side filtering & search
  const filteredAnomalies = useMemo(() => {
    if (!result?.anomalies) return [];
    return result.anomalies.filter((a: AnomalyItem) => {
      // Severity
      if (filterSeverity !== 'all' && a.severity.toLowerCase() !== filterSeverity.toLowerCase()) {
        return false;
      }
      // Anomaly Type
      if (filterType !== 'all' && a.anomaly_type !== filterType) {
        return false;
      }
      // Nature (Data Quality vs Business Event)
      if (filterNature !== 'all' && a.nature !== filterNature) {
        return false;
      }
      // Column
      if (filterColumn !== 'all' && a.column !== filterColumn) {
        return false;
      }
      // Universal search query (employee, product, vendor, record ID, reason)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesRecord = a.record_id.toLowerCase().includes(q);
        const matchesCol = a.column.toLowerCase().includes(q);
        const matchesReason = a.reason.toLowerCase().includes(q);
        const matchesType = a.anomaly_type.toLowerCase().includes(q);
        const matchesContext = a.entity_context ? a.entity_context.toLowerCase().includes(q) : false;
        if (!matchesRecord && !matchesCol && !matchesReason && !matchesType && !matchesContext) {
          return false;
        }
      }
      return true;
    });
  }, [result, filterSeverity, filterType, filterNature, filterColumn, searchQuery]);

  const handleExportCSV = () => {
    if (!filteredAnomalies.length) return;
    const headers = ["Sheet", "Record_ID", "Column", "Observed_Value", "Expected_Baseline", "Deviation_Pct", "Anomaly_Score", "Severity", "Nature", "Anomaly_Type", "Reason", "Suggested_Action", "Review_Status"];
    const rows = filteredAnomalies.map((a: AnomalyItem) => [
      a.sheet || 'Default',
      `"${a.record_id}"`,
      `"${a.column}"`,
      a.observed_value ?? 'NULL',
      a.expected_baseline,
      `${a.deviation_pct}%`,
      a.anomaly_score,
      a.severity,
      `"${a.nature}"`,
      `"${a.anomaly_type}"`,
      `"${a.reason.replace(/"/g, '""')}"`,
      `"${a.suggested_action.replace(/"/g, '""')}"`,
      a.review_status
    ].join(','));
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `dataforge_anomalies_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Configuration Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Cpu className="w-5 h-5 text-blue-600" />
              <h3 className="text-base font-bold text-slate-800">Adaptive ML Anomaly Engine</h3>
              {result?.ml_engine_active && (
                <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200">
                  Isolation Forest + IQR Active
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Autonomous multi-feature detection of unusual values, sudden shifts, abnormal delivery delays, and inventory discrepancies.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Sheet Selector */}
            {sheets.length > 1 && (
              <div className="flex items-center space-x-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-slate-600 font-medium">Sheet:</span>
                <select
                  value={selectedSheet}
                  onChange={(e) => setSelectedSheet(e.target.value)}
                  className="bg-transparent text-blue-700 font-bold focus:outline-none cursor-pointer"
                >
                  <option value="all">All Sheets ({sheets.length})</option>
                  {sheets.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Target Metric or All Metrics */}
            <div className="flex items-center space-x-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
              <span className="text-slate-600 font-medium">Metric:</span>
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
                className="bg-transparent text-blue-700 font-bold focus:outline-none cursor-pointer"
              >
                <option value="all">All Numerical Metrics ({numericColumns.length})</option>
                {numericColumns.map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Baseline Grouping */}
            {categoryColumns.length > 0 && (
              <div className="flex items-center space-x-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
                <span className="text-slate-600 font-medium">Group By:</span>
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="bg-transparent text-indigo-700 font-bold focus:outline-none cursor-pointer"
                >
                  <option value="">Global Baseline</option>
                  {categoryColumns.map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Loading, Error, and Insufficient Data States */}
      {loading && (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 shadow-sm">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          Running multi-feature Isolation Forest ensemble & robust statistical anomaly detection...
        </div>
      )}

      {error && !loading && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-rose-800 flex items-center space-x-3 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <div className="text-xs">
            <strong>Analysis Error:</strong> {error}
          </div>
        </div>
      )}

      {result?.status === 'insufficient_data' && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center text-amber-800 shadow-sm space-y-2">
          <Info className="w-6 h-6 text-amber-600 mx-auto" />
          <h4 className="text-sm font-bold">Insufficient Data for Reliable Anomaly Detection</h4>
          <p className="text-xs text-amber-700 max-w-lg mx-auto">
            {result.message || "The dataset contains too few records to build statistical baselines or train machine learning models without fabricating false positives."}
          </p>
        </div>
      )}

      {result && result.status !== 'insufficient_data' && !loading && (
        <>
          {/* 3. Executive KPI & Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold">Total Flagged Irregularities</span>
                <ShieldAlert className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{result.summary?.total_anomalies ?? result.total_anomalies_detected}</div>
              <div className="text-[11px] text-slate-500 mt-1">
                Across {result.sample_size} records analyzed
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold">High Severity Findings</span>
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-2xl font-bold text-rose-600">{result.summary?.high_severity_count ?? 0}</div>
              <div className="text-[11px] text-slate-500 mt-1">
                Requires priority investigation
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold">Affected Unique Records</span>
                <Activity className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-blue-700">{result.summary?.affected_records_count ?? 0}</div>
              <div className="text-[11px] text-slate-500 mt-1">
                {result.sample_size > 0 ? Math.round(((result.summary?.affected_records_count || 0) / result.sample_size) * 100) : 0}% of total dataset
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold">Algorithm Deployed</span>
                <Cpu className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xs font-bold text-slate-800 line-clamp-1 mt-1">{result.ml_algorithm}</div>
              <div className="text-[11px] text-emerald-600 mt-1 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Fully Calibrated
              </div>
            </div>
          </div>

          {/* 4. Most Frequently Affected Columns & Nature Breakdown Pills */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top affected fields */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Most Frequently Affected Columns</span>
                <BarChart3 className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(result.summary?.most_affected_columns || {}).map(([col, cnt]) => (
                  <button
                    key={col}
                    onClick={() => setFilterColumn(filterColumn === col ? 'all' : col)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors flex items-center space-x-1.5 ${
                      filterColumn === col
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>{col}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      filterColumn === col ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {Number(cnt)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Data Quality vs Business Event Distribution */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Classification: Data Quality vs Unusual Business Events</span>
                <Info className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(result.summary?.data_quality_vs_business || {}).map(([nature, cnt]) => (
                  <button
                    key={nature}
                    onClick={() => setFilterNature(filterNature === nature ? 'all' : nature)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors flex items-center space-x-1.5 ${
                      filterNature === nature
                        ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                        : nature.includes('Error')
                        ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                        : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                    }`}
                  >
                    <span>{nature}</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-white/70">
                      {Number(cnt)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 5. Filter Toolbar & Entity Search */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Search Bar for Product, Employee, Vendor, Record ID */}
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4 text-blue-600" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Employee, Product, Vendor, Batch, Record ID, or description..."
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Export Filtered Findings */}
              <button
                onClick={handleExportCSV}
                disabled={!filteredAnomalies.length}
                className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-xs transition-colors shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Findings ({filteredAnomalies.length})</span>
              </button>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-600">
              {/* Severity Filter */}
              <div className="flex items-center space-x-1">
                <span className="font-semibold text-slate-500">Severity:</span>
                {['all', 'critical', 'medium', 'low'].map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setFilterSeverity(sev)}
                    className={`px-2.5 py-1 rounded-md capitalize font-semibold transition-colors ${
                      filterSeverity === sev
                        ? 'bg-blue-950 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>

              {/* Anomaly Type Dropdown */}
              {availableAnomalyTypes.length > 0 && (
                <div className="flex items-center space-x-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                  <span className="font-medium text-slate-600">Type:</span>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="bg-transparent text-slate-800 font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Anomaly Types</option>
                    {availableAnomalyTypes.map((t: string) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Column Dropdown */}
              {availableColumns.length > 0 && (
                <div className="flex items-center space-x-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                  <span className="font-medium text-slate-600">Column:</span>
                  <select
                    value={filterColumn}
                    onChange={(e) => setFilterColumn(e.target.value)}
                    className="bg-transparent text-slate-800 font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Affected Columns</option>
                    {availableColumns.map((c: string) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Reset active filters */}
              {(filterSeverity !== 'all' || filterType !== 'all' || filterNature !== 'all' || filterColumn !== 'all' || searchQuery) && (
                <button
                  onClick={() => {
                    setFilterSeverity('all');
                    setFilterType('all');
                    setFilterNature('all');
                    setFilterColumn('all');
                    setSearchQuery('');
                  }}
                  className="text-blue-700 hover:text-blue-800 font-semibold underline text-xs ml-auto"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          {/* 6. Comprehensive Anomaly Findings Table */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-800">
                  Detected Findings ({filteredAnomalies.length} matches)
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click on any row to open the full diagnostic investigation suggestions and evidence trail.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="py-3 px-3 font-bold">Worksheet</th>
                    <th className="py-3 px-3 font-bold">Record ID</th>
                    <th className="py-3 px-3 font-bold">Affected Column</th>
                    <th className="py-3 px-3 font-bold">Observed vs Baseline</th>
                    <th className="py-3 px-3 font-bold">ML Score</th>
                    <th className="py-3 px-3 font-bold">Severity</th>
                    <th className="py-3 px-3 font-bold">Nature & Classification</th>
                    <th className="py-3 px-3 font-bold">Explanation</th>
                    <th className="py-3 px-3 font-bold">Review Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white font-mono text-[11px]">
                  {filteredAnomalies.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400 font-sans">
                        No anomalies matching the specified filter or search query.
                      </td>
                    </tr>
                  ) : (
                    filteredAnomalies.map((item: AnomalyItem, i: number) => {
                      const isCritical = item.severity === 'Critical';
                      const isMedium = item.severity === 'Medium';
                      const isDataError = item.nature.includes('Error');

                      return (
                        <tr
                          key={`${item.sheet}_${item.record_id}_${item.column}_${i}`}
                          onClick={() => setActiveItem(item)}
                          className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                        >
                          <td className="py-2.5 px-3 font-sans whitespace-nowrap">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-semibold border border-slate-200">
                              {item.sheet || 'Default'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800 whitespace-nowrap">
                            {item.record_id}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-blue-700 whitespace-nowrap">
                            {item.column}
                          </td>
                          <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                            <span className="font-bold text-slate-900">{item.observed_value ?? 'NULL'}</span>
                            <span className="text-slate-400 mx-1">vs</span>
                            <span className="text-slate-500">{item.expected_baseline}</span>
                            <span className={`ml-1 text-[10px] font-bold ${
                              item.deviation_pct > 0 ? 'text-rose-600' : 'text-blue-600'
                            }`}>
                              ({item.deviation_pct > 0 ? `+${item.deviation_pct}%` : `${item.deviation_pct}%`})
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                            {item.anomaly_score}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                              isCritical ? 'bg-rose-50 text-rose-700 border-rose-200' :
                              isMedium ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              {item.severity}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-sans whitespace-nowrap">
                            <div className="font-semibold text-slate-800">{item.anomaly_type}</div>
                            <span className={`text-[10px] ${isDataError ? 'text-rose-600' : 'text-slate-500'}`}>
                              {item.nature}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 max-w-xs text-slate-600 text-[11px] font-sans truncate" title={item.reason}>
                            {item.reason}
                          </td>
                          <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={item.review_status}
                              onChange={(e) => handleUpdateStatus(i, e.target.value)}
                              className={`text-xs font-semibold rounded-lg px-2 py-1 bg-white border focus:outline-none shadow-2xs ${
                                item.review_status === 'Approved Exception' ? 'text-emerald-700 border-emerald-300' :
                                item.review_status === 'False Alarm' ? 'text-slate-600 border-slate-300' :
                                'text-amber-700 border-amber-300'
                              }`}
                            >
                              <option value="Flagged">Flagged</option>
                              <option value="Approved Exception">Approved Exception</option>
                              <option value="False Alarm">False Alarm</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 7. Actionable Investigation Suggestion Modal / Drawer */}
          {activeItem && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <ShieldAlert className="w-5 h-5 text-blue-600" />
                    <h3 className="text-base font-bold text-slate-800">
                      Anomaly Diagnostic & Investigation Dossier
                    </h3>
                  </div>
                  <button
                    onClick={() => setActiveItem(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <span className="text-slate-500">Record ID</span>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">{activeItem.record_id}</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <span className="text-slate-500">Worksheet / Row</span>
                    <div className="text-sm font-bold text-blue-700 mt-0.5">{activeItem.sheet || 'Default'} (Row {activeItem.row_index + 1})</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <span className="text-slate-500">Affected Column</span>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">{activeItem.column}</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <span className="text-slate-500">Anomaly Score</span>
                    <div className="text-sm font-bold text-blue-700 mt-0.5">{activeItem.anomaly_score} / 1.0</div>
                  </div>
                </div>

                {/* Ground Truth Explanation */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Mathematical Ground Truth & Variance
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed font-mono">
                    {activeItem.reason}
                  </p>
                  <div className="text-xs text-slate-600 pt-1">
                    Observed Value: <strong className="text-slate-900">{activeItem.observed_value ?? 'NULL'}</strong> | 
                    Expected Baseline: <strong className="text-slate-900">{activeItem.expected_baseline}</strong> | 
                    Deviation: <strong className={activeItem.deviation_pct > 0 ? 'text-rose-600' : 'text-blue-600'}>{activeItem.deviation_pct}%</strong>
                  </div>
                </div>

                {/* Entity Context */}
                {activeItem.entity_context && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                    <span className="font-bold block mb-1">Associated Record Context:</span>
                    <span className="text-slate-700">{activeItem.entity_context}</span>
                  </div>
                )}

                {/* Actionable Investigation Suggestion */}
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Recommended Investigation Step:</span>
                  </div>
                  <p className="text-xs text-emerald-900 leading-relaxed">
                    {activeItem.suggested_action}
                  </p>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setActiveItem(null)}
                    className="px-4 py-2 bg-blue-950 hover:bg-blue-900 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                  >
                    Close Dossier
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

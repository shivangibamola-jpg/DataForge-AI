import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  Download, 
  ArrowUpDown, 
  BarChart2, 
  PieChart as PieIcon, 
  X, 
  Layers, 
  SlidersHorizontal,
  Table as TableIcon,
  Lightbulb
} from 'lucide-react';
import { 
  BarChart, Bar, 
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { api } from '../services/api';
import { DatasetMetadata } from '../types';

interface DataExplorerProps {
  datasetId: string;
  metadata?: DatasetMetadata | null;
  onSwitchSheet?: (sheet: string) => void;
}

const COLORS = ['#2563eb', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#f97316'];

export const DataExplorer: React.FC<DataExplorerProps> = ({ datasetId, metadata, onSwitchSheet }) => {
  // Browsing / standard state
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedColumn, setSelectedColumn] = useState<string>('all');
  const [selectedSheet, setSelectedSheet] = useState<string>('all');

  // Search & Natural Language state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [fuzzyEnabled, setFuzzyEnabled] = useState(true);
  const [fuzzyThreshold, setFuzzyThreshold] = useState(0.75);
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [selectedRowIndices, setSelectedRowIndices] = useState<Set<number>>(new Set());

  // Statistical Exploration & Visualization Modal / Drawer state
  const [activeStatsCol, setActiveStatsCol] = useState<string | null>(null);
  const [colStats, setColStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [chartType, setChartType] = useState<'bar' | 'histogram' | 'pie'>('bar');

  // Multi-column filter state in search/view
  const [columnFilterValues, setColumnFilterValues] = useState<Record<string, string>>({});
  const [showFilterBar, setShowFilterBar] = useState(false);

  // Search input ref
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sheets available
  const sheets = useMemo(() => {
    return metadata?.sheets || ['Default'];
  }, [metadata]);

  // Load preview data when not searching
  useEffect(() => {
    if (!activeQuery) {
      fetchStandardPage(page);
    }
  }, [datasetId, page, pageSize, selectedColumn]);

  // Execute search when activeQuery or search parameters change
  useEffect(() => {
    if (activeQuery) {
      performSearch(activeQuery, page);
    }
  }, [activeQuery, page, pageSize, selectedSheet, selectedColumn, fuzzyEnabled, fuzzyThreshold, sortBy, sortAsc]);

  const fetchStandardPage = async (p: number) => {
    try {
      setLoading(true);
      const res = await api.getPreview(datasetId, p, pageSize);
      setData(res);
      setSearchResults(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const performSearch = async (queryStr: string, p = 1) => {
    if (!queryStr.trim()) {
      setActiveQuery('');
      setSearchResults(null);
      fetchStandardPage(1);
      return;
    }
    try {
      setSearchLoading(true);
      const res = await api.universalSearch({
        datasetId,
        query: queryStr,
        sheet: selectedSheet,
        column: selectedColumn,
        fuzzy: fuzzyEnabled,
        fuzzyThreshold,
        page: p,
        pageSize,
        sortBy: sortBy || undefined,
        sortAsc
      });
      setSearchResults(res);
      if (res.stats_view && res.stats_column) {
        setActiveStatsCol(res.stats_column);
        setColStats(res.stats_view);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSelectedRowIndices(new Set());
    setActiveQuery(searchQuery);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setActiveQuery('');
    setSearchResults(null);
    setPage(1);
    setSelectedRowIndices(new Set());
    fetchStandardPage(1);
  };

  const handleApplySuggestion = (sug: string) => {
    setSearchQuery(sug);
    setActiveQuery(sug);
    setPage(1);
  };

  const handleInspectStats = async (col: string) => {
    setActiveStatsCol(col);
    setLoadingStats(true);
    try {
      const res = await api.getColumnStats(datasetId, col, selectedSheet !== 'all' ? selectedSheet : undefined);
      setColStats(res);
      if (res.type === 'numeric') {
        setChartType('histogram');
      } else {
        setChartType('bar');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleToggleRowSelection = (idx: number) => {
    const next = new Set(selectedRowIndices);
    if (next.has(idx)) {
      next.delete(idx);
    } else {
      next.add(idx);
    }
    setSelectedRowIndices(next);
  };

  const handleToggleSelectAll = (records: any[]) => {
    if (selectedRowIndices.size === records.length) {
      setSelectedRowIndices(new Set());
    } else {
      setSelectedRowIndices(new Set(records.map((_, i) => i)));
    }
  };

  const handleExport = (exportType: 'csv' | 'json', onlySelected = false) => {
    const currentRecords = activeQuery && searchResults ? searchResults.records : data?.records;
    if (!currentRecords || !currentRecords.length) return;

    let recordsToExport = currentRecords;
    if (onlySelected && selectedRowIndices.size > 0) {
      recordsToExport = currentRecords.filter((_: any, idx: number) => selectedRowIndices.has(idx));
    }

    if (exportType === 'csv') {
      const cols = Object.keys(recordsToExport[0]).filter(k => !k.startsWith('__'));
      const headers = cols.join(',');
      const rows = recordsToExport.map((r: any) => 
        cols.map(c => {
          const v = r[c];
          if (v === null || v === undefined) return '';
          const str = String(v);
          return str.includes(',') || str.includes('\n') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(',')
      );
      const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `dataforge_export_${activeQuery ? 'search' : 'page'}_${page}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(recordsToExport, null, 2));
      const link = document.createElement("a");
      link.setAttribute("href", dataStr);
      link.setAttribute("download", `dataforge_export_${activeQuery ? 'search' : 'page'}_${page}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const highlightMatch = (text: any, matchedCols: string[] = [], colName: string) => {
    if (text === null || text === undefined) return <span className="text-amber-500 font-mono italic">null</span>;
    const strText = String(text);
    if (!activeQuery || !matchedCols.includes(colName)) {
      return <span>{strText}</span>;
    }

    const tokens = activeQuery.split(/[\s,]+/).filter(t => t.length > 1);
    if (!tokens.length) return <span>{strText}</span>;

    try {
      const pattern = new RegExp(`(${tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
      const parts = strText.split(pattern);
      return (
        <span>
          {parts.map((part, i) => 
            pattern.test(part) ? (
              <mark key={i} className="bg-yellow-200 text-yellow-900 px-1 py-0.5 rounded font-semibold border-b border-yellow-400">
                {part}
              </mark>
            ) : (
              part
            )
          )}
        </span>
      );
    } catch {
      return <span>{strText}</span>;
    }
  };

  const isSearchMode = !!activeQuery && !!searchResults;
  const currentColumns: string[] = isSearchMode ? searchResults.columns : (data?.columns || []);
  let displayColumns = selectedColumn === 'all'
    ? currentColumns
    : currentColumns.filter(c => c === selectedColumn);

  const rawRecords: any[] = isSearchMode ? searchResults.records : (data?.records || []);

  const records = useMemo(() => {
    if (!Object.keys(columnFilterValues).length) return rawRecords;
    return rawRecords.filter((row: any) => {
      for (const [col, filterVal] of Object.entries(columnFilterValues)) {
        if (!filterVal) continue;
        const cellVal = String(row[col] ?? '').toLowerCase();
        if (!cellVal.includes(filterVal.toLowerCase())) return false;
      }
      return true;
    });
  }, [rawRecords, columnFilterValues]);

  const totalMatches = isSearchMode ? searchResults.total_matches : (data?.total_rows || 0);
  const totalPages = isSearchMode ? searchResults.total_pages : (data?.total_pages || 1);

  return (
    <div className="space-y-5">
      {/* 1. UNIVERSAL SEARCH BAR */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <form onSubmit={handleSearchSubmit} className="relative flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-blue-600">
              <Search className="w-5 h-5" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search any product, name, ID, or ask anything about your data... (e.g. 'Defect Rate > 2', 'RoboWeld-B')"
              className="w-full pl-11 pr-24 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute inset-y-0 right-20 pr-2 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="submit"
              disabled={searchLoading}
              className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-sm"
            >
              {searchLoading ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                  <span>Search</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Search Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-3">
            {/* Sheet Selector */}
            <div className="flex items-center space-x-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span className="font-medium text-slate-700">Sheet:</span>
              <select
                value={selectedSheet}
                onChange={(e) => {
                  setSelectedSheet(e.target.value);
                  if (e.target.value !== 'all' && onSwitchSheet) {
                    onSwitchSheet(e.target.value);
                  }
                }}
                className="bg-transparent text-blue-600 font-semibold focus:outline-none cursor-pointer"
              >
                <option value="all">All Sheets ({sheets.length})</option>
                {sheets.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Column Selector */}
            <div className="flex items-center space-x-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <Filter className="w-3.5 h-3.5 text-blue-600" />
              <span className="font-medium text-slate-700">Column:</span>
              <select
                value={selectedColumn}
                onChange={(e) => setSelectedColumn(e.target.value)}
                className="bg-transparent text-blue-600 font-semibold focus:outline-none cursor-pointer"
              >
                <option value="all">All Columns ({currentColumns.length})</option>
                {currentColumns.map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>

            {/* Fuzzy match */}
            <label className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={fuzzyEnabled}
                onChange={(e) => setFuzzyEnabled(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-0 bg-white w-3.5 h-3.5"
              />
              <span className={fuzzyEnabled ? "text-blue-700 font-semibold" : "text-slate-600"}>Fuzzy Matching</span>
            </label>

            {/* Column Filters toggle */}
            <button
              onClick={() => setShowFilterBar(!showFilterBar)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                showFilterBar ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
              <span>Column Filters</span>
            </button>
          </div>

          {/* Quick NL prompts */}
          <div className="flex items-center space-x-2 text-[11px] text-slate-500">
            <span className="hidden sm:inline font-medium text-slate-400">Suggestions:</span>
            <button
              onClick={() => {
                setSearchQuery('Defect Rate > 2');
                setActiveQuery('Defect Rate > 2');
              }}
              className="hover:text-blue-700 hover:border-blue-300 bg-white px-2 py-1 rounded border border-slate-200 text-slate-600 transition-colors shadow-2xs"
            >
              Defect Rate &gt; 2
            </button>
            <button
              onClick={() => {
                setSearchQuery('RoboWeld-B');
                setActiveQuery('RoboWeld-B');
              }}
              className="hover:text-blue-700 hover:border-blue-300 bg-white px-2 py-1 rounded border border-slate-200 text-slate-600 transition-colors shadow-2xs"
            >
              RoboWeld-B
            </button>
            <button
              onClick={() => {
                setSearchQuery('stats for cycle time');
                setActiveQuery('stats for cycle time');
              }}
              className="hover:text-blue-700 hover:border-blue-300 bg-white px-2 py-1 rounded border border-slate-200 text-slate-600 transition-colors shadow-2xs"
            >
              Stats for Cycle Time
            </button>
          </div>
        </div>

        {/* Spelling suggestions */}
        {isSearchMode && searchResults.suggestions && searchResults.suggestions.length > 0 && (
          <div className="flex items-center space-x-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
            <Lightbulb className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-medium">Did you mean:</span>
            <div className="flex flex-wrap gap-1.5">
              {searchResults.suggestions.map((sug: string) => (
                <button
                  key={sug}
                  onClick={() => handleApplySuggestion(sug)}
                  className="bg-amber-100 hover:bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-mono font-semibold transition-colors"
                >
                  "{sug}"
                </button>
              ))}
            </div>
          </div>
        )}

        {/* NL intent explanation */}
        {isSearchMode && searchResults.is_nl && searchResults.nl_intent && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                <strong>Natural Language Query:</strong> {searchResults.nl_intent.explanation}
              </span>
            </div>
            <span className="text-[11px] text-blue-700 font-mono font-semibold bg-blue-100 px-2 py-0.5 rounded border border-blue-200">
              AI Query Engine
            </span>
          </div>
        )}
      </div>

      {/* 2. STATISTICAL SUMMARY DRAWER */}
      {activeStatsCol && colStats && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <BarChart2 className="w-5 h-5 text-blue-600" />
              <h4 className="text-sm font-bold text-slate-800">
                Statistical Exploration & Visual Distribution: <span className="text-blue-600 font-mono">{activeStatsCol}</span>
              </h4>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200 text-xs">
                <button
                  onClick={() => setChartType('bar')}
                  className={`px-3 py-1 rounded-md font-medium ${chartType === 'bar' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Bar
                </button>
                <button
                  onClick={() => setChartType('histogram')}
                  className={`px-3 py-1 rounded-md font-medium ${chartType === 'histogram' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Histogram
                </button>
                <button
                  onClick={() => setChartType('pie')}
                  className={`px-3 py-1 rounded-md font-medium ${chartType === 'pie' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Pie
                </button>
              </div>
              <button
                onClick={() => {
                  setActiveStatsCol(null);
                  setColStats(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="text-slate-500 font-medium">Total Count</div>
              <div className="text-base font-bold text-slate-800 mt-0.5">{colStats.count?.toLocaleString()}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="text-slate-500 font-medium">Missing</div>
              <div className="text-base font-bold text-amber-600 mt-0.5">{colStats.missing}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="text-slate-500 font-medium">Unique Values</div>
              <div className="text-base font-bold text-blue-600 mt-0.5">{colStats.unique?.toLocaleString()}</div>
            </div>
            {colStats.type === 'numeric' ? (
              <>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="text-slate-500 font-medium">Mean</div>
                  <div className="text-base font-bold text-emerald-600 mt-0.5">{colStats.mean}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="text-slate-500 font-medium">Median</div>
                  <div className="text-base font-bold text-indigo-600 mt-0.5">{colStats.median}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="text-slate-500 font-medium">Min / Max</div>
                  <div className="text-xs font-mono font-bold text-slate-700 mt-1">
                    {colStats.min} / {colStats.max}
                  </div>
                </div>
              </>
            ) : (
              <div className="col-span-3 bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-slate-500 font-medium">Classification</div>
                  <div className="text-sm font-bold text-blue-800 mt-0.5">Categorical / Text Field</div>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">Cardinality: {colStats.unique}</span>
              </div>
            )}
          </div>

          <div className="h-64 w-full bg-slate-50/70 rounded-lg p-3 border border-slate-200">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'histogram' && colStats.histogram ? (
                <BarChart data={colStats.histogram}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="bin" stroke="#64748b" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : chartType === 'pie' && colStats.top_values ? (
                <PieChart>
                  <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Pie
                    data={Object.entries(colStats.top_values).map(([k, v]) => ({ name: k, value: v }))}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {Object.keys(colStats.top_values).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              ) : (
                <BarChart
                  data={
                    colStats.type === 'numeric' && colStats.histogram
                      ? colStats.histogram.map((h: any) => ({ name: h.bin, value: h.count }))
                      : Object.entries(colStats.top_values || {}).map(([k, v]) => ({ name: k, value: v }))
                  }
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 3. MAIN DATA TABLE CONTAINER */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2">
              <TableIcon className="w-4 h-4 text-blue-600" />
              <h3 className="text-base font-bold text-slate-800">
                {isSearchMode ? 'Matching Records' : 'Interactive Data Grid'}
              </h3>
              {isSearchMode && (
                <span className="bg-blue-100 text-blue-700 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-blue-200">
                  {totalMatches} matches found
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing records {totalMatches === 0 ? 0 : ((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, totalMatches)} of {totalMatches}
              {selectedRowIndices.size > 0 && ` (${selectedRowIndices.size} selected)`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 text-xs text-slate-600">
              <span className="font-medium">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-transparent text-slate-800 font-semibold focus:outline-none cursor-pointer"
              >
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => handleExport('csv', selectedRowIndices.size > 0)}
                disabled={!records.length}
                className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV {selectedRowIndices.size > 0 ? `(${selectedRowIndices.size})` : ''}</span>
              </button>

              <button
                onClick={() => handleExport('json', selectedRowIndices.size > 0)}
                disabled={!records.length}
                className="flex items-center space-x-1 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold shadow-2xs transition-colors"
              >
                <span>JSON</span>
              </button>
            </div>
          </div>
        </div>

        {showFilterBar && (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
            {displayColumns.map(col => (
              <div key={col} className="space-y-1">
                <span className="text-[10px] text-slate-600 font-semibold font-mono truncate block">{col}</span>
                <input
                  type="text"
                  placeholder={`Filter...`}
                  value={columnFilterValues[col] || ''}
                  onChange={(e) => setColumnFilterValues(prev => ({ ...prev, [col]: e.target.value }))}
                  className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            ))}
          </div>
        )}

        <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold">
              <tr>
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={records.length > 0 && selectedRowIndices.size === records.length}
                    onChange={() => handleToggleSelectAll(records)}
                    className="rounded border-slate-300 text-blue-600 bg-white w-3.5 h-3.5 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-3 w-12 text-slate-400 font-mono">#</th>
                {isSearchMode && (
                  <th className="py-3 px-3 font-bold text-blue-700 whitespace-nowrap">
                    Sheet
                  </th>
                )}
                {displayColumns.map((col: string) => (
                  <th key={col} className="py-3 px-3 font-bold text-slate-700 whitespace-nowrap group">
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => {
                          if (sortBy === col) {
                            setSortAsc(!sortAsc);
                          } else {
                            setSortBy(col);
                            setSortAsc(true);
                          }
                        }}
                        className="hover:text-blue-600 flex items-center space-x-1"
                      >
                        <span>{col}</span>
                        <ArrowUpDown className={`w-3 h-3 ${sortBy === col ? 'text-blue-600' : 'text-slate-400'}`} />
                      </button>
                      <button
                        onClick={() => handleInspectStats(col)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-blue-600 rounded transition-opacity"
                        title="View statistical summary & chart"
                      >
                        <BarChart2 className="w-3 h-3" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white font-mono text-[11px]">
              {(loading || searchLoading) ? (
                <tr>
                  <td colSpan={displayColumns.length + (isSearchMode ? 3 : 2)} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Fetching records...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={displayColumns.length + (isSearchMode ? 3 : 2)} className="py-12 text-center text-slate-400 font-sans">
                    No matching records found. Try modifying your search query or loosening filters.
                  </td>
                </tr>
              ) : (
                records.map((row: any, i: number) => {
                  const isSelected = selectedRowIndices.has(i);
                  const matchedCols: string[] = row.__matched_cols__ || [];

                  return (
                    <tr
                      key={i}
                      className={`hover:bg-blue-50/50 transition-colors ${
                        isSelected ? 'bg-blue-50' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleRowSelection(i)}
                          className="rounded border-slate-300 text-blue-600 bg-white w-3.5 h-3.5 cursor-pointer"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                        {((page - 1) * pageSize) + i + 1}
                      </td>
                      {isSearchMode && (
                        <td className="py-2.5 px-3 font-sans whitespace-nowrap">
                          <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-semibold">
                            {row.__sheet__ || 'Default'}
                          </span>
                        </td>
                      )}
                      {displayColumns.map((col: string) => (
                        <td key={col} className="py-2.5 px-3 whitespace-nowrap text-slate-800">
                          {highlightMatch(row[col], matchedCols, col)}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between pt-2 text-xs text-slate-500">
          <span>
            Page <strong className="text-slate-800">{page}</strong> of <strong className="text-slate-800">{totalPages}</strong>
          </span>
          <div className="flex items-center space-x-2">
            <button
              disabled={page <= 1 || loading || searchLoading}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 shadow-2xs transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-slate-600 font-semibold px-2">
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages || loading || searchLoading}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 shadow-2xs transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

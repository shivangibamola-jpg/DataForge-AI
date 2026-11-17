import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Table, 
  BarChart3, 
  Plus, 
  Download, 
  Search, 
  ArrowLeft, 
  Trash2, 
  Edit3, 
  Eye, 
  ChevronLeft, 
  ChevronRight, 
  ArrowUpDown, 
  SlidersHorizontal,
  Key,
  Layers,
  Sparkles,
  ExternalLink,
  Clock,
  RefreshCw
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { StudioAppDetail, StudioDashboardData, StudioFieldDefinition } from '../../types';
import { api } from '../../services/api';
import { RecordModal } from './RecordModal';
import { AddFieldModal } from './AddFieldModal';

interface GeneratedAppRunnerProps {
  appId: string;
  onExit: () => void;
}

export const GeneratedAppRunner: React.FC<GeneratedAppRunnerProps> = ({ appId, onExit }) => {
  const [app, setApp] = useState<StudioAppDetail | null>(null);
  const [dashboard, setDashboard] = useState<StudioDashboardData | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard'); // 'dashboard' | entityName | 'analytics'
  const [isLoading, setIsLoading] = useState(true);

  // Entity Data State
  const [records, setRecords] = useState<any[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);

  // Modals state
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [recordModalMode, setRecordModalMode] = useState<'create' | 'edit' | 'view'>('view');
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [selectedRecordRelations, setSelectedRecordRelations] = useState<Record<string, any>>({});
  const [addFieldModalOpen, setAddFieldModalOpen] = useState(false);

  // Load app metadata and dashboard
  const loadAppData = async () => {
    try {
      setIsLoading(true);
      const appData = await api.studio.getApp(appId);
      setApp(appData);
      const dashData = await api.studio.getDashboard(appId);
      setDashboard(dashData);
    } catch (err) {
      console.error('Failed to load application', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAppData();
  }, [appId]);

  // Load entity records when switching tabs, paging, or searching
  const loadEntityRecords = async (entityName: string) => {
    try {
      setIsLoadingRecords(true);
      const res = await api.studio.getRecords(appId, entityName, {
        page,
        pageSize,
        search: searchQuery,
        sortBy: sortBy || undefined,
        sortAsc
      });
      setRecords(res.records);
      setTotalRows(res.total_rows);
    } catch (err) {
      console.error('Failed to load records', err);
    } finally {
      setIsLoadingRecords(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'dashboard' && activeTab !== 'analytics' && app) {
      loadEntityRecords(activeTab);
    }
  }, [activeTab, page, pageSize, searchQuery, sortBy, sortAsc, app]);

  const currentEntity = app?.entities.find(e => e.name === activeTab || e.display_name === activeTab);

  // Record CRUD Handlers
  const handleOpenCreate = () => {
    setSelectedRecord(null);
    setSelectedRecordRelations({});
    setRecordModalMode('create');
    setRecordModalOpen(true);
  };

  const handleOpenView = async (record: any) => {
    if (!currentEntity) return;
    try {
      const pkVal = record[currentEntity.primary_key];
      const res = await api.studio.getRecord(appId, currentEntity.name, pkVal);
      setSelectedRecord(res.record);
      setSelectedRecordRelations(res.relations || {});
      setRecordModalMode('view');
      setRecordModalOpen(true);
    } catch (err) {
      console.error('Failed to view record', err);
    }
  };

  const handleOpenEdit = (record: any) => {
    setSelectedRecord(record);
    setSelectedRecordRelations({});
    setRecordModalMode('edit');
    setRecordModalOpen(true);
  };

  const handleSaveRecord = async (formData: any) => {
    if (!currentEntity) return;
    if (recordModalMode === 'create') {
      await api.studio.createRecord(appId, currentEntity.name, formData);
    } else {
      const pkVal = selectedRecord[currentEntity.primary_key];
      await api.studio.updateRecord(appId, currentEntity.name, pkVal, formData);
    }
    // Refresh records and dashboard
    loadEntityRecords(currentEntity.name);
    api.studio.getDashboard(appId).then(setDashboard);
  };

  const handleDeleteRecord = async (recordId: string) => {
    if (!currentEntity) return;
    await api.studio.deleteRecord(appId, currentEntity.name, recordId);
    loadEntityRecords(currentEntity.name);
    api.studio.getDashboard(appId).then(setDashboard);
  };

  const handleAddField = async (fieldDef: any) => {
    if (!currentEntity) return;
    await api.studio.addField(appId, currentEntity.name, fieldDef);
    await loadAppData();
    if (activeTab === currentEntity.name) {
      loadEntityRecords(currentEntity.name);
    }
  };

  const handleSort = (colName: string) => {
    if (sortBy === colName) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(colName);
      setSortAsc(true);
    }
  };

  if (isLoading || !app) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center text-slate-500 shadow-sm">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800">Initializing Live Application...</h3>
        <p className="text-xs text-slate-500 mt-1">Connecting to persistent SQLite database.</p>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  return (
    <div className="space-y-6">
      {/* Top Application Ribbon */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={onExit}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition border border-slate-200"
              title="Return to App Studio Directory"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">{app.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  {app.domain}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Live SQLite
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 max-w-2xl truncate">
                {app.description} &bull; <strong className="text-slate-700">{app.total_records.toLocaleString()}</strong> persistent records
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {currentEntity && (
              <>
                <button
                  onClick={handleOpenCreate}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center space-x-1.5 transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>New {currentEntity.display_name}</span>
                </button>

                <div className="relative group">
                  <button
                    className="px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg flex items-center space-x-1.5 transition"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Export</span>
                  </button>
                  <div className="absolute right-0 top-full mt-1 hidden group-hover:block w-36 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-30">
                    <a
                      href={api.studio.getExportUrl(appId, currentEntity.name, 'csv')}
                      className="block px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      Export CSV (.csv)
                    </a>
                    <a
                      href={api.studio.getExportUrl(appId, currentEntity.name, 'xlsx')}
                      className="block px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      Export Excel (.xlsx)
                    </a>
                    <a
                      href={api.studio.getExportUrl(appId, currentEntity.name, 'json')}
                      className="block px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      Export JSON (.json)
                    </a>
                  </div>
                </div>

                <button
                  onClick={() => setAddFieldModalOpen(true)}
                  className="px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg flex items-center space-x-1.5 transition"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                  <span>Add Field</span>
                </button>
              </>
            )}

            <button
              onClick={onExit}
              className="px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-600 text-xs font-medium rounded-lg transition"
            >
              Exit App
            </button>
          </div>
        </div>

        {/* Tab Navigation Strip */}
        <div className="flex items-center space-x-2 mt-5 pt-3 border-t border-slate-100 overflow-x-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'dashboard'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </button>

          {app.entities.map((ent) => {
            const isActive = activeTab === ent.name || activeTab === ent.display_name;
            return (
              <button
                key={ent.id}
                onClick={() => {
                  setActiveTab(ent.name);
                  setPage(1);
                  setSearchQuery('');
                  setSortBy(null);
                }}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Table className="w-4 h-4" />
                <span>{ent.display_name}s</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${isActive ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                  {ent.records_count}
                </span>
              </button>
            );
          })}

          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'analytics'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Reports &amp; Analytics</span>
          </button>
        </div>
      </div>

      {/* View 1: Application Dashboard */}
      {activeTab === 'dashboard' && dashboard && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {dashboard.kpis.map((kpi, idx) => (
              <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{kpi.label}</span>
                <div className="text-2xl font-bold text-slate-900 mt-1">
                  {typeof kpi.value === 'number' ? kpi.value.toLocaleString() : kpi.value}
                </div>
                <div className="text-[11px] text-blue-600 font-medium mt-1">
                  Entity: {kpi.entity}
                </div>
              </div>
            ))}
          </div>

          {/* Dynamic Charts & Activity Stream */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {dashboard.charts.length > 0 ? (
                dashboard.charts.map((chart) => (
                  <div key={chart.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">{chart.title}</h3>
                        <p className="text-xs text-slate-500">Distribution for {chart.entity}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-50 text-blue-700">
                        Auto-Analyzed
                      </span>
                    </div>

                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chart.data} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey={chart.x_axis} 
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            angle={-20}
                            textAnchor="end"
                          />
                          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                          />
                          <Bar dataKey={chart.y_axis} fill="#2563eb" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
                  <BarChart3 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold">Charts will activate when categorical metrics are populated.</p>
                </div>
              )}
            </div>

            {/* Recent Activity Log */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-800">Recent Records</h3>
                </div>
                <span className="text-xs text-slate-500">{dashboard.recent_activity.length} entries</span>
              </div>

              <div className="divide-y divide-slate-100 space-y-1">
                {dashboard.recent_activity.map((act, idx) => (
                  <div key={idx} className="py-2.5 flex items-start justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-900 block truncate max-w-[180px]">
                        {act.summary}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {act.entity} &bull; ID: <strong className="text-slate-700 font-mono">{act.id}</strong>
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0">
                      {act.timestamp.split('T')[0]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View 2: Entity Data Grid CRUD */}
      {currentEntity && activeTab !== 'dashboard' && activeTab !== 'analytics' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Table Toolbar */}
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={`Search ${currentEntity.display_name}s across all fields...`}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center space-x-3 text-xs text-slate-500">
              <span>Showing {records.length} of {totalRows} records</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-700"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-200 select-none">
                <tr>
                  {currentEntity.fields.slice(0, 8).map((f) => {
                    const isPk = f.name === currentEntity.primary_key || f.is_primary_key;
                    const isSorted = sortBy === f.name;
                    return (
                      <th
                        key={f.name}
                        onClick={() => handleSort(f.name)}
                        className="py-3 px-3 cursor-pointer hover:bg-slate-200/60 transition"
                      >
                        <div className="flex items-center space-x-1">
                          {isPk && <Key className="w-3.5 h-3.5 text-amber-500" />}
                          <span>{f.label}</span>
                          <ArrowUpDown className={`w-3 h-3 ${isSorted ? 'text-blue-600' : 'text-slate-400'}`} />
                        </div>
                      </th>
                    );
                  })}
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoadingRecords ? (
                  <tr>
                    <td colSpan={currentEntity.fields.length + 1} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                      Loading records...
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={currentEntity.fields.length + 1} className="py-12 text-center text-slate-400">
                      No records found. Click <strong>+ New {currentEntity.display_name}</strong> to add one.
                    </td>
                  </tr>
                ) : (
                  records.map((row, idx) => {
                    const pkVal = row[currentEntity.primary_key];
                    return (
                      <tr key={pkVal || idx} className="hover:bg-blue-50/40 transition">
                        {currentEntity.fields.slice(0, 8).map((f) => {
                          const val = row[f.name];
                          let cellRender = String(val ?? '');

                          if (val === null || val === undefined || val === '') {
                            cellRender = '-';
                          } else if (f.type === 'currency') {
                            cellRender = `$${Number(val).toLocaleString()}`;
                          } else if (f.type === 'percentage') {
                            cellRender = `${val}%`;
                          } else if (f.type === 'category') {
                            return (
                              <td key={f.name} className="py-2.5 px-3">
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-200">
                                  {val}
                                </span>
                              </td>
                            );
                          }

                          return (
                            <td key={f.name} className="py-2.5 px-3 font-medium text-slate-800 truncate max-w-xs">
                              {cellRender}
                            </td>
                          );
                        })}

                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              onClick={() => handleOpenView(row)}
                              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                              title="Inspect Record & Relations"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenEdit(row)}
                              className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition"
                              title="Edit Record"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm(`Delete record ${pkVal}?`)) {
                                  await handleDeleteRecord(pkVal);
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                              title="Delete Record"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Bar */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View 3: Reports & Analytics */}
      {activeTab === 'analytics' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-800">Application Schema &amp; Numerical Metrics</h3>
            <p className="text-xs text-slate-500">Consolidated numerical rollups, data structure, and business summaries.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {app.entities.map((ent) => (
              <div key={ent.id} className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Table className="w-4 h-4 text-blue-600" />
                    <h4 className="text-sm font-bold text-slate-800">{ent.display_name}</h4>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
                    {ent.records_count} rows
                  </span>
                </div>

                <div className="text-xs text-slate-600">
                  Primary Key: <strong className="text-slate-800 font-mono">{ent.primary_key}</strong>
                </div>

                <div className="border-t border-slate-200 pt-3">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-2">
                    Fields Registered ({ent.fields.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {ent.fields.map((f) => (
                      <span key={f.name} className="px-2 py-1 rounded text-[11px] bg-white border border-slate-200 text-slate-700 font-medium">
                        {f.label} <span className="text-slate-400 font-mono">({f.type})</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Record Inspection / Form Modal */}
      {currentEntity && (
        <RecordModal
          isOpen={recordModalOpen}
          onClose={() => setRecordModalOpen(false)}
          mode={recordModalMode}
          entityName={currentEntity.display_name}
          fields={currentEntity.fields}
          primaryKey={currentEntity.primary_key}
          initialData={selectedRecord}
          relations={selectedRecordRelations}
          onSave={handleSaveRecord}
          onDelete={handleDeleteRecord}
          onSwitchToEdit={() => setRecordModalMode('edit')}
        />
      )}

      {/* Add Field Modal */}
      {currentEntity && (
        <AddFieldModal
          isOpen={addFieldModalOpen}
          onClose={() => setAddFieldModalOpen(false)}
          entityName={currentEntity.display_name}
          onAddField={handleAddField}
        />
      )}
    </div>
  );
};

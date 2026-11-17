import { DatasetMetadata, AnomalyItem, BusinessRuleItem, RuleViolationItem, ChartRecommendation } from '../types';

// In development, talk directly to the backend to avoid dev-server proxy socket errors.
// In production or custom environments, respect VITE_API_BASE_URL.
const BASE_URL = import.meta.env.VITE_API_BASE_URL !== undefined 
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '') 
  : (import.meta.env.DEV ? 'http://127.0.0.1:8080' : '');

export const api = {
  async loadSample(sampleName: 'manufacturing' | 'logistics'): Promise<DatasetMetadata> {
    const res = await fetch(`${BASE_URL}/api/load_sample?sample_name=${sampleName}`, { method: 'POST' });
    const json = await res.json();
    if (!res.ok) throw new Error(json.detail || 'Failed to load sample');
    return json.data;
  },

  async uploadFile(file: File): Promise<DatasetMetadata> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData,
    });
    let json: any = {};
    try {
      json = await res.json();
    } catch {
      throw new Error(`Server returned ${res.status} ${res.statusText}. Please verify the backend server is running.`);
    }
    if (!res.ok) throw new Error(json.detail || 'Upload failed');
    return json.data;
  },

  async switchSheet(datasetId: string, sheetName: string): Promise<DatasetMetadata> {
    const formData = new FormData();
    formData.append('dataset_id', datasetId);
    formData.append('sheet_name', sheetName);
    const res = await fetch(`${BASE_URL}/api/switch_sheet`, {
      method: 'POST',
      body: formData,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.detail || 'Sheet switch failed');
    return json.data;
  },

  async getPreview(datasetId: string, page = 1, pageSize = 20) {
    const res = await fetch(`${BASE_URL}/api/preview?dataset_id=${datasetId}&page=${page}&page_size=${pageSize}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.detail || 'Preview fetch failed');
    return json.data;
  },

  async getAnomalies(datasetId: string, params?: {
    metric?: string;
    sheet?: string;
    groupBy?: string;
    contamination?: number;
  }): Promise<{
    status: string;
    sheets_analyzed: string[];
    sample_size: number;
    target_metric: string;
    ml_engine_active: boolean;
    ml_algorithm: string;
    total_anomalies_detected: number;
    anomalies: AnomalyItem[];
    summary: any;
  }> {
    const qp = new URLSearchParams({ dataset_id: datasetId });
    if (params?.metric && params.metric !== 'all') qp.append('metric', params.metric);
    if (params?.sheet && params.sheet !== 'all') qp.append('sheet', params.sheet);
    if (params?.groupBy && params.groupBy !== '') qp.append('group_by', params.groupBy);
    if (params?.contamination) qp.append('contamination', String(params.contamination));

    const res = await fetch(`${BASE_URL}/api/anomalies?${qp.toString()}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.detail || 'Anomaly analysis failed');
    return json.data;
  },

  async evaluateRules(datasetId: string, rules: BusinessRuleItem[], exceptions: any[]) {
    const res = await fetch(`${BASE_URL}/api/rules/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataset_id: datasetId, rules, exceptions }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.detail || 'Rules evaluation failed');
    return json.data;
  },

  async getVisualizations(datasetId: string): Promise<ChartRecommendation[]> {
    const res = await fetch(`${BASE_URL}/api/visualizations?dataset_id=${datasetId}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.detail || 'Charts fetch failed');
    return json.charts;
  },

  async getPredictAndInsights(datasetId: string) {
    const res = await fetch(`${BASE_URL}/api/predict_and_insights?dataset_id=${datasetId}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.detail || 'Predictive analysis failed');
    return json.data;
  },

  async transformData(datasetId: string, rules: any[]) {
    const res = await fetch(`${BASE_URL}/api/transform`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataset_id: datasetId, rules }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.detail || 'Transformation failed');
    return json;
  },

  async revertTransform(datasetId: string) {
    const formData = new FormData();
    formData.append('dataset_id', datasetId);
    const res = await fetch(`${BASE_URL}/api/revert_transform`, {
      method: 'POST',
      body: formData,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.detail || 'Revert failed');
    return json;
  },

  async universalSearch(params: {
    datasetId: string;
    query: string;
    sheet?: string;
    column?: string;
    fuzzy?: boolean;
    fuzzyThreshold?: number;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortAsc?: boolean;
  }) {
    const qp = new URLSearchParams({
      dataset_id: params.datasetId,
      query: params.query,
      page: String(params.page || 1),
      page_size: String(params.pageSize || 25),
      fuzzy: String(params.fuzzy ?? true),
      fuzzy_threshold: String(params.fuzzyThreshold ?? 0.75),
      sort_asc: String(params.sortAsc ?? true),
    });
    if (params.sheet && params.sheet !== 'all') qp.append('sheet', params.sheet);
    if (params.column && params.column !== 'all') qp.append('column', params.column);
    if (params.sortBy) qp.append('sort_by', params.sortBy);

    const res = await fetch(`${BASE_URL}/api/search?${qp.toString()}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.detail || 'Search query failed');
    return json.data;
  },

  async getColumnStats(datasetId: string, column: string, sheet?: string) {
    const qp = new URLSearchParams({
      dataset_id: datasetId,
      column,
    });
    if (sheet && sheet !== 'all') qp.append('sheet', sheet);

    const res = await fetch(`${BASE_URL}/api/column_stats?${qp.toString()}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.detail || 'Failed to fetch column statistics');
    return json.data;
  },

  // ==========================================
  // AI App Studio API Client
  // ==========================================
  studio: {
    async analyzeWorkbook(file: File) {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${BASE_URL}/api/studio/analyze`, {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Failed to analyze workbook');
      return json;
    },

    async analyzeSample(sampleName = 'logistics') {
      const res = await fetch(`${BASE_URL}/api/studio/analyze_sample?sample_name=${encodeURIComponent(sampleName)}`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Failed to analyze sample');
      return json;
    },

    async generateApp(payload: { cache_id: string; app_name?: string; description?: string; blueprint?: any }) {
      const res = await fetch(`${BASE_URL}/api/studio/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Failed to generate application');
      return json;
    },

    async listApps() {
      const res = await fetch(`${BASE_URL}/api/studio/apps`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Failed to list applications');
      return json.apps;
    },

    async getApp(appId: string) {
      const res = await fetch(`${BASE_URL}/api/studio/apps/${encodeURIComponent(appId)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Failed to load application');
      return json.app;
    },

    async deleteApp(appId: string) {
      const res = await fetch(`${BASE_URL}/api/studio/apps/${encodeURIComponent(appId)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Failed to delete application');
      return json;
    },

    async getDashboard(appId: string) {
      const res = await fetch(`${BASE_URL}/api/studio/apps/${encodeURIComponent(appId)}/dashboard`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Failed to load app dashboard');
      return json.dashboard;
    },

    async getRecords(
      appId: string,
      entityName: string,
      params?: {
        page?: number;
        pageSize?: number;
        search?: string;
        sortBy?: string;
        sortAsc?: boolean;
      }
    ) {
      const qp = new URLSearchParams({
        page: String(params?.page || 1),
        page_size: String(params?.pageSize || 25),
        sort_asc: String(params?.sortAsc ?? true),
      });
      if (params?.search) qp.append('search', params.search);
      if (params?.sortBy) qp.append('sort_by', params.sortBy);

      const res = await fetch(`${BASE_URL}/api/studio/apps/${encodeURIComponent(appId)}/entities/${encodeURIComponent(entityName)}/records?${qp.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Failed to fetch records');
      return json.data;
    },

    async getRecord(appId: string, entityName: string, recordId: string) {
      const res = await fetch(`${BASE_URL}/api/studio/apps/${encodeURIComponent(appId)}/entities/${encodeURIComponent(entityName)}/records/${encodeURIComponent(recordId)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Failed to fetch record details');
      return json.data;
    },

    async createRecord(appId: string, entityName: string, data: any) {
      const res = await fetch(`${BASE_URL}/api/studio/apps/${encodeURIComponent(appId)}/entities/${encodeURIComponent(entityName)}/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Failed to create record');
      return json.record;
    },

    async updateRecord(appId: string, entityName: string, recordId: string, data: any) {
      const res = await fetch(`${BASE_URL}/api/studio/apps/${encodeURIComponent(appId)}/entities/${encodeURIComponent(entityName)}/records/${encodeURIComponent(recordId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Failed to update record');
      return json.record;
    },

    async deleteRecord(appId: string, entityName: string, recordId: string) {
      const res = await fetch(`${BASE_URL}/api/studio/apps/${encodeURIComponent(appId)}/entities/${encodeURIComponent(entityName)}/records/${encodeURIComponent(recordId)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Failed to delete record');
      return json;
    },

    async addField(appId: string, entityName: string, fieldDef: { name: string; label?: string; type: string; required?: boolean; options?: string[] }) {
      const res = await fetch(`${BASE_URL}/api/studio/apps/${encodeURIComponent(appId)}/entities/${encodeURIComponent(entityName)}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fieldDef),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Failed to add field');
      return json.field;
    },

    async getTemplates() {
      const res = await fetch(`${BASE_URL}/api/studio/templates`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Failed to fetch templates');
      return json.templates;
    },

    async instantiateTemplate(templateId: string) {
      const res = await fetch(`${BASE_URL}/api/studio/templates/${encodeURIComponent(templateId)}/instantiate`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Failed to launch template application');
      return json.app;
    },

    getExportUrl(appId: string, entityName: string, format = 'csv') {
      return `${BASE_URL}/api/studio/apps/${encodeURIComponent(appId)}/entities/${encodeURIComponent(entityName)}/export?format=${encodeURIComponent(format)}`;
    }
  }
};

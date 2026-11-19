import { DatasetMetadata, AnomalyItem, BusinessRuleItem, RuleViolationItem, ChartRecommendation } from '../types';

// In development, talk directly to the backend to avoid dev-server proxy socket errors.
// In production or custom environments, respect VITE_API_BASE_URL.
const rawBaseUrl = import.meta.env.VITE_API_BASE_URL;
const BASE_URL = (rawBaseUrl !== undefined && rawBaseUrl.trim() !== '')
  ? rawBaseUrl.trim().replace(/\/+$/, '') 
  : (import.meta.env.DEV ? 'http://127.0.0.1:8080' : '');

async function requestJson<T = any>(url: string, init?: RequestInit, fallbackMsg = 'Request failed'): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err: any) {
    throw new Error(
      `Cannot connect to backend server at "${url}". ${
        !import.meta.env.DEV && (!rawBaseUrl || rawBaseUrl.trim() === '')
          ? 'When deployed on Vercel, set VITE_API_BASE_URL in your Vercel Project Settings to your live backend service URL (e.g. Render / Railway).'
          : 'Please verify the backend server is running and accessible.'
      }`
    );
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (res.status === 404) {
      throw new Error(
        `Backend endpoint not found (404). If deploying frontend on Vercel, set VITE_API_BASE_URL in your Vercel Project Settings to your deployed backend URL (e.g. https://your-backend.onrender.com).`
      );
    }
    const snippet = await res.text().catch(() => '');
    throw new Error(
      `Expected JSON from backend but received status ${res.status}. ${
        snippet.includes('<!DOCTYPE') || snippet.includes('<html')
          ? 'The server returned an HTML page instead of API JSON. Ensure your API URL is correct.'
          : snippet.slice(0, 100)
      }`
    );
  }

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.detail || json.message || `${fallbackMsg} (status ${res.status})`);
  }
  return json;
}

export const api = {
  async loadSample(sampleName: 'manufacturing' | 'logistics'): Promise<DatasetMetadata> {
    const json = await requestJson(`${BASE_URL}/api/load_sample?sample_name=${sampleName}`, { method: 'POST' });
    return json.data;
  },

  async uploadFile(file: File): Promise<DatasetMetadata> {
    const formData = new FormData();
    formData.append('file', file);
    const json = await requestJson(`${BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData,
    }, 'Upload failed');
    return json.data;
  },

  async switchSheet(datasetId: string, sheetName: string): Promise<DatasetMetadata> {
    const formData = new FormData();
    formData.append('dataset_id', datasetId);
    formData.append('sheet_name', sheetName);
    const json = await requestJson(`${BASE_URL}/api/switch_sheet`, {
      method: 'POST',
      body: formData,
    }, 'Sheet switch failed');
    return json.data;
  },

  async getPreview(datasetId: string, page = 1, pageSize = 20) {
    const json = await requestJson(`${BASE_URL}/api/preview?dataset_id=${datasetId}&page=${page}&page_size=${pageSize}`, undefined, 'Preview fetch failed');
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

    const json = await requestJson(`${BASE_URL}/api/anomalies?${qp.toString()}`, undefined, 'Anomaly analysis failed');
    return json.data;
  },

  async evaluateRules(datasetId: string, rules: BusinessRuleItem[], exceptions: any[]) {
    const json = await requestJson(`${BASE_URL}/api/rules/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataset_id: datasetId, rules, exceptions }),
    }, 'Rules evaluation failed');
    return json.data;
  },

  async getVisualizations(datasetId: string): Promise<ChartRecommendation[]> {
    const json = await requestJson(`${BASE_URL}/api/visualizations?dataset_id=${datasetId}`, undefined, 'Charts fetch failed');
    return json.charts;
  },

  async getPredictAndInsights(datasetId: string) {
    const json = await requestJson(`${BASE_URL}/api/predict_and_insights?dataset_id=${datasetId}`, undefined, 'Predictive analysis failed');
    return json.data;
  },

  async transformData(datasetId: string, rules: any[]) {
    return await requestJson(`${BASE_URL}/api/transform`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataset_id: datasetId, rules }),
    }, 'Transformation failed');
  },

  async revertTransform(datasetId: string) {
    const formData = new FormData();
    formData.append('dataset_id', datasetId);
    return await requestJson(`${BASE_URL}/api/revert_transform`, {
      method: 'POST',
      body: formData,
    }, 'Revert failed');
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

    const json = await requestJson(`${BASE_URL}/api/search?${qp.toString()}`, undefined, 'Search query failed');
    return json.data;
  },

  async getColumnStats(datasetId: string, column: string, sheet?: string) {
    const qp = new URLSearchParams({
      dataset_id: datasetId,
      column,
    });
    if (sheet && sheet !== 'all') qp.append('sheet', sheet);

    const json = await requestJson(`${BASE_URL}/api/column_stats?${qp.toString()}`, undefined, 'Failed to fetch column statistics');
    return json.data;
  },

  // ==========================================
  // AI App Studio API Client
  // ==========================================
  studio: {
    async analyzeWorkbook(file: File) {
      const formData = new FormData();
      formData.append('file', file);
      return await requestJson(`${BASE_URL}/api/studio/analyze`, {
        method: 'POST',
        body: formData,
      }, 'Failed to analyze workbook');
    },

    async analyzeSample(sampleName = 'logistics') {
      return await requestJson(
        `${BASE_URL}/api/studio/analyze_sample?sample_name=${encodeURIComponent(sampleName)}`,
        { method: 'POST' },
        'Failed to analyze sample'
      );
    },

    async generateApp(payload: { cache_id: string; app_name?: string; description?: string; blueprint?: any }) {
      return await requestJson(`${BASE_URL}/api/studio/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }, 'Failed to generate application');
    },

    async listApps() {
      const json = await requestJson(`${BASE_URL}/api/studio/apps`, undefined, 'Failed to list applications');
      return json.apps;
    },

    async getApp(appId: string) {
      const json = await requestJson(`${BASE_URL}/api/studio/apps/${encodeURIComponent(appId)}`, undefined, 'Failed to load application');
      return json.app;
    },

    async deleteApp(appId: string) {
      return await requestJson(`${BASE_URL}/api/studio/apps/${encodeURIComponent(appId)}`, {
        method: 'DELETE',
      }, 'Failed to delete application');
    },

    async getDashboard(appId: string) {
      const json = await requestJson(`${BASE_URL}/api/studio/apps/${encodeURIComponent(appId)}/dashboard`, undefined, 'Failed to load app dashboard');
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

      const json = await requestJson(`${BASE_URL}/api/studio/apps/${encodeURIComponent(appId)}/entities/${encodeURIComponent(entityName)}/records?${qp.toString()}`, undefined, 'Failed to fetch records');
      return json.data;
    },

    async getRecord(appId: string, entityName: string, recordId: string) {
      const json = await requestJson(`${BASE_URL}/api/studio/apps/${encodeURIComponent(appId)}/entities/${encodeURIComponent(entityName)}/records/${encodeURIComponent(recordId)}`, undefined, 'Failed to fetch record details');
      return json.data;
    },

    async createRecord(appId: string, entityName: string, data: any) {
      const json = await requestJson(`${BASE_URL}/api/studio/apps/${encodeURIComponent(appId)}/entities/${encodeURIComponent(entityName)}/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      }, 'Failed to create record');
      return json.record;
    },

    async updateRecord(appId: string, entityName: string, recordId: string, data: any) {
      const json = await requestJson(`${BASE_URL}/api/studio/apps/${encodeURIComponent(appId)}/entities/${encodeURIComponent(entityName)}/records/${encodeURIComponent(recordId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      }, 'Failed to update record');
      return json.record;
    },

    async deleteRecord(appId: string, entityName: string, recordId: string) {
      return await requestJson(`${BASE_URL}/api/studio/apps/${encodeURIComponent(appId)}/entities/${encodeURIComponent(entityName)}/records/${encodeURIComponent(recordId)}`, {
        method: 'DELETE',
      }, 'Failed to delete record');
    },

    async addField(appId: string, entityName: string, fieldDef: { name: string; label?: string; type: string; required?: boolean; options?: string[] }) {
      const json = await requestJson(`${BASE_URL}/api/studio/apps/${encodeURIComponent(appId)}/entities/${encodeURIComponent(entityName)}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fieldDef),
      }, 'Failed to add field');
      return json.field;
    },

    async getTemplates() {
      const json = await requestJson(`${BASE_URL}/api/studio/templates`, undefined, 'Failed to fetch templates');
      return json.templates;
    },

    async instantiateTemplate(templateId: string) {
      const json = await requestJson(`${BASE_URL}/api/studio/templates/${encodeURIComponent(templateId)}/instantiate`, {
        method: 'POST',
      }, 'Failed to launch template application');
      return json.app;
    },

    getExportUrl(appId: string, entityName: string, format = 'csv') {
      return `${BASE_URL}/api/studio/apps/${encodeURIComponent(appId)}/entities/${encodeURIComponent(entityName)}/export?format=${encodeURIComponent(format)}`;
    }
  }
};

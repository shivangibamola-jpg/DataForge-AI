import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { LineChart as LineChartIcon, BarChart3, ScatterChart as ScatterIcon } from 'lucide-react';
import { api } from '../services/api';
import { DatasetMetadata, ChartRecommendation } from '../types';

interface VisualizationsProps {
  metadata: DatasetMetadata;
}

export const Visualizations: React.FC<VisualizationsProps> = ({ metadata }) => {
  const [charts, setCharts] = useState<ChartRecommendation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCharts();
  }, [metadata.dataset_id]);

  const fetchCharts = async () => {
    try {
      setLoading(true);
      const res = await api.getVisualizations(metadata.dataset_id);
      setCharts(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 shadow-sm">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        Recommending and generating validated graphs...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center space-x-2">
          <LineChartIcon className="w-5 h-5 text-blue-600" />
          <h3 className="text-base font-bold text-slate-800">Intelligent Visualization Engine</h3>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Charts are automatically synthesized based on column semantics, time horizons, and variance distributions.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {charts.map((chart) => (
          <div key={chart.id} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
            <div className="mb-4">
              <div className="flex items-center space-x-2 mb-1">
                {chart.type === 'line' && <LineChartIcon className="w-4 h-4 text-blue-600" />}
                {chart.type === 'bar' && <BarChart3 className="w-4 h-4 text-indigo-600" />}
                {chart.type === 'scatter' && <ScatterIcon className="w-4 h-4 text-emerald-600" />}
                <h4 className="text-sm font-bold text-slate-800">{chart.title}</h4>
              </div>
              <p className="text-xs text-slate-500">{chart.description}</p>
            </div>

            <div className="h-64 w-full bg-slate-50 rounded-lg p-3 border border-slate-200">
              <ResponsiveContainer width="100%" height="100%">
                {chart.type === 'line' ? (
                  <LineChart data={chart.data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="x" stroke="#64748b" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Line type="monotone" dataKey="y" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 2 }} />
                  </LineChart>
                ) : chart.type === 'bar' ? (
                  <BarChart data={chart.data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="category" stroke="#64748b" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : (
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="x" stroke="#64748b" tick={{ fontSize: 10 }} name={chart.x_axis} />
                    <YAxis dataKey="y" stroke="#64748b" tick={{ fontSize: 10 }} name={chart.y_axis} />
                    <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Scatter data={chart.data} fill="#10b981" />
                  </ScatterChart>
                )}
              </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-100">
              <span>X: <strong className="text-slate-700">{chart.x_axis}</strong></span>
              <span>Y: <strong className="text-slate-700">{chart.y_axis}</strong></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

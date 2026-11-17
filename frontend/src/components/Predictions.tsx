import React, { useState, useEffect } from 'react';
import { Lightbulb, TrendingUp, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { DatasetMetadata } from '../types';

interface PredictionsProps {
  metadata: DatasetMetadata;
}

export const Predictions: React.FC<PredictionsProps> = ({ metadata }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPredictions();
  }, [metadata.dataset_id]);

  const fetchPredictions = async () => {
    try {
      setLoading(true);
      const res = await api.getPredictAndInsights(metadata.dataset_id);
      setData(res);
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
        Evaluating historical sufficiency and generating predictive models...
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center space-x-2">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          <h3 className="text-base font-bold text-slate-800">Predictive Analytics & Evidence Insights</h3>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Predictions are computed deterministically when data size and chronological continuity permit.
        </p>
      </div>

      {/* Predictive Modeling Assessment */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <h4 className="text-sm font-bold text-slate-800">Predictive Modeling Horizon</h4>
          </div>
          {data.prediction?.eligible ? (
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Model Deployed ({data.prediction.algorithm})
            </span>
          ) : (
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              Prediction Restricted
            </span>
          )}
        </div>

        {data.prediction?.eligible ? (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-xs font-semibold text-slate-500">Target Metric</span>
                <div className="text-base font-bold text-slate-800 mt-0.5">{data.prediction.target_metric}</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-xs font-semibold text-slate-500">Trend Trajectory</span>
                <div className="text-base font-bold capitalize text-blue-700 mt-0.5">
                  {data.prediction.trend_direction}
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-xs font-semibold text-slate-500">Rate of Shift</span>
                <div className="text-base font-bold text-slate-800 mt-0.5">
                  {data.prediction.projected_change_rate} units/period
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-xs font-bold text-slate-700 block mb-2">Projected Future Values:</span>
              <div className="flex flex-wrap gap-2">
                {data.prediction.forecast_points.map((pt: any, i: number) => (
                  <div key={i} className="px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-xs shadow-2xs">
                    <span className="text-slate-400 font-mono text-[10px] block font-semibold">{pt.period}</span>
                    <span className="font-bold text-blue-700">{pt.projected_value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center space-x-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>{data.prediction?.reason || "Insufficient data to train predictive model."}</span>
          </div>
        )}
      </div>

      {/* Evidence-Based Operational Insights */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <h4 className="text-sm font-bold text-slate-800">Deterministic Data Insights</h4>
        <div className="space-y-3">
          {data.insights.map((ins: any, i: number) => (
            <div key={i} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 shadow-2xs">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                  {ins.type}
                </span>
                <span className="text-sm font-bold text-slate-800">{ins.summary}</span>
              </div>
              <p className="text-xs text-slate-600 pl-1">{ins.evidence}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

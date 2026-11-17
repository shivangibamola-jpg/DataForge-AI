import React, { useState } from 'react';
import { Play, RotateCcw, Plus, Trash2, Check } from 'lucide-react';
import { api } from '../services/api';
import { DatasetMetadata } from '../types';

interface CleaningViewProps {
  metadata: DatasetMetadata;
  onUpdateMetadata: (meta: DatasetMetadata) => void;
}

export const CleaningView: React.FC<CleaningViewProps> = ({ metadata, onUpdateMetadata }) => {
  const [rules, setRules] = useState<any[]>([
    { action: 'handle_missing', column: metadata.profile.columns.find(c => c.missing_count > 0)?.name || metadata.profile.columns[0]?.name, strategy: 'median' }
  ]);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const addRule = () => {
    setRules([...rules, { action: 'handle_missing', column: metadata.profile.columns[0]?.name, strategy: 'mean' }]);
  };

  const removeRule = (idx: number) => {
    setRules(rules.filter((_, i) => i !== idx));
  };

  const updateRule = (idx: number, field: string, value: any) => {
    const updated = [...rules];
    updated[idx][field] = value;
    setRules(updated);
  };

  const handleApplyTransformations = async () => {
    try {
      setLoading(true);
      setSuccessMsg(null);
      const res = await api.transformData(metadata.dataset_id, rules);
      const updatedMeta = { ...metadata, profile: res.profile };
      onUpdateMetadata(updatedMeta);
      setSuccessMsg(`Transformations applied successfully! Evaluated on ${res.rows_after} records.`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRevert = async () => {
    try {
      setLoading(true);
      setSuccessMsg(null);
      const res = await api.revertTransform(metadata.dataset_id);
      const updatedMeta = { ...metadata, profile: res.profile };
      onUpdateMetadata(updatedMeta);
      setSuccessMsg("Reverted dataset back to original uploaded state.");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-800">Visual Data Cleaning & Transformation</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Define declarative cleaning steps without code. Safe, reversible, and auditable.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleRevert}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Revert to Original</span>
          </button>

          <button
            onClick={handleApplyTransformations}
            disabled={loading}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Execute Transformations</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center space-x-2 font-medium">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Rules Builder */}
      <div className="space-y-3">
        {rules.map((rule, idx) => (
          <div key={idx} className="flex flex-wrap items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-xs font-mono text-blue-700 font-bold">Step {idx + 1}</span>

            {/* Action selector */}
            <select
              value={rule.action}
              onChange={(e) => updateRule(idx, 'action', e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:border-blue-500 shadow-2xs"
            >
              <option value="handle_missing">Handle Missing Values</option>
              <option value="drop_duplicates">Drop Duplicates</option>
              <option value="convert_type">Convert Column Type</option>
            </select>

            {/* Column selector */}
            <span className="text-xs text-slate-600 font-medium">on column</span>
            <select
              value={rule.column}
              onChange={(e) => updateRule(idx, 'column', e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:border-blue-500 shadow-2xs"
            >
              {metadata.profile.columns.map(c => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>

            {/* Action-specific options */}
            {rule.action === 'handle_missing' && (
              <>
                <span className="text-xs text-slate-600 font-medium">strategy:</span>
                <select
                  value={rule.strategy}
                  onChange={(e) => updateRule(idx, 'strategy', e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:border-blue-500 shadow-2xs"
                >
                  <option value="median">Fill with Median</option>
                  <option value="mean">Fill with Mean</option>
                  <option value="mode">Fill with Most Frequent (Mode)</option>
                  <option value="forward_fill">Forward Fill (Chronological)</option>
                  <option value="drop_row">Drop Rows with Missing</option>
                </select>
              </>
            )}

            {rule.action === 'convert_type' && (
              <>
                <span className="text-xs text-slate-600 font-medium">to:</span>
                <select
                  value={rule.target_type || 'numeric'}
                  onChange={(e) => updateRule(idx, 'target_type', e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:border-blue-500 shadow-2xs"
                >
                  <option value="numeric">Numeric (Float/Int)</option>
                  <option value="datetime">Datetime</option>
                  <option value="text">String / Text</option>
                </select>
              </>
            )}

            <button
              onClick={() => removeRule(idx)}
              className="ml-auto text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-white transition-colors"
              title="Remove step"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        <button
          onClick={addRule}
          className="flex items-center space-x-1.5 text-xs text-blue-700 hover:text-blue-800 font-semibold px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Transformation Step</span>
        </button>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { X, Save, Edit3, Trash2, Key, Link2, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { StudioFieldDefinition } from '../../types';

interface RecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit' | 'view';
  entityName: string;
  fields: StudioFieldDefinition[];
  primaryKey: string;
  initialData?: any;
  relations?: Record<string, any>;
  onSave: (data: any) => Promise<void>;
  onDelete?: (recordId: string) => Promise<void>;
  onSwitchToEdit?: () => void;
}

export const RecordModal: React.FC<RecordModalProps> = ({
  isOpen,
  onClose,
  mode,
  entityName,
  fields,
  primaryKey,
  initialData = {},
  relations = {},
  onSave,
  onDelete,
  onSwitchToEdit
}) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({ ...initialData });
    } else {
      setFormData({});
    }
    setErrors({});
  }, [initialData, mode, isOpen]);

  if (!isOpen) return null;

  const handleChange = (fieldName: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
    if (errors[fieldName]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    for (const f of fields) {
      const val = formData[f.name];
      if (f.required && (val === undefined || val === null || String(val).trim() === '')) {
        newErrors[f.name] = `${f.label} is required`;
      }
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        if (f.type === 'email') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(String(val))) {
            newErrors[f.name] = 'Invalid email address format';
          }
        }
        if (f.type === 'number' || f.type === 'integer' || f.type === 'currency' || f.type === 'percentage') {
          if (isNaN(Number(val))) {
            newErrors[f.name] = 'Must be a valid numerical value';
          }
        }
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setIsSubmitting(true);
      await onSave(formData);
      onClose();
    } catch (err: any) {
      setErrors(prev => ({ ...prev, _form: err.message || 'Failed to save record' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderFieldInput = (f: StudioFieldDefinition) => {
    const isPk = f.name === primaryKey || f.is_primary_key;
    const val = formData[f.name] ?? '';

    if (mode === 'view') {
      let displayVal = val;
      if (val === null || val === undefined || val === '') {
        displayVal = <span className="text-slate-400 italic">None</span>;
      } else if (f.type === 'currency') {
        displayVal = `$${Number(val).toLocaleString()}`;
      } else if (f.type === 'percentage') {
        displayVal = `${val}%`;
      } else if (f.type === 'category') {
        displayVal = (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            {val}
          </span>
        );
      } else if (f.type === 'boolean') {
        displayVal = val ? 'Yes' : 'No';
      }

      return (
        <div key={f.name} className="py-2.5 border-b border-slate-100 last:border-b-0">
          <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-medium mb-1">
            {isPk && <Key className="w-3.5 h-3.5 text-amber-500" />}
            {f.foreign_key && <Link2 className="w-3.5 h-3.5 text-indigo-500" />}
            <span>{f.label}</span>
          </div>
          <div className="text-sm font-semibold text-slate-900 break-words">{displayVal}</div>
        </div>
      );
    }

    // Editable form input
    return (
      <div key={f.name} className="space-y-1">
        <label className="flex items-center space-x-1 text-xs font-semibold text-slate-700">
          {isPk && <Key className="w-3.5 h-3.5 text-amber-500 mr-1" />}
          <span>{f.label}</span>
          {f.required && <span className="text-red-500 font-bold">*</span>}
          {f.type === 'currency' && <span className="text-slate-400 font-normal">($)</span>}
          {f.type === 'percentage' && <span className="text-slate-400 font-normal">(%)</span>}
        </label>

        {f.type === 'category' && f.options && f.options.length > 0 ? (
          <select
            value={val}
            onChange={(e) => handleChange(f.name, e.target.value)}
            disabled={isPk && mode === 'edit'}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="">-- Select {f.label} --</option>
            {f.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : f.type === 'textarea' ? (
          <textarea
            value={val}
            onChange={(e) => handleChange(f.name, e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        ) : f.type === 'boolean' ? (
          <div className="flex items-center space-x-3 pt-1">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={!!val}
                onChange={(e) => handleChange(f.name, e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              <span className="ml-3 text-xs font-medium text-slate-700">{val ? 'True / Yes' : 'False / No'}</span>
            </label>
          </div>
        ) : (
          <input
            type={
              f.type === 'date'
                ? 'date'
                : f.type === 'email'
                ? 'email'
                : f.type === 'integer' || f.type === 'number' || f.type === 'currency' || f.type === 'percentage'
                ? 'number'
                : 'text'
            }
            step={f.type === 'integer' ? '1' : 'any'}
            value={val}
            disabled={isPk && mode === 'edit'}
            placeholder={isPk && mode === 'create' ? 'Auto-assigned if left blank' : `Enter ${f.label}`}
            onChange={(e) => handleChange(f.name, e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
          />
        )}

        {errors[f.name] && (
          <p className="text-xs text-red-600 flex items-center gap-1 mt-0.5">
            <AlertCircle className="w-3.5 h-3.5" />
            {errors[f.name]}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-800">
              {mode === 'view' ? 'Record Inspector' : mode === 'create' ? 'New Record' : 'Edit Record'}
            </span>
            <h3 className="text-base font-bold text-slate-800">
              {entityName} {formData[primaryKey] ? `(${formData[primaryKey]})` : ''}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {errors._form && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errors._form}</span>
            </div>
          )}

          {mode === 'view' ? (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 divide-y divide-slate-100">
                {fields.map(renderFieldInput)}
              </div>

              {/* Related Record Cards if Foreign Keys exist */}
              {Object.keys(relations).length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Link2 className="w-4 h-4 text-indigo-600" />
                    <span>Linked Parent Entities</span>
                  </h4>
                  {Object.entries(relations).map(([fieldKey, relObj]) => (
                    <div key={fieldKey} className="bg-indigo-50/50 border border-indigo-200/60 rounded-xl p-4">
                      <div className="text-xs font-bold text-indigo-900 mb-2">
                        Linked via {fieldKey}: <span className="text-indigo-600">{formData[fieldKey]}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {Object.entries(relObj)
                          .filter(([k]) => !k.startsWith('_'))
                          .map(([rk, rv]) => (
                            <div key={rk} className="bg-white/80 p-2 rounded border border-indigo-100">
                              <span className="text-slate-500 font-medium block">{rk}:</span>
                              <span className="font-semibold text-slate-800">{String(rv)}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form id="record-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fields.map(renderFieldInput)}
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          {mode === 'view' ? (
            <>
              {onDelete && formData[primaryKey] ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (confirm(`Are you sure you want to delete record ${formData[primaryKey]}?`)) {
                      await onDelete(formData[primaryKey]);
                      onClose();
                    }
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg border border-red-200 flex items-center space-x-1.5 transition"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Record</span>
                </button>
              ) : <div></div>}
              
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-100 font-medium transition"
                >
                  Close
                </button>
                {onSwitchToEdit && (
                  <button
                    type="button"
                    onClick={onSwitchToEdit}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow flex items-center space-x-1.5 transition"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Edit Record</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-end space-x-3 w-full">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-100 font-medium transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="record-form"
                disabled={isSubmitting}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow flex items-center space-x-2 transition disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                <span>{isSubmitting ? 'Saving...' : 'Save Record'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

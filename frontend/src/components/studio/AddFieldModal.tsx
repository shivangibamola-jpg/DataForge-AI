import React, { useState } from 'react';
import { X, Plus, AlertCircle } from 'lucide-react';

interface AddFieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityName: string;
  onAddField: (fieldDef: {
    name: string;
    label: string;
    type: string;
    required: boolean;
    options?: string[];
  }) => Promise<void>;
}

export const AddFieldModal: React.FC<AddFieldModalProps> = ({
  isOpen,
  onClose,
  entityName,
  onAddField
}) => {
  const [name, setName] = useState('');
  const [label, setLabel] = useState('');
  const [type, setType] = useState('text');
  const [required, setRequired] = useState(false);
  const [optionsStr, setOptionsStr] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setName(raw);
    if (!label || label === name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())) {
      setLabel(raw.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Field name is required');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const options = type === 'category' ? optionsStr.split(',').map(s => s.trim()).filter(Boolean) : undefined;
      await onAddField({
        name: name.trim().replace(/\s+/g, '_'),
        label: label.trim() || name.trim(),
        type,
        required,
        options
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add custom field');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Add Custom Field</h3>
            <p className="text-xs text-slate-500">Attach a new persistent column to {entityName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Field Name (Code Identifier)</label>
            <input
              type="text"
              placeholder="e.g. Priority_Level or Internal_Notes"
              value={name}
              onChange={handleNameChange}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Display Label</label>
            <input
              type="text"
              placeholder="e.g. Priority Level"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Data Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="text">Text (Single Line)</option>
              <option value="textarea">Long Text (Textarea)</option>
              <option value="integer">Integer Number</option>
              <option value="number">Decimal Number</option>
              <option value="currency">Currency ($)</option>
              <option value="percentage">Percentage (%)</option>
              <option value="date">Date</option>
              <option value="category">Category (Dropdown Choices)</option>
              <option value="email">Email</option>
              <option value="boolean">Boolean Toggle (True/False)</option>
            </select>
          </div>

          {type === 'category' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Dropdown Choices (comma-separated)</label>
              <input
                type="text"
                placeholder="Low, Medium, High, Urgent"
                value={optionsStr}
                onChange={(e) => setOptionsStr(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          )}

          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="req-checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
            />
            <label htmlFor="req-checkbox" className="text-xs font-medium text-slate-700">
              Required field (cannot be empty)
            </label>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-3">
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
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow flex items-center space-x-1.5 transition disabled:opacity-60"
            >
              <Plus className="w-4 h-4" />
              <span>{isSubmitting ? 'Adding...' : 'Add Field'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

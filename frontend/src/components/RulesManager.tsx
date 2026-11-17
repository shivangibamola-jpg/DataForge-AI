import React, { useState, useEffect } from 'react';
import { ScrollText, ShieldCheck, AlertTriangle, CheckCircle } from 'lucide-react';
import { api } from '../services/api';
import { DatasetMetadata, BusinessRuleItem, RuleViolationItem } from '../types';

interface RulesManagerProps {
  metadata: DatasetMetadata;
}

export const RulesManager: React.FC<RulesManagerProps> = ({ metadata }) => {
  const isDelivery = metadata.profile.domain.includes('Logistics') || metadata.profile.columns.some(c => c.name.includes('Delivery') || c.name.includes('Ship'));
  
  const initialRules: BusinessRuleItem[] = isDelivery ? [
    {
      id: 'rule_1',
      name: 'Standard Order SLA Ceiling',
      column: 'Actual_Delivery_Days',
      operator: '>',
      threshold: 5.0,
      scope_column: 'Order_Type',
      scope_value: 'Standard',
      severity: 'High',
      explanation: 'Standard shipments must not exceed 5 delivery days according to SLA.'
    },
    {
      id: 'rule_2',
      name: 'Custom Order Delivery SLA',
      column: 'Actual_Delivery_Days',
      operator: '>',
      threshold: 20.0,
      scope_column: 'Order_Type',
      scope_value: 'Custom',
      severity: 'Critical',
      explanation: 'Custom engineering orders have a negotiated 20-day maximum delivery window.'
    }
  ] : [
    {
      id: 'rule_1',
      name: 'Manufacturing Cycle Time Cap',
      column: metadata.profile.columns.find(c => c.semantic_type === 'numeric')?.name || 'Cycle_Time_Min',
      operator: '>',
      threshold: 55.0,
      severity: 'High',
      explanation: 'Operational cycle time exceeding 55 minutes indicates station bottlenecking.'
    }
  ];

  const [rules] = useState<BusinessRuleItem[]>(initialRules);
  const [exceptions, setExceptions] = useState<any[]>([
    {
      id: 'ex_1',
      rule_id: 'rule_1',
      record_id: isDelivery ? 'SHIP-2018' : 'MFG-1014',
      owner: 'Alex Morgan (Operations VP)',
      reason: 'Approved vendor facility power maintenance window',
      expiry_date: '2025-12-31',
      created_at: '2025-02-10'
    }
  ]);

  const [evaluation, setEvaluation] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    runEvaluation();
  }, [rules, exceptions, metadata.dataset_id]);

  const runEvaluation = async () => {
    try {
      setLoading(true);
      const res = await api.evaluateRules(metadata.dataset_id, rules, exceptions);
      setEvaluation(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddException = (recordId: string, ruleId: string) => {
    const owner = prompt("Enter Exception Approver / Owner:", "Director of Quality");
    if (!owner) return;
    const reason = prompt("Enter Business Justification Reason:", "Contractual waiver / Seasonal tolerance");
    if (!reason) return;

    const newEx = {
      id: `ex_${Date.now()}`,
      rule_id: ruleId,
      record_id: recordId,
      owner,
      reason,
      expiry_date: '2025-12-31',
      created_at: new Date().toISOString().split('T')[0]
    };
    setExceptions([...exceptions, newEx]);
  };

  return (
    <div className="space-y-6">
      {/* Header and Summary */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <ScrollText className="w-5 h-5 text-blue-600" />
              <h3 className="text-base font-bold text-slate-800">Custom Business Rules & Exception Management</h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Enforce explicit contractual thresholds and maintain audit trails of authorized business exceptions.
            </p>
          </div>

          {evaluation && (
            <div className="flex items-center space-x-3 text-xs">
              <span className="px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                {evaluation.active_breaches} Active Breaches
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                {evaluation.approved_exceptions} Approved Exceptions
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Rules Configured List */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <h4 className="text-sm font-bold text-slate-800">Active Business Policies ({rules.length})</h4>
        <div className="space-y-3">
          {rules.map((rule) => (
            <div key={rule.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-slate-800">{rule.name}</span>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                    {rule.severity}
                  </span>
                  {rule.scope_column && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                      Scope: {rule.scope_column} = '{rule.scope_value}'
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">{rule.explanation}</p>
              </div>

              <div className="text-xs font-mono font-bold bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-blue-700 shrink-0 shadow-2xs">
                Condition: {rule.column} {rule.operator} {rule.threshold}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rule Violations & Exception Management Table */}
      {evaluation && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <h4 className="text-sm font-bold text-slate-800">
            Policy Evaluation & Audit Log ({evaluation.violations.length} total occurrences)
          </h4>

          <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="py-3 px-3 font-bold">Record ID</th>
                  <th className="py-3 px-3 font-bold">Violated Policy</th>
                  <th className="py-3 px-3 font-bold">Observed vs Threshold</th>
                  <th className="py-3 px-3 font-bold">Status</th>
                  <th className="py-3 px-3 font-bold">Operational Justification / Exception Details</th>
                  <th className="py-3 px-3 font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-mono text-[11px]">
                {evaluation.violations.map((v: RuleViolationItem) => (
                  <tr key={v.violation_id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-800">{v.record_id}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-700 font-sans">{v.rule_name}</td>
                    <td className="py-2.5 px-3 font-mono">
                      <span className="text-rose-600 font-bold">{v.observed_value}</span> &nbsp;
                      <span className="text-slate-500">{v.operator} {v.threshold}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                        v.status === 'Approved Exception'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {v.status === 'Approved Exception' ? <ShieldCheck className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        {v.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-slate-600 font-sans">
                      {v.exception_info ? (
                        <div>
                          <strong className="text-emerald-700">Owner:</strong> {v.exception_info.owner}
                          <br />
                          <strong className="text-slate-500">Reason:</strong> {v.exception_info.reason}
                        </div>
                      ) : (
                        <span className="text-rose-600/80 font-medium">No authorized exception on record</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {v.status !== 'Approved Exception' ? (
                        <button
                          onClick={() => handleAddException(v.record_id, v.rule_id)}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold transition-colors shadow-2xs"
                        >
                          Authorize Exception
                        </button>
                      ) : (
                        <span className="text-emerald-700 text-xs font-semibold flex items-center gap-1 font-sans">
                          <CheckCircle className="w-3.5 h-3.5" /> Approved
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

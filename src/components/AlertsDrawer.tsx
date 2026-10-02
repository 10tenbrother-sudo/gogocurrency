import React, { useState } from 'react';
import {
  AlertRule,
  AlertEvent,
  CurrencyCode,
} from '../types/forex';
import { CURRENCIES, CURRENCY_CODES, getCurrencyConfig, playAlertChime } from '../services/currencyStrengthEngine';
import {
  X,
  Bell,
  Plus,
  Trash2,
  Volume2,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

interface AlertsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  rules: AlertRule[];
  onAddRule: (rule: Omit<AlertRule, 'id'>) => void;
  onToggleRule: (id: string) => void;
  onDeleteRule: (id: string) => void;
  events: AlertEvent[];
  onClearEvents: () => void;
}

export const AlertsDrawer: React.FC<AlertsDrawerProps> = ({
  isOpen,
  onClose,
  rules,
  onAddRule,
  onToggleRule,
  onDeleteRule,
  events,
  onClearEvents,
}) => {
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [condition, setCondition] = useState<'ABOVE' | 'BELOW'>('ABOVE');
  const [threshold, setThreshold] = useState<number>(7.5);

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    onAddRule({
      currency,
      condition,
      threshold: Number(threshold),
      enabled: true,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-md bg-white dark:bg-[#0d121f] border-l border-slate-200 dark:border-slate-800 h-full flex flex-col shadow-2xl overflow-hidden transition-colors">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090d16]">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Strength Alerts Manager
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => playAlertChime('bullish')}
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-cyan-600 dark:text-slate-400 dark:hover:text-cyan-300 rounded transition-colors"
              title="Test Alert Chime"
            >
              <Volume2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Add New Alert Form */}
          <div className="bg-slate-50 dark:bg-[#090d16] p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3">
              Create Alert Rule
            </h4>
            <form onSubmit={handleAdd} className="space-y-3 font-mono text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">
                    Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded p-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    {CURRENCY_CODES.map((c) => (
                      <option key={c} value={c}>
                        {CURRENCIES[c]?.flag || '🌐'} {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">
                    Condition
                  </label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as 'ABOVE' | 'BELOW')}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded p-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="ABOVE">&gt; Exceeds (Bullish)</option>
                    <option value="BELOW">&lt; Falls Below (Bearish)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 mb-1">
                  Threshold Score (0.0 - 10.0)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="1.0"
                    max="9.0"
                    step="0.1"
                    value={threshold}
                    onChange={(e) => setThreshold(parseFloat(e.target.value))}
                    className="flex-1 accent-cyan-500"
                  />
                  <span className="w-12 text-right font-bold text-cyan-600 dark:text-cyan-400 tabular-nums">
                    {threshold.toFixed(1)}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-sans font-semibold rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Alert Rule
              </button>
            </form>
          </div>

          {/* Active Rules List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Configured Rules ({rules.length})
              </h4>
            </div>

            {rules.length === 0 ? (
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 font-mono">
                No active alert rules. Create one above to get notified when strength levels cross.
              </div>
            ) : (
              <div className="space-y-2">
                {rules.map((rule) => {
                  const conf = CURRENCIES[rule.currency] || getCurrencyConfig(rule.currency);
                  return (
                    <div
                      key={rule.id}
                      className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{conf?.flag || '🌐'}</span>
                        <span className="font-bold text-slate-900 dark:text-white">{rule.currency}</span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {rule.condition === 'ABOVE' ? '≥' : '≤'} {rule.threshold.toFixed(1)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onToggleRule(rule.id)}
                          className={`px-2 py-0.5 rounded text-[10px] font-sans font-medium transition-colors ${
                            rule.enabled
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-slate-800 text-slate-500 border border-slate-700'
                          }`}
                        >
                          {rule.enabled ? 'Active' : 'Muted'}
                        </button>
                        <button
                          onClick={() => onDeleteRule(rule.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Triggered Alerts History */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Triggered Log ({events.length})
              </h4>
              {events.length > 0 && (
                <button
                  onClick={onClearEvents}
                  className="text-[11px] text-slate-500 hover:text-slate-300 font-mono"
                >
                  Clear Log
                </button>
              )}
            </div>

            {events.length === 0 ? (
              <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800 text-center text-xs text-slate-500 font-mono">
                No alerts triggered yet.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto font-mono text-xs">
                {events.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-2 bg-slate-900 border border-slate-800/80 rounded flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <div>
                        <span className="font-bold text-white mr-1.5">
                          {evt.currency}
                        </span>
                        <span className="text-slate-400">{evt.message}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 tabular-nums">
                      {new Date(evt.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

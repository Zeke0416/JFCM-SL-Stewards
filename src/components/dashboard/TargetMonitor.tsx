import { Target, CheckCircle2, TrendingUp, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import AnimatedNumber from '../AnimatedNumber';

export default function TargetMonitor({ trackedBudgets, onBudgetClick }: { trackedBudgets: any[], onBudgetClick?: (code: string) => void }) {
  const [tab, setTab] = useState<'INCOME'|'EXPENSE'>('INCOME');

  if (trackedBudgets.length === 0) return null;
  const filtered = trackedBudgets.filter(b => b.type === tab);

  const formatPHP = (val: number) => new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2 }).format(val);

  return (
    <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#27272A] rounded-2xl shadow-sm flex flex-col mt-4 overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-6 py-4 border-b border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#111111] rounded-t-2xl gap-4 shrink-0">
        <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-wide flex items-center gap-2">
          <Target className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Target Matrix YTD
        </h3>
        <div className="flex bg-slate-200 dark:bg-[#1a1a1a] p-1 rounded-xl border border-slate-300 dark:border-slate-800">
          <button onClick={() => setTab('INCOME')} className={`px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all rounded-lg ${tab === 'INCOME' ? 'bg-white dark:bg-[#262626] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>Income</button>
          <button onClick={() => setTab('EXPENSE')} className={`px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all rounded-lg ${tab === 'EXPENSE' ? 'bg-white dark:bg-[#262626] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>Expense</button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-[#27272A]/50">
        {filtered.map(budget => {
          const isExceededExpense = budget.type === 'EXPENSE' && budget.current > budget.target;
          const isSurplusIncome = budget.type === 'INCOME' && budget.current > budget.target;
          const isTargetMet = budget.current >= budget.target;
          const percent = Math.min(budget.percent, 100);
          const varianceAmount = Math.abs(budget.current - budget.target);

          // Determine bar fill color: Orange for normal expenses, Red for exceeded expenses, Emerald for income
          const barColor = isExceededExpense 
            ? 'bg-rose-500' 
            : budget.type === 'EXPENSE' 
              ? 'bg-amber-500' 
              : isSurplusIncome 
                ? 'bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]' 
                : 'bg-emerald-600';

          return (
            <div 
              key={budget.id} 
              onClick={() => onBudgetClick && onBudgetClick(budget.code)}
              className="p-5 hover:bg-slate-50 dark:hover:bg-[#121212] cursor-pointer transition-colors group flex flex-col justify-between gap-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mb-0.5">[{budget.code}]</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[220px]" title={budget.name}>{budget.name}</p>
                </div>
                {isTargetMet && (
                  <div className={`p-1.5 rounded-lg border ${isExceededExpense ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50' : 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50'}`}>
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">₱<AnimatedNumber value={budget.current} formatPHP={true} /></span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">Target: ₱{formatPHP(budget.target)}</span>
                </div>
                
                <div className="relative w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`absolute left-0 top-0 bottom-0 rounded-full transition-all duration-1000 ${barColor}`} 
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>

              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-500 dark:text-slate-400">
                  {isExceededExpense ? (
                    <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 font-bold">
                      <AlertCircle className="h-3 w-3" /> Exceeded by ₱{formatPHP(varianceAmount)}
                    </span>
                  ) : isSurplusIncome ? (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold">
                      <TrendingUp className="h-3 w-3" /> +₱{formatPHP(varianceAmount)} Surplus
                    </span>
                  ) : (
                    <span>In Progress</span>
                  )}
                </span>
                <span className={`font-bold ${isExceededExpense ? 'text-rose-600 dark:text-rose-400' : isSurplusIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>
                  {budget.percent.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
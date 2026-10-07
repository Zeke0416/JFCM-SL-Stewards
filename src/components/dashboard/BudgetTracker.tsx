import { Target, Star } from 'lucide-react';

export default function BudgetTracker({ trackedBudgets, formatPHP, budgetTab, setBudgetTab, onBudgetClick }: { trackedBudgets: any[], formatPHP: (val: number) => string, budgetTab: 'INCOME'|'EXPENSE', setBudgetTab: (val: 'INCOME'|'EXPENSE')=>void, onBudgetClick: (code: string) => void }) {
  if (trackedBudgets.length === 0) return null;

  return (
    <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#27272A] rounded-2xl shadow-sm overflow-hidden flex flex-col mt-4">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-6 py-4 border-b border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#111111] rounded-t-2xl gap-4 shrink-0">
        <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-wide flex items-center gap-2">
          <Target className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Fiscal Targets YTD
        </h3>
        <div className="flex bg-slate-200 dark:bg-[#1a1a1a] p-1 rounded-xl border border-slate-300 dark:border-slate-800">
          <button onClick={() => setBudgetTab('INCOME')} className={`px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all rounded-lg ${budgetTab === 'INCOME' ? 'bg-white dark:bg-[#262626] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>Income</button>
          <button onClick={() => setBudgetTab('EXPENSE')} className={`px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all rounded-lg ${budgetTab === 'EXPENSE' ? 'bg-white dark:bg-[#262626] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>Expense</button>
        </div>
      </div>
      
      <div className="divide-y divide-slate-100 dark:divide-[#27272A]/50">
        {trackedBudgets.filter(b => b.type === budgetTab).map(budget => {
          const isExceededExpense = budget.type === 'EXPENSE' && budget.current > budget.target;
          const isSurplusIncome = budget.type === 'INCOME' && budget.current > budget.target;
          const percent = Math.min(budget.percent, 100);

          return (
            <div 
              key={budget.id} 
              onClick={() => onBudgetClick(budget.code)}
              className="p-4 px-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 hover:bg-slate-50 dark:hover:bg-[#121212] cursor-pointer transition-colors group"
            >
              <div className="w-full sm:w-1/3 min-w-[200px]">
                <p className="text-[10px] font-mono text-slate-400 mb-0.5">[{budget.code}]</p>
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate" title={budget.name}>{budget.name}</p>
              </div>

              <div className="w-full sm:flex-1 flex flex-col justify-center">
                <div className="flex justify-between items-end mb-1.5">
                  <span className="text-xs font-medium tabular-nums text-slate-900 dark:text-white">₱{formatPHP(budget.current)}</span>
                  <span className="text-[10px] text-slate-500 tabular-nums tracking-wide">/ ₱{formatPHP(budget.target)}</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-[#222] h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ${isExceededExpense ? 'bg-rose-500' : isSurplusIncome ? 'bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-emerald-600 dark:bg-emerald-500'}`} 
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>

              <div className="w-full sm:w-24 text-left sm:text-right shrink-0">
                <span className={`text-[11px] font-bold tabular-nums ${isExceededExpense ? 'text-rose-600 dark:text-rose-400' : isSurplusIncome ? 'text-emerald-600 dark:text-emerald-400 flex items-center sm:justify-end gap-1' : 'text-slate-700 dark:text-slate-300'}`}>
                  {isSurplusIncome && <Star className="h-3 w-3 fill-current" />}
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
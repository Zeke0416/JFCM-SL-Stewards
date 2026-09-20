import { Target, Star } from 'lucide-react';

export default function BudgetTracker({ trackedBudgets, formatPHP, budgetTab, setBudgetTab }: { trackedBudgets: any[], formatPHP: (val: number) => string, budgetTab: 'INCOME'|'EXPENSE', setBudgetTab: (val: 'INCOME'|'EXPENSE')=>void }) {
  if (trackedBudgets.length === 0) return null;

  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-brand dark:text-emerald-500" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Budget & Target Tracking YTD</h3>
        </div>
        <div className="flex gap-1.5 p-1 bg-slate-200/70 dark:bg-slate-900 rounded-lg w-fit border border-slate-300 dark:border-slate-800">
          <button onClick={() => setBudgetTab('INCOME')} className={`px-3 py-1.5 rounded-md text-[10px] uppercase tracking-wider font-bold transition-all ${budgetTab === 'INCOME' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-800'}`}>Income Targets</button>
          <button onClick={() => setBudgetTab('EXPENSE')} className={`px-3 py-1.5 rounded-md text-[10px] uppercase tracking-wider font-bold transition-all ${budgetTab === 'EXPENSE' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-800'}`}>Expense Budgets</button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {trackedBudgets.filter(b => b.type === budgetTab).map(budget => {
          const isExceededExpense = budget.type === 'EXPENSE' && budget.current > budget.target;
          const isSurplusIncome = budget.type === 'INCOME' && budget.current > budget.target;
          const remaining = Math.abs(budget.target - budget.current);

          const borderColor = isExceededExpense ? 'border-red-200 dark:border-red-900/50' : isSurplusIncome ? 'border-emerald-300 dark:border-emerald-500/30' : 'border-slate-200 dark:border-[#27272A]';
          const bgColor = isExceededExpense ? 'bg-red-50/30 dark:bg-red-950/10' : isSurplusIncome ? 'bg-emerald-50/10 dark:bg-emerald-900/10' : 'bg-white dark:bg-[#121212]';

          return (
            <div key={budget.id} className={`bento-card ${bgColor} ${borderColor} p-5 flex flex-col justify-between`}>
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">[{budget.code}]</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-[180px]" title={budget.name}>{budget.name}</p>
                    <p className={`text-lg font-black mt-1 ${isExceededExpense ? 'text-red-600' : isSurplusIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>₱{formatPHP(budget.current)}</p>
                  </div>
                  {isExceededExpense ? (
                    <span className="text-xs font-bold px-2 py-1 rounded-md border text-red-700 bg-red-100 border-red-200 shadow-sm">
                      {budget.percent.toFixed(1)}%
                    </span>
                  ) : isSurplusIncome ? (
                    <span className="text-xs font-bold px-2 py-1 rounded-md border text-emerald-800 dark:text-emerald-300 bg-emerald-200 dark:bg-emerald-800/40 border-emerald-300 dark:border-emerald-600 shadow-sm flex items-center gap-1">
                      <Star className="h-3 w-3 fill-current" /> {budget.percent.toFixed(1)}%
                    </span>
                  ) : (
                    <span className={`text-xs font-bold px-2 py-1 rounded-md border ${budgetTab === 'INCOME' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200'}`}>
                      {budget.percent.toFixed(1)}%
                    </span>
                  )}
                </div>
                
                <div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden shadow-inner">
                    <div className={`h-2.5 rounded-full transition-all duration-1000 ease-out ${isExceededExpense ? 'bg-red-500' : budgetTab === 'INCOME' ? 'bg-emerald-500' : 'bg-amber-500'} ${isSurplusIncome ? 'shadow-[0_0_8px_#10b981]' : ''}`} style={{ width: `${Math.min(budget.percent, 100)}%` }}></div>
                  </div>
                </div>
              </div>

              {/* Render distinctly separate footer contexts */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60">
                {isSurplusIncome ? (
                  <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded-lg border border-emerald-100 dark:border-emerald-800/50">
                     <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">Target Met!</span>
                     <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">+₱{formatPHP(remaining)} Surplus</span>
                  </div>
                ) : (
                  <div className="flex justify-between items-center text-[10px]">
                    <p className="text-slate-400 font-medium">Target: ₱{formatPHP(budget.target)}</p>
                    {isExceededExpense ? (
                      <p className="text-red-600 font-bold">Exceeded by ₱{formatPHP(remaining)}</p>
                    ) : budget.current < budget.target ? (
                      <p className="text-slate-400 font-medium italic">₱{formatPHP(remaining)} {budgetTab === 'INCOME' ? 'needed to hit target' : 'remaining'}</p>
                    ) : (
                      <p className="text-slate-500 font-bold">Target exactly met</p>
                    )}
                  </div>
                )}
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}
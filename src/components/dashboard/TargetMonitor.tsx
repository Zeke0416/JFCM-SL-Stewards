import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
interface Budget { id: string; name: string; code: string; type: string; current: number; target: number; percent: number }
const money = (value: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);
export default function TargetMonitor({ trackedBudgets, onBudgetClick }: { trackedBudgets: Budget[]; onBudgetClick?: (code: string) => void }) {
  const [tab, setTab] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const budgets = trackedBudgets.filter(budget => budget.type === tab);
  return <article className="workspace-panel">
    <div className="panel-heading flex-wrap"><div><h2>Budget progress</h2><p>Recorded amounts against your annual targets</p></div><div className="segmented-control" aria-label="Budget type"><button onClick={() => setTab('INCOME')} aria-pressed={tab === 'INCOME'}>Income</button><button onClick={() => setTab('EXPENSE')} aria-pressed={tab === 'EXPENSE'}>Expenses</button></div></div>
    {budgets.length ? <ul className="budget-list">{budgets.map(budget => {
      const exceeded = budget.current > budget.target;
      const variance = Math.abs(budget.current - budget.target);
      const status = exceeded ? `${money(variance)} ${tab === 'EXPENSE' ? 'over budget' : 'above target'}` : `${money(variance)} remaining`;
      return <li key={budget.id}><button onClick={() => onBudgetClick?.(budget.code)} className="budget-row" aria-label={`${budget.name}, ${status}. View transactions`}>
        <span className="budget-name"><strong>{budget.name}</strong><span>{budget.code}</span></span>
        <span className="budget-amount"><strong className="tabular-nums">{money(budget.current)}</strong><span>of {money(budget.target)}</span></span>
        <span className="budget-progress"><span className="budget-track"><span className={exceeded && tab === 'EXPENSE' ? 'over-budget' : ''} style={{ width:`${Math.max(0, Math.min(budget.percent, 100))}%` }} /></span><span className={exceeded && tab === 'EXPENSE' ? 'text-rose-600 dark:text-rose-300' : ''}>{status}</span></span>
        <ChevronRight size={17} className="text-light-textSecondary dark:text-dark-textSecondary" />
      </button></li>;
    })}</ul> : <div className="empty-panel"><strong>No {tab === 'INCOME' ? 'income' : 'expense'} targets configured</strong><span>Targets for this financial year will appear here.</span></div>}
  </article>;
}

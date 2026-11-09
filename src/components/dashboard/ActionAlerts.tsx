import { CheckCircle2, ChevronRight, AlertCircle, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
interface ReminderInfo { isOverdue: boolean; periodId: string; periodName: string }
interface Props { unassignedCount: number; recentLogs: any[]; mprReminder?: ReminderInfo | null; mrReminder?: ReminderInfo | null; onOpenTransactionLogs: () => void }
export default function ActionAlerts({ unassignedCount, recentLogs, mprReminder, mrReminder, onOpenTransactionLogs }: Props) {
  const navigate = useNavigate();
  const openPeriod = (path: string, key: string, id: string) => { localStorage.setItem(key, id); navigate(path); };
  const priorities = [
    ...(mprReminder ? [{ title: 'Missionary report', detail: `${mprReminder.periodName} · ${mprReminder.isOverdue ? 'Overdue' : 'Awaiting submission'}`, overdue: mprReminder.isOverdue, action: () => openPeriod('/missionary-report', 'mpr_period', mprReminder.periodId) }] : []),
    ...(mrReminder ? [{ title: 'Period reconciliation', detail: `${mrReminder.periodName} · ${mrReminder.isOverdue ? 'Overdue' : 'Open for review'}`, overdue: mrReminder.isOverdue, action: () => openPeriod('/mission-readiness', 'mr_period', mrReminder.periodId) }] : []),
    ...(unassignedCount ? [{ title: 'Categorize transactions', detail: `${unassignedCount} records need a category`, overdue: false, action: () => navigate('/transactions') }] : []),
  ];
  return <div className="dashboard-work-grid">
    <article className="workspace-panel"><div className="panel-heading"><div><h2>Needs attention</h2><p>Your next steps for this financial year</p></div><span className="count-badge">{priorities.length}</span></div>
      {priorities.length ? <ul className="attention-list">{priorities.map(item => <li key={item.title}><button onClick={item.action}><AlertCircle size={19} className={item.overdue ? 'text-rose-600' : 'text-amber-600'} /><span className="flex-1 min-w-0"><strong>{item.title}</strong><span>{item.detail}</span></span><ChevronRight size={17} /></button></li>)}</ul> : <div className="empty-panel"><CheckCircle2 size={25} className="text-brand dark:text-brand-glow" /><strong>No pending reminders</strong><span>Reporting and category reminders will appear here.</span></div>}
    </article>
    <article className="workspace-panel"><div className="panel-heading"><div><h2>Recent activity</h2><p>Latest recorded changes</p></div><button onClick={onOpenTransactionLogs} className="quiet-button"><History size={16} /> History</button></div>
      {recentLogs.length ? <ul className="activity-list">{recentLogs.slice(0, 4).map(log => <li key={log.id}><span className={`activity-dot ${log.action === 'DELETE' ? 'deleted' : ''}`} /><div className="flex-1 min-w-0"><strong className="block truncate">{log.new_data?.payee_name || log.old_data?.payee_name || 'Transaction updated'}</strong><span>{log.action === 'INSERT' ? 'Recorded' : log.action === 'DELETE' ? 'Deleted' : 'Updated'} · {new Date(log.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</span></div><span className="activity-amount tabular-nums">{new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(log.new_data?.amount ?? log.old_data?.amount ?? 0))}</span></li>)}</ul> : <div className="empty-panel"><History size={25} /><strong>No activity yet</strong><span>Recorded changes will appear here.</span></div>}
    </article>
  </div>;
}

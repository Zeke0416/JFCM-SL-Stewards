import { AlertTriangle, CheckCircle2, FileCheck, ArrowUpRight, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ActionAlerts({ unassignedCount, isReady, recentLogs }: { unassignedCount: number, isReady: boolean, recentLogs: any[] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Dynamic Alerts Column */}
      <div className="space-y-4 lg:col-span-2">
        {unassignedCount > 0 ? (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-5 rounded-2xl flex items-start gap-4 shadow-sm animate-pulse">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-xl"><AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" /></div>
            <div>
              <h3 className="text-sm font-bold text-amber-900 dark:text-amber-300">Action Required: Category Review</h3>
              <p className="text-xs text-amber-700 dark:text-amber-400/80 mt-1 mb-2">There are {unassignedCount} unassigned transactions pending review.</p>
              <Link to="/transactions" className="text-xs font-bold text-amber-800 dark:text-amber-200 hover:underline">Resolve in Ledger →</Link>
            </div>
          </div>
        ) : (
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-5 rounded-2xl flex items-start gap-4 shadow-sm">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl"><CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" /></div>
            <div>
              <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-300">Ledger fully categorized</h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-400/80 mt-1 mb-2">All transactions map perfectly to the Chart of Accounts.</p>
            </div>
          </div>
        )}

        <div className="bento-card bg-white dark:bg-[#121212] flex flex-col justify-between space-y-4 border border-slate-200 dark:border-[#27272A]">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2"><FileCheck className="h-4 w-4 text-brand dark:text-emerald-500" /> Readiness Status</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Automated ComBud checks.</p>
            </div>
            <Link to="/mission-readiness" className="text-[10px] font-bold text-brand hover:underline flex items-center gap-1">Open <ArrowUpRight className="h-3 w-3" /></Link>
          </div>
          <div className="flex gap-4">
            <div className="flex-1 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Cash Reconciliation</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${isReady ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20' : 'bg-slate-200 text-slate-500 dark:bg-slate-800'}`}>{isReady ? 'Passed' : 'Pending'}</span>
            </div>
            <div className="flex-1 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Missing Receipts</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${isReady ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20' : 'bg-slate-200 text-slate-500 dark:bg-slate-800'}`}>{isReady ? 'Clear' : 'Check'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Latest Activity Logs */}
      <div className="bento-card bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#27272A] flex flex-col">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4"><Activity className="h-4 w-4 text-blue-500" /> Live Database Activity</h3>
        <div className="flex-1 space-y-3 overflow-hidden">
          {recentLogs.length > 0 ? recentLogs.map((log: any) => (
            <div key={log.id} className="flex gap-3 items-start border-l-2 border-slate-200 dark:border-slate-700 pl-3 py-1">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 rounded ${log.action === 'INSERT' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' : log.action === 'DELETE' ? 'bg-red-100 text-red-700 dark:bg-red-900/30' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30'}`}>{log.action}</span>
                  <span className="text-[9px] text-slate-400">{new Date(log.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate w-full max-w-[200px]">{log.new_data ? log.new_data.payee_name || log.new_data.remarks : log.old_data?.payee_name || 'Record'}</p>
                <p className="text-[10px] font-mono text-slate-500">₱{log.new_data?.amount || log.old_data?.amount}</p>
              </div>
            </div>
          )) : <p className="text-xs text-slate-500 italic mt-4">Waiting for new events...</p>}
        </div>
      </div>
    </div>
  );
}
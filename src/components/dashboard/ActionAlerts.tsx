import { useState, useEffect } from 'react';
import { AlertTriangle, FileText, Activity, Server, ArrowRight, ChevronLeft, ChevronRight, Terminal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ReminderInfo {
  isOverdue: boolean;
  periodId: string;
  periodName: string;
}

interface ActionAlertsProps {
  unassignedCount: number;
  recentLogs: any[];
  mprReminder?: ReminderInfo | null;
  mrReminder?: ReminderInfo | null;
  onOpenTransactionLogs: () => void;
}

export default function ActionAlerts({ unassignedCount, recentLogs, mprReminder, mrReminder, onOpenTransactionLogs }: ActionAlertsProps) {
  const navigate = useNavigate();
  const [activePriorityIndex, setActivePriorityIndex] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  const handleQuickAccess = (path: string, periodId: string, storageKey: string) => {
    localStorage.setItem(storageKey, periodId);
    navigate(path);
  };

  const todayString = new Date().toDateString();
  const todaysLogs = recentLogs.filter(log => new Date(log.created_at).toDateString() === todayString).slice(0, 6);

  const priorities: Array<{ id: string; type: string; title: string; desc: string; actionText: string; onClick: () => void; isOverdue?: boolean }> = [];

  if (mprReminder) {
    priorities.push({
      id: 'mpr',
      type: mprReminder.isOverdue ? 'Overdue' : 'Due Soon',
      title: mprReminder.isOverdue ? 'Overdue: MPR Report' : 'Due Soon: MPR Report',
      desc: `Submission for ${mprReminder.periodName} is pending.`,
      actionText: 'Open Report',
      isOverdue: mprReminder.isOverdue,
      onClick: () => handleQuickAccess('/mission-report', mprReminder.periodId, 'mpr_period')
    });
  }

  if (mrReminder) {
    priorities.push({
      id: 'mr',
      type: mrReminder.isOverdue ? 'Overdue' : 'Pending',
      title: mrReminder.isOverdue ? 'Overdue: Audit Lock' : 'Pending: Reconciliation',
      desc: `Cash reconciliation for ${mrReminder.periodName} is unlocked.`,
      actionText: 'Execute Reconciliation',
      isOverdue: mrReminder.isOverdue,
      onClick: () => handleQuickAccess('/mission-readiness', mrReminder.periodId, 'mr_period')
    });
  }

  if (unassignedCount > 0) {
    priorities.push({
      id: 'unassigned',
      type: 'Unclassified',
      title: 'Unclassified Records',
      desc: `Detected ${unassignedCount} raw transactions requiring categorization.`,
      actionText: 'View Ledger',
      isOverdue: false,
      onClick: () => navigate('/transactions')
    });
  }

  useEffect(() => {
    if (priorities.length <= 1) return;
    const interval = setInterval(() => {
      setActivePriorityIndex(prev => {
        setAnimKey(k => k + 1);
        return (prev + 1) % priorities.length;
      });
    }, 6000);
    return () => clearInterval(interval);
  }, [priorities.length]);

  const handleSwitch = (index: number) => {
    setAnimKey(k => k + 1);
    setActivePriorityIndex(index);
  };

  const currentPriority = priorities[activePriorityIndex] || priorities[0];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
      <style>{`
        @keyframes slideLeftInfinite {
          0% { transform: translateX(40px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-left {
          animation: slideLeftInfinite 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
      
      {/* Priority Operations Queue */}
      <div className="xl:col-span-5 bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#27272A] rounded-2xl shadow-sm flex flex-col h-[280px] relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#f59e0b03_1px,transparent_1px),linear-gradient(to_bottom,#f59e0b03_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
        
        {/* Added rounded-t-2xl here */}
        <div className="px-5 py-3 border-b border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#111111] flex justify-between items-center shrink-0 relative z-10 rounded-t-2xl">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-wider flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 animate-pulse" /> Priority Operations
          </h3>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping"></span>
            <span className="text-[10px] font-mono font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-widest">{priorities.length.toString().padStart(2, '0')} PENDING</span>
          </div>
        </div>
        
        <div className="flex-1 p-4 flex flex-col justify-between overflow-hidden relative z-10">
          {priorities.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4">
               <Server className="h-6 w-6 text-emerald-500 mb-1 opacity-80" />
               <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">System Clear</p>
               <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">No operational interventions required.</p>
            </div>
          ) : (
            <div key={animKey} className="p-4 rounded-xl bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-[#222222] relative overflow-hidden shadow-sm animate-slide-left flex-1 flex flex-col justify-between">
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${currentPriority.isOverdue ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'}`}></div>
              <div>
                <h4 className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${currentPriority.isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {currentPriority.title}
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">{currentPriority.desc}</p>
              </div>

              <div className="flex justify-between items-center mt-2">
                <button onClick={currentPriority.onClick} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-800 dark:text-white bg-white dark:bg-[#1A1A1A] hover:bg-slate-100 dark:hover:bg-[#222] px-3 py-1.5 rounded-lg transition-colors border border-slate-200 dark:border-[#333] shadow-sm group">
                  {currentPriority.actionText} <ArrowRight className="h-3 w-3 text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
                </button>

                {priorities.length > 1 && (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleSwitch((activePriorityIndex - 1 + priorities.length) % priorities.length)}
                      className="p-1 rounded bg-slate-200 dark:bg-[#1A1A1A] hover:bg-slate-300 dark:hover:bg-[#262626] text-slate-700 dark:text-slate-300 transition-colors"
                      title="Previous Priority"
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </button>
                    <div className="flex gap-1">
                      {priorities.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSwitch(idx)}
                          className={`h-1.5 rounded-full transition-all duration-300 ${idx === activePriorityIndex ? 'w-5 bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.8)]' : 'w-1.5 bg-slate-300 dark:bg-[#333] hover:bg-slate-400'}`}
                        />
                      ))}
                    </div>
                    <button 
                      onClick={() => handleSwitch((activePriorityIndex + 1) % priorities.length)}
                      className="p-1 rounded bg-slate-200 dark:bg-[#1A1A1A] hover:bg-slate-300 dark:hover:bg-[#262626] text-slate-700 dark:text-slate-300 transition-colors"
                      title="Next Priority"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Live Transaction Activity */}
      <div className="xl:col-span-7 bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#27272A] rounded-2xl shadow-sm flex flex-col h-[280px]">
        {/* Added rounded-t-2xl here */}
        <div className="px-5 py-3 border-b border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#111111] flex justify-between items-center shrink-0 rounded-t-2xl">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-wider flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />Transaction Activity
          </h3>
          <div className="flex items-center gap-3">
            <button 
              onClick={onOpenTransactionLogs}
              className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-500/30 transition-all shadow-sm"
              title="Open Full Transaction Logs Modal"
            >
              <Terminal className="h-3 w-3" /> Activity History
            </button>
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase">Today's Feed</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
          {todaysLogs.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-[#27272A]/50">
              {todaysLogs.map((log: any) => (
                <div key={log.id} className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-[#141414] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${log.action === 'INSERT' ? 'bg-emerald-500' : log.action === 'DELETE' ? 'bg-rose-500' : 'bg-emerald-600'}`} />
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-slate-800 dark:text-slate-200 truncate">
                        {log.new_data ? log.new_data.payee_name || log.new_data.remarks : log.old_data?.payee_name || 'Record Modified'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded ${log.action === 'INSERT' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : log.action === 'DELETE' ? 'bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400' : 'bg-slate-100 dark:bg-emerald-500/10 text-slate-700 dark:text-emerald-400'}`}>
                          {log.action}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                          {new Date(log.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] font-mono font-bold text-slate-900 dark:text-white tracking-tight">
                      ₱{Number(log.new_data?.amount || log.old_data?.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
             <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-1">
               <FileText className="h-6 w-6 text-slate-400 dark:text-slate-600 mb-1" />
               <p className="text-[11px] font-mono uppercase tracking-widest text-slate-500 dark:text-slate-400">No activity recorded today.</p>
            </div>
          )}
        </div>
      </div>
      
    </div>
  );
}
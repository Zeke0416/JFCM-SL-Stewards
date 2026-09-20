import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { X, Activity, Loader2, ArrowRight, ServerCrash } from 'lucide-react';
import type { TransactionLog } from '../types/database.types';

interface TransactionLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  churchId: string;
}

export default function TransactionLogsModal({ isOpen, onClose, churchId }: TransactionLogsModalProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) fetchLogs();
  }, [isOpen]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // FIX: Fetch logs and profiles separately to avoid breaking on unresolved foreign keys
      const { data: logsData, error } = await supabase
        .from('transaction_logs')
        .select('*')
        .eq('church_id', churchId)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;

      if (logsData && logsData.length > 0) {
        const userIds = [...new Set(logsData.map(l => l.changed_by).filter(Boolean))];
        const profilesMap: Record<string, string> = {};

        if (userIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds);
          
          profilesData?.forEach(p => {
             profilesMap[p.id] = p.full_name;
          });
        }

        const enrichedLogs = logsData.map(log => ({
          ...log,
          changed_by: { full_name: profilesMap[log.changed_by] || 'System / Unknown' }
        }));

        setLogs(enrichedLogs);
      } else {
        setLogs([]);
      }
    } catch (err) {
      console.error("Error fetching logs:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
      <div className="w-full max-w-5xl bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#27272A] rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-modal">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-[#0A0A0A]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/40 rounded-xl text-blue-600 dark:text-blue-400">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Database Event Logs</h3>
              <p className="text-xs text-slate-500 mt-0.5">Immutable tracking of Insertions, Updates, and Deletions.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-2 rounded-xl"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-0 bg-slate-50/50 dark:bg-[#121212]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin mb-4 text-brand" />
              <span className="text-xs font-bold">Querying database events...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
              <div className="p-4 bg-slate-100 dark:bg-slate-900 rounded-full text-slate-300 dark:text-slate-700">
                <ServerCrash className="h-12 w-12" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">No Event Logs Found</h4>
                <p className="text-xs text-slate-500 max-w-sm mt-1">The system has not recorded any insertions, updates, or deletions yet. Tracking will begin automatically.</p>
              </div>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap min-w-[800px]">
              <thead className="sticky top-0 bg-white dark:bg-[#121212] border-b border-slate-200 dark:border-[#27272A] z-10">
                <tr className="text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">Action</th>
                  <th className="p-4">User</th>
                  <th className="p-4">Transaction Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#27272A]/50">
                {logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="p-4 font-mono text-[10px] text-slate-500">{new Date(log.created_at).toLocaleString()}</td>
                    <td className="p-4">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${log.action === 'INSERT' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400' : log.action === 'DELETE' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4 font-medium text-slate-700 dark:text-slate-300">{log.changed_by?.full_name || 'System / Unknown'}</td>
                    <td className="p-4">
                      {log.action === 'UPDATE' ? (
                        <div className="flex items-center gap-3 max-w-[400px] overflow-hidden text-[10px] font-mono">
                          <span className="text-red-500 truncate block">₱{log.old_data?.amount} | {log.old_data?.payee_name || 'N/A'}</span>
                          <ArrowRight className="h-3 w-3 shrink-0 text-slate-400" />
                          <span className="text-emerald-500 truncate block">₱{log.new_data?.amount} | {log.new_data?.payee_name || 'N/A'}</span>
                        </div>
                      ) : (
                        <div className="text-[10px] font-mono text-slate-500 truncate max-w-[400px]">
                           {log.new_data ? `₱${log.new_data.amount} | ${log.new_data.remarks || log.new_data.payee_name}` : `₱${log.old_data?.amount} | Deleted`}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
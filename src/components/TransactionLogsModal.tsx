import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { X, Activity, Loader2, ArrowRight, ServerCrash, Fingerprint, FileSpreadsheet } from 'lucide-react';
import { exportLogsToExcel } from '../utils/exportLogsToExcel';

interface TransactionLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  churchId: string;
}

export default function TransactionLogsModal({ isOpen, onClose, churchId }: TransactionLogsModalProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [catMap, setCatMap] = useState<Map<string, string>>(new Map());
  const [profMap, setProfMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (isOpen) fetchLogs();
  }, [isOpen]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data: cats } = await supabase.from('categories').select('id, name, export_code').eq('church_id', churchId);
      const cMap = new Map(cats?.map(c => [c.id, `[${c.export_code}] ${c.name}`]) || []);
      cMap.set('unassigned', '[???] Unassigned / For Review');
      setCatMap(cMap);

      const { data: logsData, error } = await supabase
        .from('transaction_logs')
        .select('*')
        .eq('church_id', churchId)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;

      if (logsData && logsData.length > 0) {
        const userIds = new Set<string>();
        logsData.forEach(l => {
          if (l.changed_by) userIds.add(l.changed_by);
          if (l.old_data?.entered_by) userIds.add(l.old_data.entered_by);
          if (l.new_data?.entered_by) userIds.add(l.new_data.entered_by);
        });

        const pMap = new Map<string, string>();
        if (userIds.size > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', Array.from(userIds));
          
          profilesData?.forEach(p => {
             pMap.set(p.id, p.full_name);
          });
        }
        setProfMap(pMap);

        const enrichedLogs = logsData.map(log => ({
          ...log,
          changed_by_name: pMap.get(log.changed_by) || 'System / Unknown'
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

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportLogsToExcel(logs, catMap, profMap);
    } catch (err) {
      console.error("Failed to export logs:", err);
      alert("Failed to export logs to Excel.");
    } finally {
      setExporting(false);
    }
  };

  const renderLogDetails = (log: any) => {
    const oldData = log.old_data || {};
    const newData = log.new_data || {};

    const oldCat = catMap.get(oldData.category_id) || '[???] Unassigned / For Review';
    const newCat = catMap.get(newData.category_id) || '[???] Unassigned / For Review';
    
    const originalEncoderId = oldData.entered_by || newData.entered_by;
    const originalEncoder = profMap.get(originalEncoderId) || 'System';

    if (log.action === 'INSERT') {
      return (
        <div className="space-y-1">
           <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mb-2">Record Originally Created</div>
           <div className="text-[10px] text-slate-500">Original Encoder: <span className="font-bold text-slate-700 dark:text-slate-300">{originalEncoder}</span></div>
           <div className="text-[10px] text-slate-500">Transaction Date: <span className="font-bold text-slate-700 dark:text-slate-300">{newData.date}</span></div>
           <div className="text-[10px] text-slate-500 whitespace-pre-wrap break-words">Account: <span className="font-mono text-slate-700 dark:text-slate-300">{newCat}</span></div>
           <div className="text-[10px] text-slate-500">Amount: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">₱{Number(newData.amount).toLocaleString('en-PH', {minimumFractionDigits: 2})}</span></div>
        </div>
      );
    }

    if (log.action === 'UPDATE') {
      return (
        <div className="space-y-2">
           <div className="text-[10px] text-blue-600 dark:text-blue-400 font-bold mb-2">Record Modified</div>
           <div className="text-[10px] text-slate-500 flex flex-wrap gap-2 items-center bg-slate-100 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-200 dark:border-slate-800 mb-2">
              <span className="shrink-0">Orig. Encoder: <strong>{originalEncoder}</strong></span>
              <ArrowRight className="h-3 w-3 shrink-0 text-slate-400" />
              <span className="shrink-0 text-blue-600 dark:text-blue-400">Edited by: <strong>{log.changed_by_name}</strong></span>
           </div>
           
           {oldData.date !== newData.date && (
             <div className="text-[10px] flex items-start gap-2">
                <span className="text-slate-400 w-16 shrink-0 mt-0.5">Tx Date:</span>
                <span className="text-red-400 dark:text-red-400/80 line-through shrink-0 flex-1 whitespace-pre-wrap break-words">{oldData.date}</span>
                <ArrowRight className="h-3 w-3 text-slate-500 shrink-0 mt-0.5" />
                <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0 flex-1 whitespace-pre-wrap break-words">{newData.date}</span>
             </div>
           )}

           {oldData.category_id !== newData.category_id && (
             <div className="text-[10px] flex items-start gap-2">
                <span className="text-slate-400 w-16 shrink-0 mt-0.5">Account:</span>
                <span className="text-red-400 dark:text-red-400/80 line-through flex-1 whitespace-pre-wrap break-words">{oldCat}</span>
                <ArrowRight className="h-3 w-3 text-slate-500 shrink-0 mt-0.5" />
                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex-1 whitespace-pre-wrap break-words">{newCat}</span>
             </div>
           )}

           {Number(oldData.amount) !== Number(newData.amount) && (
             <div className="text-[10px] flex items-start gap-2">
                <span className="text-slate-400 w-16 shrink-0 mt-0.5">Amount:</span>
                <span className="text-red-400 dark:text-red-400/80 line-through shrink-0 flex-1 whitespace-pre-wrap break-words">₱{Number(oldData.amount).toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>
                <ArrowRight className="h-3 w-3 text-slate-500 shrink-0 mt-0.5" />
                <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0 flex-1 whitespace-pre-wrap break-words">₱{Number(newData.amount).toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>
             </div>
           )}
           
           {oldData.payee_name !== newData.payee_name && (
             <div className="text-[10px] flex items-start gap-2">
                <span className="text-slate-400 w-16 shrink-0 mt-0.5">Payee:</span>
                <span className="text-red-400 dark:text-red-400/80 line-through flex-1 whitespace-pre-wrap break-words">{oldData.payee_name || 'N/A'}</span>
                <ArrowRight className="h-3 w-3 text-slate-500 shrink-0 mt-0.5" />
                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex-1 whitespace-pre-wrap break-words">{newData.payee_name || 'N/A'}</span>
             </div>
           )}

           {oldData.remarks !== newData.remarks && (
             <div className="text-[10px] flex items-start gap-2">
                <span className="text-slate-400 w-16 shrink-0 mt-0.5">Remarks:</span>
                <span className="text-red-400 dark:text-red-400/80 line-through flex-1 whitespace-pre-wrap break-words">{oldData.remarks || 'N/A'}</span>
                <ArrowRight className="h-3 w-3 text-slate-500 shrink-0 mt-0.5" />
                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex-1 whitespace-pre-wrap break-words">{newData.remarks || 'N/A'}</span>
             </div>
           )}
        </div>
      );
    }

    if (log.action === 'DELETE') {
      return (
        <div className="space-y-1">
           <div className="text-[10px] text-red-600 dark:text-red-400 font-bold mb-2">Record Permanently Deleted</div>
           <div className="text-[10px] text-slate-500">Deleted by: <span className="font-bold text-slate-700 dark:text-slate-300">{log.changed_by_name}</span></div>
           <div className="text-[10px] text-slate-500">Original Encoder: <span className="font-bold text-slate-700 dark:text-slate-300">{originalEncoder}</span></div>
           <div className="text-[10px] text-slate-500">Tx Date: <span className="font-bold text-slate-700 dark:text-slate-300">{oldData.date}</span></div>
           <div className="text-[10px] text-slate-500 whitespace-pre-wrap break-words">Account: <span className="font-mono text-slate-700 dark:text-slate-300">{oldCat}</span></div>
           <div className="text-[10px] text-slate-500">Amount: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">₱{Number(oldData.amount).toLocaleString('en-PH', {minimumFractionDigits: 2})}</span></div>
        </div>
      );
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
      <div className="w-full max-w-6xl bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#27272A] rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-modal">
        
        {/* Modal Header */}
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
          <div className="flex items-center gap-3">
            <button 
              onClick={handleExport} 
              disabled={loading || exporting || logs.length === 0}
              className="flex items-center gap-2 text-white bg-brand dark:bg-emerald-700 hover:bg-brand-dark dark:hover:bg-emerald-800 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md disabled:opacity-50"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} 
              {exporting ? 'Exporting...' : 'Export to Excel'}
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-2 rounded-xl bg-slate-100 dark:bg-[#1A1A1A] transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
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
            <table className="w-full text-left border-collapse text-xs min-w-[900px]">
              <thead className="sticky top-0 bg-white dark:bg-[#121212] border-b border-slate-200 dark:border-[#27272A] z-10 shadow-sm">
                <tr className="text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                  <th className="p-4 w-40">Event Timestamp</th>
                  <th className="p-4 w-28">Action</th>
                  <th className="p-4 w-40">Active User</th>
                  <th className="p-4">Detailed Audit Changes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#27272A]/50">
                {logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-[#1A1A1C] transition-colors">
                    <td className="p-4 font-mono text-[10px] text-slate-500 dark:text-slate-400 align-top">
                      <div className="flex flex-col gap-1.5 items-start">
                        <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md font-bold text-slate-600 dark:text-slate-300 tracking-wide uppercase">
                          <Fingerprint className="h-3 w-3" /> SYS_LOG
                        </span>
                        <span className="whitespace-normal break-words">{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="p-4 align-top">
                      <span className={`inline-flex px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${log.action === 'INSERT' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400' : log.action === 'DELETE' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4 font-medium text-slate-700 dark:text-slate-300 align-top break-words whitespace-normal">
                      {log.changed_by_name}
                    </td>
                    <td className="p-4 align-top w-full max-w-full">
                      {renderLogDetails(log)}
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
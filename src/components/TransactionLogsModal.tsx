import { ReportIcon as FileSpreadsheet } from './ui/StewardGlyph';
import { useFeedback } from './ui/useFeedback';
import DialogLayer from './ui/DialogLayer';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { X, Activity, Loader2, ArrowRight, ServerCrash } from 'lucide-react';
import { exportLogsToExcel } from '../utils/exportLogsToExcel';

interface TransactionLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  churchId: string;
}

export default function TransactionLogsModal({ isOpen, onClose, churchId }: TransactionLogsModalProps) {
  const { notify } = useFeedback();
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
      notify("Failed to export logs to Excel.");
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
           <div className="text-xs editor-accent font-bold mb-2">Record Originally Created</div>
           <div className="text-xs text-slate-500">Original Encoder: <span className="font-bold text-slate-700 dark:text-slate-300">{originalEncoder}</span></div>
           <div className="text-xs text-slate-500">Transaction Date: <span className="font-bold text-slate-700 dark:text-slate-300">{newData.date}</span></div>
           <div className="text-xs text-slate-500 whitespace-pre-wrap break-words">Account: <span className="font-mono text-slate-700 dark:text-slate-300">{newCat}</span></div>
           <div className="text-xs text-slate-500">Amount: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">₱{Number(newData.amount).toLocaleString('en-PH', {minimumFractionDigits: 2})}</span></div>
        </div>
      );
    }

    if (log.action === 'UPDATE') {
      return (
        <div className="space-y-2">
           <div className="text-xs text-sky-600 dark:text-sky-400 font-bold mb-2">Record Modified</div>
           <div className="text-xs text-slate-500 flex flex-wrap gap-2 items-center bg-slate-50 dark:bg-dark-elevated p-2.5 rounded-xl border border-slate-200 dark:border-dark-border mb-2">
              <span className="shrink-0">Orig. Encoder: <strong>{originalEncoder}</strong></span>
              <ArrowRight className="h-3 w-3 shrink-0 text-slate-400" />
              <span className="shrink-0 text-sky-600 dark:text-sky-400">Edited by: <strong>{log.changed_by_name}</strong></span>
           </div>
           
           {oldData.date !== newData.date && (
             <div className="text-xs flex items-start gap-2">
                <span className="text-slate-400 w-16 shrink-0 mt-0.5">Tx Date:</span>
                <span className="text-rose-500 dark:text-rose-400/80 line-through shrink-0 flex-1 whitespace-pre-wrap break-words">{oldData.date}</span>
                <ArrowRight className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" />
                <span className="editor-accent font-bold shrink-0 flex-1 whitespace-pre-wrap break-words">{newData.date}</span>
             </div>
           )}

           {oldData.category_id !== newData.category_id && (
             <div className="text-xs flex items-start gap-2">
                <span className="text-slate-400 w-16 shrink-0 mt-0.5">Account:</span>
                <span className="text-rose-500 dark:text-rose-400/80 line-through flex-1 whitespace-pre-wrap break-words">{oldCat}</span>
                <ArrowRight className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" />
                <span className="editor-accent font-bold flex-1 whitespace-pre-wrap break-words">{newCat}</span>
             </div>
           )}

           {Number(oldData.amount) !== Number(newData.amount) && (
             <div className="text-xs flex items-start gap-2">
                <span className="text-slate-400 w-16 shrink-0 mt-0.5">Amount:</span>
                <span className="text-rose-500 dark:text-rose-400/80 line-through shrink-0 flex-1 whitespace-pre-wrap break-words">₱{Number(oldData.amount).toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>
                <ArrowRight className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" />
                <span className="editor-accent font-bold shrink-0 flex-1 whitespace-pre-wrap break-words">₱{Number(newData.amount).toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>
             </div>
           )}
           
           {oldData.payee_name !== newData.payee_name && (
             <div className="text-xs flex items-start gap-2">
                <span className="text-slate-400 w-16 shrink-0 mt-0.5">Payee:</span>
                <span className="text-rose-500 dark:text-rose-400/80 line-through flex-1 whitespace-pre-wrap break-words">{oldData.payee_name || 'N/A'}</span>
                <ArrowRight className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" />
                <span className="editor-accent font-bold flex-1 whitespace-pre-wrap break-words">{newData.payee_name || 'N/A'}</span>
             </div>
           )}

           {oldData.remarks !== newData.remarks && (
             <div className="text-xs flex items-start gap-2">
                <span className="text-slate-400 w-16 shrink-0 mt-0.5">Remarks:</span>
                <span className="text-rose-500 dark:text-rose-400/80 line-through flex-1 whitespace-pre-wrap break-words">{oldData.remarks || 'N/A'}</span>
                <ArrowRight className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" />
                <span className="editor-accent font-bold flex-1 whitespace-pre-wrap break-words">{newData.remarks || 'N/A'}</span>
             </div>
           )}
        </div>
      );
    }

    if (log.action === 'DELETE') {
      return (
        <div className="space-y-1">
           <div className="text-xs text-rose-600 dark:text-rose-400 font-bold mb-2">Record Permanently Deleted</div>
           <div className="text-xs text-slate-500">Deleted by: <span className="font-bold text-slate-700 dark:text-slate-300">{log.changed_by_name}</span></div>
           <div className="text-xs text-slate-500">Original Encoder: <span className="font-bold text-slate-700 dark:text-slate-300">{originalEncoder}</span></div>
           <div className="text-xs text-slate-500">Tx Date: <span className="font-bold text-slate-700 dark:text-slate-300">{oldData.date}</span></div>
           <div className="text-xs text-slate-500 whitespace-pre-wrap break-words">Account: <span className="font-mono text-slate-700 dark:text-slate-300">{oldCat}</span></div>
           <div className="text-xs text-slate-500">Amount: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">₱{Number(oldData.amount).toLocaleString('en-PH', {minimumFractionDigits: 2})}</span></div>
        </div>
      );
    }
  };

  if (!isOpen) return null;

  return createPortal(<DialogLayer onDismiss={onClose} label="Transaction audit history"><div className="dialog-surface audit-history">
    <header className="dialog-header reference-header"><span className="reference-icon"><Activity size={20}/></span><div><h3>Transaction audit history</h3><p>Review who changed a record, when, and what changed.</p></div><button className="button-secondary" onClick={handleExport} aria-busy={exporting} disabled={loading || exporting || !logs.length}>{exporting?<Loader2 size={16} className="animate-spin"/>:<FileSpreadsheet size={16}/>}<span>{exporting?'Exporting…':'Export to Excel'}</span></button><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19}/></button></header>
    <div className="dialog-body audit-events">{loading?<div className="empty-panel"><Loader2 className="animate-spin"/>Loading audit history…</div>:!logs.length?<div className="empty-panel"><ServerCrash/><strong>No audit events recorded</strong><span>Recorded changes will appear here.</span></div>:logs.map((log:any)=><article className="audit-event" key={log.id}><div className="audit-event-meta"><span className={`audit-action action-${log.action.toLowerCase()}`}>{log.action==='INSERT'?'Created':log.action==='DELETE'?'Deleted':'Updated'}</span><time dateTime={log.created_at}>{new Date(log.created_at).toLocaleString()}</time><span>By <strong>{log.changed_by_name}</strong></span></div><div className="audit-event-details">{renderLogDetails(log)}</div></article>)}</div>
    <footer className="dialog-footer reference-footer">{logs.length} recorded events</footer>
  </div></DialogLayer>,document.body);
}

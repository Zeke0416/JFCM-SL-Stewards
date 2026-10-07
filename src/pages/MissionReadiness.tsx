import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle2, AlertTriangle, ShieldCheck, FileCheck, HelpCircle, Loader2, Save, Copy, Check, X, AlertOctagon, Activity, ServerCrash, ArrowRight, SearchCode, ChevronDown } from 'lucide-react';
import SmartDiagnosisModal from '../components/SmartDiagnosisModal';

let mrMemoryCache: any = null;

type ReconState = {
  beginning_balance: number;
  cib_savings: number;
  cib_current: number;
  cib_time_deposit: number;
  coh_petty_cash: number;
  coh_undeposited: number;
  coh_advances: number;
};

export default function MissionReadiness() {
  const { user } = useAuth();
  const [churchId, setChurchId] = useState<string>(mrMemoryCache?.churchId || '');
  const [loading, setLoading] = useState(!mrMemoryCache);
  const [saving, setSaving] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [copiedBalance, setCopiedBalance] = useState(false);
  const [showFaultGuide, setShowFaultGuide] = useState(false);
  
  const [errorModal, setErrorModal] = useState<{ title: string; message: string } | null>(null);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [reconLogs, setReconLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  
  const [periods, setPeriods] = useState<any[]>(mrMemoryCache?.periods || []);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(mrMemoryCache?.selectedPeriod || '');
  const [transactions, setTransactions] = useState<any[]>(mrMemoryCache?.transactions || []);
  
  const [recon, setRecon] = useState<ReconState>(mrMemoryCache?.recon || {
    beginning_balance: 0,
    cib_savings: 0,
    cib_current: 0,
    cib_time_deposit: 0,
    coh_petty_cash: 0,
    coh_undeposited: 0,
    coh_advances: 0
  });

  const [oldRecon, setOldRecon] = useState<ReconState>(mrMemoryCache?.oldRecon || { ...recon });

  const [stats, setStats] = useState(mrMemoryCache?.stats || {
    totalIncome: 0,
    totalExpense: 0,
    transactionCount: 0,
  });

  useEffect(() => {
    if (user) fetchPeriods();
  }, [user]);

  useEffect(() => {
    if (selectedPeriod) fetchTransactionsAndReconForPeriod(selectedPeriod);
  }, [selectedPeriod]);

  useEffect(() => {
    if (showLogsModal && selectedPeriod && churchId) fetchReconLogs();
  }, [showLogsModal, selectedPeriod, churchId]);

  const fetchPeriods = async () => {
    if (!mrMemoryCache) setLoading(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('church_id').eq('id', user?.id).maybeSingle();
      if (profile?.church_id) {
        setChurchId(profile.church_id);
        const { data: periodData } = await supabase
          .from('financial_periods')
          .select('*')
          .eq('church_id', profile.church_id)
          .order('month', { ascending: true });

        if (periodData && periodData.length > 0) {
          setPeriods(periodData);
          
          // Smart deadline rule
          const now = new Date();
          const currentMonthNum = now.getMonth() + 1;
          const todayDate = now.getDate();
          const deadlineDay = parseInt(localStorage.getItem('mpr_deadline_day') || '14', 10);
          
          let targetMonth = currentMonthNum;
          if (todayDate < deadlineDay) {
            targetMonth = currentMonthNum - 1;
            if (targetMonth === 0) {
              targetMonth = 12;
            }
          }

          const smartPeriod = periodData.find(p => p.month === targetMonth) || periodData.find(p => p.status === 'OPEN') || periodData[0];
          const defaultPeriod = mrMemoryCache?.selectedPeriod || smartPeriod.id;
          setSelectedPeriod(defaultPeriod);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactionsAndReconForPeriod = async (periodId: string) => {
    if (!mrMemoryCache) setLoading(true);
    try {
      const { data: txData, error: txError } = await supabase.from('transactions').select('*, categories(name)').eq('financial_period_id', periodId);
      if (txError) throw txError;

      let income = 0;
      let expense = 0;
      if (txData) {
        setTransactions(txData);
        income = txData.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + Number(t.amount), 0);
        expense = txData.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Number(t.amount), 0);
        setStats({ totalIncome: income, totalExpense: expense, transactionCount: txData.length });
      }

      const { data: periodData } = await supabase.from('financial_periods').select('*').eq('id', periodId).single();
      let loadedRecon = recon;
      if (periodData) {
        loadedRecon = {
          beginning_balance: Number(periodData.beginning_balance) || 0,
          cib_savings: Number(periodData.cib_savings) || 0,
          cib_current: Number(periodData.cib_current) || 0,
          cib_time_deposit: Number(periodData.cib_time_deposit) || 0,
          coh_petty_cash: Number(periodData.coh_petty_cash) || 0,
          coh_undeposited: Number(periodData.coh_undeposited) || 0,
          coh_advances: Number(periodData.coh_advances) || 0
        };
        setRecon(loadedRecon);
        setOldRecon(loadedRecon); 
      }

      mrMemoryCache = {
        churchId,
        periods,
        selectedPeriod: periodId,
        transactions: txData || [],
        recon: loadedRecon,
        oldRecon: loadedRecon,
        stats: { totalIncome: income, totalExpense: expense, transactionCount: txData?.length || 0 }
      };

    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReconLogs = async () => {
    setLoadingLogs(true);
    try {
      const { data: logsData, error } = await supabase.from('reconciliation_logs').select('*').eq('church_id', churchId).eq('financial_period_id', selectedPeriod).order('created_at', { ascending: false }).limit(100);
      if (error) { setReconLogs([]); return; }
      if (logsData && logsData.length > 0) {
        const userIds = [...new Set(logsData.map(l => l.changed_by).filter(Boolean))];
        const profilesMap: Record<string, string> = {};
        if (userIds.length > 0) {
          const { data: profilesData } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
          profilesData?.forEach(p => { profilesMap[p.id] = p.full_name; });
        }
        const enrichedLogs = logsData.map(log => ({ ...log, changed_by: { full_name: profilesMap[log.changed_by] || 'System / Unknown' } }));
        setReconLogs(enrichedLogs);
      } else {
        setReconLogs([]);
      }
    } catch (err) {
      setReconLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleSaveRecon = async () => {
    if (!selectedPeriod) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('financial_periods').update({
        beginning_balance: recon.beginning_balance, cib_savings: recon.cib_savings, cib_current: recon.cib_current, cib_time_deposit: recon.cib_time_deposit,
        coh_petty_cash: recon.coh_petty_cash, coh_undeposited: recon.coh_undeposited, coh_advances: recon.coh_advances
      }).eq('id', selectedPeriod);
      if (error) throw error;

      if (churchId) {
        await supabase.from('reconciliation_logs').insert({ church_id: churchId, financial_period_id: selectedPeriod, action: 'UPDATE', changed_by: user?.id, old_data: oldRecon, new_data: recon });
      }

      setOldRecon({ ...recon });
      const actualEndingBalance = (recon.cib_savings + recon.cib_current + recon.cib_time_deposit) + (recon.coh_petty_cash + recon.coh_undeposited + recon.coh_advances);
      const currentIndex = periods.findIndex(p => p.id === selectedPeriod);
      
      if (currentIndex !== -1 && currentIndex < periods.length - 1) {
        const nextPeriod = periods[currentIndex + 1];
        await supabase.from('financial_periods').update({ beginning_balance: actualEndingBalance }).eq('id', nextPeriod.id);
      }

      mrMemoryCache = null; // Invalidate cache on write
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 2000);
    } catch (error: any) {
      setErrorModal({ title: 'Save Failed', message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleExemptReceipt = async (transactionId: string) => {
    try {
      setTransactions(prev => prev.map(t => t.id === transactionId ? { ...t, receipt_exempt: true } : t));
      const { error } = await supabase.from('transactions').update({ receipt_exempt: true }).eq('id', transactionId);
      if (error) throw error;
      mrMemoryCache = null; // Invalidate cache
    } catch (err: any) {
      setErrorModal({ title: 'Exemption Failed', message: err.message });
      fetchTransactionsAndReconForPeriod(selectedPeriod); 
    }
  };

  const handleReconChange = (field: keyof typeof recon, value: string) => {
    const numValue = parseFloat(value) || 0;
    setRecon((prev: ReconState) => ({ ...prev, [field]: numValue }));
  };

  const handleCopyBalance = () => {
    navigator.clipboard.writeText(actualEndingBalance.toFixed(2));
    setCopiedBalance(true);
    setTimeout(() => setCopiedBalance(false), 2000);
  };

  const totalBank = recon.cib_savings + recon.cib_current + recon.cib_time_deposit;
  const totalCash = recon.coh_petty_cash + recon.coh_undeposited + recon.coh_advances;
  const actualEndingBalance = totalBank + totalCash;
  const systemEndingBalance = recon.beginning_balance + stats.totalIncome - stats.totalExpense;
  const discrepancy = actualEndingBalance - systemEndingBalance;
  const isBalanced = discrepancy === 0;
  
  const exemptKeywords = ['love gift', 'compassion', 'honorarium', 'allowance', 'benevolence', 'remittance', 'tithe'];
  const missingReceipts = transactions.filter((t) => {
    if (t.type !== 'EXPENSE') return false; 
    if (t.receipt_url && t.receipt_url.trim() !== '') return false; 
    if (t.receipt_exempt === true) return false;
    const categoryName = t.categories?.name?.toLowerCase() || '';
    return !exemptKeywords.some(keyword => categoryName.includes(keyword));
  });

  const isReady = isBalanced && missingReceipts.length === 0 && transactions.length > 0;
  const currentMonthNum = new Date().getMonth() + 1;

  if (loading && !mrMemoryCache) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-slate-200 dark:bg-[#1a1a1a] rounded-xl w-1/3 sm:w-1/4"></div>
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-6">
           <div className="xl:col-span-8 h-96 bg-slate-200 dark:bg-[#121212] rounded-2xl border border-slate-200 dark:border-[#27272A]"></div>
           <div className="xl:col-span-4 h-96 bg-slate-200 dark:bg-[#121212] rounded-2xl border border-slate-200 dark:border-[#27272A]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 relative">
      
      {showSaveSuccess && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 dark:bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#27272A] rounded-2xl p-8 shadow-2xl flex flex-col items-center justify-center space-y-4 animate-in zoom-in-95 duration-300 min-w-[300px]">
            <div className="h-16 w-16 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 animate-bounce">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold uppercase tracking-wider text-slate-900 dark:text-white">Balances Saved!</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Reconciliation secured & next month updated.</p>
            </div>
          </div>
        </div>,
        document.body
      )}

      {errorModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 dark:bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#27272A] rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl text-rose-600 dark:text-rose-400 shrink-0">
                <AlertOctagon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{errorModal.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">{errorModal.message}</p>
              </div>
            </div>
            <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-[#27272A]">
              <button onClick={() => setErrorModal(null)} className="px-6 py-2.5 bg-slate-900 dark:bg-[#1A1A1A] text-white hover:bg-black dark:hover:bg-[#262626] rounded-xl text-xs font-bold transition-all shadow-md border border-slate-200 dark:border-[#333]">
                Acknowledge
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showLogsModal && createPortal(
        <>
          <div className="fixed inset-0 z-[99998] bg-slate-950/75 dark:bg-black/85 backdrop-blur-md transition-opacity duration-300" aria-hidden="true" />
          <div className="fixed inset-0 z-[99998] flex items-center justify-center p-0 sm:p-4 pointer-events-none">
            <div className="pointer-events-auto w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] max-w-4xl bg-white dark:bg-[#0A0A0A] border-0 sm:border border-slate-200 dark:border-[#27272A] rounded-none sm:rounded-2xl shadow-none sm:shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="flex justify-between items-center p-4 sm:p-6 bg-slate-50 dark:bg-[#111111] border-b border-slate-200 dark:border-[#27272A] shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 shrink-0">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">Reconciliation Audit Trail</h3>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5 hidden sm:block">Immutable record of "before and after" physical balance modifications.</p>
                  </div>
                </div>
                <button onClick={() => setShowLogsModal(false)} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-[#1A1A1A] border border-slate-200 dark:border-[#333] rounded-xl transition-colors shrink-0"><X className="h-4 w-4" /></button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-0 bg-slate-50/50 dark:bg-[#0A0A0A]">
                {loadingLogs ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                    <Loader2 className="h-8 w-8 animate-spin mb-4 text-emerald-500" />
                    <span className="text-xs font-bold">Querying audit logs...</span>
                  </div>
                ) : reconLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
                    <div className="p-4 bg-slate-100 dark:bg-[#121212] rounded-full text-slate-400 border border-slate-200 dark:border-[#27272A]">
                      <ServerCrash className="h-12 w-12" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">No Record Changes Found</h4>
                      <p className="text-[10px] text-slate-500 max-w-sm mt-1 px-4">There are no documented balance updates for this period, or the tracking table hasn't been initialized in your database.</p>
                    </div>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs whitespace-nowrap min-w-[700px]">
                    <thead className="sticky top-0 bg-white dark:bg-[#121212] border-b border-slate-200 dark:border-[#27272A] z-10">
                      <tr className="text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                        <th className="p-4">Timestamp</th>
                        <th className="p-4">Updated By</th>
                        <th className="p-4">Cash in Bank (Before → After)</th>
                        <th className="p-4">Cash on Hand (Before → After)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#27272A]/50">
                      {reconLogs.map((log) => {
                        const oldBank = Number(log.old_data?.cib_savings||0) + Number(log.old_data?.cib_current||0) + Number(log.old_data?.cib_time_deposit||0);
                        const oldCash = Number(log.old_data?.coh_petty_cash||0) + Number(log.old_data?.coh_undeposited||0) + Number(log.old_data?.coh_advances||0);
                        const newBank = Number(log.new_data?.cib_savings||0) + Number(log.new_data?.cib_current||0) + Number(log.new_data?.cib_time_deposit||0);
                        const newCash = Number(log.new_data?.coh_petty_cash||0) + Number(log.new_data?.coh_undeposited||0) + Number(log.new_data?.coh_advances||0);

                        return (
                          <tr key={log.id} className="hover:bg-slate-50 dark:bg-[#121212] transition-colors">
                            <td className="p-4 font-mono text-[10px] text-slate-500 dark:text-slate-400">{new Date(log.created_at).toLocaleString()}</td>
                            <td className="p-4 font-medium text-slate-700 dark:text-slate-300">{log.changed_by?.full_name}</td>
                            <td className="p-4">
                              <div className="flex items-center gap-3 text-[10px] font-mono">
                                <span className="text-amber-600 dark:text-amber-400 truncate block w-20 text-right">₱{oldBank.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                <ArrowRight className="h-3 w-3 shrink-0 text-slate-400" />
                                <span className="text-emerald-600 dark:text-emerald-400 truncate block w-20">₱{newBank.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-3 text-[10px] font-mono">
                                <span className="text-amber-600 dark:text-amber-400 truncate block w-20 text-right">₱{oldCash.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                <ArrowRight className="h-3 w-3 shrink-0 text-slate-400" />
                                <span className="text-emerald-600 dark:text-emerald-400 truncate block w-20">₱{newCash.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>,
        document.body
      )}

      <SmartDiagnosisModal 
        isOpen={showFaultGuide} 
        onClose={() => setShowFaultGuide(false)} 
        discrepancy={discrepancy} 
        isBalanced={isBalanced} 
        transactions={transactions} 
        recon={recon} 
        totalBank={totalBank} 
        totalCash={totalCash} 
      />

      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            Mission Readiness
          </h1>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Reconcile accounts and verify documentation prior to financial export.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-3 bg-white dark:bg-[#0A0A0A] p-1.5 pr-3 sm:pr-4 rounded-2xl border border-slate-200 dark:border-[#27272A] shadow-sm flex-1 sm:flex-none relative">
            <select 
              value={selectedPeriod}
              onChange={(e) => { setSelectedPeriod(e.target.value); localStorage.setItem('mr_period', e.target.value); }}
              className="w-full rounded-xl border-none bg-slate-50 dark:bg-[#121212] px-4 py-3 pr-10 text-xs font-bold text-slate-900 dark:text-white shadow-sm focus:ring-0 cursor-pointer flex-1 sm:w-auto min-w-0 truncate outline-none appearance-none"
            >
              {periods.map(p => (
                <option key={p.id} value={p.id}>
                  {p.period_name} {p.month === currentMonthNum ? '(Current Month)' : ''} {p.status !== 'OPEN' ? `(${p.status})` : ''}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none"><ChevronDown className="h-4 w-4 text-slate-400" /></div>
            <div className="flex gap-4 items-center shrink-0 hidden sm:flex pl-2 border-l border-slate-200 dark:border-[#27272A]">
              <div className="text-right">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Income</p>
                <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">₱{stats.totalIncome.toLocaleString('en-PH', {minimumFractionDigits:2})}</p>
              </div>
              <div className="h-6 w-px bg-slate-200 dark:bg-[#27272A]"></div>
              <div className="text-right">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Expense</p>
                <p className="text-sm font-black text-amber-600 dark:text-amber-400">₱{stats.totalExpense.toLocaleString('en-PH', {minimumFractionDigits:2})}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!loading && (
        <>
          {missingReceipts.length > 0 && (
            <div className="bg-white dark:bg-[#0A0A0A] border border-amber-500/40 rounded-2xl p-5 space-y-4 shadow-sm relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.6)]"></div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-[#27272A] pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
                    <AlertTriangle className="h-5 w-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Action Required: Missing Receipts</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {missingReceipts.length} operational expense{missingReceipts.length > 1 ? 's are' : ' is'} missing documentation.
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto custom-scrollbar border border-slate-200 dark:border-[#27272A] rounded-xl bg-slate-50 dark:bg-[#111111]">
                <div className="max-h-60 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-xs min-w-[500px] whitespace-nowrap">
                    <tbody className="divide-y divide-slate-200 dark:divide-[#27272A]/50">
                      {missingReceipts.map((transaction) => (
                        <tr key={transaction.id} className="hover:bg-slate-100 dark:hover:bg-[#1A1A1A] transition-colors">
                          <td className="p-3.5 w-[60%]">
                            <span className="font-medium text-slate-800 dark:text-slate-200 truncate inline-block max-w-[200px] sm:max-w-[300px] align-bottom">
                              {transaction.remarks || transaction.payee_name || 'No Receipt Registered'}
                            </span>
                            <span className="ml-2 text-[10px] text-amber-600 dark:text-amber-400 inline-block align-bottom">({transaction.categories?.name || 'Uncategorized'})</span>
                          </td>
                          <td className="p-3.5 text-right font-mono font-bold text-amber-600 dark:text-amber-400 w-[20%]">
                            ₱{Number(transaction.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3.5 pr-4 text-right w-[20%]">
                            <button 
                              onClick={() => handleExemptReceipt(transaction.id)}
                              className="group flex items-center justify-end gap-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors ml-auto"
                              title="Mark as Receipt Not Required"
                            >
                              <span className="uppercase tracking-wider">Exempt</span>
                              <div className="w-8 h-4 bg-slate-200 dark:bg-slate-800 rounded-full relative group-hover:bg-emerald-500/50 transition-colors">
                                <div className="w-3 h-3 bg-white rounded-full absolute left-[3px] top-[2px] group-hover:translate-x-4 transition-transform shadow-sm" />
                              </div>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            
            <div className="xl:col-span-8 space-y-6">
              <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#27272A] rounded-2xl p-6 shadow-sm space-y-6">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-[#27272A] pb-4">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">Bank & Cash Reconciliation</h3>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                    <button
                      onClick={() => setShowLogsModal(true)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-[#27272A] text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-slate-100 dark:hover:bg-[#1A1A1A] transition-colors shadow-sm text-xs font-bold"
                      title="View Audit Trail"
                    >
                      <Activity className="h-4 w-4 shrink-0" />
                      <span className="whitespace-nowrap">Audit Logs</span>
                    </button>
                    <button
                      onClick={handleSaveRecon}
                      disabled={saving}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shrink-0 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {saving ? 'Saving...' : 'Save Balances'}
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-[#121212] p-4 rounded-xl border border-slate-200 dark:border-[#27272A]">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                    Beginning Balance (Start of Month)
                  </label>
                  <input 
                    type="number" 
                    className="w-full sm:w-1/2 rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0A] px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 dark:text-white focus:border-emerald-500 outline-none shadow-sm transition-colors"
                    value={recon.beginning_balance || ''}
                    onChange={(e) => handleReconChange('beginning_balance', e.target.value)}
                    placeholder="0.00"
                  />
                  <p className="text-[10px] text-slate-500 mt-2 leading-relaxed max-w-lg">Enter the total combined cash and bank balance carried over from the previous month.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-[#27272A] pb-2">Cash in Bank</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Savings Account</label>
                        <input 
                          type="number" 
                          className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#121212] px-3.5 py-2.5 text-xs font-mono font-medium text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors"
                          value={recon.cib_savings || ''}
                          onChange={(e) => handleReconChange('cib_savings', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Current Account</label>
                        <input 
                          type="number" 
                          className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#121212] px-3.5 py-2.5 text-xs font-mono font-medium text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors"
                          value={recon.cib_current || ''}
                          onChange={(e) => handleReconChange('cib_current', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Time Deposit</label>
                        <input 
                          type="number" 
                          className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#121212] px-3.5 py-2.5 text-xs font-mono font-medium text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors"
                          value={recon.cib_time_deposit || ''}
                          onChange={(e) => handleReconChange('cib_time_deposit', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-[#27272A] pb-2">Cash on Hand</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Petty Cash</label>
                        <input 
                          type="number" 
                          className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#121212] px-3.5 py-2.5 text-xs font-mono font-medium text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors"
                          value={recon.coh_petty_cash || ''}
                          onChange={(e) => handleReconChange('coh_petty_cash', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Undeposited Collections</label>
                        <input 
                          type="number" 
                          className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#121212] px-3.5 py-2.5 text-xs font-mono font-medium text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors"
                          value={recon.coh_undeposited || ''}
                          onChange={(e) => handleReconChange('coh_undeposited', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Advances / IOU</label>
                        <input 
                          type="number" 
                          className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#121212] px-3.5 py-2.5 text-xs font-mono font-medium text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors"
                          value={recon.coh_advances || ''}
                          onChange={(e) => handleReconChange('coh_advances', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="pt-4 mt-2 border-t border-slate-200 dark:border-[#27272A] flex items-center justify-between bg-slate-50 dark:bg-[#111111] p-4 rounded-xl border border-slate-200 dark:border-[#27272A]">
                   <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Actual Physical Balance:</span>
                   <div className="flex items-center gap-2">
                     <span className="text-xl font-mono font-black text-emerald-600 dark:text-emerald-400">₱{actualEndingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                     <button 
                       onClick={handleCopyBalance}
                       className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-[#1A1A1A] transition-colors bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#27272A] shadow-sm"
                       title="Copy Exact Balance"
                     >
                       {copiedBalance ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                     </button>
                   </div>
                </div>
              </div>
            </div>

            <div className="xl:col-span-4 space-y-6">
              <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#27272A] rounded-2xl p-6 shadow-sm space-y-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-[#27272A] pb-4">
                  <FileCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  Readiness Status
                </h3>
                
                <div className="space-y-4">
                  
                  <div className="flex flex-col gap-3 bg-slate-50 dark:bg-[#121212] p-4 rounded-xl border border-slate-200 dark:border-[#27272A]">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        Ledger Reconciled
                        <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
                      </span>
                      {isBalanced ? (
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-emerald-200 dark:border-emerald-900/50">Passed</span>
                      ) : (
                        <span className="px-2.5 py-1 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-rose-200 dark:border-rose-900/50">Failed</span>
                      )}
                    </div>
                    
                    {!isBalanced && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-[#27272A]">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono leading-relaxed">
                          Target: ₱{systemEndingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                        <button 
                          onClick={() => setShowFaultGuide(true)} 
                          className="flex items-center justify-center gap-1.5 w-full sm:w-auto px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-600 dark:text-amber-400 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors border border-amber-200 dark:border-amber-900/50 animate-pulse hover:animate-none"
                        >
                          <SearchCode className="h-3.5 w-3.5" /> Smart Diagnosis
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center bg-slate-50 dark:bg-[#121212] p-4 rounded-xl border border-slate-200 dark:border-[#27272A]">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      Document Completeness
                    </span>
                    {missingReceipts.length === 0 ? (
                      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-emerald-200 dark:border-emerald-900/50">Passed</span>
                    ) : (
                      <span className="px-2.5 py-1 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-rose-200 dark:border-rose-900/50">{missingReceipts.length} Missing</span>
                    )}
                  </div>

                  <div className="pt-4 mt-2 border-t border-slate-200 dark:border-[#27272A]">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Discrepancy</span>
                      <span className={`text-xl font-mono font-black ${discrepancy === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        ₱{Math.abs(discrepancy).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
                
                <button 
                  disabled={!isReady}
                  className={`w-full py-3.5 mt-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 ${
                    isReady 
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer' 
                      : 'bg-slate-100 text-slate-400 border border-slate-200 dark:bg-[#1A1A1A] dark:text-slate-500 cursor-not-allowed dark:border-[#27272A] shadow-none'
                  }`}
                >
                  {isReady ? 'System Ready for Export' : 'Resolve Issues to Export'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
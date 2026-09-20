// ==========================================
// MISSION READINESS PAGE COMPONENT
// Purpose: Audit verification, missing receipt exemptions, discrepancy troubleshooting, 
// Koop passbook cross-validation, and Smart Discrepancy Analysis & Recon Logging.
// ==========================================

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle2, AlertTriangle, ShieldCheck, FileCheck, HelpCircle, Loader2, Save, Copy, Check, SearchCode, XCircle, AlertOctagon, Activity, ServerCrash, ArrowRight } from 'lucide-react';

export default function MissionReadiness() {
  const { user } = useAuth();
  const [churchId, setChurchId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [copiedBalance, setCopiedBalance] = useState(false);
  const [showFaultGuide, setShowFaultGuide] = useState(false);
  
  // World-Class Error & Logs Modal State
  const [errorModal, setErrorModal] = useState<{ title: string; message: string } | null>(null);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [reconLogs, setReconLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  
  const [periods, setPeriods] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [transactions, setTransactions] = useState<any[]>([]);
  
  const [recon, setRecon] = useState({
    beginning_balance: 0,
    cib_savings: 0,
    cib_current: 0,
    cib_time_deposit: 0,
    coh_petty_cash: 0,
    coh_undeposited: 0,
    coh_advances: 0
  });

  // Track the previous state for accurate audit logging
  const [oldRecon, setOldRecon] = useState({ ...recon });

  const [stats, setStats] = useState({
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
          
          const now = new Date();
          const currentMonthNum = now.getMonth() + 1; // 1-12
          
          const currentOpenPeriod = periodData.find(p => p.month === currentMonthNum && p.status === 'OPEN');
          const fallbackOpenPeriod = periodData.find(p => p.status === 'OPEN');
          
          // Priority: Current Month -> Any Open Month -> First Period in list
          const defaultPeriod = currentOpenPeriod?.id || fallbackOpenPeriod?.id || periodData[0].id;
          
          setSelectedPeriod(defaultPeriod);
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchTransactionsAndReconForPeriod = async (periodId: string) => {
    setLoading(true);
    try {
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*, categories(name)')
        .eq('financial_period_id', periodId);

      if (txError) throw txError;

      if (txData) {
        setTransactions(txData);
        const income = txData.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + Number(t.amount), 0);
        const expense = txData.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Number(t.amount), 0);
        setStats({ totalIncome: income, totalExpense: expense, transactionCount: txData.length });
      }

      const { data: periodData } = await supabase
        .from('financial_periods')
        .select('*')
        .eq('id', periodId)
        .single();

      if (periodData) {
        const loadedRecon = {
          beginning_balance: Number(periodData.beginning_balance) || 0,
          cib_savings: Number(periodData.cib_savings) || 0,
          cib_current: Number(periodData.cib_current) || 0,
          cib_time_deposit: Number(periodData.cib_time_deposit) || 0,
          coh_petty_cash: Number(periodData.coh_petty_cash) || 0,
          coh_undeposited: Number(periodData.coh_undeposited) || 0,
          coh_advances: Number(periodData.coh_advances) || 0
        };
        setRecon(loadedRecon);
        setOldRecon(loadedRecon); // Baseline for audit logging
      }

    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReconLogs = async () => {
    setLoadingLogs(true);
    try {
      const { data: logsData, error } = await supabase
        .from('reconciliation_logs')
        .select('*')
        .eq('church_id', churchId)
        .eq('financial_period_id', selectedPeriod)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) {
        console.warn('Reconciliation logs table might not exist yet.');
        setReconLogs([]);
        return;
      }

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

        setReconLogs(enrichedLogs);
      } else {
        setReconLogs([]);
      }
    } catch (err) {
      console.error("Error fetching recon logs:", err);
      setReconLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleSaveRecon = async () => {
    if (!selectedPeriod) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('financial_periods')
        .update({
          beginning_balance: recon.beginning_balance,
          cib_savings: recon.cib_savings,
          cib_current: recon.cib_current,
          cib_time_deposit: recon.cib_time_deposit,
          coh_petty_cash: recon.coh_petty_cash,
          coh_undeposited: recon.coh_undeposited,
          coh_advances: recon.coh_advances
        })
        .eq('id', selectedPeriod);
      
      if (error) throw error;

      // ---- INSERT RECON AUDIT LOG ----
      if (churchId) {
        const { error: logError } = await supabase.from('reconciliation_logs').insert({
           church_id: churchId,
           financial_period_id: selectedPeriod,
           action: 'UPDATE',
           changed_by: user?.id,
           old_data: oldRecon,
           new_data: recon
        });
        if (logError) console.warn("Failed to write to reconciliation_logs:", logError.message);
      }

      // Update baseline to the new saved state
      setOldRecon({ ...recon });

      const actualEndingBalance = 
        (recon.cib_savings + recon.cib_current + recon.cib_time_deposit) + 
        (recon.coh_petty_cash + recon.coh_undeposited + recon.coh_advances);
      
      const currentIndex = periods.findIndex(p => p.id === selectedPeriod);
      if (currentIndex !== -1 && currentIndex < periods.length - 1) {
        const nextPeriod = periods[currentIndex + 1];
        await supabase
          .from('financial_periods')
          .update({ beginning_balance: actualEndingBalance })
          .eq('id', nextPeriod.id);
      }

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
      const { error } = await supabase
        .from('transactions')
        .update({ receipt_exempt: true })
        .eq('id', transactionId);

      if (error) throw error;
    } catch (err: any) {
      setErrorModal({ title: 'Exemption Failed', message: err.message });
      fetchTransactionsAndReconForPeriod(selectedPeriod); // Revert UI
    }
  };

  const handleReconChange = (field: keyof typeof recon, value: string) => {
    const numValue = parseFloat(value) || 0;
    setRecon(prev => ({ ...prev, [field]: numValue }));
  };

  const totalBank = recon.cib_savings + recon.cib_current + recon.cib_time_deposit;
  const totalCash = recon.coh_petty_cash + recon.coh_undeposited + recon.coh_advances;
  const actualEndingBalance = totalBank + totalCash;
  
  const handleCopyBalance = () => {
    navigator.clipboard.writeText(actualEndingBalance.toFixed(2));
    setCopiedBalance(true);
    setTimeout(() => setCopiedBalance(false), 2000);
  };

  const exemptKeywords = ['love gift', 'compassion', 'honorarium', 'allowance', 'benevolence', 'remittance', 'tithe'];
  
  const missingReceipts = transactions.filter((t) => {
    if (t.type !== 'EXPENSE') return false; 
    if (t.receipt_url && t.receipt_url.trim() !== '') return false; 
    if (t.receipt_exempt === true) return false;

    const categoryName = t.categories?.name?.toLowerCase() || '';
    const isAutoExempt = exemptKeywords.some(keyword => categoryName.includes(keyword));
    
    return !isAutoExempt;
  });

  const systemEndingBalance = recon.beginning_balance + stats.totalIncome - stats.totalExpense;
  const discrepancy = actualEndingBalance - systemEndingBalance;
  
  const isBalanced = discrepancy === 0;
  const isReady = isBalanced && missingReceipts.length === 0 && transactions.length > 0;

  // --- ADVANCED SMART DISCREPANCY ANALYZER ---
  const analyzerFindings = useMemo(() => {
    if (discrepancy === 0) return [];
    const findings: { type: string, message: React.ReactNode }[] = [];
    const absDisc = Math.abs(discrepancy);
    
    // 1. Directional Insight
    if (discrepancy < 0) {
      findings.push({
        type: 'shortage',
        message: <span><strong>Physical Shortage:</strong> You are physically short by <strong>₱{absDisc.toLocaleString('en-PH', {minimumFractionDigits: 2})}</strong>. The system ledger expects more money. Check for an unrecorded physical Expense, an automatic bank fee deducted from Savings, or check if Advances (₱{recon.coh_advances.toLocaleString()}) were given out but not logged in the transactions.</span>
      });
    } else {
      findings.push({
        type: 'overage',
        message: <span><strong>Physical Overage:</strong> You have <strong>₱{absDisc.toLocaleString('en-PH', {minimumFractionDigits: 2})}</strong> more physical cash/bank than expected. Check for unrecorded Income (like late tithes or offerings) or Coop Interest that hasn't been encoded into the ledger yet.</span>
      });
    }

    // 2. Direct Bank & Cash Value Match
    if (absDisc === recon.coh_undeposited && recon.coh_undeposited > 0) {
      findings.push({
        type: 'exact_match',
        message: <span><strong>Undeposited Collections Match:</strong> The discrepancy is exactly equal to your Undeposited Collections (₱{recon.coh_undeposited.toLocaleString()}). Verify if you encoded this as Income but forgot to physically deposit it, or if your physical cash count is inflated.</span>
      });
    }
    if (absDisc === recon.coh_petty_cash && recon.coh_petty_cash > 0) {
      findings.push({
        type: 'exact_match',
        message: <span><strong>Petty Cash Match:</strong> The discrepancy exactly matches your Petty Cash Fund (₱{recon.coh_petty_cash.toLocaleString()}). Did you replenish this from the bank without logging the transfer, or forget it in the beginning balance?</span>
      });
    }

    // 3. Exact Transaction Match
    const exactMatches = transactions.filter(t => Number(t.amount) === absDisc);
    if (exactMatches.length > 0) {
      findings.push({
        type: 'ledger_match',
        message: <span><strong>Ledger Entry Found:</strong> There {exactMatches.length > 1 ? 'are' : 'is'} {exactMatches.length} transaction(s) matching exactly ₱{absDisc.toLocaleString('en-PH', {minimumFractionDigits: 2})}: {exactMatches.map(t => `'${t.remarks || t.payee_name || t.categories?.name}'`).join(', ')}. Check if this was accidentally duplicated in the ledger, or physically omitted from the bank total.</span>
      });
    }

    // 4. Polarity Flip (Income vs Expense)
    const flippedMatches = transactions.filter(t => Number(t.amount) === (absDisc / 2));
    if (flippedMatches.length > 0) {
      findings.push({
        type: 'polarity',
        message: <span><strong>Income/Expense Flip:</strong> Found {flippedMatches.length} transaction(s) for exactly half the variance (₱{(absDisc / 2).toLocaleString('en-PH', {minimumFractionDigits: 2})}). E.g. {flippedMatches.map(t => `'${t.remarks || t.payee_name}'`).join(', ')}. If an expense was accidentally tagged as income (or vice versa), it doubles the mathematical error!</span>
      });
    }

    // 5. Transposition Check
    const centsDisc = Math.round(absDisc * 100);
    if (centsDisc % 9 === 0 && absDisc % 10 !== 0) {
      findings.push({
        type: 'typo',
        message: <span><strong>Typo Check (Transposition):</strong> The variance of ₱{absDisc.toLocaleString('en-PH', {minimumFractionDigits: 2})} is perfectly divisible by 9. This mathematically guarantees a typing error in your physical counts (e.g., typing 54 instead of 45). Re-verify your Cash in Bank (₱{totalBank.toLocaleString()}) and Cash on Hand (₱{totalCash.toLocaleString()}) inputs digit-by-digit.</span>
      });
    }

    return findings;
  }, [discrepancy, transactions, recon, totalBank, totalCash]);

  if (loading && !selectedPeriod) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin mb-4 text-brand dark:text-emerald-500" />
        <p className="text-xs font-medium">Checking Audit Requirements...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300 relative">
      
      {/* WORLD-CLASS SAVE SUCCESS OVERLAY WITH CREATEPORTAL */}
      {showSaveSuccess && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#27272A] rounded-3xl p-8 shadow-2xl flex flex-col items-center justify-center space-y-5 animate-modal min-w-[320px]">
            <div className="h-16 w-16 bg-emerald-100 dark:bg-emerald-950/60 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 animate-bounce">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Balances Saved!</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Reconciliation secured & next month updated.</p>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* WORLD-CLASS ERROR MODAL WITH CREATEPORTAL */}
      {errorModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#121212] rounded-3xl shadow-2xl border border-slate-200 dark:border-[#27272A] w-full max-w-md p-6 animate-modal">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-2xl shrink-0">
                <AlertOctagon className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{errorModal.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                  {errorModal.message}
                </p>
              </div>
            </div>
            <div className="flex justify-end pt-5 border-t border-slate-100 dark:border-slate-800/60">
              <button 
                onClick={() => setErrorModal(null)} 
                className="px-6 py-2.5 bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold transition-all shadow-md"
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* DISCREPANCY FAULT-FINDING MODAL WITH CREATEPORTAL */}
      {showFaultGuide && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#27272A] rounded-3xl p-8 shadow-2xl space-y-6 animate-modal max-h-[85vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2"><SearchCode className="h-5 w-5 text-emerald-500" /> Smart Discrepancy Analyzer</h3>
              <button onClick={() => setShowFaultGuide(false)} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl transition-colors"><XCircle className="h-5 w-5" /></button>
            </div>

            {!isBalanced && analyzerFindings.length > 0 ? (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-5 rounded-2xl space-y-4">
                <h4 className="font-bold text-amber-900 dark:text-amber-400 flex items-center gap-2 text-sm border-b border-amber-200/50 dark:border-amber-800/50 pb-2">
                  <AlertOctagon className="h-4 w-4" /> Probable Errors Found:
                </h4>
                <ul className="space-y-3">
                  {analyzerFindings.map((finding, idx) => (
                    <li key={idx} className="text-amber-800 dark:text-amber-300 text-xs leading-relaxed font-medium bg-white/50 dark:bg-black/20 p-3 rounded-lg border border-amber-100 dark:border-amber-900/30">
                      {finding.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : !isBalanced ? (
              <div className="bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">The discrepancy pattern is irregular. Please carefully review the general checklist below to audit your inputs.</p>
              </div>
            ) : (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-800/50 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">Ledger perfectly reconciled. No discrepancies detected.</p>
              </div>
            )}

            <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
              <h4 className="font-bold text-slate-900 dark:text-white px-2">General Auditing Checklist</h4>
              <div className="bg-slate-50 dark:bg-[#1A1A1A] p-4 rounded-xl space-y-1 border border-slate-200 dark:border-[#27272A]">
                <h4 className="font-bold text-slate-900 dark:text-white">1. Beginning Balance Carryover Check</h4>
                <p className="text-slate-500 dark:text-slate-400">Verify that your starting beginning balance correctly matches last month's final ending cash balance.</p>
              </div>
              <div className="bg-slate-50 dark:bg-[#1A1A1A] p-4 rounded-xl space-y-1 border border-slate-200 dark:border-[#27272A]">
                <h4 className="font-bold text-slate-900 dark:text-white">2. Unassigned or Unrecorded Transactions</h4>
                <p className="text-slate-500 dark:text-slate-400">Check if any cash collections, offerings, or disbursements were left unassigned or omitted from the ledger.</p>
              </div>
              <div className="bg-slate-50 dark:bg-[#1A1A1A] p-4 rounded-xl space-y-1 border border-slate-200 dark:border-[#27272A]">
                <h4 className="font-bold text-slate-900 dark:text-white">3. San Jose Koop Passbook Pass-Throughs</h4>
                <p className="text-slate-500 dark:text-slate-400">Ensure all Koop deposits and monthly interest earnings are logged accurately in the SJ Koop Ledger.</p>
              </div>
            </div>
            
            <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
              <button onClick={() => setShowFaultGuide(false)} className="px-6 py-2.5 bg-slate-900 dark:bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors shadow-md">Close Guide</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* RECONCILIATION AUDIT LOGS MODAL WITH CREATEPORTAL */}
      {showLogsModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-4xl bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#27272A] rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-modal">
            <div className="flex justify-between items-center p-6 bg-slate-50 dark:bg-[#0A0A0A] border-b border-slate-200 dark:border-[#27272A]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 dark:bg-blue-900/40 rounded-xl text-blue-600 dark:text-blue-400">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Reconciliation Audit Trail</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Immutable record of "before and after" physical balance modifications.</p>
                </div>
              </div>
              <button onClick={() => setShowLogsModal(false)} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl transition-colors"><XCircle className="h-5 w-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-0 bg-slate-50/50 dark:bg-transparent">
              {loadingLogs ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                  <Loader2 className="h-8 w-8 animate-spin mb-4 text-brand dark:text-emerald-500" />
                  <span className="text-xs font-bold">Querying audit logs...</span>
                </div>
              ) : reconLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
                  <div className="p-4 bg-slate-100 dark:bg-[#1A1A1A] rounded-full text-slate-300 dark:text-slate-700">
                    <ServerCrash className="h-12 w-12" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">No Record Changes Found</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mt-1">There are no documented balance updates for this period, or the tracking table hasn't been initialized in your database.</p>
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
                        <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-[#1A1A1A] transition-colors">
                          <td className="p-4 font-mono text-[10px] text-slate-500 dark:text-slate-400">{new Date(log.created_at).toLocaleString()}</td>
                          <td className="p-4 font-medium text-slate-700 dark:text-slate-300">{log.changed_by?.full_name}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-3 text-[10px] font-mono">
                              <span className="text-amber-600 dark:text-amber-500 truncate block w-20 text-right">₱{oldBank.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                              <ArrowRight className="h-3 w-3 shrink-0 text-slate-400" />
                              <span className="text-emerald-600 dark:text-emerald-400 truncate block w-20">₱{newBank.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-3 text-[10px] font-mono">
                              <span className="text-amber-600 dark:text-amber-500 truncate block w-20 text-right">₱{oldCash.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
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
        </div>,
        document.body
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <CheckCircle2 className="h-7 w-7 text-brand dark:text-emerald-500" />
            Mission Readiness
          </h1>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Reconcile accounts and verify documentation prior to financial export.</p>
        </div>

        <div className="flex items-center gap-5 bg-white dark:bg-[#121212] p-2 pr-4 rounded-2xl border border-slate-200 dark:border-[#27272A] shadow-sm">
          <select 
            value={selectedPeriod}
            onChange={(e) => { setSelectedPeriod(e.target.value); localStorage.setItem('mr_period', e.target.value); }}
            className="rounded-xl border-none bg-slate-50 dark:bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white shadow-sm focus:ring-0 cursor-pointer min-w-[180px]"
          >
            {periods.map(p => <option key={p.id} value={p.id}>{p.period_name}</option>)}
          </select>
          <div className="flex gap-4">
            <div className="text-right hidden md:block">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Income</p>
              <p className="text-sm font-black text-emerald-500">₱{stats.totalIncome.toLocaleString('en-PH', {minimumFractionDigits:2})}</p>
            </div>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 self-center hidden md:block"></div>
            <div className="text-right hidden md:block">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Expense</p>
              <p className="text-sm font-black text-amber-500">₱{stats.totalExpense.toLocaleString('en-PH', {minimumFractionDigits:2})}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bento-card bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl text-emerald-600 dark:text-emerald-400"><HelpCircle className="h-5 w-5" /></div>
          <div>
            <h3 className="text-xs font-bold text-emerald-900 dark:text-emerald-200 uppercase tracking-wider">Auditor Fault-Finding Assistant</h3>
            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">Need help diagnosing why ledger reconciliation failed? Use our smart analyzer checklist.</p>
          </div>
        </div>
        <button onClick={() => setShowFaultGuide(true)} className={`px-4 py-2 text-white rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 ${!isBalanced ? 'bg-amber-600 hover:bg-amber-700 animate-pulse' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
          {!isBalanced ? 'View Smart Diagnosis' : 'Open Fault-Finding Guide'}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-brand" /></div>
      ) : (
        <>
          {missingReceipts.length > 0 && (
            <div className="bento-card bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg text-amber-600 dark:text-amber-400 shrink-0">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">Action Required: Missing Receipts</h3>
                    <p className="text-xs text-amber-700 dark:text-amber-400/80">
                      {missingReceipts.length} operational expense{missingReceipts.length > 1 ? 's are' : ' is'} missing documentation.
                    </p>
                  </div>
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto custom-scrollbar border border-amber-200/50 dark:border-amber-900/30 rounded-xl bg-white/50 dark:bg-[#121212]/50">
                <table className="w-full text-left text-xs min-w-[500px]">
                  <tbody className="divide-y divide-amber-100 dark:divide-amber-900/30">
                    {missingReceipts.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-amber-50/50 dark:hover:bg-amber-900/20 transition-colors">
                        <td className="p-3 w-1/2">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {transaction.remarks || transaction.payee_name || 'No Receipt Registered'}
                          </span>
                          <span className="ml-2 text-[10px] text-amber-600 dark:text-amber-500/70">({transaction.categories?.name || 'Uncategorized'})</span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-amber-700 dark:text-amber-400 w-1/4">
                          ₱{Number(transaction.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 pr-4 text-right w-1/4 space-x-3">
                          <button 
                            onClick={() => handleExemptReceipt(transaction.id)}
                            className="group flex items-center justify-end gap-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors ml-auto"
                            title="Mark as Receipt Not Required"
                          >
                            <span className="uppercase tracking-wider hidden sm:inline">Exempt</span>
                            <div className="w-8 h-4 bg-slate-200 dark:bg-slate-700 rounded-full relative group-hover:bg-emerald-500/50 transition-colors">
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
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            <div className="lg:col-span-8 space-y-6">
              <div className="bento-card bg-white dark:bg-[#121212] border-slate-200 dark:border-[#27272A] space-y-6">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-[#27272A] pb-4">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-brand dark:text-emerald-500" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Bank & Cash Reconciliation</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowLogsModal(true)}
                      className="flex items-center justify-center p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-white transition-all shadow-sm border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#121212]"
                      title="View Audit Trail"
                    >
                      <Activity className="h-4 w-4" />
                    </button>
                    <button
                      onClick={handleSaveRecon}
                      disabled={saving}
                      className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0"
                    >
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      {saving ? 'Saving...' : 'Save Balances'}
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                    Beginning Balance (Start of Month)
                  </label>
                  <input 
                    type="number" 
                    className="w-full md:w-1/2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 dark:text-white focus:border-brand dark:focus:border-emerald-500 shadow-sm transition-colors"
                    value={recon.beginning_balance || ''}
                    onChange={(e) => handleReconChange('beginning_balance', e.target.value)}
                    placeholder="0.00"
                  />
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5">Enter the total combined cash and bank balance carried over from the previous month.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cash in Bank</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Savings Account</label>
                        <input 
                          type="number" 
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-xs font-mono font-medium text-slate-900 dark:text-white focus:border-brand dark:focus:border-emerald-500 transition-colors"
                          value={recon.cib_savings || ''}
                          onChange={(e) => handleReconChange('cib_savings', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Current Account</label>
                        <input 
                          type="number" 
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-xs font-mono font-medium text-slate-900 dark:text-white focus:border-brand dark:focus:border-emerald-500 transition-colors"
                          value={recon.cib_current || ''}
                          onChange={(e) => handleReconChange('cib_current', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Time Deposit</label>
                        <input 
                          type="number" 
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-xs font-mono font-medium text-slate-900 dark:text-white focus:border-brand dark:focus:border-emerald-500 transition-colors"
                          value={recon.cib_time_deposit || ''}
                          onChange={(e) => handleReconChange('cib_time_deposit', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cash on Hand</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Petty Cash</label>
                        <input 
                          type="number" 
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-xs font-mono font-medium text-slate-900 dark:text-white focus:border-brand dark:focus:border-emerald-500 transition-colors"
                          value={recon.coh_petty_cash || ''}
                          onChange={(e) => handleReconChange('coh_petty_cash', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Undeposited Collections</label>
                        <input 
                          type="number" 
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-xs font-mono font-medium text-slate-900 dark:text-white focus:border-brand dark:focus:border-emerald-500 transition-colors"
                          value={recon.coh_undeposited || ''}
                          onChange={(e) => handleReconChange('coh_undeposited', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Advances / IOU</label>
                        <input 
                          type="number" 
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-xs font-mono font-medium text-slate-900 dark:text-white focus:border-brand dark:focus:border-emerald-500 transition-colors"
                          value={recon.coh_advances || ''}
                          onChange={(e) => handleReconChange('coh_advances', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-slate-100 dark:border-[#27272A] flex items-center justify-between">
                   <span className="text-sm font-bold text-slate-900 dark:text-white">Actual Physical Balance:</span>
                   <div className="flex items-center gap-2">
                     <span className="text-lg font-mono font-bold text-brand dark:text-emerald-400">₱{actualEndingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                     <button 
                       onClick={handleCopyBalance}
                       className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
                       title="Copy Exact Balance"
                     >
                       {copiedBalance ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                     </button>
                   </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
              <div className="bento-card bg-white dark:bg-[#121212] border-slate-200 dark:border-[#27272A] space-y-6">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-emerald-500" />
                  Readiness Status
                </h3>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-start bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2 mt-0.5">
                      Ledger Reconciled
                      <HelpCircle className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                    </span>
                    {isBalanced ? (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 rounded text-[10px] font-bold uppercase tracking-wider border border-emerald-200 dark:border-emerald-500/30">Passed</span>
                    ) : (
                      <div className="flex flex-col items-end gap-1 text-right">
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 rounded text-[10px] font-bold uppercase tracking-wider border border-red-200 dark:border-red-500/30">Failed</span>
                        <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium leading-tight max-w-[120px]">
                          Physical amount must match Ledger (₱{systemEndingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      Document Completeness
                    </span>
                    {missingReceipts.length === 0 ? (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 rounded text-[10px] font-bold uppercase tracking-wider border border-emerald-200 dark:border-emerald-500/30">Passed</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 rounded text-[10px] font-bold uppercase tracking-wider border border-red-200 dark:border-red-500/30">{missingReceipts.length} Missing</span>
                    )}
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Discrepancy</span>
                      <span className={`text-sm font-mono font-bold ${discrepancy === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        ₱{Math.abs(discrepancy).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
                
                <button 
                  disabled={!isReady}
                  className={`w-full py-3.5 mt-6 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 ${
                    isReady 
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer' 
                      : 'bg-slate-100 text-slate-400 border border-slate-200 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed dark:border-slate-700'
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
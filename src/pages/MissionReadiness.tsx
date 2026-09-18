// ==========================================
// MISSION READINESS PAGE COMPONENT
// Purpose: Audit verification, missing receipt exemptions, discrepancy troubleshooting, 
// Koop passbook cross-validation, and Smart Discrepancy Analysis.
// ==========================================

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle2, AlertTriangle, ShieldCheck, FileCheck, HelpCircle, Loader2, Save, Copy, Check, X, SearchCode } from 'lucide-react';

export default function MissionReadiness() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [copiedBalance, setCopiedBalance] = useState(false);
  const [showFaultGuide, setShowFaultGuide] = useState(false);
  
  const [periods, setPeriods] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [transactions, setTransactions] = useState<any[]>([]);
  
  // Holds the ending balance from the SJ Koop Ledger for cross-validation
  const [coopEndingBalance, setCoopEndingBalance] = useState<number | null>(null);
  
  const [recon, setRecon] = useState({
    beginning_balance: 0,
    cib_savings: 0,
    cib_current: 0,
    cib_time_deposit: 0,
    coh_petty_cash: 0,
    coh_undeposited: 0,
    coh_advances: 0
  });

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

  const fetchPeriods = async () => {
    try {
      const { data: profile } = await supabase.from('profiles').select('church_id').eq('id', user?.id).single();
      if (profile?.church_id) {
        const { data: periodData } = await supabase
          .from('financial_periods')
          .select('*')
          .eq('church_id', profile.church_id)
          .order('month', { ascending: true });

        if (periodData && periodData.length > 0) {
          setPeriods(periodData);
          const openPeriod = periodData.find(p => p.status === 'OPEN') || periodData[0];
          setSelectedPeriod(openPeriod.id);
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  /**
   * Fetches transactions, reconciliation metrics, AND cross-references the SJ Koop Ledger.
   */
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
        setStats({ 
          totalIncome: Number(income.toFixed(2)), 
          totalExpense: Number(expense.toFixed(2)), 
          transactionCount: txData.length 
        });
      }

      const { data: periodData } = await supabase
        .from('financial_periods')
        .select('*')
        .eq('id', periodId)
        .single();

      if (periodData) {
        setRecon({
          beginning_balance: Number(periodData.beginning_balance) || 0,
          cib_savings: Number(periodData.cib_savings) || 0,
          cib_current: Number(periodData.cib_current) || 0,
          cib_time_deposit: Number(periodData.cib_time_deposit) || 0,
          coh_petty_cash: Number(periodData.coh_petty_cash) || 0,
          coh_undeposited: Number(periodData.coh_undeposited) || 0,
          coh_advances: Number(periodData.coh_advances) || 0
        });
      }

      // FETCH KOOP LEDGER ENDING BALANCE FOR CROSS-VALIDATION
      const { data: coopData } = await supabase
        .from('coop_monthly_logs')
        .select('ending_balance')
        .eq('financial_period_id', periodId)
        .single();
      
      if (coopData) {
        setCoopEndingBalance(Number(coopData.ending_balance));
      } else {
        setCoopEndingBalance(null);
      }

    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRecon = async () => {
    if (!selectedPeriod) return;
    setSaving(true);
    try {
      const roundedBeg = Number(recon.beginning_balance.toFixed(2));
      const roundedCibSv = Number(recon.cib_savings.toFixed(2));
      const roundedCibCur = Number(recon.cib_current.toFixed(2));
      const roundedCibTime = Number(recon.cib_time_deposit.toFixed(2));
      const roundedCohPet = Number(recon.coh_petty_cash.toFixed(2));
      const roundedCohUnd = Number(recon.coh_undeposited.toFixed(2));
      const roundedCohAdv = Number(recon.coh_advances.toFixed(2));

      const { error } = await supabase
        .from('financial_periods')
        .update({
          beginning_balance: roundedBeg,
          cib_savings: roundedCibSv,
          cib_current: roundedCibCur,
          cib_time_deposit: roundedCibTime,
          coh_petty_cash: roundedCohPet,
          coh_undeposited: roundedCohUnd,
          coh_advances: roundedCohAdv
        })
        .eq('id', selectedPeriod);
      
      if (error) throw error;

      const actualEndingBalance = Number(((roundedCibSv + roundedCibCur + roundedCibTime) + (roundedCohPet + roundedCohUnd + roundedCohAdv)).toFixed(2));
      
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
      alert("Failed to save balances: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExemptReceipt = async (transactionId: string) => {
    try {
      setTransactions(prev => prev.map(t => t.id === transactionId ? { ...t, receipt_exempt: true } : t));
      await supabase.from('transactions').update({ receipt_exempt: true }).eq('id', transactionId);
    } catch (err: any) {
      alert("Failed to exempt transaction: " + err.message);
      fetchTransactionsAndReconForPeriod(selectedPeriod);
    }
  };

  const handleReconChange = (field: keyof typeof recon, value: string) => {
    const numValue = parseFloat(value) || 0;
    setRecon(prev => ({ ...prev, [field]: Number(numValue.toFixed(2)) }));
  };

  const totalBank = Number((recon.cib_savings + recon.cib_current + recon.cib_time_deposit).toFixed(2));
  const totalCash = Number((recon.coh_petty_cash + recon.coh_undeposited + recon.coh_advances).toFixed(2));
  const actualEndingBalance = Number((totalBank + totalCash).toFixed(2));
  
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
    return !exemptKeywords.some(keyword => categoryName.includes(keyword));
  });

  const systemEndingBalance = Number((recon.beginning_balance + stats.totalIncome - stats.totalExpense).toFixed(2));
  const discrepancy = Number((actualEndingBalance - systemEndingBalance).toFixed(2));
  
  const isBalanced = discrepancy === 0;
  const isReady = isBalanced && missingReceipts.length === 0 && transactions.length > 0;

  // ==========================================
  // SMART DISCREPANCY ANALYZER ENGINE
  // Purpose: Mathematically deduces human errors locally.
  // ==========================================
  const analyzerFindings = useMemo(() => {
    if (discrepancy === 0) return [];
    const findings: string[] = [];
    const absDisc = Math.abs(discrepancy);
    
    // Check 1: Round Number Input Typo (Prioritize this to prevent false Polarity flags on flat numbers)
    if (absDisc >= 100 && absDisc % 100 === 0) {
      findings.push(`Round Number Variance: The discrepancy is exactly ₱${absDisc.toLocaleString('en-PH', {minimumFractionDigits: 2})}. Before checking the ledger, carefully verify that you didn't accidentally mistype a digit in your physical Cash in Bank or Cash on Hand inputs.`);
    }

    // Check 2: Transposition Error (Typo check - divisible by 9)
    const centsDisc = Math.round(absDisc * 100);
    if (centsDisc % 9 === 0 && absDisc % 10 !== 0) {
       findings.push(`Transposition Check: The discrepancy of ₱${absDisc.toLocaleString('en-PH', {minimumFractionDigits: 2})} is perfectly divisible by 9. This mathematically hints at a transposed digit typo (e.g. typing 54 instead of 45) in your cash counts.`);
    }

    // Check 3: Exact Match (Missing or Duplicate transaction)
    const exactMatches = transactions.filter(t => Number(t.amount) === absDisc);
    if (exactMatches.length > 0) {
       findings.push(`Missing / Duplicate Entry: We found ${exactMatches.length} transaction(s) for exactly ₱${absDisc.toLocaleString('en-PH', {minimumFractionDigits: 2})}. Check if you forgot to record a bank withdrawal for this, or accidentally encoded a receipt twice.`);
    }

    // Check 4: Polarity Error (Income marked as Expense or vice versa)
    const flippedMatches = transactions.filter(t => Number(t.amount) === (absDisc / 2));
    if (flippedMatches.length > 0) {
       findings.push(`Check for Polarity Flip: If an item is logged as Income instead of Expense, it doubles the ledger error. We found ${flippedMatches.length} transaction(s) for ₱${(absDisc / 2).toLocaleString('en-PH', {minimumFractionDigits: 2})} (exactly half the discrepancy). Verify if their Type is correct.`);
    }

    // Check 5: Breakdown Sub-item Math Error
    const brokenMathTxs = transactions.filter(t => {
      const match = (t.remarks || '').match(/\[Breakdown: (.*?)\]/);
      if (match) {
        const items = match[1].split(', ');
        const sum = items.reduce((acc: number, pair: string) => {
          const lastColon = pair.lastIndexOf(': ₱');
          if (lastColon !== -1) return acc + (parseFloat(pair.substring(lastColon + 3)) || 0);
          return acc;
        }, 0);
        return Math.abs(sum - Number(t.amount)) > 0.01;
      }
      return false;
    });

    if (brokenMathTxs.length > 0) {
       findings.push(`Itemized Breakdown Mismatch: Found ${brokenMathTxs.length} transaction(s) where the manual sub-item breakdown does not mathematically equal the total transaction amount.`);
    }

    return findings;
  }, [discrepancy, transactions]);


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
      
      {/* PORTAL FIX: Ensure Save Success Modal breaks out of local stacking contexts */}
      {showSaveSuccess && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#27272A] rounded-3xl p-8 shadow-2xl flex flex-col items-center justify-center space-y-5 animate-modal min-w-[320px]">
            <div className="h-16 w-16 bg-emerald-100 dark:bg-emerald-950/60 rounded-2xl flex items-center justify-center text-emerald-600 animate-bounce">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Balances Saved!</h3>
              <p className="text-xs text-slate-500">Reconciliation secured & next month updated.</p>
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

        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider hidden sm:block">Select Month:</span>
          <select 
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#121212] px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white shadow-sm focus:border-brand w-full sm:w-auto min-w-[200px]"
          >
            {periods.map(p => (
              <option key={p.id} value={p.id}>{p.period_name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bento-card bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl text-emerald-600 dark:text-emerald-400">
            <HelpCircle className="h-5 w-5" />
          </div>
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
            <div className="bento-card bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg text-amber-600 shrink-0"><AlertTriangle className="h-5 w-5" /></div>
                <div>
                  <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">Action Required: Missing Receipts</h3>
                  <p className="text-xs text-amber-700 dark:text-amber-400">{missingReceipts.length} operational expense(s) missing documentation.</p>
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto custom-scrollbar border border-amber-200/50 rounded-xl bg-white/50 dark:bg-[#121212]/50">
                <table className="w-full text-left text-xs min-w-[500px]">
                  <tbody className="divide-y divide-amber-100 dark:divide-amber-900/30">
                    {missingReceipts.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-amber-50/50 transition-colors">
                        <td className="p-3 w-1/2 font-medium text-slate-800 dark:text-slate-200">
                          {transaction.remarks || transaction.payee_name || 'No Receipt Registered'}
                          <span className="ml-2 text-[10px] text-amber-600">({transaction.categories?.name || 'Uncategorized'})</span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-amber-700 w-1/4">
                          ₱{Number(transaction.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 pr-4 text-right w-1/4">
                          <button onClick={() => handleExemptReceipt(transaction.id)} className="flex items-center justify-end gap-2 text-[10px] font-bold text-slate-500 hover:text-emerald-600 transition-colors ml-auto">
                            <span className="uppercase tracking-wider">Exempt</span>
                            <div className="w-8 h-4 bg-slate-200 dark:bg-slate-700 rounded-full relative"><div className="w-3 h-3 bg-white rounded-full absolute left-[3px] top-[2px]" /></div>
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
              <div className="bento-card bg-white dark:bg-[#121212] space-y-6">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-[#27272A] pb-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-brand dark:text-emerald-500" /> Bank & Cash Reconciliation</h3>
                  <button onClick={handleSaveRecon} disabled={saving} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-xs font-bold transition-all">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    {saving ? 'Saving...' : 'Save Balances'}
                  </button>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Beginning Balance (Start of Month)</label>
                  <input type="number" step="0.01" className="w-full md:w-1/2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 dark:text-white focus:border-brand" value={recon.beginning_balance || ''} onChange={(e) => handleReconChange('beginning_balance', e.target.value)} placeholder="0.00" />
                  <p className="text-[10px] text-slate-500 mt-1.5">Combined cash and bank balance carried over from previous month.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cash in Bank</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Savings Account</label>
                        <input type="number" step="0.01" className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-xs font-mono text-slate-900 dark:text-white focus:border-brand" value={recon.cib_savings || ''} onChange={(e) => handleReconChange('cib_savings', e.target.value)} placeholder="0.00" />
                        
                        {coopEndingBalance !== null && recon.cib_savings !== coopEndingBalance && (
                          <div className="flex items-center gap-1.5 mt-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/30 p-1.5 rounded-lg border border-amber-200 dark:border-amber-900/50">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            <span>Mismatch: SJ Koop Ledger calculated ₱{coopEndingBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                      </div>
                      <div><label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Current Account</label><input type="number" step="0.01" className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-xs font-mono text-slate-900 dark:text-white focus:border-brand" value={recon.cib_current || ''} onChange={(e) => handleReconChange('cib_current', e.target.value)} placeholder="0.00" /></div>
                      <div><label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Time Deposit</label><input type="number" step="0.01" className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-xs font-mono text-slate-900 dark:text-white focus:border-brand" value={recon.cib_time_deposit || ''} onChange={(e) => handleReconChange('cib_time_deposit', e.target.value)} placeholder="0.00" /></div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cash on Hand</h4>
                    <div className="space-y-3">
                      <div><label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Petty Cash</label><input type="number" step="0.01" className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-xs font-mono text-slate-900 dark:text-white focus:border-brand" value={recon.coh_petty_cash || ''} onChange={(e) => handleReconChange('coh_petty_cash', e.target.value)} placeholder="0.00" /></div>
                      <div><label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Undeposited Collections</label><input type="number" step="0.01" className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-xs font-mono text-slate-900 dark:text-white focus:border-brand" value={recon.coh_undeposited || ''} onChange={(e) => handleReconChange('coh_undeposited', e.target.value)} placeholder="0.00" /></div>
                      <div><label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Advances / IOU</label><input type="number" step="0.01" className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-xs font-mono text-slate-900 dark:text-white focus:border-brand" value={recon.coh_advances || ''} onChange={(e) => handleReconChange('coh_advances', e.target.value)} placeholder="0.00" /></div>
                    </div>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-slate-100 dark:border-[#27272A] flex items-center justify-between">
                   <span className="text-sm font-bold text-slate-900 dark:text-white">Actual Physical Balance:</span>
                   <div className="flex items-center gap-2">
                     <span className="text-lg font-mono font-bold text-brand dark:text-emerald-400">₱{actualEndingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                     <button onClick={handleCopyBalance} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors" title="Copy Exact Balance">
                       {copiedBalance ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                     </button>
                   </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
              <div className="bento-card bg-white dark:bg-[#121212] space-y-6">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2"><FileCheck className="h-5 w-5 text-emerald-500" /> Readiness Status</h3>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-start bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2 mt-0.5">Ledger Reconciled</span>
                    {isBalanced ? (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 rounded text-[10px] font-bold uppercase tracking-wider">Passed</span>
                    ) : (
                      <div className="flex flex-col items-end gap-1 text-right">
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 rounded text-[10px] font-bold uppercase tracking-wider">Failed</span>
                        <span className="text-[9px] text-slate-500 leading-tight max-w-[120px]">Physical amount must match Ledger (₱{systemEndingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })})</span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Document Completeness</span>
                    {missingReceipts.length === 0 ? (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 rounded text-[10px] font-bold uppercase tracking-wider">Passed</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 rounded text-[10px] font-bold uppercase tracking-wider">{missingReceipts.length} Missing</span>
                    )}
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Discrepancy</span>
                      <span className={`text-sm font-mono font-bold ${discrepancy === 0 ? 'text-emerald-600' : 'text-red-600'}`}>₱{Math.abs(discrepancy).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
                
                <button disabled={!isReady} className={`w-full py-3.5 mt-6 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 ${isReady ? 'bg-emerald-600 text-white cursor-pointer' : 'bg-slate-100 text-slate-400 border border-slate-200 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed dark:border-slate-700'}`}>
                  {isReady ? 'System Ready for Export' : 'Resolve Issues to Export'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* PORTAL FIX: Ensure Fault Guide Modal breaks out of local stacking contexts */}
      {showFaultGuide && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#27272A] rounded-3xl p-8 shadow-2xl space-y-6 animate-modal max-h-[85vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2"><HelpCircle className="h-5 w-5 text-emerald-500" /> Discrepancy Fault-Finding Checklist</h3>
              <button onClick={() => setShowFaultGuide(false)} className="p-2 text-slate-400 hover:text-white rounded-xl"><X className="h-4 w-4" /></button>
            </div>

            {/* DYNAMIC SMART ANALYZER INJECTION */}
            {!isBalanced && analyzerFindings.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-4 rounded-xl space-y-2">
                <h4 className="font-bold text-amber-900 dark:text-amber-400 flex items-center gap-2 text-sm">
                  <SearchCode className="h-4 w-4" /> Smart Analysis Findings:
                </h4>
                <ul className="list-disc pl-5 text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed space-y-2 font-medium">
                  {analyzerFindings.map((finding, idx) => (
                    <li key={idx}>{finding}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl space-y-1 border border-slate-200 dark:border-slate-800">
                <h4 className="font-bold text-slate-900 dark:text-white">1. Beginning Balance Carryover Check</h4>
                <p>Verify that your starting beginning balance correctly matches last month's final ending cash balance.</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl space-y-1 border border-slate-200 dark:border-slate-800">
                <h4 className="font-bold text-slate-900 dark:text-white">2. Unassigned or Unrecorded Transactions</h4>
                <p>Check if any cash collections, offerings, or disbursements were left unassigned or omitted from the ledger.</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl space-y-1 border border-slate-200 dark:border-slate-800">
                <h4 className="font-bold text-slate-900 dark:text-white">3. San Jose Koop Passbook Pass-Throughs</h4>
                <p>Ensure all Koop deposits and monthly interest earnings are logged accurately in the SJ Koop Ledger.</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl space-y-1 border border-slate-200 dark:border-slate-800">
                <h4 className="font-bold text-slate-900 dark:text-white">4. Transposed Digits in Physical Cash Breakdown</h4>
                <p>Re-count your physical bills and coins against Petty Cash and Undeposited Collections for typing transpositions.</p>
              </div>
            </div>
            <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
              <button onClick={() => setShowFaultGuide(false)} className="px-6 py-2.5 bg-slate-900 dark:bg-slate-800 text-white rounded-xl text-xs font-bold">Close Guide</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
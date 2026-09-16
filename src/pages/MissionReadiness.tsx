import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle2, AlertTriangle, ShieldCheck, FileCheck, HelpCircle, Loader2, Save, Copy, Check } from 'lucide-react';

export default function MissionReadiness() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [copiedBalance, setCopiedBalance] = useState(false);
  
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
      alert("Failed to save balances: " + error.message);
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
      alert("Failed to exempt transaction: " + err.message);
      fetchTransactionsAndReconForPeriod(selectedPeriod);
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
      
      {showSaveSuccess && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#27272A] rounded-3xl p-8 shadow-2xl flex flex-col items-center justify-center space-y-5 animate-modal min-w-[320px]">
            <div className="h-16 w-16 bg-emerald-100 dark:bg-emerald-950/60 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 animate-bounce">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Balances Saved!</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Reconciliation secured & next month updated.</p>
            </div>
          </div>
        </div>
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
            className="rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#121212] px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white shadow-sm focus:border-brand focus:ring-1 focus:ring-brand w-full sm:w-auto min-w-[200px]"
          >
            {periods.map(p => (
              <option key={p.id} value={p.id}>{p.period_name}</option>
            ))}
          </select>
        </div>
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
                          {/* FIX: Using remarks or payee name instead of description */}
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
              <div className="bento-card bg-white dark:bg-[#121212] space-y-6">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-[#27272A] pb-4">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-brand dark:text-emerald-500" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Bank & Cash Reconciliation</h3>
                  </div>
                  <button
                    onClick={handleSaveRecon}
                    disabled={saving}
                    className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0"
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    {saving ? 'Saving...' : 'Save Balances'}
                  </button>
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

            {/* FIX: Improved Light Mode Classes for Readiness Status */}
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
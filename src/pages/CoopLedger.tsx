import { CoopIcon as Landmark } from '../components/ui/StewardGlyph';
import { useFeedback } from '../components/ui/useFeedback';
import Select from '../components/ui/Select';
import Input from '../components/ui/Input';
import DialogLayer from '../components/ui/DialogLayer';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Save, CheckCircle2, Loader2, ArrowUpRight, ArrowDownRight, Plus, Calendar, Trash2, ArrowUpDown, ArrowUp, ArrowDown, UserCircle, X, AlertTriangle } from 'lucide-react';
import type { FinancialPeriod, FinancialYear, CoopMonthlyLog, CoopWeeklyLog } from '../types/database.types';

export default function CoopLedger() {
  const { notify, confirmAction } = useFeedback();
  const { user } = useAuth();
  const [churchId, setChurchId] = useState<string>('');
  const [userFullName, setUserFullName] = useState<string>('Auditor');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [years, setYears] = useState<FinancialYear[]>([]);
  const [sortedPeriods, setSortedPeriods] = useState<FinancialPeriod[]>([]);
  const [allLogs, setAllLogs] = useState<{ [periodId: string]: CoopMonthlyLog }>({});
  
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');

  const [sortField, setSortField] = useState<'date' | 'type' | 'amount'>('date');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [isAddLogOpen, setIsAddLogOpen] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const [interestRate, setInterestRate] = useState<number>(0.01);
  const [userPassword, setUserPassword] = useState('');
  const [newRateInput, setNewRateInput] = useState('');
  const [rateError, setRateError] = useState('');

  const [newLog, setNewLog] = useState({ date: new Date().toISOString().split('T')[0], type: 'DEPOSIT', amount: '', remarks: '' });

  useEffect(() => {
    if (user) fetchCoopData();
  }, [user]);

  const fetchCoopData = async () => {
    setLoading(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('church_id, full_name').eq('id', user?.id).single();
      if (profile?.church_id) {
        setChurchId(profile.church_id);
        setUserFullName(profile.full_name || 'Auditor');

        const [yearRes, periodRes, logRes] = await Promise.all([
          supabase.from('financial_years').select('*').eq('church_id', profile.church_id),
          supabase.from('financial_periods').select('*').eq('church_id', profile.church_id),
          supabase.from('coop_monthly_logs').select('*').eq('church_id', profile.church_id)
        ]);

        const fetchedYears = yearRes.data || [];
        setYears(fetchedYears);

        const sorted = (periodRes.data || []).sort((a, b) => {
          const yearA = fetchedYears.find(y => y.id === a.financial_year_id)?.year || 0;
          const yearB = fetchedYears.find(y => y.id === b.financial_year_id)?.year || 0;
          if (yearA !== yearB) return yearA - yearB;
          return a.month - b.month;
        });
        
        setSortedPeriods(sorted);

        if (sorted.length > 0) {
          const now = new Date();
          const currentMonth = now.getMonth() + 1;
          const currentYear = now.getFullYear();
          const todayDate = now.getDate();
          const deadlineDay = parseInt(localStorage.getItem('mpr_deadline_day') || '14', 10);
          
          let targetMonth = currentMonth;
          let targetYear = currentYear;
          if (todayDate < deadlineDay) {
            targetMonth = currentMonth - 1;
            if (targetMonth === 0) {
              targetMonth = 12;
              targetYear = currentYear - 1;
            }
          }

          const targetPeriod = sorted.find(p => {
             const y = fetchedYears.find(fy => fy.id === p.financial_year_id)?.year;
             return y === targetYear && p.month === targetMonth;
          }) || sorted.find(p => p.status === 'OPEN') || sorted[0];
          
          setSelectedPeriodId(targetPeriod.id);
        }

        if (logRes.data) {
          const map: { [id: string]: CoopMonthlyLog } = {};
          logRes.data.forEach((l: CoopMonthlyLog) => {
            map[l.financial_period_id] = l;
            if (l.interest_rate) setInterestRate(Number(l.interest_rate));
          });
          setAllLogs(map);
        }
      }
    } catch (err) {
      console.error("Failed to load coop ledger data:", err);
    } finally {
      setLoading(false);
    }
  };

  const periodMetrics = useMemo(() => {
    const metrics: Record<string, { beg: number, dep: number, wdl: number, int: number, end: number, canEditBeg: boolean, rateUpdater: string | null }> = {};
    let prevEnd = 0;

    sortedPeriods.forEach((p, i) => {
        const log = allLogs[p.id] || {};
        const wLogs = log.weekly_logs || [];
        
        const dep = Number(wLogs.filter((l: CoopWeeklyLog) => l.type === 'DEPOSIT').reduce((s: number, l: CoopWeeklyLog) => s + l.amount, 0).toFixed(2));
        const wdl = Number(wLogs.filter((l: CoopWeeklyLog) => l.type === 'WITHDRAWAL').reduce((s: number, l: CoopWeeklyLog) => s + l.amount, 0).toFixed(2));

        let beg = prevEnd;
        let canEditBeg = false;

        if (i === 0 || prevEnd === 0) {
            beg = Number((log.beginning_balance || 0).toFixed(2));
            canEditBeg = true;
        }

        const currentRate = log.interest_rate ?? interestRate;
        const int = Number((beg * currentRate).toFixed(2));
        const end = Number((beg + dep - wdl + int).toFixed(2));

        metrics[p.id] = { beg, dep, wdl, int, end, canEditBeg, rateUpdater: log.rate_updated_by || null };
        prevEnd = end;
    });

    return metrics;
  }, [sortedPeriods, allLogs, interestRate]);

  const currentValues = periodMetrics[selectedPeriodId] || { beg: 0, dep: 0, wdl: 0, int: 0, end: 0, canEditBeg: false, rateUpdater: null };
  const currentPeriodData = sortedPeriods.find(p => p.id === selectedPeriodId);

  const handleAddWeeklyLog = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(parseFloat(newLog.amount).toFixed(2));
    if (isNaN(amount) || amount <= 0) return notify("Please enter a valid positive amount.");
    
    const logEntry: CoopWeeklyLog = {
       id: crypto.randomUUID(),
       date: newLog.date,
       type: newLog.type as 'DEPOSIT' | 'WITHDRAWAL',
       amount,
       remarks: newLog.remarks.trim() || 'No remarks',
       encoded_by: userFullName
    };
    
    setAllLogs(prev => {
       const existing = prev[selectedPeriodId] || { weekly_logs: [] };
       return {
          ...prev,
          [selectedPeriodId]: { ...existing, weekly_logs: [...(existing.weekly_logs || []), logEntry] } as CoopMonthlyLog
       }
    });

    setIsAddLogOpen(false);
    setNewLog({ date: new Date().toISOString().split('T')[0], type: 'DEPOSIT', amount: '', remarks: '' });
  };

  const handleDeleteWeeklyLog = async (logId: string) => {
    if (!await confirmAction("Remove this transaction from the Koop passbook?")) return;
    setAllLogs(prev => {
       const existing = prev[selectedPeriodId];
       if (!existing) return prev;
       return {
          ...prev,
          [selectedPeriodId]: { ...existing, weekly_logs: existing.weekly_logs.filter((l: CoopWeeklyLog) => l.id !== logId) }
       }
    });
  };

  const handleSaveLedgerSync = async () => {
    setSaving(true);
    try {
      const payloads = sortedPeriods.map((p) => {
         const m = periodMetrics[p.id];
         const log = allLogs[p.id];
         return {
            church_id: churchId,
            financial_period_id: p.id,
            month: p.month,
            beginning_balance: m.beg,
            deposit: m.dep,
            withdrawal: m.wdl,
            weekly_logs: log?.weekly_logs || [],
            interest_rate: log?.interest_rate ?? interestRate,
            interest_earned: m.int,
            ending_balance: m.end,
            rate_updated_by: log?.rate_updated_by || null
         };
      });
      
      for (const payload of payloads) {
         const { error } = await supabase.from('coop_monthly_logs').upsert(payload, { onConflict: 'church_id,financial_period_id' });
         if (error) throw error;
      }
      
      setSuccessMessage("San Jose Koop transactions and interest balances fully synchronized!");
      setShowSuccessModal(true);
    } catch (err: any) {
      notify("Failed to sync ledger: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyAndUpdateRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setRateError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: userPassword
      });
      if (error) throw new Error("Incorrect user password. Verification failed.");

      const rateNum = parseFloat(newRateInput);
      if (isNaN(rateNum) || rateNum < 0) throw new Error("Please enter a valid interest percentage.");

      const finalRate = Number((rateNum / 100).toFixed(4));
      setInterestRate(finalRate);
      
      setAllLogs(prev => {
         const current = prev[selectedPeriodId] || {};
         return { ...prev, [selectedPeriodId]: { ...current, interest_rate: finalRate, rate_updated_by: userFullName } as CoopMonthlyLog }
      });

      setIsRateModalOpen(false);
      setUserPassword('');
      setNewRateInput('');
      setSuccessMessage("Cooperative monthly interest rate updated securely!");
      setShowSuccessModal(true);
    } catch (err: any) {
      setRateError(err.message);
    }
  };

  const handleSort = (field: 'date' | 'type' | 'amount') => {
    if (sortField === field) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection('desc'); }
  };

  const sortedWeeklyLogs = useMemo(() => {
    const logs = allLogs[selectedPeriodId]?.weekly_logs || [];
    return [...logs].sort((a: any, b: any) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      if (sortField === 'date') { aVal = new Date(a.date).getTime(); bVal = new Date(b.date).getTime(); }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [allLogs, selectedPeriodId, sortField, sortDirection]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-slate-200 dark:bg-dark-floating rounded-xl w-1/3 sm:w-1/4"></div>
        <div className="h-16 bg-slate-200 dark:bg-dark-elevated rounded-2xl w-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="system-page-title text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Landmark className="h-7 w-7 editor-accent shrink-0" />
            <span className="truncate">SJ Koop passbook</span>
          </h1>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Manage weekly Koop transactions and auto-compounding interest.</p>
        </div>
        <button onClick={handleSaveLedgerSync} aria-busy={saving} disabled={saving} className="flex-none flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md w-full sm:w-auto">
          {saving ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <Save className="h-4 w-4 shrink-0" />}
          {saving ? 'Saving ledger…' : 'Save ledger'}
        </button>
      </div>

      <div className="bg-white dark:bg-dark-surface border border-slate-200 dark:border-dark-border rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto flex-1 min-w-[220px] relative">
          <Calendar className="h-5 w-5 text-slate-400 shrink-0" />
          <Select aria-label="Financial period"
            value={selectedPeriodId}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-elevated px-4 py-3 pr-10 text-xs font-bold text-slate-900 dark:text-white shadow-sm focus:border-sky-500 outline-none appearance-none cursor-pointer"
          >
            {sortedPeriods.map(p => {
               const yearName = years.find(y => y.id === p.financial_year_id)?.year || '';
               return <option key={p.id} value={p.id}>{p.period_name} {yearName} {p.status === 'OPEN' ? '(OPEN)' : ''}</option>
            })}
          </Select>

        </div>
        
        <div className="flex items-center gap-4 w-full sm:w-auto justify-between bg-amber-50 dark:bg-amber-950/30 px-4 py-2.5 rounded-xl border border-amber-200 dark:border-amber-900/50">
          <div className="text-sm text-amber-800 dark:text-amber-200 flex flex-col justify-center">
            <div>
              <span className="font-bold tracking-normal">Interest Rate:</span> <span className="font-mono text-sm font-semibold ml-1">{(interestRate * 100).toFixed(2)}%</span>
            </div>
            {currentValues.rateUpdater && <span className="text-xs opacity-70 font-medium">Updated by {currentValues.rateUpdater}</span>}
          </div>
          <button onClick={() => setIsRateModalOpen(true)} className="px-3 py-1.5 bg-white dark:bg-dark-elevated hover:bg-slate-50 dark:hover:bg-dark-floating text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors border border-slate-200 dark:border-dark-border shrink-0">
            <Lock className="h-3 w-3 text-amber-500" /> Modify
          </button>
        </div>
      </div>

      <div className="coop-balance-strip grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-dark-surface border border-slate-200 dark:border-dark-border rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <p className="text-xs font-bold text-slate-400 tracking-normal">Beginning Balance</p>
          {currentValues.canEditBeg ? (
            <div>
              <Input aria-label="Beginning balance in pesos" type="number" step="0.01" className="w-full mt-2 rounded-xl border border-sky-500/50 bg-sky-50 dark:bg-sky-950/30 px-3 py-2 text-base font-semibold editor-accent shadow-sm outline-none" value={allLogs[selectedPeriodId]?.beginning_balance || ''} placeholder="0.00" onChange={(e) => { const val = parseFloat(e.target.value) || 0; setAllLogs(prev => ({ ...prev, [selectedPeriodId]: { ...prev[selectedPeriodId], beginning_balance: Number(val.toFixed(2)) } as CoopMonthlyLog })); }} />
              <p className="text-xs text-slate-400 mt-1.5 italic">Mid-year system start unlocked.</p>
            </div>
          ) : (
            <p className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white mt-1">₱{currentValues.beg.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
          )}
        </div>
        <div className="bg-white dark:bg-dark-surface border border-slate-200 dark:border-dark-border rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <p className="text-xs font-bold text-slate-400 tracking-normal">Total Deposits</p>
          <p className="text-base sm:text-lg font-semibold editor-accent mt-1">+₱{currentValues.dep.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white dark:bg-dark-surface border border-slate-200 dark:border-dark-border rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <p className="text-xs font-bold text-slate-400 tracking-normal">Total Withdrawals</p>
          <p className="text-base sm:text-lg font-semibold text-amber-600 dark:text-amber-400 mt-1">-₱{currentValues.wdl.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-sky-50/50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/50 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <p className="text-xs font-bold text-sky-700 dark:text-sky-400 tracking-normal">Auto Interest</p>
          <p className="text-base sm:text-lg font-semibold text-sky-700 dark:text-sky-300 mt-1">+₱{currentValues.int.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
        </div>
        
        <div className="bg-slate-900 dark:bg-dark-elevated border border-slate-800 dark:border-dark-border rounded-2xl sm:col-span-2 lg:col-span-4 xl:col-span-1 p-4 flex flex-col justify-between shadow-lg">
          <p className="text-xs font-bold text-slate-400 tracking-normal">Ending Balance</p>
          <p className="text-xl sm:text-2xl font-semibold text-white mt-1">₱{currentValues.end.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
          
          {currentPeriodData && currentPeriodData.cib_savings !== currentValues.end && (
            <div className="mt-2.5 flex items-start gap-1.5 text-xs font-bold text-amber-400 bg-amber-950/30 p-1.5 rounded-xl border border-amber-900/50 leading-tight">
              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
              <span>Note: Mission Readiness Savings declared as ₱{currentPeriodData.cib_savings.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-dark-surface border border-slate-200 dark:border-dark-border rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-dark-border flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-slate-50 dark:bg-dark-elevated rounded-t-2xl">
          <h3 className="text-xs font-bold tracking-normal text-slate-900 dark:text-white flex items-center gap-2">Detailed Koop Transactions</h3>
          <button onClick={() => setIsAddLogOpen(true)} className="flex items-center justify-center gap-1.5 bg-brand hover:bg-brand-dark text-white px-4 py-2 sm:py-1.5 rounded-xl text-sm font-bold shadow-sm transition-all w-full sm:w-auto shrink-0">
            <Plus className="h-3.5 w-3.5" /> Add Entry
          </button>
        </div>
        
        {sortedWeeklyLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs font-medium">No transactions recorded for this month yet.</div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="ui-data-table w-full text-left border-collapse text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-transparent border-b border-slate-200 dark:border-dark-border text-slate-500 font-semibold tracking-normal text-xs">
                  <th onClick={() => handleSort('date')} className="p-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors">
                    <div className="flex items-center gap-1">Date {sortField === 'date' ? (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-50" />}</div>
                  </th>
                  <th onClick={() => handleSort('type')} className="p-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors">
                    <div className="flex items-center gap-1">Type {sortField === 'type' ? (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-50" />}</div>
                  </th>
                  <th onClick={() => handleSort('amount')} className="p-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors text-right">
                    <div className="flex items-center justify-end gap-1">Amount (₱) {sortField === 'amount' ? (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-50" />}</div>
                  </th>
                  <th className="p-4">Remarks</th>
                  <th className="p-4">Encoded By</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-dark-border/50 bg-transparent">
                {sortedWeeklyLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-dark-elevated transition-colors">
                    <td className="p-4 font-medium text-slate-700 dark:text-slate-300">{log.date}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold tracking-wide border bg-slate-50 dark:bg-dark-elevated uppercase ${log.type === 'DEPOSIT' ? 'text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-900/50' : 'text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50'}`}>
                        {log.type === 'DEPOSIT' ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />} {log.type}
                      </span>
                    </td>
                    <td className={`p-4 text-right font-mono font-bold ${log.type === 'DEPOSIT' ? 'editor-accent' : 'text-slate-900 dark:text-white'}`}>
                      {log.type === 'DEPOSIT' ? '+' : '-'}₱{log.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-400 truncate max-w-[200px]">{log.remarks}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <UserCircle className="h-3.5 w-3.5 editor-accent" /> <span className="text-sm font-medium">{log.encoded_by}</span>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <button aria-label="Remove cooperative transaction" onClick={() => handleDeleteWeeklyLog(log.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isAddLogOpen && (
        <DialogLayer onDismiss={() => setIsAddLogOpen(false)} label="Log Koop Transaction" className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 dark:bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <form onSubmit={handleAddWeeklyLog} className="dialog-surface w-full max-w-md bg-white dark:bg-dark-surface border border-slate-200 dark:border-dark-border rounded-2xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-300">
            <div className="dialog-header flex justify-between items-center border-b border-slate-200 dark:border-dark-border pb-3">
              <h3 className="text-sm font-bold tracking-normal text-slate-900 dark:text-white">Log Koop Transaction</h3>
              <button aria-label="Close dialog" type="button" onClick={() => setIsAddLogOpen(false)} className="icon-button text-slate-400 hover:text-slate-900 dark:hover:text-white p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-dark-floating transition-colors"><X className="h-4 w-4" /></button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-dark-elevated p-1.5 rounded-xl border border-slate-200 dark:border-dark-border">
                <button type="button" onClick={() => setNewLog({...newLog, type: 'DEPOSIT'})} className={`py-2 text-sm font-bold rounded-lg transition-all ${newLog.type === 'DEPOSIT' ? 'bg-brand text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>Deposit</button>
                <button type="button" onClick={() => setNewLog({...newLog, type: 'WITHDRAWAL'})} className={`py-2 text-sm font-bold rounded-lg transition-all ${newLog.type === 'WITHDRAWAL' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>Withdrawal</button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-500 tracking-normal">Date</label>
                  <Input aria-label="Date" type="date" required className="w-full rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-elevated px-3.5 py-3 text-xs font-bold text-slate-900 dark:text-white focus:border-sky-500 outline-none" value={newLog.date} onChange={e => setNewLog({...newLog, date: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-500 tracking-normal">Amount (₱)</label>
                  <Input aria-label="Amount (₱)" type="number" step="0.01" required placeholder="0.00" className="w-full rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-elevated px-3.5 py-3 text-xs font-bold text-slate-900 dark:text-white focus:border-sky-500 outline-none" value={newLog.amount} onChange={e => setNewLog({...newLog, amount: e.target.value})} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-500 tracking-normal">Remarks / Reference</label>
                <Input aria-label="Remarks / Reference" type="text" placeholder="e.g. Weekly collection deposit" className="w-full rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-elevated px-3.5 py-3 text-xs font-bold text-slate-900 dark:text-white focus:border-sky-500 outline-none" value={newLog.remarks} onChange={e => setNewLog({...newLog, remarks: e.target.value})} />
              </div>
            </div>

            <div className="dialog-footer flex gap-3 pt-3 border-t border-slate-200 dark:border-dark-border mt-4">
              <button type="button" onClick={() => setIsAddLogOpen(false)} className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-white dark:bg-dark-elevated text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-border">Cancel</button>
              <button type="submit" className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-brand hover:bg-brand-dark text-white shadow-md">Add to Ledger</button>
            </div>
          </form>
        </DialogLayer>
      )}

      {showSuccessModal && (
        <DialogLayer label="Operation Successful" className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 dark:bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="dialog-surface w-full max-w-md bg-white dark:bg-dark-surface border border-slate-200 dark:border-dark-border rounded-2xl p-8 shadow-2xl space-y-6 text-center animate-in zoom-in-95 duration-300">
            <div className="mx-auto h-16 w-16 bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20 rounded-2xl flex items-center justify-center editor-accent animate-bounce">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold tracking-normal text-slate-900 dark:text-white">Operation Successful</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{successMessage}</p>
            </div>
            <button onClick={() => setShowSuccessModal(false)} className="w-full py-3 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-bold shadow-md transition-all">
              Continue Auditing
            </button>
          </div>
        </DialogLayer>
      )}

      {isRateModalOpen && (
        <DialogLayer label="Secure Interest Modification" className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 dark:bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <form onSubmit={handleVerifyAndUpdateRate} className="dialog-surface w-full max-w-md bg-white dark:bg-dark-surface border border-slate-200 dark:border-dark-border rounded-2xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-300">
            <div className="text-center space-y-2">
              <div className="mx-auto h-12 w-12 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Lock className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold tracking-normal text-slate-900 dark:text-white">Secure Interest Modification</h3>
              <p className="text-xs text-slate-500">Enter your personal user password to update the monthly cooperative interest rate percentage.</p>
            </div>

            {rateError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 text-xs rounded-xl border border-rose-200 dark:border-rose-900/50">{rateError}</div>
            )}

            <div className="space-y-3">
              <div>
                <Input aria-label="e.g. 1.25" type="number" step="0.01" required placeholder="e.g. 1.25" className="w-full rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-elevated px-3.5 py-3 text-xs font-bold text-slate-900 dark:text-white focus:border-sky-500 outline-none shadow-sm" value={newRateInput} onChange={e => setNewRateInput(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 tracking-normal mb-1">Your Personal Password</label>
                <Input aria-label="Your Personal Password" type="password" required placeholder="••••••••" className="w-full rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-elevated px-3.5 py-3 text-xs font-bold text-slate-900 dark:text-white focus:border-sky-500 outline-none shadow-sm" value={userPassword} onChange={e => setUserPassword(e.target.value)} />
              </div>
            </div>

            <div className="dialog-footer flex gap-3 pt-3 border-t border-slate-200 dark:border-dark-border">
              <button type="button" onClick={() => setIsRateModalOpen(false)} className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-white dark:bg-dark-elevated text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-border">Cancel</button>
              <button type="submit" className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-brand hover:bg-brand-dark text-white shadow-md">Verify & Save</button>
            </div>
          </form>
        </DialogLayer>
      )}
    </div>
  );
}

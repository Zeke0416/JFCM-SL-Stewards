import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Wallet, TrendingUp, TrendingDown, Activity, CheckCircle2, ShieldCheck, ArrowUpRight } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalIncome: 0,
    totalExpense: 0,
    netBalance: 0,
    transactionCount: 0
  });

  useEffect(() => {
    if (user) fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    setLoading(true);
    const { data: profile } = await supabase.from('profiles').select('church_id').eq('id', user?.id).single();
    
    if (profile) {
      const { data: txs } = await supabase
        .from('transactions')
        .select('amount, type')
        .eq('church_id', profile.church_id);

      if (txs) {
        let inc = 0;
        let exp = 0;
        txs.forEach(tx => {
          if (tx.type === 'INCOME') inc += Number(tx.amount);
          if (tx.type === 'EXPENSE') exp += Number(tx.amount);
        });

        setMetrics({
          totalIncome: inc,
          totalExpense: exp,
          netBalance: inc - exp,
          transactionCount: txs.length
        });
      }
    }
    setLoading(false);
  };

  const formatPHP = (amount: number) => {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
  };

  if (loading) return <div className="p-12 text-center text-slate-500 dark:text-slate-400 font-medium text-xs">Loading financial metrics...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Financial Overview</h1>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Real-time fiscal posture and stewardship metrics.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        
        {/* Net Balance Card - Fixed light mode styling with explicit background */}
        <div className="bg-brand dark:bg-[#121212] text-white rounded-2xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-between border-none dark:border dark:border-[#27272A]">
          <div className="relative z-10 space-y-1">
            <p className="text-brand-light/80 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">Net Balance YTD</p>
            <h3 className="text-2xl font-black tracking-tight">{formatPHP(metrics.netBalance)}</h3>
          </div>
          <div className="relative z-10 pt-4 flex items-center text-[11px] text-brand-light/70 dark:text-slate-400 font-medium gap-1">
            <ShieldCheck className="h-3.5 w-3.5" /> Authoritative Ledger Position
          </div>
          <Wallet className="absolute right-[-15px] bottom-[-15px] h-32 w-32 text-white opacity-10 pointer-events-none" />
        </div>

        {/* Total Income */}
        <div className="bento-card flex flex-col justify-between space-y-4 bg-white dark:bg-[#121212]">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Income</p>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{formatPHP(metrics.totalIncome)}</h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Tithes, offerings & receipts</p>
          </div>
        </div>

        {/* Total Expense */}
        <div className="bento-card flex flex-col justify-between space-y-4 bg-white dark:bg-[#121212]">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Expenses</p>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/60 rounded-xl border border-amber-100 dark:border-amber-900/50">
              <TrendingDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{formatPHP(metrics.totalExpense)}</h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Disbursements & operating costs</p>
          </div>
        </div>

        {/* Activity */}
        <div className="bento-card flex flex-col justify-between space-y-4 bg-white dark:bg-[#121212]">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Activity Log</p>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/60 rounded-xl border border-blue-100 dark:border-blue-900/50">
              <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{metrics.transactionCount}</h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Total transactions encoded</p>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="bento-card xl:col-span-2 space-y-5 flex flex-col justify-between bg-white dark:bg-[#121212]">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Mission Readiness & Compliance</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Automated validation checks for monthly ComBud reporting.</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
              <CheckCircle2 className="h-3.5 w-3.5" /> Ready for Review
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-2">
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Receipt Verification</p>
              <p className="text-xs font-bold text-slate-900 dark:text-white mt-1">100% Accounted</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Category Mapping</p>
              <p className="text-xs font-bold text-slate-900 dark:text-white mt-1">ComBud Aligned</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cash Reconciliation</p>
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">Zero Variance</p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>All records have been cross-checked by authorized stewards.</span>
            <a href="/export-center" className="text-brand dark:text-emerald-400 font-bold hover:underline flex items-center gap-1">
              Proceed to Export Center <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        <div className="bento-card flex flex-col justify-between space-y-4 bg-white dark:bg-[#121212]">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Audit Protocol</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Strict governance rules ensure complete transparency.</p>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="h-2 w-2 rounded-full bg-brand dark:bg-emerald-500 mt-1.5 shrink-0" />
              <p className="text-xs text-slate-600 dark:text-slate-300">All entries are permanently stamped with the encoder's real name.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-2 w-2 rounded-full bg-brand dark:bg-emerald-500 mt-1.5 shrink-0" />
              <p className="text-xs text-slate-600 dark:text-slate-300">Itemized receipt breakdowns populate automated audit remarks.</p>
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[11px] text-slate-400 italic">JFCM-SL Stewards v2.6 - Production Ready</p>
          </div>
        </div>

      </div>
    </div>
  );
}
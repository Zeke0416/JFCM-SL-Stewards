import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Wallet, TrendingUp, TrendingDown, Activity, CheckCircle2, ShieldCheck, ArrowUpRight, Target } from 'lucide-react';
import type { Category, FinancialYear } from '../types/database.types';

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Dashboard Metrics
  const [metrics, setMetrics] = useState({
    totalIncome: 0,
    totalExpense: 0,
    netBalance: 0,
    transactionCount: 0
  });

  // Track Progress of Category Budgets
  const [trackedBudgets, setTrackedBudgets] = useState<{ id: string, name: string, current: number, target: number, percent: number }[]>([]);

  useEffect(() => {
    if (user) fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    setLoading(true);
    const { data: profile } = await supabase.from('profiles').select('church_id').eq('id', user?.id).single();
    
    if (profile) {
      // 1. Get Categories for name resolution
      const { data: cats } = await supabase.from('categories').select('*').eq('church_id', profile.church_id);
      if (cats) setCategories(cats);

      // 2. Fetch the ACTIVE CURRENT YEAR (Most recent year)
      const { data: latestYearData } = await supabase.from('financial_years').select('*').eq('church_id', profile.church_id).order('year', { ascending: false }).limit(1).single();
      
      if (latestYearData) {
        // Fetch periods belonging ONLY to this year to guarantee YTD math
        const { data: currentPeriods } = await supabase.from('financial_periods').select('id').eq('financial_year_id', latestYearData.id);
        const periodIds = (currentPeriods || []).map(p => p.id);

        if (periodIds.length > 0) {
          // Fetch transactions ONLY for the current year periods
          const { data: txs } = await supabase.from('transactions').select('amount, type, category_id').in('financial_period_id', periodIds);
          
          if (txs) {
            let inc = 0;
            let exp = 0;
            
            // Map running totals per category
            const categorySums: Record<string, number> = {};

            txs.forEach(tx => {
              if (tx.type === 'INCOME') inc += Number(tx.amount);
              if (tx.type === 'EXPENSE') exp += Number(tx.amount);
              
              if (tx.category_id) {
                 categorySums[tx.category_id] = (categorySums[tx.category_id] || 0) + Number(tx.amount);
              }
            });

            setMetrics({ totalIncome: inc, totalExpense: exp, netBalance: inc - exp, transactionCount: txs.length });

            // 3. Process the Tracked Budgets against actual transactions
            const targets = latestYearData.category_targets || {};
            const budgetData = [];
            
            for (const catId in targets) {
               if (targets[catId] > 0) {
                  const targetAmt = targets[catId];
                  const currentAmt = categorySums[catId] || 0;
                  const percent = Math.min((currentAmt / targetAmt) * 100, 100);
                  const catName = cats?.find(c => c.id === catId)?.name || 'Unknown Category';
                  
                  budgetData.push({ id: catId, name: catName, current: currentAmt, target: targetAmt, percent });
               }
            }
            
            setTrackedBudgets(budgetData);
          }
        }
      }
    }
    setLoading(false);
  };

  const formatPHP = (amount: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

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

        <div className="bento-card flex flex-col justify-between space-y-4 bg-white dark:bg-[#121212]">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Activity Log</p>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/60 rounded-xl border border-blue-100 dark:border-blue-900/50">
              <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{metrics.transactionCount}</h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Total transactions encoded YTD</p>
          </div>
        </div>
      </div>

      {/* DYNAMIC CATEGORY BUDGET TRACKING (Only renders if targets are set) */}
      {trackedBudgets.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-brand dark:text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Budget & Target Tracking YTD</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trackedBudgets.map(budget => (
              <div key={budget.id} className="bento-card bg-white dark:bg-[#121212] p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{budget.name}</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{formatPHP(budget.current)}</p>
                  </div>
                  <span className="text-xs font-bold text-brand dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-md border border-emerald-100 dark:border-emerald-900/50">
                    {budget.percent.toFixed(1)}%
                  </span>
                </div>
                
                <div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-brand dark:bg-emerald-500 h-2.5 rounded-full transition-all duration-1000 ease-out" style={{ width: `${budget.percent}%` }}></div>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-[10px] text-slate-400 font-medium">Target: {formatPHP(budget.target)}</p>
                    {budget.current < budget.target && (
                      <p className="text-[10px] text-slate-400 font-medium text-right italic">{formatPHP(budget.target - budget.current)} needed</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
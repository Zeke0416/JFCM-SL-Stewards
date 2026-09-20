import { Wallet, TrendingUp, TrendingDown, Activity, ShieldCheck } from 'lucide-react';

export default function MetricsCards({ metrics, formatPHP }: { metrics: any, formatPHP: (val: number) => string }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
      <div className="bg-brand dark:bg-[#121212] text-white rounded-2xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-between border-none dark:border dark:border-[#27272A]">
        <div className="relative z-10 space-y-1">
          <p className="text-brand-light/80 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">Net Balance YTD</p>
          <h3 className="text-2xl font-black tracking-tight">₱{formatPHP(metrics.netBalance)}</h3>
        </div>
        <div className="relative z-10 pt-4 flex items-center text-[11px] text-brand-light/70 dark:text-slate-400 font-medium gap-1">
          <ShieldCheck className="h-3.5 w-3.5" /> Authoritative Ledger Position
        </div>
        <Wallet className="absolute right-[-15px] bottom-[-15px] h-32 w-32 text-white opacity-10 pointer-events-none" />
      </div>

      <div className="bento-card flex flex-col justify-between space-y-4 bg-white dark:bg-[#121212]">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Income</p>
          <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl border border-emerald-100 dark:border-emerald-900/50"><TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /></div>
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">₱{formatPHP(metrics.totalIncome)}</h3>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Tithes, offerings & receipts</p>
        </div>
      </div>

      <div className="bento-card flex flex-col justify-between space-y-4 bg-white dark:bg-[#121212]">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Expenses</p>
          <div className="p-2 bg-amber-50 dark:bg-amber-950/60 rounded-xl border border-amber-100 dark:border-amber-900/50"><TrendingDown className="h-4 w-4 text-amber-600 dark:text-amber-400" /></div>
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">₱{formatPHP(metrics.totalExpense)}</h3>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Disbursements & operating costs</p>
        </div>
      </div>

      <div className="bento-card flex flex-col justify-between space-y-4 bg-white dark:bg-[#121212]">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Activity Log</p>
          <div className="p-2 bg-blue-50 dark:bg-blue-950/60 rounded-xl border border-blue-100 dark:border-blue-900/50"><Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" /></div>
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">{metrics.transactionCount}</h3>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Total transactions encoded YTD</p>
        </div>
      </div>
    </div>
  );
}
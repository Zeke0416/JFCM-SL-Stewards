import { Wallet, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import AnimatedNumber from '../AnimatedNumber';

export default function MetricsCards({ metrics, chartData }: { metrics: any, chartData: any[] }) {
  const currentYear = new Date().getFullYear();

  // Referenced directly from TrendChart wavy curve calculation logic
  const generateSparkline = (key: 'income' | 'expense') => {
    if (!chartData || chartData.length === 0) return { path: '', width: 300, height: 100 };
    const max = Math.max(...chartData.map(d => d[key]), 10);
    const points = chartData.map((d, i) => [
      (i / Math.max(chartData.length - 1, 1)) * 300,
      80 - ((d[key] / max) * 55)
    ]);
    let path = `M ${points[0][0]},${points[0][1]}`;
    for (let i = 0; i < points.length - 1; i++) {
      const x0 = points[i][0], y0 = points[i][1];
      const x1 = points[i+1][0], y1 = points[i+1][1];
      const cx1 = x0 + (x1 - x0) * 0.42;
      const cx2 = x1 - (x1 - x0) * 0.42;
      path += ` C ${cx1},${y0} ${cx2},${y1} ${x1},${y1}`;
    }
    return { path, width: 300, height: 100 };
  };

  const incSparkData = generateSparkline('income');
  const expSparkData = generateSparkline('expense');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <style>{`
        @keyframes lavaFlow1 {
          0% { transform: translate(0px, 0px) scale(1); opacity: 0.35; }
          33% { transform: translate(90px, -60px) scale(1.4); opacity: 0.55; }
          66% { transform: translate(-70px, 80px) scale(0.9); opacity: 0.4; }
          100% { transform: translate(0px, 0px) scale(1); opacity: 0.35; }
        }
        @keyframes lavaFlow2 {
          0% { transform: translate(0px, 0px) scale(1); opacity: 0.25; }
          33% { transform: translate(-80px, 70px) scale(1.3); opacity: 0.45; }
          66% { transform: translate(75px, -50px) scale(1.15); opacity: 0.35; }
          100% { transform: translate(0px, 0px) scale(1); opacity: 0.25; }
        }
        @keyframes gridMove {
          0% { background-position: 0 0; }
          100% { background-position: 32px 32px; }
        }
        .animate-lava-1 {
          animation: lavaFlow1 12s ease-in-out infinite;
        }
        .animate-lava-2 {
          animation: lavaFlow2 16s ease-in-out infinite;
        }
        .bg-moving-grid {
          background-image: linear-gradient(to right, rgba(16, 185, 129, 0.08) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(16, 185, 129, 0.08) 1px, transparent 1px);
          background-size: 32px 32px;
          animation: gridMove 20s linear infinite;
        }
      `}</style>

      {/* Primary Command Hero */}
      <div className="lg:col-span-8 bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#27272A] rounded-2xl p-6 sm:p-7 min-h-[190px] flex flex-col justify-between group overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative">
        <div className="absolute inset-0 bg-moving-grid pointer-events-none" />
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-emerald-500/30 dark:bg-emerald-400/35 rounded-full blur-[80px] animate-lava-1 pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-teal-400/25 dark:bg-emerald-600/30 rounded-full blur-[80px] animate-lava-2 pointer-events-none" />
        
        <div className="relative z-10 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest font-mono">Live Sync Active</span>
            </div>
            <p className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">Net Balance {currentYear}</p>
          </div>
          <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 shadow-sm">
            <Wallet className="h-4 w-4" />
          </div>
        </div>

        <div className="relative z-10 mt-4">
          <div className="flex items-baseline gap-2">
            <span className="text-xl text-slate-400 font-light">₱</span>
            <h1 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight tabular-nums drop-shadow-sm">
              <AnimatedNumber value={metrics.netBalance} formatPHP={true} />
            </h1>
          </div>
          <div className="flex items-center gap-4 mt-3 text-[11px] font-medium text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-[#27272A] pt-3">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span> Official Financial Records
            </span>
            <span className="flex items-center gap-1.5 opacity-60">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 inline-block"></span> Fully Audited
            </span>
          </div>
        </div>
      </div>

      {/* Secondary Telemetry Cards with TrendChart-aligned Wavy Sparklines & Traveling Dots */}
      <div className="lg:col-span-4 flex flex-col gap-3">
        
        {/* Gross Income */}
        <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#27272A] rounded-2xl p-4 relative group flex flex-col justify-between shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
          <div className="relative z-10 flex justify-between items-center mb-1">
            <p className="text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">Gross Income</p>
            <div className="p-1.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-lg text-emerald-600 dark:text-emerald-400"><TrendingUp className="h-3.5 w-3.5" /></div>
          </div>
          <div className="relative z-10">
            <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">
              ₱<AnimatedNumber value={metrics.totalIncome} formatPHP={true} />
            </p>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-1/2 opacity-35 group-hover:opacity-55 transition-opacity pointer-events-none">
             <svg viewBox={`0 0 ${incSparkData.width} ${incSparkData.height}`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
               <defs>
                 <filter id="incomeDotGlow" x="-50%" y="-50%" width="200%" height="200%">
                   <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                   <feMerge>
                     <feMergeNode in="coloredBlur"/>
                     <feMergeNode in="SourceGraphic"/>
                   </feMerge>
                 </filter>
               </defs>
               <path id="incomeCardSparkPath" d={incSparkData.path} fill="none" stroke="#10B981" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
               <circle r="5.5" fill="#34D399" filter="url(#incomeDotGlow)">
                 <animateMotion dur="8s" repeatCount="indefinite">
                   <mpath href="#incomeCardSparkPath" />
                 </animateMotion>
               </circle>
             </svg>
          </div>
        </div>

        {/* Total Expense */}
        <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#27272A] rounded-2xl p-4 relative group flex flex-col justify-between shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
          <div className="relative z-10 flex justify-between items-center mb-1">
            <p className="text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">Total Expense</p>
            <div className="p-1.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg text-amber-600 dark:text-amber-400"><TrendingDown className="h-3.5 w-3.5" /></div>
          </div>
          <div className="relative z-10">
            <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">
              ₱<AnimatedNumber value={metrics.totalExpense} formatPHP={true} />
            </p>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-1/2 opacity-35 group-hover:opacity-55 transition-opacity pointer-events-none">
             <svg viewBox={`0 0 ${expSparkData.width} ${expSparkData.height}`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
               <defs>
                 <filter id="expenseDotGlow" x="-50%" y="-50%" width="200%" height="200%">
                   <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                   <feMerge>
                     <feMergeNode in="coloredBlur"/>
                     <feMergeNode in="SourceGraphic"/>
                   </feMerge>
                 </filter>
               </defs>
               <path id="expenseCardSparkPath" d={expSparkData.path} fill="none" stroke="#F59E0B" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
               <circle r="5.5" fill="#FBBF24" filter="url(#expenseDotGlow)">
                 <animateMotion dur="6s" repeatCount="indefinite">
                   <mpath href="#expenseCardSparkPath" />
                 </animateMotion>
               </circle>
             </svg>
          </div>
        </div>

        {/* Transactions Encoded */}
        <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#27272A] rounded-2xl p-4 relative flex items-center justify-between shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
          <div className="relative z-10">
            <p className="text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase mb-0.5">Transactions</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
              <AnimatedNumber value={metrics.transactionCount} formatPHP={false} /> <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">Records</span>
            </p>
          </div>
          <div className="relative z-10 h-8 w-8 rounded-xl border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Activity className="h-4 w-4" />
          </div>
        </div>

      </div>
    </div>
  );
}
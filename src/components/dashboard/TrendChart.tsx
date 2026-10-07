import { useState, useEffect } from 'react';
import { TrendingUp } from 'lucide-react';

type VisibleLine = 'BOTH' | 'INCOME' | 'EXPENSE';

export default function TrendChart({ chartData }: { chartData: any[] }) {
  const [activeLine, setActiveLine] = useState<VisibleLine>('BOTH');
  const [tooltip, setTooltip] = useState<{ month: string; income: number; expense: number; cssX: number; svgX: number; yInc: number; yExp: number } | null>(null);
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => { setAnimationKey(prev => prev + 1); }, [chartData]);

  const maxChartVal = Math.max(...chartData.flatMap(d => [d.income, d.expense]), 10);
  
  const createWavyPaths = (key: 'income'|'expense') => {
    if (chartData.length === 0) return { path: '' };
    const points = chartData.map((d, i) => [(i / Math.max(chartData.length - 1, 1)) * 1000, 260 - ((d[key] / maxChartVal) * 220)]);
    let path = `M ${points[0][0]},${points[0][1]}`;
    for (let i = 0; i < points.length - 1; i++) {
      const x0 = points[i][0], y0 = points[i][1];
      const x1 = points[i+1][0], y1 = points[i+1][1];
      const cx1 = x0 + (x1 - x0) * 0.42;
      const cx2 = x1 - (x1 - x0) * 0.42;
      path += ` C ${cx1},${y0} ${cx2},${y1} ${x1},${y1}`;
    }
    return { path };
  };

  const incPath = createWavyPaths('income').path;
  const expPath = createWavyPaths('expense').path;
  const formatPHP = (val: number) => new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2 }).format(val);

  return (
    <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#27272A] rounded-2xl relative overflow-hidden flex flex-col min-h-[380px] shadow-sm">
      <style>{`
        @keyframes drawLine {
          from { stroke-dashoffset: 4000; }
          to { stroke-dashoffset: 0; }
        }
        .animate-draw {
          stroke-dasharray: 4000;
          animation: drawLine 3s cubic-bezier(0.2, 0, 0.2, 1) forwards;
        }
        .grid-line {
          stroke: rgba(148, 163, 184, 0.15);
          stroke-width: 1;
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#111111] rounded-t-2xl z-10 shrink-0">
        <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-wide flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Performance Analytics
        </h3>
        <div className="flex gap-4 text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 select-none">
          <div onClick={() => setActiveLine(activeLine === 'INCOME' ? 'BOTH' : 'INCOME')} className={`flex items-center gap-2 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors ${activeLine === 'EXPENSE' ? 'opacity-30' : 'opacity-100'}`}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span> Income
          </div>
          <div onClick={() => setActiveLine(activeLine === 'EXPENSE' ? 'BOTH' : 'EXPENSE')} className={`flex items-center gap-2 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors ${activeLine === 'INCOME' ? 'opacity-30' : 'opacity-100'}`}>
            <span className="w-2 h-2 rounded-full bg-amber-500 shadow-sm"></span> Expense
          </div>
        </div>
      </div>
      
      {/* Chart Canvas */}
      <div className="relative w-full flex-1 pt-6 pb-8 px-6 group z-10">
        
        {/* Tooltip Overlay */}
        <div className="absolute inset-0 pointer-events-none px-6 pt-6 pb-8 z-30">
          <div className="relative w-full h-full">
            {tooltip && (
              <>
                <div 
                  className="absolute top-0 bottom-0 w-[1px] bg-emerald-500/50 transition-all duration-75"
                  style={{ left: `${tooltip.cssX}%` }}
                />
                
                <div 
                  className="absolute z-40 pointer-events-none bg-white/90 dark:bg-[#141414]/90 backdrop-blur-md border border-slate-200 dark:border-[#27272A] rounded-xl p-4 min-w-[160px] transition-all duration-75 shadow-lg"
                  style={{ left: `${tooltip.cssX}%`, top: '-1rem', transform: tooltip.cssX > 80 ? 'translateX(-110%)' : 'translateX(10%)' }}
                >
                  <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2 border-b border-slate-200 dark:border-[#27272A] pb-1.5">{tooltip.month}</p>
                  <div className="space-y-1.5 text-xs font-mono font-semibold">
                    <div className="flex justify-between gap-6 text-emerald-600 dark:text-emerald-400">
                      <span>INC</span><span>₱{formatPHP(tooltip.income)}</span>
                    </div>
                    <div className="flex justify-between gap-6 text-amber-600 dark:text-amber-400">
                      <span>EXP</span><span>₱{formatPHP(tooltip.expense)}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {chartData.length > 0 && (
          <svg key={animationKey} className="absolute inset-0 w-full h-full overflow-visible px-6 z-10" preserveAspectRatio="none" viewBox="0 0 1000 300">
            <defs>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>

              <linearGradient id="gradIncomeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="gradExpenseFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
              </linearGradient>

              <clipPath id="reveal">
                <rect x="0" y="0" width="1000" height="300">
                  <animate attributeName="width" values="0;1000" dur="1.5s" fill="freeze" calcMode="spline" keySplines="0.1 0 0.1 1" />
                </rect>
              </clipPath>
            </defs>

            {/* Horizontal Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map(pct => (
              <line key={pct} x1="0" y1={pct * 280} x2="1000" y2={pct * 280} className="grid-line" />
            ))}

            <g clipPath="url(#reveal)">
              
              {/* Expense Render & Traveling Dot */}
              <g className="transition-opacity duration-300" style={{ opacity: activeLine === 'INCOME' ? 0.05 : 1 }}>
                <path d={`${expPath} L 1000,300 L 0,300 Z`} fill="url(#gradExpenseFill)" />
                <path id="expensePath" d={expPath} fill="none" stroke="#F59E0B" strokeWidth="2.5" className="animate-draw" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" />
                
                {/* Traveling Glowing Dot on Expense Line */}
                <circle r="4.5" fill="#F59E0B" filter="url(#glow)">
                  <animateMotion dur="6s" repeatCount="indefinite" rotate="auto">
                    <mpath href="#expensePath" />
                  </animateMotion>
                </circle>
              </g>

              {/* Income Render & Traveling Dot */}
              <g className="transition-opacity duration-300" style={{ opacity: activeLine === 'EXPENSE' ? 0.05 : 1 }}>
                <path d={`${incPath} L 1000,300 L 0,300 Z`} fill="url(#gradIncomeFill)" />
                <path id="incomePath" d={incPath} fill="none" stroke="#10B981" strokeWidth="2.5" className="animate-draw" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" />
                
                {/* Traveling Glowing Dot on Income Line */}
                <circle r="4.5" fill="#10B981" filter="url(#glow)">
                  <animateMotion dur="8s" repeatCount="indefinite" rotate="auto">
                    <mpath href="#incomePath" />
                  </animateMotion>
                </circle>
              </g>

              {/* Hitboxes & Hover Dots */}
              {chartData.map((d, i) => {
                const x = (i / Math.max(chartData.length - 1, 1)) * 1000;
                const colW = 1000 / Math.max(chartData.length - 1, 1);
                const yInc = 260 - ((d.income / maxChartVal) * 220);
                const yExp = 260 - ((d.expense / maxChartVal) * 220);
                const leftPercent = (x / 1000) * 100;
                const isHovered = tooltip?.month === d.month;

                return (
                  <g key={`col-${i}`}>
                    <rect x={x - (colW / 2)} y="-20" width={colW} height="340" fill="transparent" 
                      onMouseEnter={() => setTooltip({ month: d.month, income: d.income, expense: d.expense, cssX: leftPercent, svgX: x, yInc, yExp })}
                      onMouseLeave={() => setTooltip(null)} className="cursor-crosshair outline-none" />
                    
                    <circle cx={x} cy={yInc} r={isHovered && activeLine !== 'EXPENSE' ? 6 : 2.5} 
                      className={`pointer-events-none transition-all duration-150 ${isHovered && activeLine !== 'EXPENSE' ? 'fill-white dark:fill-[#0A0A0A] stroke-emerald-500' : 'fill-emerald-500 stroke-transparent opacity-60'}`} 
                      strokeWidth={isHovered && activeLine !== 'EXPENSE' ? 2.5 : 0} filter="url(#glow)" />
                      
                    <circle cx={x} cy={yExp} r={isHovered && activeLine !== 'INCOME' ? 6 : 2.5} 
                      className={`pointer-events-none transition-all duration-150 ${isHovered && activeLine !== 'INCOME' ? 'fill-white dark:fill-[#0A0A0A] stroke-amber-500' : 'fill-amber-500 stroke-transparent opacity-60'}`} 
                      strokeWidth={isHovered && activeLine !== 'INCOME' ? 2.5 : 0} filter="url(#glow)" />
                  </g>
                );
              })}
            </g>
          </svg>
        )}
        
        {/* X-Axis Labels */}
        <div className="absolute bottom-1 left-6 right-6 flex justify-between text-xs font-mono text-slate-400 uppercase tracking-wider pointer-events-none">
          {chartData.map(d => <span key={d.month}>{d.month}</span>)}
        </div>
      </div>
    </div>
  );
}
import { useState } from 'react';
import { Activity } from 'lucide-react';

type VisibleLine = 'BOTH' | 'INCOME' | 'EXPENSE';

export default function TrendChart({ chartData }: { chartData: any[] }) {
  const [activeLine, setActiveLine] = useState<VisibleLine>('BOTH');
  const [tooltip, setTooltip] = useState<{ month: string; income: number; expense: number; x: number; y: number; type: 'income' | 'expense' } | null>(null);

  const maxChartVal = Math.max(...chartData.flatMap(d => [d.income, d.expense]), 10);
  
  // Advanced cubic bezier generator returning dual paths for fluid SMIL animation
  const createWavyPaths = (key: 'income'|'expense', closePath = false) => {
    if (chartData.length === 0) return { pathA: '', pathB: '' };
    
    const points = chartData.map((d, i) => [
      (i / Math.max(chartData.length - 1, 1)) * 1000, 
      280 - ((d[key] / maxChartVal) * 240)            
    ]);
    
    const buildPath = (waveAmplitude: number) => {
      let path = `M ${points[0][0]},${points[0][1]}`;
      
      for (let i = 0; i < points.length - 1; i++) {
        const x0 = points[i][0], y0 = points[i][1];
        const x1 = points[i+1][0], y1 = points[i+1][1];
        
        const cx1 = x0 + (x1 - x0) * 0.4;
        const cx2 = x1 - (x1 - x0) * 0.4;
        const offset = (i % 2 === 0) ? waveAmplitude : -waveAmplitude;
        const cy1 = y0 + offset;
        const cy2 = y1 - offset;
        
        path += ` C ${cx1},${cy1} ${cx2},${cy2} ${x1},${y1}`;
      }
      
      if (closePath) path += ` L 1000,300 L 0,300 Z`;
      return path;
    };

    return {
      pathA: buildPath(6), 
      pathB: buildPath(-6) 
    };
  };

  const toggleLine = (line: 'INCOME' | 'EXPENSE') => {
    if (activeLine === line) setActiveLine('BOTH');
    else setActiveLine(line);
  };

  const incPathsFill = createWavyPaths('income', true);
  const incPathsLine = createWavyPaths('income', false);
  const expPathsFill = createWavyPaths('expense', true);
  const expPathsLine = createWavyPaths('expense', false);

  const formatPHP = (val: number) => new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

  return (
    <div className="bento-card bg-[#0F1115] dark:bg-[#0A0A0C] space-y-6 flex flex-col border border-slate-200/50 dark:border-[#1F2229] shadow-2xl relative overflow-hidden">
      
      {/* Background Subtle Grid Lines */}
      <div className="absolute inset-0 flex flex-col justify-between opacity-[0.03] dark:opacity-10 pointer-events-none px-6 py-12">
          {[1,2,3,4,5].map(i => <div key={i} className="w-full h-px bg-slate-400 dark:bg-white"></div>)}
      </div>

      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-emerald-400" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-white tracking-wide">Financial Posture Trend</h3>
        </div>
        
        {/* Interactive UI toggles */}
        <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 select-none">
          <div 
            onClick={() => toggleLine('INCOME')}
            className={`flex items-center gap-1.5 cursor-pointer hover:text-slate-300 transition-all ${activeLine === 'EXPENSE' ? 'opacity-40 grayscale' : 'opacity-100'}`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] shadow-[0_0_8px_#10b981]"></span> Income
          </div>
          <div 
            onClick={() => toggleLine('EXPENSE')}
            className={`flex items-center gap-1.5 cursor-pointer hover:text-slate-300 transition-all ${activeLine === 'INCOME' ? 'opacity-40 grayscale' : 'opacity-100'}`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] shadow-[0_0_8px_#f59e0b]"></span> Expense
          </div>
        </div>
      </div>
      
      <div className="relative w-full h-64 sm:h-80 flex-1 mt-4">
        
        {/* Floating Tooltip Box */}
        {tooltip && (
          <div 
            className="absolute z-30 pointer-events-none bg-slate-900/95 dark:bg-black/95 border border-slate-700 text-white px-3 py-2 rounded-xl shadow-2xl text-[11px] font-medium backdrop-blur-md transform -translate-x-1/2 -translate-y-[120%] transition-all"
            style={{ left: `${tooltip.x}%`, top: `${tooltip.y}%` }}
          >
            <p className="font-bold text-slate-300 mb-0.5 border-b border-slate-700 pb-0.5">{tooltip.month}</p>
            <p className={tooltip.type === 'income' ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
              {tooltip.type === 'income' ? 'Income' : 'Expense'}: ₱{formatPHP(tooltip.type === 'income' ? tooltip.income : tooltip.expense)}
            </p>
          </div>
        )}

        {chartData.length > 0 && (
          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 1000 300">
            <defs>
              {/* Vertical Fills */}
              <linearGradient id="gradIncomeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="gradExpenseFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
              </linearGradient>

              {/* Horizontal Animated Glowing Stroke Gradients */}
              <linearGradient id="flowIncome" x1="-100%" y1="0%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#059669" />
                <stop offset="50%" stopColor="#6ee7b7" />
                <stop offset="100%" stopColor="#059669" />
                <animate attributeName="x1" from="-100%" to="100%" dur="8s" repeatCount="indefinite" />
                <animate attributeName="x2" from="0%" to="200%" dur="8s" repeatCount="indefinite" />
              </linearGradient>

              <linearGradient id="flowExpense" x1="-100%" y1="0%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#d97706" />
                <stop offset="50%" stopColor="#fde68a" />
                <stop offset="100%" stopColor="#d97706" />
                <animate attributeName="x1" from="-100%" to="100%" dur="8s" repeatCount="indefinite" />
                <animate attributeName="x2" from="0%" to="200%" dur="8s" repeatCount="indefinite" />
              </linearGradient>
            </defs>

            {/* Income Paths */}
            <g className="transition-opacity duration-500 ease-in-out" style={{ opacity: activeLine === 'EXPENSE' ? 0 : 1 }}>
              <path d={incPathsFill.pathA} fill="url(#gradIncomeFill)">
                <animate attributeName="d" values={`${incPathsFill.pathA}; ${incPathsFill.pathB}; ${incPathsFill.pathA}`} dur="4s" repeatCount="indefinite" calcMode="spline" keyTimes="0; 0.5; 1" keySplines="0.4 0 0.2 1; 0.4 0 0.2 1" />
              </path>
              <path d={incPathsLine.pathA} fill="none" stroke="url(#flowIncome)" strokeWidth="3.5">
                <animate attributeName="d" values={`${incPathsLine.pathA}; ${incPathsLine.pathB}; ${incPathsLine.pathA}`} dur="4s" repeatCount="indefinite" calcMode="spline" keyTimes="0; 0.5; 1" keySplines="0.4 0 0.2 1; 0.4 0 0.2 1" />
              </path>
            </g>

            {/* Expense Paths */}
            <g className="transition-opacity duration-500 ease-in-out" style={{ opacity: activeLine === 'INCOME' ? 0 : 1 }}>
              <path d={expPathsFill.pathA} fill="url(#gradExpenseFill)">
                <animate attributeName="d" values={`${expPathsFill.pathA}; ${expPathsFill.pathB}; ${expPathsFill.pathA}`} dur="4s" repeatCount="indefinite" calcMode="spline" keyTimes="0; 0.5; 1" keySplines="0.4 0 0.2 1; 0.4 0 0.2 1" />
              </path>
              <path d={expPathsLine.pathA} fill="none" stroke="url(#flowExpense)" strokeWidth="3.5">
                <animate attributeName="d" values={`${expPathsLine.pathA}; ${expPathsLine.pathB}; ${expPathsLine.pathA}`} dur="4s" repeatCount="indefinite" calcMode="spline" keyTimes="0; 0.5; 1" keySplines="0.4 0 0.2 1; 0.4 0 0.2 1" />
              </path>
            </g>

            {/* Interactive Data Plots with Fixed Percentage Tooltip Anchors */}
            {chartData.map((d, i) => {
              const x = (i / Math.max(chartData.length - 1, 1)) * 1000;
              const yInc = 280 - ((d.income / maxChartVal) * 240);
              const yExp = 280 - ((d.expense / maxChartVal) * 240);
              
              const leftPercent = (x / 1000) * 100;
              const topIncPercent = (yInc / 300) * 100;
              const topExpPercent = (yExp / 300) * 100;

              return (
                <g key={`dots-${i}`}>
                  {/* Income Dot & Hover Area */}
                  {activeLine !== 'EXPENSE' && (
                    <g 
                      className="cursor-pointer group"
                      onMouseEnter={() => setTooltip({ month: d.month, income: d.income, expense: d.expense, x: leftPercent, y: topIncPercent, type: 'income' })}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      <circle cx={x} cy={yInc} r="18" fill="transparent" />
                      <circle cx={x} cy={yInc} r="5" fill="#0A0A0C" stroke="#10b981" strokeWidth="2.5" className="transition-transform group-hover:scale-125" />
                    </g>
                  )}
                  
                  {/* Expense Dot & Hover Area */}
                  {activeLine !== 'INCOME' && (
                    <g 
                      className="cursor-pointer group"
                      onMouseEnter={() => setTooltip({ month: d.month, income: d.income, expense: d.expense, x: leftPercent, y: topExpPercent, type: 'expense' })}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      <circle cx={x} cy={yExp} r="18" fill="transparent" />
                      <circle cx={x} cy={yExp} r="5" fill="#0A0A0C" stroke="#f59e0b" strokeWidth="2.5" className="transition-transform group-hover:scale-125" />
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        )}
        <div className="absolute -bottom-4 left-0 right-0 flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          {chartData.map(d => <span key={d.month}>{d.month}</span>)}
        </div>
      </div>
    </div>
  );
}
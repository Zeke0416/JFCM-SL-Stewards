import { useId, useState, useSyncExternalStore } from 'react';
import { useMotion } from '../ui/useMotion';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useTheme } from '../../contexts/ThemeContext';
const axisNumber = new Intl.NumberFormat('en-PH', { notation: 'compact', maximumFractionDigits: 1 });
const reducedMotionQuery = '(prefers-reduced-motion: reduce)';
const subscribeReducedMotion = (notify: () => void) => { const query = matchMedia(reducedMotionQuery); query.addEventListener('change', notify); return () => query.removeEventListener('change', notify); };
interface Month { month: string; income: number; expense: number }
export default function TrendChart({ chartData }: { chartData: Month[] }) {
  const [visible, setVisible] = useState<'both' | 'income' | 'expense'>('both');
  const { darkMode } = useTheme();
  const { paused } = useMotion();
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, () => matchMedia(reducedMotionQuery).matches, () => true);
  const motionEnabled = !paused && !reducedMotion;
  const id = useId();
  const income = darkMode ? '#9CD6E5' : '#285B7A';
  const expense = darkMode ? '#E0B574' : '#9A6A29';
  const sweep = (delay = '0s') => motionEnabled ? <><animate attributeName="x1" values="-100%;100%" dur="7s" begin={delay} repeatCount="indefinite"/><animate attributeName="x2" values="0%;200%" dur="7s" begin={delay} repeatCount="indefinite"/></> : null;
  const money = (value: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);
  return <article className={`workspace-panel chart-panel ${motionEnabled ? 'chart-looping' : ''}`} data-chart-motion={motionEnabled ? 'running' : 'paused'}>
    <div className="panel-heading flex-wrap gap-4"><div><h2>Income and expenses</h2><p>Monthly movement in Philippine pesos</p></div><div className="segmented-control" aria-label="Chart series">{(['both', 'income', 'expense'] as const).map(value => <button key={value} aria-pressed={visible === value} onClick={() => setVisible(value)}>{value === 'both' ? 'All' : value === 'income' ? 'Income' : 'Expenses'}</button>)}</div></div>
    {chartData.length === 0 ? <div className="empty-panel">Monthly activity will appear when transactions are recorded.</div> : <>
      <div className="chart-canvas" role="img" aria-label="Monthly income and expenses; exact values are available in the table below"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 20, right: 16, left: 0, bottom: 0 }} accessibilityLayer>
        <defs>
          <linearGradient id={`${id}-income-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={income} stopOpacity={darkMode ? .3 : .23}/><stop offset="100%" stopColor={income} stopOpacity={.01}/></linearGradient>
          <linearGradient id={`${id}-expense-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={expense} stopOpacity={darkMode ? .2 : .15}/><stop offset="100%" stopColor={expense} stopOpacity={0}/></linearGradient>
          <linearGradient id={`${id}-income-line`} gradientUnits="userSpaceOnUse" x1="0%" y1="0" x2="100%" y2="0"><stop offset="0%" stopColor={income}/><stop offset="50%" stopColor={darkMode ? '#D7F4FF' : '#4E8099'}/><stop offset="100%" stopColor={income}/>{sweep()}</linearGradient>
          <linearGradient id={`${id}-expense-line`} gradientUnits="userSpaceOnUse" x1="0%" y1="0" x2="100%" y2="0"><stop offset="0%" stopColor={expense}/><stop offset="50%" stopColor={darkMode ? '#FFE2B0' : '#B17D3E'}/><stop offset="100%" stopColor={expense}/>{sweep('-3.5s')}</linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={darkMode ? '#2B3948' : '#DCE3EA'} strokeDasharray="3 5" />
        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: darkMode ? '#ADBAC8' : '#586776', fontSize: 13 }} tickMargin={12} />
        <YAxis width={52} axisLine={false} tickLine={false} tick={{ fill: darkMode ? '#ADBAC8' : '#586776', fontSize: 12 }} tickFormatter={value => axisNumber.format(Number(value)).toLowerCase()} />
        <Tooltip formatter={value => money(Number(value))} contentStyle={{ borderRadius: 10, background: darkMode ? '#1A2430' : '#FFFFFF', borderColor: darkMode ? '#2B3948' : '#DCE3EA', color: darkMode ? '#F8FAF9' : '#17232D' }} />
        {visible !== 'expense' && <Area className="income-series" name="Income" type="monotoneX" dataKey="income" stroke={`url(#${id}-income-line)`} fill={`url(#${id}-income-fill)`} fillOpacity={1} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" isAnimationActive={motionEnabled} animationDuration={900} animationEasing="ease-out"/>}
        {visible !== 'income' && <Area className="expense-series" name="Expenses" type="monotoneX" dataKey="expense" stroke={`url(#${id}-expense-line)`} fill={`url(#${id}-expense-fill)`} fillOpacity={1} strokeWidth={2} strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" isAnimationActive={motionEnabled} animationDuration={900} animationEasing="ease-out"/>}
        {motionEnabled && visible !== 'expense' && <Area className="income-tracer" aria-hidden="true" name="Income motion" type="monotoneX" dataKey="income" stroke={darkMode ? '#E0F7FF' : '#5798B5'} fill="none" strokeWidth={3} strokeDasharray="18 340" strokeLinecap="round" tooltipType="none" legendType="none" dot={false} activeDot={false} isAnimationActive={false}/>}
      </AreaChart></ResponsiveContainer></div>
      <details className="chart-data"><summary>View monthly figures</summary><div className="overflow-x-auto"><table><caption className="sr-only">Monthly income and expenses in PHP</caption><thead><tr><th scope="col">Month</th><th scope="col">Income</th><th scope="col">Expenses</th></tr></thead><tbody>{chartData.map((row, i) => <tr key={i}><th scope="row">{row.month}</th><td>{money(row.income)}</td><td>{money(row.expense)}</td></tr>)}</tbody></table></div></details>
    </>}
  </article>;
}

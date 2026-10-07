import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { X, Calendar as CalendarIcon, FileText, CheckCircle2, Search, ChevronDown, ChevronRight } from 'lucide-react';
import MetricsCards from '../components/dashboard/MetricsCards';
import ActionAlerts from '../components/dashboard/ActionAlerts';
import TrendChart from '../components/dashboard/TrendChart';
import TargetMonitor from '../components/dashboard/TargetMonitor';
import TransactionLogsModal from '../components/TransactionLogsModal'; // <-- Make sure this import is present

let dashboardMemoryCache: any = null;

export default function Dashboard() {
  const { user } = useAuth();
  const [churchId, setChurchId] = useState(dashboardMemoryCache?.churchId || '');
  const [loading, setLoading] = useState(!dashboardMemoryCache);
  
  const [metrics, setMetrics] = useState(dashboardMemoryCache?.metrics || { totalIncome: 0, totalExpense: 0, netBalance: 0, transactionCount: 0 });
  const [unassignedCount, setUnassignedCount] = useState(dashboardMemoryCache?.unassignedCount || 0);
  const [recentLogs, setRecentLogs] = useState<any[]>(dashboardMemoryCache?.recentLogs || []);

  const [trackedBudgets, setTrackedBudgets] = useState<any[]>(dashboardMemoryCache?.trackedBudgets || []);
  const [chartData, setChartData] = useState<any[]>(dashboardMemoryCache?.chartData || []);

  const [allTransactions, setAllTransactions] = useState<any[]>(dashboardMemoryCache?.allTransactions || []);
  const [selectedBudgetCode, setSelectedBudgetCode] = useState<string | null>(null);
  const [categories, setCategories] = useState<any[]>(dashboardMemoryCache?.categories || []);
  const [periods, setPeriods] = useState<any[]>(dashboardMemoryCache?.periods || []);
  const [profMap, setProfMap] = useState<Map<string, string>>(new Map()); // <-- Encoder profile map

  const [mprReminder, setMprReminder] = useState<any>(dashboardMemoryCache?.mprReminder || null);
  const [mrReminder, setMrReminder] = useState<any>(dashboardMemoryCache?.mrReminder || null);

  const [expandedMonthId, setExpandedMonthId] = useState<string | null>(null);
  const [showTxLogsModal, setShowTxLogsModal] = useState(false); // <-- Full Logs Modal State

  useEffect(() => {
    if (user) fetchDashboardData();
  }, [user]);

  useEffect(() => {
    if (!churchId) return;
    const channel = supabase.channel('dashboard-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
         dashboardMemoryCache = null; 
         fetchDashboardData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [churchId]);

  const fetchDashboardData = async () => {
    if (!dashboardMemoryCache) setLoading(true); 
    
    try {
      const { data: profile } = await supabase.from('profiles').select('church_id').eq('id', user?.id).maybeSingle();
      
      if (profile) {
        const cId = profile.church_id;
        setChurchId(cId);

        // Fetch user profiles for encoder mapping
        const { data: profilesData } = await supabase.from('profiles').select('id, full_name').eq('church_id', cId);
        const pMap = new Map(profilesData?.map(p => [p.id, p.full_name]) || []);
        setProfMap(pMap);

        let fetchedCategories: any[] = [];
        const { data: cats } = await supabase.from('categories').select('*').eq('church_id', cId);
        if (cats) {
          setCategories(cats);
          fetchedCategories = cats;
        }

        const { data: logs } = await supabase.from('transaction_logs').select('*').eq('church_id', cId).order('created_at', { ascending: false }).limit(30);
        if (logs) setRecentLogs(logs);

        const { data: yearList } = await supabase.from('financial_years').select('*').eq('church_id', cId).order('year', { ascending: false }).limit(1);
        const latestYearData = yearList?.[0];
        
        let fetchedMetrics = { totalIncome: 0, totalExpense: 0, netBalance: 0, transactionCount: 0 };
        let fetchedUnassignedCount = 0;
        let fetchedChartData: any[] = [];
        let fetchedTrackedBudgets: any[] = [];
        let fetchedMprReminder = null;
        let fetchedMrReminder = null;
        let fetchedPeriods: any[] = [];
        let fetchedTxs: any[] = [];
        
        if (latestYearData) {
          const { data: currentPeriods } = await supabase.from('financial_periods').select('*').eq('financial_year_id', latestYearData.id).order('month', { ascending: true });
          if (currentPeriods) {
            setPeriods(currentPeriods);
            fetchedPeriods = currentPeriods;
          }
          const periodIds = (currentPeriods || []).map(p => p.id);

          const now = new Date();
          const lastMonthNum = now.getMonth() === 0 ? 12 : now.getMonth(); 
          const lastMonthPeriod = (currentPeriods || []).find(p => p.month === lastMonthNum);
          const today = now.getDate();
          
          if (lastMonthPeriod) {
            const { data: mpr } = await supabase.from('mpr_reports').select('id').eq('financial_period_id', lastMonthPeriod.id).maybeSingle();
            const mprStartDay = parseInt(localStorage.getItem('mpr_start_day') || '1', 10);
            const mprDeadlineDay = parseInt(localStorage.getItem('mpr_deadline_day') || '14', 10);
            if (!mpr && today >= mprStartDay) {
              fetchedMprReminder = { isOverdue: today > mprDeadlineDay, periodId: lastMonthPeriod.id, periodName: lastMonthPeriod.period_name };
            }

            const mrStartDay = parseInt(localStorage.getItem('mr_start_day') || '1', 10);
            const mrDeadlineDay = parseInt(localStorage.getItem('mr_deadline_day') || '7', 10);
            if (lastMonthPeriod.status === 'OPEN' && today >= mrStartDay) {
              fetchedMrReminder = { isOverdue: today > mrDeadlineDay, periodId: lastMonthPeriod.id, periodName: lastMonthPeriod.period_name };
            }
          }

          setMprReminder(fetchedMprReminder);
          setMrReminder(fetchedMrReminder);

          if (periodIds.length > 0) {
            // Include entered_by in transaction selection for encoder display
            const { data: txs, error: txErr } = await supabase.from('transactions').select('id, amount, type, category_id, financial_period_id, receipt_no, date, payee_name, remarks, entered_by').in('financial_period_id', periodIds);
            if (txErr) throw txErr;

            if (txs) {
              fetchedTxs = txs;
              setAllTransactions(txs);

              let inc = 0; let exp = 0;
              const categorySumsByCode: Record<string, number> = {};
              const monthlyStats: Record<string, { income: number, expense: number }> = {};
              
              (currentPeriods || []).forEach(p => { monthlyStats[p.id] = { income: 0, expense: 0 }; });

              txs.forEach(tx => {
                const amt = Number(tx.amount) || 0;
                if (tx.type === 'INCOME') { inc += amt; if (monthlyStats[tx.financial_period_id]) monthlyStats[tx.financial_period_id].income += amt; }
                if (tx.type === 'EXPENSE') { exp += amt; if (monthlyStats[tx.financial_period_id]) monthlyStats[tx.financial_period_id].expense += amt; }
                
                if (tx.category_id) {
                  const matchedCat = cats?.find(c => c.id === tx.category_id);
                  if (matchedCat) categorySumsByCode[matchedCat.export_code] = (categorySumsByCode[matchedCat.export_code] || 0) + amt;
                } else fetchedUnassignedCount++;
              });

              fetchedMetrics = { totalIncome: inc, totalExpense: exp, netBalance: inc - exp, transactionCount: txs.length };
              setMetrics(fetchedMetrics);
              setUnassignedCount(fetchedUnassignedCount);

              fetchedChartData = (currentPeriods || []).map(p => ({ month: p.period_name.split(' ')[0].substring(0,3), income: monthlyStats[p.id]?.income || 0, expense: monthlyStats[p.id]?.expense || 0 }));
              setChartData(fetchedChartData);

              const targets = latestYearData.category_targets || {};
              for (const catId in targets) {
                if (targets[catId] > 0) {
                    const matchedCat = cats?.find(c => c.id === catId);
                    if (matchedCat) {
                      const currentAmt = categorySumsByCode[matchedCat.export_code] || 0;
                      const targetAmt = targets[catId];
                      const percent = Math.min((currentAmt / targetAmt) * 100, 100);
                      
                      fetchedTrackedBudgets.push({ 
                        id: catId, 
                        name: matchedCat.name, 
                        code: matchedCat.export_code || '---', 
                        type: matchedCat.type, 
                        current: currentAmt, 
                        target: targetAmt, 
                        percent 
                      });
                    }
                }
              }
              fetchedTrackedBudgets.sort((a,b) => a.code.localeCompare(b.code));
              setTrackedBudgets(fetchedTrackedBudgets);
            }
          }
        }

        dashboardMemoryCache = { 
          churchId: cId, metrics: fetchedMetrics, unassignedCount: fetchedUnassignedCount, recentLogs: logs, 
          trackedBudgets: fetchedTrackedBudgets, chartData: fetchedChartData, mprReminder: fetchedMprReminder, 
          mrReminder: fetchedMrReminder, allTransactions: fetchedTxs, categories: fetchedCategories, periods: fetchedPeriods 
        };
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const selectedBudgetTxs = selectedBudgetCode ? allTransactions.filter(tx => {
    const cat = categories.find(c => c.id === tx.category_id);
    return cat && cat.export_code === selectedBudgetCode;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) : [];

  const selectedBudgetName = selectedBudgetCode ? categories.find(c => c.export_code === selectedBudgetCode)?.name : '';
  const selectedBudgetTarget = selectedBudgetCode ? trackedBudgets.find(b => b.code === selectedBudgetCode)?.target || 0 : 0;
  const isSelectedBudgetIncome = selectedBudgetCode ? categories.find(c => c.export_code === selectedBudgetCode)?.type === 'INCOME' : false;

  const chronologicalPeriods = [...periods].sort((a,b) => a.month - b.month);
  let runningTotal = 0;
  let breachedMonthId: string | null = null;

  const monthlyGroups = chronologicalPeriods.map(p => {
     const txs = selectedBudgetTxs.filter(t => t.financial_period_id === p.id);
     const monthTotal = txs.reduce((sum, t) => sum + Number(t.amount), 0);
     
     runningTotal += monthTotal;
     let isBreachPoint = false;
     if (selectedBudgetTarget > 0 && !breachedMonthId && runningTotal >= selectedBudgetTarget && monthTotal > 0) {
         isBreachPoint = true;
         breachedMonthId = p.id;
     }

     return { period: p, txs, monthTotal, runningTotal, isBreachPoint };
  }).filter(g => g.txs.length > 0 || g.isBreachPoint).reverse();

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse max-w-7xl mx-auto pb-12">
        <div className="h-[220px] bg-slate-200 dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#222] rounded-xl w-full"></div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
           <div className="h-[300px] bg-slate-200 dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#222] rounded-xl lg:col-span-6"></div>
           <div className="h-[300px] bg-slate-200 dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#222] rounded-xl lg:col-span-6"></div>
        </div>
        <div className="h-[360px] bg-slate-200 dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#222] rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto pb-12">
      
      {/* 1. Core Financials Section */}
      <section>
        <MetricsCards metrics={metrics} chartData={chartData} />
      </section>
      
      {/* 2. Action Center Section */}
      <section>
        <ActionAlerts 
          unassignedCount={unassignedCount} 
          recentLogs={recentLogs} 
          mprReminder={mprReminder} 
          mrReminder={mrReminder} 
          onOpenTransactionLogs={() => setShowTxLogsModal(true)} 
        />
      </section>
      
      {/* 3. Performance Trends Section */}
      <section>
        <TrendChart chartData={chartData} />
      </section>

      {/* 4. Target Matrix Section */}
      <section>
        <TargetMonitor trackedBudgets={trackedBudgets} onBudgetClick={(code) => {
          setSelectedBudgetCode(code);
          setExpandedMonthId(null);
        }} />
      </section>

      {/* Futuristic Terminal-Style Budget Breakdown Modal with Portal Blur */}
      {selectedBudgetCode && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 dark:bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white dark:bg-[#0A0A0A] shadow-2xl relative flex flex-col overflow-hidden border border-slate-200 dark:border-[#27272A] rounded-2xl max-h-[85vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#111111] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold tracking-wider uppercase text-slate-900 dark:text-white truncate max-w-[220px] sm:max-w-[400px]">[{selectedBudgetCode}] {selectedBudgetName}</h2>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">DATA MODULE :: MONTHLY CHRONOLOGY</p>
                </div>
              </div>
              <button onClick={() => { setSelectedBudgetCode(null); setExpandedMonthId(null); }} className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-2 rounded-xl transition-colors hover:bg-slate-100 dark:hover:bg-[#1A1A1A] shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-50/50 dark:bg-[#0A0A0A]">
              {monthlyGroups.length > 0 ? (
                <div className="space-y-3">
                  {monthlyGroups.map((group) => {
                    const isExpanded = expandedMonthId === group.period.id;
                    return (
                      <div key={group.period.id} className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#27272A] rounded-xl overflow-hidden shadow-sm transition-all">
                         
                         {/* Collapsed Header */}
                         <div 
                           onClick={() => setExpandedMonthId(isExpanded ? null : group.period.id)}
                           className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-[#1A1A1A] transition-colors relative"
                         >
                           <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-300 dark:bg-[#333] transition-colors"></div>

                           <div className="flex flex-col gap-1 pl-2">
                             <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                               <CalendarIcon className="h-3.5 w-3.5 text-slate-400" /> {group.period.period_name}
                             </h4>
                             {group.isBreachPoint && selectedBudgetTarget > 0 && !isExpanded && (
                                <span className={`text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 mt-0.5 ${isSelectedBudgetIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                  <CheckCircle2 className="h-3 w-3" /> Target Threshold Reached
                                </span>
                             )}
                           </div>
                           <div className="flex items-center gap-6">
                             <div className="text-right">
                               <span className="font-mono font-bold text-slate-900 dark:text-white text-xs block">₱{group.monthTotal.toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>
                               <span className="text-[9px] text-slate-400 uppercase tracking-widest font-mono mt-0.5 inline-block">Run: ₱{group.runningTotal.toLocaleString(undefined, {minimumFractionDigits:0})}</span>
                             </div>
                             {isExpanded ? <ChevronDown className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                           </div>
                         </div>
                         
                         {/* Expanded Data Area */}
                         {isExpanded && (
                           <div className="animate-in slide-in-from-top-2 duration-200 border-t border-slate-200 dark:border-[#27272A] bg-slate-50/50 dark:bg-[#0A0A0A]">
                             {group.isBreachPoint && selectedBudgetTarget > 0 && (
                                <div className={`px-4 py-2.5 text-center text-[9px] font-bold uppercase tracking-widest flex justify-center items-center gap-2 border-b border-slate-200 dark:border-[#27272A] ${isSelectedBudgetIncome ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'}`}>
                                  <CheckCircle2 className="h-3 w-3" /> 
                                  {isSelectedBudgetIncome ? 'Income Target Reached During This Period' : 'Expense Target Exceeded During This Period'}
                                </div>
                             )}
                             <div className="p-0 divide-y divide-slate-100 dark:divide-[#27272A]/50">
                                {group.txs.map(tx => {
                                  const encoderName = profMap.get(tx.entered_by) || 'System Auditor';
                                  return (
                                    <div key={tx.id} className="px-5 py-3.5 flex justify-between items-center hover:bg-slate-100/50 dark:hover:bg-[#141414] transition-colors">
                                      <div className="min-w-0 pr-6 space-y-1">
                                        <div className="flex items-center gap-2">
                                          <p className="text-[9px] font-mono text-slate-400">{tx.date}</p>
                                          {tx.receipt_no && (
                                            <span className="text-[9px] font-mono bg-slate-200 dark:bg-[#222] px-1.5 py-0.2 rounded text-slate-600 dark:text-slate-300">
                                              Ref: #{tx.receipt_no}
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate whitespace-normal leading-relaxed">
                                          {tx.payee_name || tx.remarks || 'General Transaction'}
                                        </p>
                                        <div className="flex items-center gap-2 pt-0.5">
                                          <span className="text-[9px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-900/50">
                                            Encoder: {encoderName}
                                          </span>
                                          {tx.remarks && tx.payee_name && (
                                            <span className="text-[10px] font-mono text-slate-400 truncate">{tx.remarks}</span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <p className="font-mono font-bold text-slate-900 dark:text-white text-xs">₱{Number(tx.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                                      </div>
                                    </div>
                                  );
                                })}
                             </div>
                           </div>
                         )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-20 text-center space-y-3 opacity-40">
                  <Search className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 dark:text-white">No Data In Matrix</p>
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-[#111111] border-t border-slate-200 dark:border-[#27272A] flex justify-between items-center shrink-0">
               <span className="font-bold text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider">Total Extracted Output</span>
               <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-base">
                 ₱{selectedBudgetTxs.reduce((sum, t) => sum + Number(t.amount), 0).toLocaleString('en-PH', {minimumFractionDigits: 2})}
               </span>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Transaction Logs Full Modal Render */}
      <TransactionLogsModal 
        isOpen={showTxLogsModal} 
        onClose={() => setShowTxLogsModal(false)} 
        churchId={churchId} 
      />
    </div>
  );
}
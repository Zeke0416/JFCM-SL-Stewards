import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import MetricsCards from '../components/dashboard/MetricsCards';
import ActionAlerts from '../components/dashboard/ActionAlerts';
import TrendChart from '../components/dashboard/TrendChart';
import BudgetTracker from '../components/dashboard/BudgetTracker';

export default function Dashboard() {
  const { user } = useAuth();
  const [churchId, setChurchId] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [metrics, setMetrics] = useState({ totalIncome: 0, totalExpense: 0, netBalance: 0, transactionCount: 0 });
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  const [trackedBudgets, setTrackedBudgets] = useState<any[]>([]);
  const [budgetTab, setBudgetTab] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    if (user) fetchDashboardData();
  }, [user]);

  // Keep realtime sync alive
  useEffect(() => {
    if (!churchId) return;
    const channel = supabase.channel('dashboard-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => fetchDashboardData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [churchId]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('church_id').eq('id', user?.id).maybeSingle();
      
      if (profile) {
        setChurchId(profile.church_id);

        const { data: cats } = await supabase.from('categories').select('*').eq('church_id', profile.church_id);
        const { data: logs } = await supabase.from('transaction_logs').select('*').eq('church_id', profile.church_id).order('created_at', { ascending: false }).limit(4);
        if (logs) setRecentLogs(logs);

        // Fetch ACTIVE CURRENT YEAR using robust limit(1) to avoid PGRST116 errors
        const { data: yearList } = await supabase.from('financial_years').select('*').eq('church_id', profile.church_id).order('year', { ascending: false }).limit(1);
        const latestYearData = yearList?.[0];
        
        if (latestYearData) {
          const { data: currentPeriods } = await supabase.from('financial_periods').select('*').eq('financial_year_id', latestYearData.id).order('month', { ascending: true });
          const periodIds = (currentPeriods || []).map(p => p.id);

          if (periodIds.length > 0) {
            const { data: txs, error: txErr } = await supabase.from('transactions')
              .select('amount, type, category_id, financial_period_id, receipt_no')
              .in('financial_period_id', periodIds);
            
            if (txErr) throw txErr;

            if (txs) {
              let inc = 0; let exp = 0; let unassigned = 0; let missingDocs = 0;
              
              // FIX: Map running totals per EXPORT CODE to bypass UUID mismatch bugs
              const categorySumsByCode: Record<string, number> = {};
              const monthlyStats: Record<string, { income: number, expense: number }> = {};
              
              (currentPeriods || []).forEach(p => { monthlyStats[p.id] = { income: 0, expense: 0 }; });

              txs.forEach(tx => {
                const amt = Number(tx.amount) || 0;
                if (tx.type === 'INCOME') { 
                  inc += amt; 
                  if (monthlyStats[tx.financial_period_id]) monthlyStats[tx.financial_period_id].income += amt; 
                }
                if (tx.type === 'EXPENSE') { 
                  exp += amt; 
                  if (monthlyStats[tx.financial_period_id]) monthlyStats[tx.financial_period_id].expense += amt; 
                  if (!tx.receipt_no) missingDocs++; 
                }
                
                if (tx.category_id) {
                  const matchedCat = cats?.find(c => c.id === tx.category_id);
                  if (matchedCat) {
                     categorySumsByCode[matchedCat.export_code] = (categorySumsByCode[matchedCat.export_code] || 0) + amt;
                  }
                } else {
                  unassigned++;
                }
              });

              setMetrics({ totalIncome: inc, totalExpense: exp, netBalance: inc - exp, transactionCount: txs.length });
              setUnassignedCount(unassigned);
              setIsReady(unassigned === 0 && missingDocs === 0);

              const cData = (currentPeriods || []).map(p => ({
                month: p.period_name.split(' ')[0].substring(0,3),
                income: monthlyStats[p.id]?.income || 0,
                expense: monthlyStats[p.id]?.expense || 0
              }));
              setChartData(cData);

              const targets = latestYearData.category_targets || {};
              const budgetData = [];
              
              for (const catId in targets) {
                if (targets[catId] > 0) {
                    const targetAmt = targets[catId];
                    const matchedCat = cats?.find(c => c.id === catId);
                    
                    if (matchedCat) {
                      // FIX: Retrieve sum using the unchangeable export code
                      const currentAmt = categorySumsByCode[matchedCat.export_code] || 0;
                      const percent = Math.min((currentAmt / targetAmt) * 100, 100);
                      
                      budgetData.push({ 
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
              
              budgetData.sort((a,b) => a.code.localeCompare(b.code));
              setTrackedBudgets(budgetData);
            }
          }
        }
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatPHP = (amount: number) => new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

  if (loading) return <div className="p-12 text-center text-slate-500 font-medium text-xs">Loading financial metrics...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-end mb-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Financial Overview</h1>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Real-time fiscal posture and stewardship metrics.</p>
        </div>
      </div>

      <MetricsCards metrics={metrics} formatPHP={formatPHP} />
      <ActionAlerts unassignedCount={unassignedCount} isReady={isReady} recentLogs={recentLogs} />
      <TrendChart chartData={chartData} />
      <BudgetTracker trackedBudgets={trackedBudgets} formatPHP={formatPHP} budgetTab={budgetTab} setBudgetTab={setBudgetTab} />
    </div>
  );
}
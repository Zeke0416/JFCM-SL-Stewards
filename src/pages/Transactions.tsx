import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { Transaction, Category, FinancialPeriod } from '../types/database.types';
import { Plus, Search, Receipt, UserCircle, ArrowUpDown, ArrowDown, ArrowUp, Edit2, Eye, Calendar, Trash2, Paperclip, CheckCircle2, AlertTriangle, BookOpen, X, Activity, ToggleLeft, ToggleRight, TrendingUp, TrendingDown, Loader2, Clock, FileText, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import TransactionModal from '../components/TransactionModal';
import TransactionDetailModal from '../components/TransactionDetailModal';
import CategoryGuideModal from '../components/CategoryGuideModal';
import TransactionLogsModal from '../components/TransactionLogsModal';
import { useAuth } from '../contexts/AuthContext';
import AnimatedNumber from '../components/AnimatedNumber';

type EnrichedTransaction = Transaction & { 
  categories?: Category;
  profiles?: { full_name: string }; 
  updated_by_profile?: { full_name: string };
};

type SortField = 'date' | 'type' | 'category' | 'payee_remarks' | 'encoded_by' | 'amount';
type SortDirection = 'asc' | 'desc';

export default function Transactions() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<EnrichedTransaction[]>([]);
  const [periods, setPeriods] = useState<FinancialPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0); 
  const [chartAnimKey, setChartAnimKey] = useState(0);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<EnrichedTransaction | null>(null);
  const [viewingTx, setViewingTx] = useState<EnrichedTransaction | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [showCategoryGuide, setShowCategoryGuide] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  
  const [deleteTxParams, setDeleteTxParams] = useState<{id: string, description: string} | null>(null);
  const [deletedSuccessInfo, setDeletedSuccessInfo] = useState<{description: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [detailedMode, setDetailedMode] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [selectedPeriodFilter, setSelectedPeriodFilter] = useState<string>('ALL');
  const [churchId, setChurchId] = useState<string>('');

  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  const [missingMPRPeriod, setMissingMPRPeriod] = useState<string | null>(null);

  const exemptKeywords = ['love gift', 'compassion', 'honorarium', 'allowance', 'benevolence', 'remittance', 'tithe'];

  useEffect(() => {
    if (user) fetchInitialData();
  }, [user, refreshTrigger]); 

  useEffect(() => {
    if (!loading) {
      setChartAnimKey(prev => prev + 1);
    }
  }, [loading]);

  useEffect(() => {
    if (deletedSuccessInfo) {
      const timer = setTimeout(() => {
        setDeletedSuccessInfo(null);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [deletedSuccessInfo]);

  useEffect(() => {
    if (!churchId) return;
    const channel = supabase.channel('transactions-ledger-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
         setRefreshTrigger(prev => prev + 1); 
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [churchId]);

  const fetchInitialData = async () => {
    const { data: profile } = await supabase.from('profiles').select('church_id').eq('id', user?.id).single();

    if (profile) {
      setChurchId(profile.church_id);
      
      const [txRes, catRes, profRes, periodRes] = await Promise.all([
        supabase.from('transactions').select('*').eq('church_id', profile.church_id),
        supabase.from('categories').select('*').eq('church_id', profile.church_id),
        supabase.from('profiles').select('*').eq('church_id', profile.church_id),
        supabase.from('financial_periods').select('*').eq('church_id', profile.church_id).order('month', { ascending: true })
      ]);

      if (periodRes.data) {
        setPeriods(periodRes.data);
        
        const now = new Date();
        const lastMonthNum = now.getMonth() === 0 ? 12 : now.getMonth(); 
        const lastMonthPeriod = periodRes.data.find(p => p.month === lastMonthNum);
        
        if (lastMonthPeriod) {
          const { data: mpr } = await supabase.from('mpr_reports').select('id').eq('financial_period_id', lastMonthPeriod.id).maybeSingle();
          const deadlineWeek = parseInt(localStorage.getItem('mpr_deadline_week') || '2', 10);
          const deadlineDay = deadlineWeek * 7;
          if (!mpr && now.getDate() >= deadlineDay) {
            setMissingMPRPeriod(lastMonthPeriod.period_name);
          }
        }
        
        if (!initialLoadDone) {
          const cachedPeriod = localStorage.getItem('selectedPeriodFilter');
          if (cachedPeriod && periodRes.data.some(p => p.id === cachedPeriod)) {
            setSelectedPeriodFilter(cachedPeriod);
          } else if (periodRes.data.length > 0) {
            // Smart deadline rule: default to last month if today < deadline
            const currentMonth = now.getMonth() + 1;
            const todayDate = now.getDate();
            const deadlineDay = parseInt(localStorage.getItem('mpr_deadline_day') || '14', 10);
            
            let targetMonth = currentMonth;
            if (todayDate < deadlineDay) {
              targetMonth = currentMonth - 1;
              if (targetMonth === 0) targetMonth = 12;
            }

            const smartPeriod = periodRes.data.find(p => p.month === targetMonth) || periodRes.data[0];
            setSelectedPeriodFilter(smartPeriod.id);
            localStorage.setItem('selectedPeriodFilter', smartPeriod.id);
          }
          setInitialLoadDone(true);
        }
      }

      const catMap = new Map(catRes.data?.map(c => [c.id, c]) || []);
      const profMap = new Map(profRes.data?.map(p => [p.id, p]) || []);

      const enriched = (txRes.data || []).map(tx => ({
        ...tx,
        categories: catMap.get(tx.category_id || ''),
        profiles: { full_name: profMap.get(tx.entered_by)?.full_name || 'System Administrator' },
        updated_by_profile: tx.updated_by ? { full_name: profMap.get(tx.updated_by)?.full_name || 'System Administrator' } : undefined
      }));

      setTransactions(enriched);
    }
    setLoading(false);
  };

  const handlePeriodChange = (val: string) => {
    setSelectedPeriodFilter(val);
    localStorage.setItem('selectedPeriodFilter', val);
  };

  const handleEdit = (tx: EnrichedTransaction) => {
    setEditingTx(tx);
    setIsModalOpen(true);
  };

  const handleViewDetails = (tx: EnrichedTransaction) => {
    setViewingTx(tx);
    setIsDetailModalOpen(true);
  };

  const handleOpenNew = () => {
    setEditingTx(null);
    setIsModalOpen(true);
  };

  const handleDeletePrompt = (txId: string, description: string) => {
    setDeleteTxParams({ id: txId, description });
  };

  const confirmDeleteTransaction = async () => {
    if (!deleteTxParams) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', deleteTxParams.id);
      if (error) throw error;
      
      const targetDesc = deleteTxParams.description;
      setTransactions(prev => prev.filter(tx => tx.id !== deleteTxParams.id));
      setDeleteTxParams(null);
      setDeletedSuccessInfo({ description: targetDesc });
      fetchInitialData();
    } catch (err: any) {
      alert("Failed to delete transaction: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredTransactions = useMemo(() => {
    const lowerQuery = searchQuery.toLowerCase();
    return transactions.filter((tx) => {
      if (activeTab !== 'ALL' && tx.type !== activeTab) return false;
      if (selectedPeriodFilter !== 'ALL' && tx.financial_period_id !== selectedPeriodFilter) return false;
      
      return (
        (tx.remarks || '').toLowerCase().includes(lowerQuery) ||
        (tx.payee_name || '').toLowerCase().includes(lowerQuery) ||
        (tx.receipt_no || '').toLowerCase().includes(lowerQuery) ||
        (tx.categories?.name || '').toLowerCase().includes(lowerQuery) ||
        (tx.categories?.export_code || '').includes(lowerQuery) ||
        (tx.profiles?.full_name || '').toLowerCase().includes(lowerQuery)
      );
    });
  }, [transactions, searchQuery, activeTab, selectedPeriodFilter]);

  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => {
      let aValue: any; let bValue: any;
      switch (sortField) {
        case 'date': aValue = new Date(a.date).getTime(); bValue = new Date(b.date).getTime(); break;
        case 'amount': aValue = Number(a.amount); bValue = Number(a.amount); break;
        case 'category': aValue = `[${a.categories?.export_code}] ${a.categories?.name}`.toLowerCase(); bValue = `[${b.categories?.export_code}] ${b.categories?.name}`.toLowerCase(); break;
        case 'payee_remarks': aValue = `${a.payee_name} ${a.remarks}`.toLowerCase(); bValue = `${b.payee_name} ${b.remarks}`.toLowerCase(); break;
        case 'encoded_by': aValue = (a.profiles?.full_name || '').toLowerCase(); bValue = (b.profiles?.full_name || '').toLowerCase(); break;
        case 'type': aValue = a.type.toLowerCase(); bValue = a.type.toLowerCase(); break;
        default: aValue = ''; bValue = '';
      }
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredTransactions, sortField, sortDirection]);

  const metrics = useMemo(() => {
    let inc = 0; let exp = 0;
    filteredTransactions.forEach(t => {
      if (t.type === 'INCOME') inc += Number(t.amount);
      if (t.type === 'EXPENSE') exp += Number(t.amount);
    });
    return { income: inc, expense: exp };
  }, [filteredTransactions]);

  const unassignedTxs = useMemo(() => {
    return filteredTransactions.filter(tx => !tx.categories || tx.categories.export_code === '???');
  }, [filteredTransactions]);

  const generateSparkline = (key: 'income' | 'expense') => {
    const targetType = key === 'income' ? 'INCOME' : 'EXPENSE';
    const typeTxs = filteredTransactions.filter(t => t.type === targetType);
    if (typeTxs.length < 2) {
      return { path: 'M 0,55 C 42,40 84,70 126,55 C 168,40 210,70 252,55 C 273,47 286,60 300,55', width: 300, height: 100 };
    }
    const vals = typeTxs.map(t => Number(t.amount) || 0);
    const max = Math.max(...vals, 10);
    const points = vals.slice(0, 12).map((val, i, arr) => [
      (i / Math.max(arr.length - 1, 1)) * 300,
      80 - ((val / max) * 55)
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

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection(field === 'amount' || field === 'date' ? 'desc' : 'asc'); }
  };

  const SortableHeader = ({ field, label, align = 'left' }: { field: SortField, label: string, align?: 'left' | 'right' }) => {
    const isActive = sortField === field;
    return (
      <th onClick={() => handleSort(field)} className={`p-4 cursor-pointer select-none group transition-colors hover:text-slate-900 dark:hover:text-white ${isActive ? 'text-slate-900 dark:text-white' : ''}`}>
        <div className={`flex items-center gap-2 ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
          {label}
          <span className={`flex items-center justify-center h-4 w-4 rounded transition-colors ${isActive ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300' : 'text-slate-400 group-hover:bg-slate-100 dark:group-hover:bg-slate-800/50'}`}>
            {!isActive ? <ArrowUpDown className="h-3 w-3 opacity-50" /> : (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
          </span>
        </div>
      </th>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      <style>{`
        @keyframes drawLine {
          from { stroke-dashoffset: 1000; }
          to { stroke-dashoffset: 0; }
        }
        .animate-draw {
          stroke-dasharray: 1000;
          animation: drawLine 2.5s cubic-bezier(0.2, 0, 0.2, 1) forwards;
        }
      `}</style>

      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Transactions Ledger</h1>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Record, search, and dynamically audit financial records.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto mt-2 lg:mt-0">
          <div className="grid grid-cols-2 gap-3 w-full sm:w-auto sm:flex sm:flex-row">
            <button onClick={() => setShowLogsModal(true)} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#27272A] text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-slate-50 dark:hover:bg-[#121212] transition-colors shadow-sm" title="View Database Logs">
              <Activity className="h-4 w-4 shrink-0" />
              <span className="text-xs font-bold whitespace-nowrap">Audit Logs</span>
            </button>
            <button onClick={() => setShowCategoryGuide(true)} className="flex items-center justify-center gap-2 bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#27272A] text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-[#121212] transition-all shadow-sm">
              <BookOpen className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">Guide</span>
            </button>
          </div>
          <button onClick={handleOpenNew} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all">
            <Plus className="h-4 w-4 shrink-0" /> Add Transaction
          </button>
        </div>
      </div>

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        
        {/* Filtered Income Card */}
        <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#27272A] rounded-2xl p-5 flex items-center justify-between shadow-sm relative overflow-visible group">
          <div className="relative z-10">
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Filtered Income</p>
            {loading ? (
              <div className="h-7 w-32 bg-slate-200 dark:bg-[#1a1a1a] rounded-lg animate-pulse mt-1"></div>
            ) : (
              <h3 className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                ₱<AnimatedNumber value={metrics.income} formatPHP={true} />
              </h3>
            )}
          </div>
          <div className="relative z-10 p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400"><TrendingUp className="h-5 w-5" /></div>
          
          {!loading && (
            <div className="absolute inset-0 opacity-25 group-hover:opacity-50 transition-opacity pointer-events-none rounded-2xl overflow-hidden">
               <svg key={`inc-${chartAnimKey}`} viewBox={`0 0 ${incSparkData.width} ${incSparkData.height}`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
                 <defs>
                   <filter id="txIncomeDotGlow" x="-50%" y="-50%" width="200%" height="200%">
                     <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                     <feMerge>
                       <feMergeNode in="coloredBlur"/>
                       <feMergeNode in="SourceGraphic"/>
                     </feMerge>
                   </filter>
                 </defs>
                 <path id="txIncomeSparkPath" d={incSparkData.path} fill="none" stroke="#10B981" strokeWidth="2.5" vectorEffect="non-scaling-stroke" className="animate-draw" />
                 <circle r="4.5" fill="#34D399" filter="url(#txIncomeDotGlow)">
                   <animateMotion dur="8s" repeatCount="indefinite">
                     <mpath href="#txIncomeSparkPath" />
                   </animateMotion>
                 </circle>
               </svg>
            </div>
          )}
        </div>

        {/* Filtered Expense Card */}
        <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#27272A] rounded-2xl p-5 flex items-center justify-between shadow-sm relative overflow-visible group">
          <div className="relative z-10">
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Filtered Expense</p>
            {loading ? (
              <div className="h-7 w-32 bg-slate-200 dark:bg-[#1a1a1a] rounded-lg animate-pulse mt-1"></div>
            ) : (
              <h3 className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
                ₱<AnimatedNumber value={metrics.expense} formatPHP={true} />
              </h3>
            )}
          </div>
          <div className="relative z-10 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl text-amber-600 dark:text-amber-400"><TrendingDown className="h-5 w-5" /></div>

          {!loading && (
            <div className="absolute inset-0 opacity-25 group-hover:opacity-50 transition-opacity pointer-events-none rounded-2xl overflow-hidden">
               <svg key={`exp-${chartAnimKey}`} viewBox={`0 0 ${expSparkData.width} ${expSparkData.height}`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
                 <defs>
                   <filter id="txExpenseDotGlow" x="-50%" y="-50%" width="200%" height="200%">
                     <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                     <feMerge>
                       <feMergeNode in="coloredBlur"/>
                       <feMergeNode in="SourceGraphic"/>
                     </feMerge>
                   </filter>
                 </defs>
                 <path id="txExpenseSparkPath" d={expSparkData.path} fill="none" stroke="#F59E0B" strokeWidth="2.5" vectorEffect="non-scaling-stroke" className="animate-draw" />
                 <circle r="4.5" fill="#FBBF24" filter="url(#txExpenseDotGlow)">
                   <animateMotion dur="6s" repeatCount="indefinite">
                     <mpath href="#txExpenseSparkPath" />
                   </animateMotion>
                 </circle>
               </svg>
            </div>
          )}
        </div>

      </div>

      {/* Alert Notices */}
      {(unassignedTxs.length > 0 || missingMPRPeriod) && (
        <div className="flex flex-col gap-3">
          {missingMPRPeriod && (
             <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 p-4 rounded-2xl flex items-center justify-between text-xs text-rose-800 dark:text-rose-200 shadow-sm">
               <div className="flex items-center gap-2.5">
                 <FileText className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                 <span><strong>Missing MPR:</strong> The Monthly Progress Report for {missingMPRPeriod} is past due.</span>
               </div>
               <Link to="/missionary-report" className="font-bold underline text-rose-700 dark:text-rose-300">Submit Now</Link>
             </div>
          )}

          {unassignedTxs.length > 0 && (
            <div className="bg-white dark:bg-[#0A0A0A] border border-amber-500/40 rounded-2xl shadow-sm overflow-hidden relative">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.6)]"></div>
              <div className="px-5 py-4 border-b border-slate-200 dark:border-[#27272A] bg-amber-50/50 dark:bg-amber-950/20 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
                    <AlertTriangle className="h-4 w-4 animate-pulse" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Review Required: <span className="text-amber-600 dark:text-amber-400">{unassignedTxs.length} unassigned transaction(s)</span> pending category audit.
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 uppercase tracking-widest bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded">ACTION REQUIRED</span>
              </div>
              <div className="p-4 space-y-2 bg-slate-50 dark:bg-[#111111]">
                 {unassignedTxs.map(tx => {
                   const pName = periods.find(p => p.id === tx.financial_period_id)?.period_name || 'Unknown';
                   return (
                     <div key={tx.id} className="flex justify-between items-center bg-white dark:bg-[#1A1A1A] px-4 py-3 rounded-xl shadow-sm border border-slate-200 dark:border-[#27272A] hover:border-amber-500/40 transition-colors">
                       <div className="flex items-center gap-3 min-w-0">
                         <span className="text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-1 rounded">[{pName}]</span>
                         <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{tx.date} — {tx.payee_name || tx.remarks}</span>
                       </div>
                       <div className="flex items-center gap-4 shrink-0">
                         <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">₱{Number(tx.amount).toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>
                         <button onClick={() => handleEdit(tx)} className="text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 px-3 py-1.5 rounded-lg transition-colors shadow-sm">Assign Category</button>
                       </div>
                     </div>
                   );
                 })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter & Tab Controls */}
      <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#27272A] rounded-2xl p-5 space-y-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-[#121212] rounded-xl w-full lg:w-fit border border-slate-200 dark:border-[#27272A] shadow-inner overflow-x-auto custom-scrollbar">
            <button onClick={() => setActiveTab('ALL')} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'ALL' ? 'bg-white dark:bg-[#262626] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>All Records</button>
            <button onClick={() => setActiveTab('INCOME')} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'INCOME' ? 'bg-white dark:bg-[#262626] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>Income</button>
            <button onClick={() => setActiveTab('EXPENSE')} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'EXPENSE' ? 'bg-white dark:bg-[#262626] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>Expenses</button>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-[#27272A] rounded-xl px-4 py-2.5 w-full sm:w-auto shadow-sm min-w-[220px] relative">
              <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
              <select 
                className="w-full bg-transparent border-none text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-0 outline-none cursor-pointer pr-4 appearance-none"
                value={selectedPeriodFilter}
                onChange={(e) => handlePeriodChange(e.target.value)}
              >
                <option value="ALL" className="bg-white dark:bg-[#121212] text-slate-900 dark:text-white">All Financial Periods</option>
                {periods.map(p => <option key={p.id} value={p.id} className="bg-white dark:bg-[#121212] text-slate-900 dark:text-white">{p.period_name} {p.status === 'OPEN' ? '(OPEN)' : ''}</option>)}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none"><ChevronDown className="h-4 w-4 text-slate-400" /></div>
            </div>
            
            <button 
              onClick={() => setDetailedMode(!detailedMode)} 
              className="flex items-center justify-between sm:justify-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-[#27272A] rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap"
            >
              <span>Detailed View</span>
              {detailedMode ? <ToggleRight className="h-5 w-5 text-emerald-500 shrink-0" /> : <ToggleLeft className="h-5 w-5 text-slate-400 shrink-0" />}
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
          <input type="text" placeholder="Search remarks, payee, receipt #, category, or encoder..." className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 dark:border-[#27272A] text-xs font-medium bg-slate-50 dark:bg-[#121212] text-slate-900 dark:text-white shadow-sm outline-none focus:border-emerald-500" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          {searchQuery && (
             <button onClick={() => setSearchQuery('')} className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X className="h-4 w-4" />
             </button>
          )}
        </div>
      </div>

      {/* Transactions Table with Skeleton Loading */}
      <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#27272A] rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#111111] rounded-t-2xl flex justify-between items-center text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          <span>{selectedPeriodFilter === 'ALL' ? 'Showing records across All Periods' : `Viewing ${periods.find(p => p.id === selectedPeriodFilter)?.period_name}`}</span>
          <span>{sortedTransactions.length} records</span>
        </div>
        
        {loading ? (
          <div className="p-8 space-y-4 animate-pulse">
            <div className="h-10 bg-slate-100 dark:bg-[#1a1a1a] rounded-xl w-full"></div>
            <div className="h-12 bg-slate-100 dark:bg-[#1a1a1a] rounded-xl w-full"></div>
            <div className="h-12 bg-slate-100 dark:bg-[#1a1a1a] rounded-xl w-full"></div>
            <div className="h-12 bg-slate-100 dark:bg-[#1a1a1a] rounded-xl w-full"></div>
          </div>
        ) : sortedTransactions.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <Receipt className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-700" />
            <p className="text-slate-600 dark:text-slate-400 text-xs font-medium">No transactions match your current view.</p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap min-w-[1050px]">
              <thead>
                <tr className="bg-transparent border-b border-slate-200 dark:border-[#27272A] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  {detailedMode && <SortableHeader field="date" label="Date Logged" />}
                  {!detailedMode && <SortableHeader field="date" label="Tx Date" />}
                  <SortableHeader field="type" label="Type" />
                  <SortableHeader field="category" label="Account No. / Name" />
                  <SortableHeader field="payee_remarks" label="Payee / Remarks" />
                  {!detailedMode && <th className="p-4 uppercase tracking-wider text-[10px] font-semibold">Receipt</th>}
                  {detailedMode && <SortableHeader field="encoded_by" label="Audit Trail" />}
                  <SortableHeader field="amount" label="Amount (PHP)" align="right" />
                  <th className="p-4 text-right uppercase tracking-wider text-[10px] font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#27272A]/50 bg-transparent">
                {sortedTransactions.map((tx) => {
                  const categoryName = tx.categories?.name?.toLowerCase() || '';
                  const isAutoExempt = exemptKeywords.some(keyword => categoryName.includes(keyword));
                  const isUnassigned = !tx.categories || tx.categories.export_code === '???';
                  const pName = selectedPeriodFilter === 'ALL' ? periods.find(p => p.id === tx.financial_period_id)?.period_name || 'Unknown' : '';

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-[#121212] transition-colors group">
                      <td className="p-4 text-slate-600 dark:text-slate-300 font-medium">
                        {detailedMode ? (
                          <div className="flex flex-col gap-1">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{tx.date}</span>
                            <span className="text-[10px] text-slate-400">Log: {new Date(tx.created_at).toLocaleDateString()}</span>
                          </div>
                        ) : (
                          <>
                            {tx.date}
                            {selectedPeriodFilter === 'ALL' && <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 uppercase tracking-wider">{pName}</div>}
                          </>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide border border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#141414] text-slate-700 dark:text-slate-300">
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${tx.type === 'INCOME' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                          {tx.type}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {isUnassigned ? (
                            <span className="font-medium text-amber-600 dark:text-amber-400 font-bold">Unassigned</span>
                          ) : (
                            <>
                              <span className="font-mono text-[10px] text-slate-400">[{tx.categories?.export_code}]</span>
                              <span className="font-medium text-slate-700 dark:text-slate-200">{tx.categories?.name}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-slate-900 dark:text-white font-medium">{tx.payee_name || '—'}</div>
                        <div className="text-slate-500 text-[11px] mt-0.5 truncate max-w-[200px]" title={tx.remarks || ''}>{tx.remarks || '—'}</div>
                      </td>
                      
                      {detailedMode && (
                        <td className="p-4">
                          <div className="flex flex-col text-[10px] font-medium text-slate-500 gap-1.5">
                            <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5" title="Original Encoder">
                              <UserCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Encoded by {tx.profiles?.full_name}
                            </span>
                            {tx.updated_by_profile && (
                              <span className="text-sky-600 dark:text-sky-400 flex items-center gap-1.5" title="Last Updated By">
                                <Clock className="h-3.5 w-3.5" /> Edited by {tx.updated_by_profile.full_name}
                              </span>
                            )}
                          </div>
                        </td>
                      )}

                      {!detailedMode && (
                        <td className="p-4">
                          {tx.type === 'INCOME' ? (
                            <span className="text-slate-400 text-[10px] font-medium">—</span>
                          ) : tx.receipt_no ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50">
                              <Paperclip className="h-3 w-3" /> Attached
                            </span>
                          ) : (tx.receipt_exempt || isAutoExempt) ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-[#1A1A1A] border border-slate-200 dark:border-[#27272A]">
                              <CheckCircle2 className="h-3 w-3 text-slate-400" /> Exempt
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Missing
                            </span>
                          )}
                        </td>
                      )}
                      
                      <td className="p-4 text-right font-mono text-xs font-medium">
                         <span className={tx.type === 'INCOME' ? 'text-slate-900 dark:text-slate-100 font-bold' : 'text-slate-600 dark:text-slate-400'}>
                           {tx.type === 'INCOME' ? '+' : '-'}₱{Number(tx.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                         </span>
                      </td>
                      <td className="p-4 text-right space-x-0.5">
                        <button onClick={() => handleViewDetails(tx)} className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-[#1A1A1A]" title="View Details"><Eye className="h-3.5 w-3.5" /></button>
                        <button onClick={() => handleEdit(tx)} className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-[#1A1A1A]" title="Edit Transaction"><Edit2 className="h-3.5 w-3.5" /></button>
                        <button onClick={() => handleDeletePrompt(tx.id, tx.remarks || tx.payee_name || 'Transaction')} className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors hover:bg-rose-500/10" title="Delete Transaction"><Trash2 className="h-3.5 w-3.5" /></button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CategoryGuideModal isOpen={showCategoryGuide} onClose={() => setShowCategoryGuide(false)} />
      <TransactionLogsModal isOpen={showLogsModal} onClose={() => setShowLogsModal(false)} churchId={churchId} />

      {churchId && user && (
        <>
          <TransactionModal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            onSuccess={() => setRefreshTrigger(prev => prev + 1)} 
            churchId={churchId} 
            userId={user.id} 
            initialData={editingTx} 
            defaultPeriodId={selectedPeriodFilter !== 'ALL' ? selectedPeriodFilter : (periods.find(p => p.status === 'OPEN')?.id || undefined)} 
            existingTransactions={transactions}
          />
          <TransactionDetailModal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} transaction={viewingTx} />
        </>
      )}

      {deleteTxParams && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 dark:bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#0A0A0A] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#27272A] w-full max-w-md p-6 animate-in zoom-in-95 duration-300">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl text-rose-600 dark:text-rose-400 shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Transaction</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                  This action cannot be undone. Are you sure you want to permanently delete the record for <strong className="text-slate-700 dark:text-slate-300">"{deleteTxParams.description}"</strong>?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 dark:border-[#27272A] pt-4">
              <button onClick={() => setDeleteTxParams(null)} disabled={isDeleting} className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1A1A1A] transition-colors border border-slate-200 dark:border-[#27272A]">
                Cancel
              </button>
              <button onClick={confirmDeleteTransaction} disabled={isDeleting} className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center gap-2">
                {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isDeleting ? 'Deleting...' : 'Yes, Delete Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* World-Class Auto-Closing Delete Success Modal (1.5s, no button) */}
      {deletedSuccessInfo && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 dark:bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300 pointer-events-none">
          <div className="bg-white dark:bg-[#0A0A0A] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#27272A] w-full max-w-sm p-6 text-center space-y-4 animate-in zoom-in-95 duration-300 pointer-events-auto">
            <div className="mx-auto w-14 h-14 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm animate-bounce">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Transaction Deleted</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed truncate px-2">
                "{deletedSuccessInfo.description}"
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
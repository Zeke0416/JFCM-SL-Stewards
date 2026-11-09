import UserAvatar from '../components/ui/UserAvatar';
import AnimatedNumber from '../components/AnimatedNumber';
import { LedgerIcon as Receipt } from '../components/ui/StewardGlyph';
import { useFeedback } from '../components/ui/useFeedback';
import { StewardGlyph } from '../components/ui/StewardGlyph';
import Select from '../components/ui/Select';
import Input from '../components/ui/Input';
import DialogLayer from '../components/ui/DialogLayer';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { Transaction, Category, FinancialPeriod } from '../types/database.types';
import { Plus, Search, ArrowLeft, ArrowRight, ArrowUpDown, ArrowDown, ArrowUp, Edit2, Eye, Trash2, Paperclip, CheckCircle2, AlertTriangle, BookOpen, X, Activity, Loader2, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import TransactionModal from '../components/TransactionModal';
import TransactionDetailModal from '../components/TransactionDetailModal';
import CategoryGuideModal from '../components/CategoryGuideModal';
import TransactionLogsModal from '../components/TransactionLogsModal';
import { useAuth } from '../contexts/AuthContext';
import TransactionDuplicateScanner, {
  findDuplicateCandidates,
  type DuplicateCandidate,
} from '../components/TransactionDuplicateScanner';

type EnrichedTransaction = Transaction & { 
  categories?: Category;
  profiles?: { full_name: string; avatar_data_url?: string | null };
  updated_by_profile?: { full_name: string; avatar_data_url?: string | null };
};

type SortField = 'date' | 'type' | 'category' | 'remarks' | 'encoded_by' | 'amount';
type SortDirection = 'asc' | 'desc';

export default function Transactions() {
  const { notify } = useFeedback();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<EnrichedTransaction[]>([]);
  const [periods, setPeriods] = useState<FinancialPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0); 
  
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
  const [page, setPage] = useState(1);
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
        profiles: { full_name: profMap.get(tx.entered_by)?.full_name || 'Encoder unavailable', avatar_data_url: profMap.get(tx.entered_by)?.avatar_data_url || null },
        updated_by_profile: tx.updated_by ? { full_name: profMap.get(tx.updated_by)?.full_name || 'Encoder unavailable', avatar_data_url: profMap.get(tx.updated_by)?.avatar_data_url || null } : undefined
      }));

      setTransactions(enriched);
    }
    setLoading(false);
  };

  const handlePeriodChange = (val: string) => {
    setPage(1);
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
      notify("Failed to delete transaction: " + err.message);
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

  const duplicateCandidates = useMemo(
    () => findDuplicateCandidates(transactions, selectedPeriodFilter, activeTab),
    [transactions, selectedPeriodFilter, activeTab],
  );

  const duplicateByTransactionId = useMemo(() => {
    const result = new Map<string, DuplicateCandidate>();

    for (const candidate of duplicateCandidates) {
      for (const transaction of [candidate.first, candidate.second]) {
        const current = result.get(transaction.id);
        const candidateIsStronger =
          !current ||
          (candidate.confidence === 'HIGH' && current.confidence !== 'HIGH') ||
          (candidate.confidence === current.confidence && candidate.score > current.score);

        if (candidateIsStronger) result.set(transaction.id, candidate);
      }
    }

    return result;
  }, [duplicateCandidates]);

  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => {
      let aValue: any; let bValue: any;
      switch (sortField) {
        case 'date': aValue = new Date(a.date).getTime(); bValue = new Date(b.date).getTime(); break;
        case 'amount': aValue = Number(a.amount); bValue = Number(a.amount); break;
        case 'category': aValue = `${a.categories?.name || ''} ${a.categories?.export_code || ''}`.toLowerCase(); bValue = `${b.categories?.name || ''} ${b.categories?.export_code || ''}`.toLowerCase(); break;
        case 'remarks': aValue = `${a.remarks || ''}`.toLowerCase(); bValue = `${b.remarks || ''}`.toLowerCase(); break;
        case 'encoded_by': aValue = (a.profiles?.full_name || '').toLowerCase(); bValue = (b.profiles?.full_name || '').toLowerCase(); break;
        case 'type': aValue = a.type.toLowerCase(); bValue = b.type.toLowerCase(); break;
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

  const pageCount = Math.max(1, Math.ceil(sortedTransactions.length / 12));
  const currentPage = Math.min(page, pageCount);
  const visibleTransactions = sortedTransactions.slice((currentPage - 1) * 12, currentPage * 12);

  const handleSort = (field: SortField) => {
    setPage(1);
    if (sortField === field) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection(field === 'amount' || field === 'date' ? 'desc' : 'asc'); }
  };

  const SortableHeader = ({ field, label, align = 'left' }: { field: SortField, label: string, align?: 'left' | 'right' }) => {
    const isActive = sortField === field;
    return (
      <th scope="col" aria-sort={isActive ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'} className={`p-4 cursor-pointer select-none group transition-colors hover:text-slate-900 dark:hover:text-white ${isActive ? 'text-slate-900 dark:text-white' : ''}`}>
        <button type="button" onClick={() => handleSort(field)} className={`flex w-full items-center gap-2 ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
          {label}
          <span className={`flex items-center justify-center h-4 w-4 rounded transition-colors ${isActive ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300' : 'text-slate-400 group-hover:bg-slate-100 dark:group-hover:bg-slate-800/50'}`}>
            {!isActive ? <ArrowUpDown className="h-3 w-3 opacity-50" /> : (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
          </span>
        </button>
      </th>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="system-page-title text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Transactions</h1>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Record receipts and expenses. Review every detail in one place.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto mt-2 lg:mt-0">
          <div className="grid grid-cols-2 gap-3 w-full sm:w-auto sm:flex sm:flex-row">
            <button onClick={() => setShowLogsModal(true)} className="button-secondary" title="View Database Logs">
              <Activity className="h-4 w-4 shrink-0" />
              <span className="text-xs font-bold whitespace-nowrap">Audit Logs</span>
            </button>
            <button onClick={() => setShowCategoryGuide(true)} className="button-secondary">
              <BookOpen className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">Guide</span>
            </button>
          </div>
          <button onClick={handleOpenNew} className="button-primary">
            <Plus className="h-4 w-4 shrink-0" /> Add Transaction
          </button>
        </div>
      </div>

      <div className="ledger-summary" aria-label="Filtered totals">
        <div><span>Income in this view</span><strong className="text-brand dark:text-brand-glow tabular-nums"><AnimatedNumber value={metrics.income} formatPHP /></strong></div>
        <div><span>Expenses in this view</span><strong className="text-amber-700 dark:text-amber-300 tabular-nums"><AnimatedNumber value={metrics.expense} formatPHP /></strong></div>
        <div><span>Matching records</span><strong className="tabular-nums">{filteredTransactions.length.toLocaleString()}</strong></div>
      </div>

      {/* Alert Notices */}
      {(unassignedTxs.length > 0 || missingMPRPeriod || duplicateCandidates.length > 0) && (
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

          {unassignedTxs.length > 0 && <details className="review-queue"><summary><AlertTriangle size={16}/><strong>{unassignedTxs.length} {unassignedTxs.length === 1 ? 'entry needs' : 'entries need'} a category</strong><span>Review entries</span></summary><div className="review-queue-list">{unassignedTxs.map(tx => <div key={tx.id}><div><strong>{tx.payee_name || tx.remarks || 'Unassigned entry'}</strong><span>{tx.date} · {periods.find(p => p.id === tx.financial_period_id)?.period_name || 'Unknown period'}</span></div><span>₱{Number(tx.amount).toLocaleString('en-PH', {minimumFractionDigits:2,maximumFractionDigits:2})}</span><button className="button-secondary" onClick={() => handleEdit(tx)}>Assign category</button></div>)}</div></details>}

          {duplicateCandidates.length > 0 && (
            <TransactionDuplicateScanner
              transactions={transactions}
              periods={periods}
              selectedPeriodFilter={selectedPeriodFilter}
              activeTab={activeTab}
              candidates={duplicateCandidates}
              onViewDetails={handleViewDetails}
              onEdit={handleEdit}
            />
          )}
        </div>
      )}

      <div className="ledger-toolbar compact-ledger-toolbar">
        <div className="segmented-control" aria-label="Transaction type">{(['ALL','INCOME','EXPENSE'] as const).map(tab => <button key={tab} aria-pressed={activeTab === tab} onClick={() => {setPage(1);setActiveTab(tab);}}>{tab === 'ALL' ? 'All records' : tab === 'INCOME' ? 'Income' : 'Expenses'}</button>)}</div>
        <div className="ledger-search"><Search size={16}/><Input aria-label="Search transactions" placeholder="Search records…" value={searchQuery} onChange={e=>{setPage(1);setSearchQuery(e.target.value);}}/>{searchQuery && <button className="icon-button" aria-label="Clear transaction search" onClick={()=>setSearchQuery('')}><X size={15}/></button>}</div>
        <Select aria-label="Financial period" value={selectedPeriodFilter} onChange={e=>handlePeriodChange(e.target.value)}><option value="ALL">All financial periods</option>{periods.map(p=><option key={p.id} value={p.id}>{p.period_name} {p.status === 'OPEN' ? '(OPEN)' : ''}</option>)}</Select>
        <button className="button-secondary audit-toggle" aria-pressed={detailedMode} onClick={()=>setDetailedMode(!detailedMode)}><Eye size={15}/>Audit details</button>
      </div>

      {/* Transactions Table with Skeleton Loading */}
      <div className="bg-white dark:bg-dark-surface border border-slate-200 dark:border-dark-border rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-elevated rounded-t-2xl flex justify-between items-center text-xs font-bold text-slate-500 dark:text-slate-400 tracking-normal">
          <span>{selectedPeriodFilter === 'ALL' ? 'Showing records across All Periods' : `Viewing ${periods.find(p => p.id === selectedPeriodFilter)?.period_name}`}</span>
          <span>{sortedTransactions.length} records</span>
        </div>
        
        {loading ? (
          <div className="p-8 space-y-4 animate-pulse">
            <div className="h-10 bg-slate-100 dark:bg-dark-floating rounded-xl w-full"></div>
            <div className="h-12 bg-slate-100 dark:bg-dark-floating rounded-xl w-full"></div>
            <div className="h-12 bg-slate-100 dark:bg-dark-floating rounded-xl w-full"></div>
            <div className="h-12 bg-slate-100 dark:bg-dark-floating rounded-xl w-full"></div>
          </div>
        ) : sortedTransactions.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <Receipt className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-700" />
            <p className="text-slate-600 dark:text-slate-400 text-xs font-medium">No transactions match your current view.</p>
          </div>
        ) : (
          <div className="ledger-table-scroll custom-scrollbar"><table className="ui-data-table ledger-table"><caption className="sr-only">Church transactions in Philippine pesos</caption><thead><tr><SortableHeader field="category" label="Transaction" /><SortableHeader field="remarks" label="Account" /><SortableHeader field="date" label="Date" /><th scope="col">Receipt</th><SortableHeader field="amount" label="Amount (₱)" align="right" /><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody key={`${activeTab}-${currentPage}-${sortField}-${sortDirection}`} className="ledger-results">{visibleTransactions.map(tx => {
            const categoryName = tx.categories?.name?.toLowerCase() || '';
            const isAutoExempt = exemptKeywords.some(keyword => categoryName.includes(keyword));
            const duplicate = duplicateByTransactionId.get(tx.id);
            const periodName = periods.find(period => period.id === tx.financial_period_id)?.period_name;
            return <tr key={tx.id} data-tx-id={tx.id} data-tx-type={tx.type} className={`ledger-clickable-row ${duplicate ? 'possible-duplicate' : ''}`} tabIndex={0} aria-label={`View transaction ${tx.categories?.name || 'Unassigned account'}`} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); handleViewDetails(tx); } }} onClick={event => { if (!(event.target as HTMLElement).closest('button,a,input,textarea,select,[role=button],[role=combobox]')) handleViewDetails(tx); }}>
              <td className="ledger-identity"><div className={`entry-mark ${tx.type === 'INCOME' ? 'entry-income' : 'entry-expense'}`}><StewardGlyph name="ledger" size={21} /></div><div className="ledger-record"><div><strong className="record-title">{tx.categories?.name || 'Unassigned / for review'}</strong><span className={`entry-type ${tx.type === 'INCOME' ? 'income' : 'expense'}`}>{tx.type === 'INCOME' ? 'Receipt' : 'Disbursement'}</span></div><p className="ledger-account-number">Account no. {tx.categories?.export_code || 'Not assigned'}</p>{duplicate && <span className="duplicate-badge" title={duplicate.reasons.join(' · ')}><AlertTriangle size={12} /> Possible duplicate</span>}{detailedMode && <span className="ledger-audit"><UserAvatar photoUrl={tx.profiles?.avatar_data_url} size={18}/> {tx.profiles?.full_name || 'Encoder unavailable'}{tx.updated_by_profile && ` · Edited by ${tx.updated_by_profile.full_name}`}</span>}</div></td>
              <td className="ledger-account" data-label="Account"><p className="ledger-remarks">{tx.remarks || 'No remarks recorded'}</p>{selectedPeriodFilter === 'ALL' && <span>{periodName}</span>}</td>
              <td className="ledger-date" data-label="Date"><strong>{new Date(`${tx.date}T12:00:00`).toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' })}</strong>{detailedMode && <span>Logged {new Date(tx.created_at).toLocaleDateString('en-PH',{month:'short',day:'numeric'})}</span>}</td>
              <td className="ledger-evidence" data-label="Receipt">{tx.receipt_url ? <span className="evidence-badge referenced"><Paperclip size={13} /> Receipt linked</span> : tx.receipt_no ? <span className="evidence-badge referenced"><FileText size={13} /> Reference</span> : tx.type === 'INCOME' ? <span className="evidence-badge neutral">Not required</span> : tx.receipt_exempt || isAutoExempt ? <span className="evidence-badge neutral"><CheckCircle2 size={13} /> Exempt</span> : <span className="evidence-badge missing"><AlertTriangle size={13} /> Missing</span>}{detailedMode && tx.receipt_no && <span className="evidence-reference">{tx.receipt_no}</span>}</td>
              <td className={`ledger-amount tabular-nums ${tx.type === 'INCOME' ? 'income' : ''}`} data-label="Amount">{tx.type === 'INCOME' ? '+' : '−'}{new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(Number(tx.amount))}</td>
              <td className="ledger-actions"><button type="button" className="icon-button" onClick={() => handleEdit(tx)} aria-label={`Edit ${tx.payee_name || 'transaction'}`} title="Edit record"><Edit2 size={15} /></button><button type="button" className="icon-button danger" onClick={() => handleDeletePrompt(tx.id, tx.remarks || tx.payee_name || 'Transaction')} aria-label={`Delete ${tx.payee_name || 'transaction'}`} title="Delete record"><Trash2 size={15} /></button></td>
            </tr>;
          })}</tbody></table></div>

        )}
      </div>

      <div className="ledger-grid-footer"><span>{sortedTransactions.length ? (currentPage - 1) * 12 + 1 : 0}–{Math.min(currentPage * 12, sortedTransactions.length)} of {sortedTransactions.length} records</span><div className="ledger-order"><Select aria-label="Sort transactions" value={`${sortField}:${sortDirection}`} onChange={event => { const [field, direction] = event.target.value.split(':'); setSortField(field as SortField); setSortDirection(direction as SortDirection); setPage(1); }}><option value="date:desc">Newest first</option><option value="date:asc">Oldest first</option><option value="amount:desc">Highest amount</option><option value="amount:asc">Lowest amount</option><option value="type:asc">Type: A to Z</option><option value="encoded_by:asc">Encoder: A to Z</option></Select></div><div className="ledger-pagination"><button type="button" className="icon-button" aria-label="Previous page" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ArrowLeft size={16} /></button><span>{currentPage} / {pageCount}</span><button type="button" className="icon-button" aria-label="Next page" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}><ArrowRight size={16} /></button></div></div>
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
        <DialogLayer label="Delete Transaction" className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 dark:bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="dialog-surface bg-white dark:bg-dark-surface rounded-2xl shadow-2xl border border-slate-200 dark:border-dark-border w-full max-w-md p-6 animate-in zoom-in-95 duration-300">
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
            <div className="dialog-footer flex justify-end gap-3 border-t border-slate-200 dark:border-dark-border pt-4">
              <button onClick={() => setDeleteTxParams(null)} disabled={isDeleting} className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-floating transition-colors border border-slate-200 dark:border-dark-border">
                Cancel
              </button>
              <button onClick={confirmDeleteTransaction} aria-busy={isDeleting} disabled={isDeleting} className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center gap-2">
                {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isDeleting ? 'Deleting...' : 'Yes, Delete Record'}
              </button>
            </div>
          </div>
        </DialogLayer>
      )}

      {/* World-Class Auto-Closing Delete Success Modal (1.5s, no button) */}
      {deletedSuccessInfo && (
        <DialogLayer label="Transaction Deleted" className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 dark:bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300 pointer-events-none">
          <div className="dialog-surface bg-white dark:bg-dark-surface rounded-2xl shadow-2xl border border-slate-200 dark:border-dark-border w-full max-w-sm p-6 text-center space-y-4 animate-in zoom-in-95 duration-300 pointer-events-auto">
            <div className="mx-auto w-14 h-14 bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20 rounded-2xl flex items-center justify-center editor-accent shadow-sm animate-bounce">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-normal">Transaction Deleted</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed truncate px-2">
                "{deletedSuccessInfo.description}"
              </p>
            </div>
          </div>
        </DialogLayer>
      )}
    </div>
  );
}

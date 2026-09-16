import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { Transaction, Category, FinancialPeriod } from '../types/database.types';
import { Plus, Search, Receipt, UserCircle, ArrowUpDown, ArrowDown, ArrowUp, Edit2, Eye, Calendar, Trash2, Paperclip, CheckCircle2 } from 'lucide-react';
import TransactionModal from '../components/TransactionModal';
import TransactionDetailModal from '../components/TransactionDetailModal';
import { useAuth } from '../contexts/AuthContext';

type EnrichedTransaction = Transaction & { 
  categories?: Category;
  profiles?: { full_name: string }; 
};

type SortField = 'date' | 'type' | 'category' | 'payee_remarks' | 'encoded_by' | 'amount';
type SortDirection = 'asc' | 'desc';

export default function Transactions() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<EnrichedTransaction[]>([]);
  const [periods, setPeriods] = useState<FinancialPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<EnrichedTransaction | null>(null);
  const [viewingTx, setViewingTx] = useState<EnrichedTransaction | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [selectedPeriodFilter, setSelectedPeriodFilter] = useState<string>('ALL');
  const [churchId, setChurchId] = useState<string>('');

  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const exemptKeywords = ['love gift', 'compassion', 'honorarium', 'allowance', 'benevolence', 'remittance', 'tithe'];

  useEffect(() => {
    if (user) fetchInitialData();
  }, [user]);

  const fetchInitialData = async () => {
    setLoading(true);
    const { data: profile } = await supabase.from('profiles').select('church_id').eq('id', user?.id).single();

    if (profile) {
      setChurchId(profile.church_id);
      
      const [txRes, catRes, profRes, periodRes] = await Promise.all([
        supabase.from('transactions').select('*').eq('church_id', profile.church_id),
        supabase.from('categories').select('*').eq('church_id', profile.church_id),
        supabase.from('profiles').select('*').eq('church_id', profile.church_id),
        supabase.from('financial_periods').select('*').eq('church_id', profile.church_id).order('month', { ascending: true })
      ]);

      if (periodRes.data) setPeriods(periodRes.data);

      const catMap = new Map(catRes.data?.map(c => [c.id, c]) || []);
      const profMap = new Map(profRes.data?.map(p => [p.id, p]) || []);

      const enriched = (txRes.data || []).map(tx => ({
        ...tx,
        categories: catMap.get(tx.category_id),
        profiles: { full_name: profMap.get(tx.entered_by)?.full_name || 'System Administrator' }
      }));

      setTransactions(enriched);
    }
    setLoading(false);
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

  const handleDeleteTransaction = async (txId: string, description: string) => {
    if (!confirm(`Are you sure you want to permanently delete the record for "${description || 'this transaction'}"?`)) return;
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', txId);
      if (error) throw error;
      fetchInitialData(); 
    } catch (err: any) {
      alert("Failed to delete transaction: " + err.message);
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
        case 'type': aValue = a.type.toLowerCase(); bValue = b.type.toLowerCase(); break;
        default: aValue = ''; bValue = '';
      }
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredTransactions, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection(field === 'amount' || field === 'date' ? 'desc' : 'asc'); }
  };

  const SortableHeader = ({ field, label, align = 'left' }: { field: SortField, label: string, align?: 'left' | 'right' }) => {
    const isActive = sortField === field;
    return (
      <th onClick={() => handleSort(field)} className={`p-4 cursor-pointer select-none group transition-colors hover:text-slate-900 dark:hover:text-slate-200 ${isActive ? 'text-slate-900 dark:text-slate-200' : ''}`}>
        <div className={`flex items-center gap-2 ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
          {label}
          <span className={`flex items-center justify-center h-4 w-4 rounded transition-colors ${isActive ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300' : 'text-slate-300 dark:text-slate-600 group-hover:bg-slate-100 dark:group-hover:bg-slate-800/50'}`}>
            {!isActive ? <ArrowUpDown className="h-3 w-3 opacity-50" /> : (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
          </span>
        </div>
      </th>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Transactions Ledger</h1>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Record, search, and dynamically audit financial records.</p>
        </div>
        <button onClick={handleOpenNew} className="flex items-center gap-2 bg-brand dark:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md hover:bg-brand-dark dark:hover:bg-emerald-800 transition-all">
          <Plus className="h-4 w-4" /> Add Transaction
        </button>
      </div>

      <div className="bento-card p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          
          <div className="flex gap-1.5 p-1.5 bg-slate-200/70 dark:bg-slate-900/80 rounded-xl w-fit border border-slate-300 dark:border-slate-800 shadow-inner">
            <button onClick={() => setActiveTab('ALL')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'ALL' ? 'bg-slate-800 text-white dark:bg-slate-700 shadow-md transform scale-[1.02]' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'}`}>All Records</button>
            <button onClick={() => setActiveTab('INCOME')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'INCOME' ? 'bg-emerald-600 text-white shadow-md transform scale-[1.02]' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'}`}>Income</button>
            <button onClick={() => setActiveTab('EXPENSE')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'EXPENSE' ? 'bg-amber-500 text-white shadow-md transform scale-[1.02]' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'}`}>Expenses</button>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <select 
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm focus:border-brand dark:focus:border-emerald-500 focus:ring-1 focus:ring-brand"
              value={selectedPeriodFilter}
              onChange={(e) => setSelectedPeriodFilter(e.target.value)}
            >
              <option value="ALL">All Financial Periods (Months)</option>
              {periods.map(p => (
                <option key={p.id} value={p.id}>{p.period_name} ({p.status})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
          <input type="text" placeholder="Search remarks, payee, receipt #, category, or encoder..." className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-800 text-xs font-medium focus:border-brand dark:focus:border-emerald-500 focus:ring-1 focus:ring-brand bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      <div className="bento-card overflow-hidden p-0 border border-slate-200 dark:border-[#27272A] shadow-sm rounded-2xl bg-white dark:bg-[#121212]">
        {loading ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400 animate-pulse text-xs font-medium">Loading secure ledger...</div>
        ) : sortedTransactions.length === 0 ? (
          <div className="p-16 text-center space-y-3 bg-slate-50 dark:bg-transparent">
            <Receipt className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-700" />
            <p className="text-slate-600 dark:text-slate-400 text-xs font-medium">No transactions match your current view.</p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap min-w-[1050px]">
              <thead>
                <tr className="bg-transparent border-b border-slate-200 dark:border-[#27272A] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <SortableHeader field="date" label="Date" />
                  <SortableHeader field="type" label="Type" />
                  <SortableHeader field="category" label="ComBud Category" />
                  <SortableHeader field="payee_remarks" label="Payee / Remarks" />
                  <SortableHeader field="encoded_by" label="Encoded By" />
                  <th className="p-4 uppercase tracking-wider text-[10px] font-semibold">Receipt</th>
                  <SortableHeader field="amount" label="Amount (PHP)" align="right" />
                  <th className="p-4 text-right uppercase tracking-wider text-[10px] font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#27272A]/50 bg-transparent">
                {sortedTransactions.map((tx) => {
                  const categoryName = tx.categories?.name?.toLowerCase() || '';
                  const isAutoExempt = exemptKeywords.some(keyword => categoryName.includes(keyword));

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors group">
                      <td className="p-4 text-slate-600 dark:text-slate-300 font-medium">{tx.date}</td>
                      
                      <td className="p-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide border border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300">
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${tx.type === 'INCOME' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                          {tx.type}
                        </span>
                      </td>
                      
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">{tx.categories?.export_code}</span>
                          <span className="font-medium text-slate-700 dark:text-slate-200">{tx.categories?.name}</span>
                        </div>
                      </td>
                      
                      <td className="p-4">
                        <div className="text-slate-900 dark:text-white font-medium">{tx.payee_name || '—'}</div>
                        <div className="text-slate-500 dark:text-slate-500 text-[11px] mt-0.5 truncate max-w-[200px]" title={tx.remarks || ''}>{tx.remarks || '—'}</div>
                      </td>
                      
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                          <UserCircle className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                          <span className="text-[11px] font-medium">
                            {tx.profiles?.full_name}
                          </span>
                        </div>
                      </td>

                      <td className="p-4">
                        {tx.type === 'INCOME' ? (
                          <span className="text-slate-400 dark:text-slate-600 text-[10px] font-medium">—</span>
                        ) : tx.receipt_url ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-[#27272A]">
                            <Paperclip className="h-3 w-3 text-emerald-500" /> Attached
                          </span>
                        ) : (tx.receipt_exempt || isAutoExempt) ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-[#27272A]">
                            <CheckCircle2 className="h-3 w-3 text-slate-500" /> Exempt
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-[#27272A]">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Missing
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-right font-mono text-xs font-medium">
                         <span className={tx.type === 'INCOME' ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}>
                           {tx.type === 'INCOME' ? '+' : '-'}₱{Number(tx.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                         </span>
                      </td>

                      <td className="p-4 text-right space-x-0.5">
                        <button 
                          onClick={() => handleViewDetails(tx)}
                          className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#27272A] rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button 
                          onClick={() => handleEdit(tx)}
                          className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#27272A] rounded-lg transition-colors"
                          title="Edit Transaction"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteTransaction(tx.id, tx.remarks || tx.payee_name || 'Transaction')}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Delete Transaction"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {churchId && user && (
        <>
          {/* FIX: Passing the current filter state as the defaultPeriodId */}
          <TransactionModal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            onSuccess={fetchInitialData} 
            churchId={churchId} 
            userId={user.id} 
            initialData={editingTx} 
            defaultPeriodId={selectedPeriodFilter !== 'ALL' ? selectedPeriodFilter : (periods.find(p => p.status === 'OPEN')?.id || undefined)}
          />
          <TransactionDetailModal
            isOpen={isDetailModalOpen}
            onClose={() => setIsDetailModalOpen(false)}
            transaction={viewingTx}
          />
        </>
      )}
    </div>
  );
}
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { X, AlertCircle, Search, Check, ChevronDown, ToggleLeft, ToggleRight, ListPlus, Trash2, Calculator, CheckCircle2, AlertTriangle, Tag, RotateCw } from 'lucide-react';
import type { Category, TransactionType, FinancialPeriod, Transaction } from '../types/database.types';
import TransactionReviewModal, { type ReviewData } from './TransactionReviewModal';

type EnrichedTransaction = Transaction & { categories?: Category };

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  churchId: string;
  userId: string;
  initialData?: Transaction | null;
  defaultPeriodId?: string; 
  existingTransactions: EnrichedTransaction[];
}

export default function TransactionModal({ isOpen, onClose, onSuccess, churchId, userId, initialData, defaultPeriodId, existingTransactions }: TransactionModalProps) {
  const [type, setType] = useState<TransactionType>('INCOME');
  const [categories, setCategories] = useState<Category[]>([]);
  const [periods, setPeriods] = useState<FinancialPeriod[]>([]);
  
  const [tithers, setTithers] = useState<{id: string, full_name: string}[]>([]);
  const [focusedItemIndex, setFocusedItemIndex] = useState<number | null>(null);

  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [receiptNo, setReceiptNo] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [remarks, setRemarks] = useState('');
  
  const [categoryId, setCategoryId] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [strictMode, setStrictMode] = useState(false);
  const [wholeAmount, setWholeAmount] = useState('');
  const [decimalAmount, setDecimalAmount] = useState('00');
  const [standardAmount, setStandardAmount] = useState('');

  const [useBreakdown, setUseBreakdown] = useState(false);
  const [breakdownItems, setBreakdownItems] = useState<{name: string, amount: string}[]>([]);

  const [showReview, setShowReview] = useState(false);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);

  const [loading, setLoading] = useState(false);
  const [successAnim, setSuccessAnim] = useState(false);
  const [error, setError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<EnrichedTransaction | null>(null);

  const SPECIAL_EVENT_TAGS: Record<string, string[]> = {
    '6251': ['food', 'transport', 'love gift', 'materials'],
    '6252': ['food', 'transport', 'love gift', 'materials'],
    '6253': ['food', 'transport', 'love gift'],
    '6261': ['food', 'transport', 'love gift', 'materials', 'lodging'],
    '6262': ['transport', 'materials', 'fees'],
    '6301': ['food', 'transport', 'gift'],
    '6302': ['food', 'materials'],
    '6351': ['venue', 'transport', 'food', 'materials'],
    '6352': ['venue', 'transport', 'food', 'materials'],
    '6353': ['venue', 'transport', 'food', 'materials'],
    '6354': ['venue', 'transport', 'food', 'materials'],
    '6355': ['venue', 'transport', 'food', 'materials'],
    '6356': ['venue', 'transport', 'food', 'materials'],
    '6357': ['venue', 'transport', 'food', 'materials'],
    '6358': ['venue', 'transport', 'food', 'materials'],
    '6359': ['venue', 'transport', 'food', 'materials'],
  };

  useEffect(() => {
    if (isOpen) {
      setSuccessAnim(false); setDuplicateWarning(null); setShowReview(false);
      if (initialData) {
        setType(initialData.type); setDate(initialData.date);
        setReceiptNo(initialData.receipt_no || ''); setPayeeName(initialData.payee_name || '');
        setSelectedPeriodId(initialData.financial_period_id); setCategoryId(initialData.category_id || 'unassigned');
        
        setStandardAmount(initialData.amount.toLocaleString('en-US'));

        const fullRemarks = initialData.remarks || '';
        const breakdownMatch = fullRemarks.match(/\[Breakdown: (.*?)\]/);
        if (breakdownMatch) {
          const parsed = breakdownMatch[1].split(', ').map(pair => {
            const lastColonIndex = pair.lastIndexOf(': ₱');
            return lastColonIndex === -1 ? { name: pair, amount: '' } : { name: pair.substring(0, lastColonIndex), amount: parseFloat(pair.substring(lastColonIndex + 3)).toLocaleString('en-US') };
          });
          setBreakdownItems(parsed); setUseBreakdown(true);
          setRemarks(fullRemarks.replace(/\[Breakdown:.*?\]/, '').trim());
        } else {
          setUseBreakdown(false); setBreakdownItems([]); setRemarks(fullRemarks);
        }
      } else {
        setDate(new Date().toISOString().split('T')[0]);
        setReceiptNo(''); setPayeeName(''); setRemarks('');
        setStandardAmount(''); setWholeAmount(''); setDecimalAmount('00');
        setUseBreakdown(false); setBreakdownItems([]);
      }
      fetchMetadata();
    }
  }, [isOpen, initialData, type]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsCategoryOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchMetadata = async () => {
    const { data: catData } = await supabase.from('categories').select('*').eq('church_id', churchId).eq('type', initialData ? initialData.type : type).order('sort_order');
    const unassignedCategory: Category = { id: 'unassigned', church_id: churchId, type: type, export_code: '???', name: 'Unassigned', sort_order: 0, created_at: new Date().toISOString() };
    const combinedCategories = [unassignedCategory, ...(catData || [])];
    setCategories(combinedCategories);

    if (!initialData) {
      setCategoryId('unassigned'); setCategorySearch('Unassigned');
    } else {
      const found = combinedCategories.find(c => c.id === (initialData.category_id || 'unassigned'));
      if (found) { setCategorySearch(found.id === 'unassigned' ? 'Unassigned' : `[${found.export_code}] ${found.name}`); setCategoryId(found.id); }
      else { setCategorySearch('Unassigned'); setCategoryId('unassigned'); }
    }

    const [periodData, tithersData] = await Promise.all([
      supabase.from('financial_periods').select('*').eq('church_id', churchId).order('month', { ascending: true }),
      supabase.from('tithers').select('id, full_name').eq('church_id', churchId).order('full_name')
    ]);

    if (tithersData.data) setTithers(tithersData.data);

    if (periodData.data) {
      setPeriods(periodData.data);
      if (!initialData && periodData.data.length > 0) {
        if (defaultPeriodId && periodData.data.some(p => p.id === defaultPeriodId)) setSelectedPeriodId(defaultPeriodId);
        else {
          const openPeriod = periodData.data.find(p => p.status === 'OPEN');
          setSelectedPeriodId(openPeriod ? openPeriod.id : periodData.data[0].id);
        }
      }
    }
  };

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    setCategoryId('unassigned');
    setCategorySearch('Unassigned');
    setBreakdownItems([]);
    setRemarks('');
  };

  const handleCategorySelect = (c: Category) => {
    setCategoryId(c.id); setCategorySearch(c.id === 'unassigned' ? 'Unassigned' : `[${c.export_code}] ${c.name}`); setIsCategoryOpen(false);
  };

  const handleAmountChange = (val: string, setter: (v: string) => void) => {
    const raw = val.replace(/[^0-9.]/g, ''); 
    const parts = raw.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    if (parts.length > 2) parts.pop(); 
    setter(parts.join('.'));
  };

  const filteredCategories = categories.filter(c => c.name.toLowerCase().includes(categorySearch.toLowerCase()) || c.export_code.includes(categorySearch));
  const selectedCategory = categories.find(c => c.id === categoryId);
  const breakdownTotal = breakdownItems.reduce((sum, item) => sum + (parseFloat(item.amount.replace(/,/g, '')) || 0), 0);

  const isTitheOrOffering = selectedCategory && (
    selectedCategory.name.toLowerCase().includes('tithe') ||
    selectedCategory.name.toLowerCase().includes('offering') ||
    ['5011', '5015'].includes(selectedCategory.export_code)
  );

  const handleReviewIntercept = async (e: React.FormEvent, forceBypassDuplicate = false) => {
    e.preventDefault();
    setError('');

    let finalAmount = 0;
    if (useBreakdown) finalAmount = breakdownTotal;
    else if (strictMode) finalAmount = parseFloat(`${wholeAmount.replace(/,/g, '') || 0}.${decimalAmount || '00'}`);
    else finalAmount = parseFloat(standardAmount.replace(/,/g, '') || '0');

    const roundedAmount = Number(finalAmount.toFixed(2));
    if (isNaN(roundedAmount) || roundedAmount <= 0) { setError('Please enter a valid positive amount.'); return; }

    if (categoryId === 'unassigned' && !remarks.trim()) {
      setError('Remarks are required when saving an Unassigned transaction. Please leave a note for the auditor.');
      return;
    }

    if (!forceBypassDuplicate && !initialData) {
      const isDuplicate = existingTransactions.find(tx => tx.financial_period_id === selectedPeriodId && tx.category_id === (categoryId === 'unassigned' ? null : categoryId) && Number(tx.amount) === roundedAmount && tx.date === date);
      if (isDuplicate) { setDuplicateWarning(isDuplicate); return; }
    }

    let finalRemarks = remarks.trim();
    if (useBreakdown && breakdownItems.length > 0) {
      const breakdownText = breakdownItems.map(i => `${i.name}: ₱${Number(parseFloat(i.amount.replace(/,/g, '')) || 0).toFixed(2)}`).join(', ');
      finalRemarks = finalRemarks ? `${finalRemarks} [Breakdown: ${breakdownText}]` : `[Breakdown: ${breakdownText}]`;
    }

    const payload = {
      church_id: churchId, financial_period_id: selectedPeriodId, category_id: categoryId === 'unassigned' ? null : categoryId, 
      date, type, receipt_no: receiptNo.trim() || null, remarks: finalRemarks || null, payee_name: payeeName.trim() || null, amount: roundedAmount, entered_by: userId,
    };

    setReviewData({
      type,
      amount: roundedAmount,
      date,
      periodName: periods.find(p => p.id === selectedPeriodId)?.period_name || 'Unknown Period',
      categoryName: categoryId === 'unassigned' ? 'Unassigned' : (selectedCategory?.name || 'Unassigned'),
      payeeName: payeeName.trim() || '—',
      receiptNo: receiptNo.trim() || '—',
      remarks: finalRemarks || '—',
      payload
    });
    
    setShowReview(true);
  };

  const confirmAndSave = async () => {
    if (!reviewData) return;
    setLoading(true);
    try {
      if (initialData) {
        await supabase.from('transaction_logs').insert({ church_id: churchId, action: 'UPDATE', changed_by: userId, old_data: initialData, new_data: reviewData.payload });
        const { error } = await supabase.from('transactions').update(reviewData.payload).eq('id', initialData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('transactions').insert(reviewData.payload);
        if (error) throw error;
      }
      setShowReview(false);
      setSuccessAnim(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1000);
    } catch (error: any) {
      alert("Error saving transaction: " + error.message);
      setShowReview(false);
    } finally {
      setLoading(false);
    }
  };

  const getPayeePlaceholder = () => {
    if (!selectedCategory || selectedCategory.id === 'unassigned') return 'e.g. Source / Payee Name';
    const name = selectedCategory.name.toLowerCase();
    if (type === 'INCOME') {
      if (name.includes('tithe') || name.includes('offering')) return 'e.g. Member / Family Name (Optional)';
      return 'e.g. Donor / Source Name';
    } else {
      if (name.includes('electricity') || name.includes('water')) return 'e.g. Utility Provider (e.g. Meralco)';
      return 'e.g. Supplier / Payee Name';
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      <div className="fixed -inset-10 z-[99998] bg-slate-950/75 dark:bg-black/85 backdrop-blur-md transition-opacity duration-300" aria-hidden="true" />

      <div className="fixed inset-0 z-[99998] flex items-center justify-center p-0 sm:p-4 pointer-events-none">
        
        <div className={`pointer-events-auto w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] max-w-2xl bg-white dark:bg-[#0A0A0A] rounded-none sm:rounded-2xl shadow-none sm:shadow-2xl relative flex flex-col p-0 overflow-hidden border-0 sm:border border-slate-200 dark:border-[#27272A] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${showReview ? 'scale-[0.95] -translate-x-12 opacity-0 blur-[2px] pointer-events-none' : 'scale-100 translate-x-0 opacity-100 blur-0'}`}>
          
          {successAnim ? (
            <div className="p-16 flex flex-col items-center justify-center space-y-4 text-center my-auto">
              <div className="h-16 w-16 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 animate-bounce"><CheckCircle2 className="h-8 w-8" /></div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Transaction Saved Successfully!</h3>
            </div>
          ) : duplicateWarning ? (
            <div className="p-8 flex flex-col items-center justify-center space-y-6 text-center h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-[#0A0A0A]">
              <div className="h-16 w-16 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400 animate-pulse shrink-0"><AlertTriangle className="h-8 w-8" /></div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Possible Duplicate Detected</h3>
                <p className="text-xs text-slate-500">A transaction with the exact same amount and category already exists on this date.</p>
              </div>
              <div className="bg-white dark:bg-[#121212] p-4 rounded-xl border border-slate-200 dark:border-[#27272A] text-left text-xs w-full font-mono">
                <p className="text-slate-400 mb-1">Existing Record Details:</p>
                <p><strong>Date:</strong> {duplicateWarning.date}</p>
                <p><strong>Amount:</strong> ₱{Number(duplicateWarning.amount).toLocaleString('en-PH', {minimumFractionDigits: 2})}</p>
                <p><strong>Payee:</strong> {duplicateWarning.payee_name || 'N/A'}</p>
                <p className="truncate"><strong>Remarks:</strong> {duplicateWarning.remarks || 'N/A'}</p>
              </div>
              <div className="flex flex-col sm:flex-row w-full gap-3 mt-4">
                <button onClick={() => setDuplicateWarning(null)} className="flex-1 py-3 bg-white dark:bg-[#121212] text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-[#1A1A1A] transition-all border border-slate-200 dark:border-[#27272A]">Go Back & Edit</button>
                <button onClick={(e) => handleReviewIntercept(e, true)} className="flex-1 py-3 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-all shadow-md">Yes, Save as Duplicate</button>
              </div>
            </div>
          ) : (
            <>
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 sm:p-6 bg-slate-50 dark:bg-[#111111] border-b border-slate-200 dark:border-[#27272A] rounded-t-2xl shrink-0">
                <div>
                  <h2 className="text-sm font-bold tracking-wide uppercase text-slate-900 dark:text-white flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${type === 'INCOME' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                    {initialData ? 'Edit' : 'Record'} {type === 'INCOME' ? 'Receipt' : 'Disbursement'}
                  </h2>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5 hidden sm:block">Ensure details match physical vouchers exactly.</p>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1A1A1A] p-2 rounded-xl transition-colors hidden sm:flex"><X className="h-4 w-4" /></button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4 bg-slate-50/50 dark:bg-[#0A0A0A]">
                {error && (
                  <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 p-4 rounded-xl text-xs font-medium flex items-center gap-2.5 border border-rose-200 dark:border-rose-900/50"><AlertCircle className="h-4 w-4 shrink-0" /><span>{error}</span></div>
                )}

                {!initialData && (
                  <div className="flex gap-1.5 p-1.5 bg-slate-200 dark:bg-[#121212] rounded-xl border border-slate-300 dark:border-[#27272A] shadow-inner">
                    <button type="button" onClick={() => handleTypeChange('INCOME')} className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all shadow-sm ${type === 'INCOME' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>Income / Receipt</button>
                    <button type="button" onClick={() => handleTypeChange('EXPENSE')} className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all shadow-sm ${type === 'EXPENSE' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>Expense / Disbursement</button>
                  </div>
                )}

                <form id="tx-form" onSubmit={(e) => handleReviewIntercept(e, false)} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Fixed Financial Period Dropdown Padding & Right Alignment */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Financial Period</label>
                      <div className="relative">
                        <select required className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#121212] px-4 py-3 pr-10 text-xs font-bold text-slate-900 dark:text-white focus:border-emerald-500 outline-none appearance-none cursor-pointer" value={selectedPeriodId} onChange={(e) => setSelectedPeriodId(e.target.value)}>
                          {periods.map((p) => <option key={p.id} value={p.id}>{p.period_name} {p.status !== 'OPEN' ? `(${p.status})` : ''}</option>)}
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none"><ChevronDown className="h-4 w-4 text-slate-400" /></div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Transaction Date</label>
                      <input type="date" required className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#121212] px-4 py-3 text-xs font-bold text-slate-900 dark:text-white focus:border-emerald-500 outline-none" value={date} onChange={(e) => setDate(e.target.value)} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative">
                    <div ref={dropdownRef} className="relative space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Account No. & Name</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><Search className="h-4 w-4 text-slate-400" /></div>
                        <input type="text" className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#121212] pl-10 pr-10 py-3 text-xs font-bold text-slate-900 dark:text-white focus:border-emerald-500 outline-none" placeholder="Search ComBud Account..." value={categorySearch} onClick={() => { setIsCategoryOpen(true); setCategorySearch(''); }} onChange={(e) => { setCategorySearch(e.target.value); setIsCategoryOpen(true); }} />
                        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none"><ChevronDown className="h-4 w-4 text-slate-400" /></div>
                      </div>
                      {isCategoryOpen && (
                        <div className="absolute z-20 mt-1 w-full bg-white dark:bg-[#121212] shadow-2xl max-h-60 rounded-xl py-1 text-xs overflow-auto border border-slate-200 dark:border-[#27272A] custom-scrollbar">
                          {filteredCategories.map((c) => (
                            <div key={c.id} className={`px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-slate-50 dark:hover:bg-[#1A1A1A] ${categoryId === c.id ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold' : 'text-slate-700 dark:text-slate-300'}`} onClick={() => handleCategorySelect(c)}>
                              <div className="flex gap-2 items-center">
                                {c.id !== 'unassigned' && <span className="font-mono text-[10px] text-slate-400">[{c.export_code}]</span>}
                                <span>{c.name}</span>
                              </div>
                              {categoryId === c.id && <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Receipt / Ref No.</label>
                      <input type="text" placeholder="e.g. 1024" className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#121212] px-4 py-3 text-xs font-bold text-slate-900 dark:text-white focus:border-emerald-500 outline-none" value={receiptNo} onChange={(e) => setReceiptNo(e.target.value)} />
                    </div>
                  </div>

                  {selectedCategory && SPECIAL_EVENT_TAGS[selectedCategory.export_code] && (
                    <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/50 p-4 rounded-xl space-y-2">
                      <div className="flex items-center gap-2 text-sky-700 dark:text-sky-400 text-xs font-bold">
                        <Tag className="h-4 w-4" /> Special Category Export Matcher
                      </div>
                      <p className="text-[11px] text-sky-600 dark:text-sky-300">Click a tag below to set the exact remark needed for the ComBud export:</p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {SPECIAL_EVENT_TAGS[selectedCategory.export_code].map(tag => (
                          <button key={tag} type="button" onClick={() => setRemarks(tag)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${remarks === tag ? 'bg-sky-600 text-white border-sky-600' : 'bg-white dark:bg-[#121212] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#27272A] hover:border-sky-400'}`}>
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Payee / Source</label>
                      <input type="text" placeholder={getPayeePlaceholder()} className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#121212] px-4 py-3 text-xs font-bold text-slate-900 dark:text-white focus:border-emerald-500 outline-none" value={payeeName} onChange={(e) => setPayeeName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Remarks {categoryId === 'unassigned' && <span className="text-red-500">*</span>}</label>
                      <input type="text" placeholder="Additional details..." required={categoryId === 'unassigned'} className={`w-full rounded-xl border bg-white dark:bg-[#121212] px-4 py-3 text-xs font-bold text-slate-900 dark:text-white focus:border-emerald-500 outline-none ${categoryId === 'unassigned' ? 'border-amber-400 dark:border-amber-600' : 'border-slate-200 dark:border-[#27272A]'}`} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                    </div>
                  </div>

                  <div className="bg-white dark:bg-[#121212] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-[#27272A] space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-200 dark:border-[#27272A] pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 hidden sm:block"><Calculator className="h-4 w-4" /></div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Itemized Breakdown</h4>
                          <p className="text-[10px] text-slate-500 hidden sm:block">Break down sub-items before posting total.</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => { setUseBreakdown(!useBreakdown); if (!useBreakdown && breakdownItems.length === 0) setBreakdownItems([{name: '', amount: ''}]); }} className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 ${useBreakdown ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-[#1A1A1A] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#27272A]'}`}>
                        <ListPlus className="h-3.5 w-3.5" /> {useBreakdown ? 'Itemized Active' : 'Enable Itemized'}
                      </button>
                    </div>

                    {useBreakdown ? (
                      <div className="space-y-3 bg-slate-50 dark:bg-[#0A0A0A] p-4 rounded-xl border border-slate-200 dark:border-[#27272A]">
                        {breakdownItems.map((item, index) => {
                          // Optimized to show top 5 matches instantly without scrollbar rendering / lagging
                          const matchedTithers = item.name.trim() ? tithers.filter(t => t.full_name.toLowerCase().includes(item.name.toLowerCase())).slice(0, 5) : [];

                          return (
                            <div key={index} className="flex flex-col sm:flex-row gap-2 items-center w-full">
                              <div className="relative w-full sm:flex-1 min-w-0">
                                 <input 
                                   type="text" 
                                   placeholder={isTitheOrOffering ? "Search Tither name..." : "Item name"} 
                                   required 
                                   className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#121212] px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:border-emerald-500 outline-none" 
                                   value={item.name} 
                                   onChange={e => { const newItems = [...breakdownItems]; newItems[index].name = e.target.value; setBreakdownItems(newItems); }} 
                                   onFocus={() => setFocusedItemIndex(index)} 
                                   onBlur={() => setTimeout(() => setFocusedItemIndex(null), 200)}
                                 />
                                 {focusedItemIndex === index && isTitheOrOffering && matchedTithers.length > 0 && (
                                   <div className="absolute z-50 mt-1 w-full bg-white dark:bg-[#1A1A1A] shadow-xl rounded-xl py-1 text-xs border border-slate-200 dark:border-[#27272A]">
                                      {matchedTithers.map(t => (
                                        <div 
                                          key={t.id} 
                                          className="px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-[#262626] text-slate-700 dark:text-slate-300 font-medium transition-colors" 
                                          onMouseDown={() => { const newItems = [...breakdownItems]; newItems[index].name = t.full_name; setBreakdownItems(newItems); setFocusedItemIndex(null); }}
                                        >
                                          {t.full_name}
                                        </div>
                                      ))}
                                   </div>
                                 )}
                              </div>

                              <div className="flex gap-2 w-full sm:w-auto">
                                <input type="text" placeholder="₱ 0.00" required className="flex-1 sm:w-32 rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#121212] px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:border-emerald-500 outline-none text-right" value={item.amount} onChange={e => { const newItems = [...breakdownItems]; handleAmountChange(e.target.value, (masked) => { newItems[index].amount = masked; }); setBreakdownItems(newItems); }} />
                                <button type="button" onClick={() => setBreakdownItems(breakdownItems.filter((_, i) => i !== index))} className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-500/10 rounded-xl bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#27272A] flex items-center justify-center shrink-0"><Trash2 className="h-4 w-4" /></button>
                              </div>
                            </div>
                          );
                        })}
                        <button type="button" onClick={() => setBreakdownItems([...breakdownItems, {name: '', amount: ''}])} className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline">+ Add Another Item</button>
                        <div className="border-t border-slate-200 dark:border-[#27272A] pt-3 mt-3 flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-500">Auto-Computed Total:</span>
                          <span className="font-black text-lg text-emerald-600 dark:text-emerald-400">₱{breakdownTotal.toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Amount (PHP ₱)</label>
                          <button type="button" onClick={() => setStrictMode(!strictMode)} className="text-[10px] font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5">
                            Strict Format {strictMode ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4 text-slate-400" />}
                          </button>
                        </div>
                        {strictMode ? (
                          <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-2 relative">
                              <span className="absolute -top-2 left-3 bg-white dark:bg-[#121212] px-1 text-[9px] font-bold text-slate-400 uppercase">Whole Number</span>
                              <input type="text" required placeholder="5,000" className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#121212] px-4 py-3 text-sm font-bold text-slate-900 dark:text-white focus:border-emerald-500 outline-none" value={wholeAmount} onChange={(e) => handleAmountChange(e.target.value.replace(/[^0-9]/g, ''), setWholeAmount)} />
                            </div>
                            <div className="relative">
                              <span className="absolute -top-2 left-3 bg-white dark:bg-[#121212] px-1 text-[9px] font-bold text-slate-400 uppercase">Decimal</span>
                              <input type="text" maxLength={2} placeholder="00" className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#121212] px-4 py-3 text-sm font-bold text-slate-900 dark:text-white text-center focus:border-emerald-500 outline-none" value={decimalAmount} onChange={(e) => setDecimalAmount(e.target.value.replace(/[^0-9]/g, ''))} />
                            </div>
                          </div>
                        ) : (
                          <input type="text" required placeholder="0.00" className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#121212] px-4 py-3 text-sm font-bold text-slate-900 dark:text-white focus:border-emerald-500 outline-none" value={standardAmount} onChange={(e) => handleAmountChange(e.target.value, setStandardAmount)} />
                        )}
                      </div>
                    )}
                  </div>
                </form>
              </div>

              {/* Modal Footer */}
              <div className="p-4 sm:p-6 bg-slate-50 dark:bg-[#111111] border-t border-slate-200 dark:border-[#27272A] flex justify-end gap-3 shrink-0 rounded-b-2xl">
                <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1A1A1A] transition-colors border border-slate-200 dark:border-[#27272A]">Cancel</button>
                <button form="tx-form" type="submit" className="px-7 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2">
                  <span>Continue to Review</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <TransactionReviewModal 
        isOpen={showReview} 
        onBack={() => setShowReview(false)} 
        onConfirm={confirmAndSave} 
        data={reviewData} 
        loading={loading}
        isEditing={!!initialData}
      />
    </>,
    document.body
  );
}
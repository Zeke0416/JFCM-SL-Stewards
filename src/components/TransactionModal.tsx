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

    const { data: periodData } = await supabase.from('financial_periods').select('*').eq('church_id', churchId).order('month', { ascending: true });
    if (periodData) {
      setPeriods(periodData);
      if (!initialData && periodData.length > 0) {
        if (defaultPeriodId && periodData.some(p => p.id === defaultPeriodId)) setSelectedPeriodId(defaultPeriodId);
        else {
          const openPeriod = periodData.find(p => p.status === 'OPEN');
          setSelectedPeriodId(openPeriod ? openPeriod.id : periodData[0].id);
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
      <div className="fixed -inset-10 z-[99998] bg-black/80 backdrop-blur-md transition-opacity duration-300" aria-hidden="true" />

      <div className="fixed inset-0 z-[99998] flex items-center justify-center p-0 sm:p-4 pointer-events-none">
        
        <div className={`pointer-events-auto w-full h-[100dvh] sm:h-auto sm:max-h-[95vh] max-w-2xl bg-white dark:bg-[#121212] rounded-none sm:rounded-3xl shadow-none sm:shadow-2xl relative flex flex-col p-0 overflow-hidden border-0 sm:border border-slate-200 dark:border-[#27272A] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${showReview ? 'scale-[0.95] -translate-x-12 opacity-0 blur-[2px] pointer-events-none' : 'scale-100 translate-x-0 opacity-100 blur-0'}`}>
          
          {successAnim ? (
            <div className="p-16 flex flex-col items-center justify-center space-y-4 text-center my-auto">
              <div className="h-16 w-16 bg-emerald-100 dark:bg-emerald-950/80 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 animate-bounce"><CheckCircle2 className="h-8 w-8" /></div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Transaction Saved Successfully!</h3>
            </div>
          ) : duplicateWarning ? (
            <div className="p-8 flex flex-col items-center justify-center space-y-6 text-center h-full overflow-y-auto custom-scrollbar">
              <div className="h-16 w-16 bg-amber-100 dark:bg-amber-950/80 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400 animate-pulse shrink-0"><AlertTriangle className="h-8 w-8" /></div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Possible Duplicate Detected</h3>
                <p className="text-xs text-slate-500">A transaction with the exact same amount and category already exists on this date.</p>
              </div>
              <div className="bg-slate-50 dark:bg-[#0A0A0A] p-4 rounded-xl border border-slate-200 dark:border-[#27272A] text-left text-xs w-full font-mono">
                <p className="text-slate-400 mb-1">Existing Record Details:</p>
                <p><strong>Date:</strong> {duplicateWarning.date}</p>
                <p><strong>Amount:</strong> ₱{Number(duplicateWarning.amount).toLocaleString('en-PH', {minimumFractionDigits: 2})}</p>
                <p><strong>Payee:</strong> {duplicateWarning.payee_name || 'N/A'}</p>
                <p className="truncate"><strong>Remarks:</strong> {duplicateWarning.remarks || 'N/A'}</p>
              </div>
              <div className="flex flex-col sm:flex-row w-full gap-3 mt-4">
                <button onClick={() => setDuplicateWarning(null)} className="flex-1 py-3 bg-slate-100 dark:bg-[#1A1A1A] text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-[#27272A] transition-all border border-slate-200 dark:border-[#27272A]">Go Back & Edit</button>
                <button onClick={(e) => handleReviewIntercept(e, true)} className="flex-1 py-3 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-all shadow-md">Yes, Save as Duplicate</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between p-4 sm:p-6 landscape:py-2.5 landscape:px-4 lg:landscape:p-6 bg-slate-50 dark:bg-[#0A0A0A] border-b border-slate-200 dark:border-[#27272A] shrink-0">
                <div>
                  <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${type === 'INCOME' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                    {initialData ? 'Edit' : 'Record'} {type === 'INCOME' ? 'Receipt' : 'Disbursement'}
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 hidden sm:block landscape:hidden lg:landscape:block">Ensure details match physical vouchers exactly.</p>
                </div>
                <button onClick={onClose} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/5 p-2 rounded-xl transition-colors hidden sm:flex"><X className="h-4 w-4" /></button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 landscape:py-3 landscape:px-4 lg:landscape:p-6 space-y-4 sm:space-y-5 landscape:space-y-3 lg:landscape:space-y-5">
                {error && (
                  <div className="bg-red-50 dark:bg-red-950/40 text-red-700 p-4 rounded-2xl text-xs font-medium flex items-center gap-2.5 border border-red-200"><AlertCircle className="h-4 w-4 shrink-0 text-red-500" /><span>{error}</span></div>
                )}

                {!initialData && (
                  <div className="flex gap-1.5 p-1.5 bg-slate-200/70 dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-800 shadow-inner">
                    <button type="button" onClick={() => handleTypeChange('INCOME')} className={`flex-1 py-2.5 landscape:py-2 lg:landscape:py-2.5 text-xs font-bold rounded-xl transition-all shadow-sm ${type === 'INCOME' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>Income / Receipt</button>
                    <button type="button" onClick={() => handleTypeChange('EXPENSE')} className={`flex-1 py-2.5 landscape:py-2 lg:landscape:py-2.5 text-xs font-bold rounded-xl transition-all shadow-sm ${type === 'EXPENSE' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>Expense / Disbursement</button>
                  </div>
                )}

                <form id="tx-form" onSubmit={(e) => handleReviewIntercept(e, false)} className="space-y-4 sm:space-y-5 landscape:space-y-3 lg:landscape:space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 landscape:gap-3 lg:landscape:gap-5">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Financial Period</label>
                      <select required className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 landscape:py-2.5 lg:landscape:py-3 text-xs font-bold text-slate-900 dark:text-white focus:border-brand" value={selectedPeriodId} onChange={(e) => setSelectedPeriodId(e.target.value)}>
                        {periods.map((p) => <option key={p.id} value={p.id}>{p.period_name} {p.status !== 'OPEN' ? `(${p.status})` : ''}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Transaction Date</label>
                      <input type="date" required className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 landscape:py-2.5 lg:landscape:py-3 text-xs font-bold text-slate-900 dark:text-white focus:border-brand" value={date} onChange={(e) => setDate(e.target.value)} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 landscape:gap-3 lg:landscape:gap-5 relative">
                    <div ref={dropdownRef} className="relative space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Account No. & Name</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><Search className="h-4 w-4 text-slate-400" /></div>
                        <input type="text" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 pl-10 pr-10 py-3 landscape:py-2.5 lg:landscape:py-3 text-xs font-bold text-slate-900 dark:text-white focus:border-brand" placeholder="Search ComBud Account..." value={categorySearch} onClick={() => { setIsCategoryOpen(true); setCategorySearch(''); }} onChange={(e) => { setCategorySearch(e.target.value); setIsCategoryOpen(true); }} />
                        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none"><ChevronDown className="h-4 w-4 text-slate-400" /></div>
                      </div>
                      {isCategoryOpen && (
                        <div className="absolute z-20 mt-1 w-full bg-white dark:bg-[#121212] shadow-2xl max-h-60 rounded-2xl py-1 text-xs overflow-auto border border-slate-200 dark:border-[#27272A] ring-1 ring-black/5 custom-scrollbar">
                          {filteredCategories.map((c) => (
                            <div key={c.id} className={`px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 ${categoryId === c.id ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 font-bold' : 'text-slate-700 dark:text-slate-300'}`} onClick={() => handleCategorySelect(c)}>
                              <div className="flex gap-2 items-center">
                                {c.id !== 'unassigned' && <span className="font-mono text-[11px] text-slate-400">[{c.export_code}]</span>}
                                <span>{c.name}</span>
                              </div>
                              {categoryId === c.id && <Check className="h-4 w-4 text-emerald-600" />}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Receipt / Ref No.</label>
                      <input type="text" placeholder="e.g. 1024" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 landscape:py-2.5 lg:landscape:py-3 text-xs font-bold text-slate-900 dark:text-white focus:border-brand" value={receiptNo} onChange={(e) => setReceiptNo(e.target.value)} />
                    </div>
                  </div>

                  {selectedCategory && SPECIAL_EVENT_TAGS[selectedCategory.export_code] && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/50 p-4 rounded-xl space-y-2">
                      <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 text-xs font-bold">
                        <Tag className="h-4 w-4" /> Special Category Export Matcher
                      </div>
                      <p className="text-[11px] text-blue-600 dark:text-blue-300">Click a tag below to set the exact remark needed for the ComBud export:</p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {SPECIAL_EVENT_TAGS[selectedCategory.export_code].map(tag => (
                          <button key={tag} type="button" onClick={() => setRemarks(tag)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${remarks === tag ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-blue-400'}`}>
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 landscape:gap-3 lg:landscape:gap-5">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Payee / Source</label>
                      <input type="text" placeholder={getPayeePlaceholder()} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 landscape:py-2.5 lg:landscape:py-3 text-xs font-bold text-slate-900 dark:text-white focus:border-brand" value={payeeName} onChange={(e) => setPayeeName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Remarks {categoryId === 'unassigned' && <span className="text-red-500">*</span>}</label>
                      <input type="text" placeholder="Additional details..." required={categoryId === 'unassigned'} className={`w-full rounded-xl border bg-slate-50 dark:bg-slate-900 px-4 py-3 landscape:py-2.5 lg:landscape:py-3 text-xs font-bold text-slate-900 dark:text-white focus:border-brand ${categoryId === 'unassigned' ? 'border-amber-300 dark:border-amber-700' : 'border-slate-200 dark:border-slate-700'}`} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-[#0A0A0A] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-[#27272A] space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-200 dark:border-[#27272A] pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-brand/10 dark:bg-emerald-950/60 rounded-xl text-brand dark:text-emerald-400 hidden sm:block"><Calculator className="h-4 w-4" /></div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Itemized Breakdown</h4>
                          <p className="text-[10px] text-slate-500 hidden sm:block landscape:hidden lg:landscape:block">Break down sub-items before posting total.</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => { setUseBreakdown(!useBreakdown); if (!useBreakdown && breakdownItems.length === 0) setBreakdownItems([{name: '', amount: ''}]); }} className={`px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 ${useBreakdown ? 'bg-brand text-white shadow-sm' : 'bg-white dark:bg-[#121212] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#27272A]'}`}>
                        <ListPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> {useBreakdown ? 'Itemized Active' : 'Enable Itemized'}
                      </button>
                    </div>

                    {useBreakdown ? (
                      <div className="space-y-3 bg-white dark:bg-[#121212] p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-[#27272A]">
                        {/* Mobile rotation hint */}
                        <div className="block sm:hidden mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-[10px] text-blue-600 dark:text-blue-400 font-medium flex items-center justify-center gap-1.5">
                          <RotateCw className="h-3.5 w-3.5" /> Rotate phone for a better view.
                        </div>

                        {breakdownItems.map((item, index) => (
                          <div key={index} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center w-full bg-slate-50 dark:bg-[#0A0A0A] p-3 sm:p-0 rounded-xl sm:bg-transparent sm:dark:bg-transparent border border-slate-200 dark:border-[#27272A] sm:border-none">
                            <input type="text" placeholder="Item name" required className="w-full sm:flex-1 min-w-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white sm:bg-slate-50 dark:bg-slate-900 px-3 py-2.5 sm:py-2 landscape:py-2 lg:landscape:py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:border-brand" value={item.name} onChange={e => { const newItems = [...breakdownItems]; newItems[index].name = e.target.value; setBreakdownItems(newItems); }} />
                            <div className="flex gap-2 w-full sm:w-auto">
                              <input type="text" placeholder="₱ 0.00" required className="flex-1 sm:w-32 min-w-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white sm:bg-slate-50 dark:bg-slate-900 px-3 py-2.5 sm:py-2 landscape:py-2 lg:landscape:py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:border-brand text-right" value={item.amount} onChange={e => { const newItems = [...breakdownItems]; handleAmountChange(e.target.value, (masked) => { newItems[index].amount = masked; }); setBreakdownItems(newItems); }} />
                              <button type="button" onClick={() => setBreakdownItems(breakdownItems.filter((_, i) => i !== index))} className="px-3.5 sm:p-2 shrink-0 text-red-400 hover:text-red-600 hover:bg-red-500/10 rounded-xl bg-white sm:bg-transparent dark:bg-slate-900 border border-slate-200 sm:border-transparent dark:border-slate-700 flex items-center justify-center"><Trash2 className="h-4 w-4" /></button>
                            </div>
                          </div>
                        ))}
                        <button type="button" onClick={() => setBreakdownItems([...breakdownItems, {name: '', amount: ''}])} className="text-xs font-bold text-brand dark:text-emerald-400 hover:underline">+ Add Another Item</button>
                        <div className="border-t border-slate-200 dark:border-[#27272A] pt-3 mt-3 flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-600 dark:text-slate-400">Auto-Computed Total:</span>
                          <span className="font-black text-lg text-brand dark:text-emerald-400">₱{breakdownTotal.toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Total Amount (PHP ₱)</label>
                          <button type="button" onClick={() => setStrictMode(!strictMode)} className="text-[11px] font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5">
                            Strict Format {strictMode ? <ToggleRight className="h-4 w-4 text-brand dark:text-emerald-400" /> : <ToggleLeft className="h-4 w-4 text-slate-400" />}
                          </button>
                        </div>
                        {strictMode ? (
                          <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-2 relative">
                              <span className="absolute -top-2 left-3 bg-slate-50 dark:bg-[#0A0A0A] px-1 text-[10px] font-bold text-slate-400 uppercase">Whole Number</span>
                              <input type="text" required placeholder="5,000" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 landscape:py-2.5 lg:landscape:py-3 text-sm font-bold text-slate-900 dark:text-white focus:border-brand" value={wholeAmount} onChange={(e) => handleAmountChange(e.target.value.replace(/[^0-9]/g, ''), setWholeAmount)} />
                            </div>
                            <div className="relative">
                              <span className="absolute -top-2 left-3 bg-slate-50 dark:bg-[#0A0A0A] px-1 text-[10px] font-bold text-slate-400 uppercase">Decimal</span>
                              <input type="text" maxLength={2} placeholder="00" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 landscape:py-2.5 lg:landscape:py-3 text-sm font-bold text-slate-900 dark:text-white text-center focus:border-brand" value={decimalAmount} onChange={(e) => setDecimalAmount(e.target.value.replace(/[^0-9]/g, ''))} />
                            </div>
                          </div>
                        ) : (
                          <input type="text" required placeholder="0.00" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 landscape:py-2.5 lg:landscape:py-3 text-sm font-bold text-slate-900 dark:text-white focus:border-brand" value={standardAmount} onChange={(e) => handleAmountChange(e.target.value, setStandardAmount)} />
                        )}
                      </div>
                    )}
                  </div>
                </form>
              </div>

              {/* Footer */}
              <div className="p-4 sm:p-6 landscape:py-2.5 landscape:px-4 lg:landscape:p-6 bg-slate-100/50 dark:bg-[#0A0A0A] border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 shrink-0 sm:rounded-b-3xl">
                <button type="button" onClick={onClose} className="px-5 py-3 sm:py-2.5 landscape:py-2 lg:landscape:py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700 sm:border-transparent flex-1 sm:flex-none">Cancel</button>
                <button form="tx-form" type="submit" className="px-7 py-3 sm:py-2.5 landscape:py-2 lg:landscape:py-2.5 bg-brand dark:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md hover:bg-brand-dark dark:hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 flex-[2] sm:flex-none">
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
import SuggestInput from './ui/SuggestInput';
import { useFeedback } from './ui/useFeedback';
import DialogLayer from './ui/DialogLayer';
import Select from './ui/Select';
import Input from './ui/Input';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { X, AlertCircle, ToggleLeft, ToggleRight, ListPlus, Trash2, Calculator, CheckCircle2, AlertTriangle, Tag } from 'lucide-react';
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
  const { notify } = useFeedback();
  const [type, setType] = useState<TransactionType>('INCOME');
  const [categories, setCategories] = useState<Category[]>([]);
  const [periods, setPeriods] = useState<FinancialPeriod[]>([]);
  
  const [tithers, setTithers] = useState<{id: string, full_name: string}[]>([]);

  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [receiptNo, setReceiptNo] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [remarks, setRemarks] = useState('');
  
  const [categoryId, setCategoryId] = useState('');
  
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
  const [showConvertPrompt, setShowConvertPrompt] = useState(false);

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
      setSuccessAnim(false); setDuplicateWarning(null); setShowReview(false); setShowConvertPrompt(false);
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
      } else if (!showConvertPrompt && type !== 'INCOME') {
        setDate(new Date().toISOString().split('T')[0]);
        setReceiptNo(''); setPayeeName(''); setRemarks('');
        setStandardAmount(''); setWholeAmount(''); setDecimalAmount('00');
        setUseBreakdown(false); setBreakdownItems([]);
      }
      fetchMetadata();
    }
  }, [isOpen, initialData]);

  useEffect(() => {
    if (isOpen) {
      fetchCategoriesForType(type);
    }
  }, [type, churchId, isOpen]);

  const fetchCategoriesForType = async (targetType: TransactionType) => {
    const { data: catData } = await supabase.from('categories').select('*').eq('church_id', churchId).eq('type', targetType).order('sort_order');
    const unassignedCategory: Category = { id: 'unassigned', church_id: churchId, type: targetType, export_code: '???', name: 'Unassigned', sort_order: 0, created_at: new Date().toISOString() };
    setCategories([unassignedCategory, ...(catData || [])]);
  };

  const fetchMetadata = async () => {
    const { data: catData } = await supabase.from('categories').select('*').eq('church_id', churchId).eq('type', initialData ? initialData.type : type).order('sort_order');
    const unassignedCategory: Category = { id: 'unassigned', church_id: churchId, type: type, export_code: '???', name: 'Unassigned', sort_order: 0, created_at: new Date().toISOString() };
    const combinedCategories = [unassignedCategory, ...(catData || [])];
    setCategories(combinedCategories);

    if (!initialData) {
      setCategoryId('unassigned'); } else {
      const found = combinedCategories.find(c => c.id === (initialData.category_id || 'unassigned'));
      if (found) { setCategoryId(found.id); }
      else { setCategoryId('unassigned'); }
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
    setBreakdownItems([]);
    setRemarks('');
  };

  const handleCategorySelect = (c: Category) => {
    setCategoryId(c.id);
  };

  const handleAmountChange = (val: string, setter: (v: string) => void) => {
    const raw = val.replace(/[^0-9.]/g, ''); 
    const parts = raw.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    if (parts.length > 2) parts.pop(); 
    setter(parts.join('.'));
  };

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
      if (reviewData.type === 'EXPENSE') {
        setShowConvertPrompt(true);
      } else {
        setSuccessAnim(true);
        setTimeout(() => { onSuccess(); onClose(); }, 1000);
      }
    } catch (error: any) {
      notify("Error saving transaction: " + error.message);
      setShowReview(false);
    } finally {
      setLoading(false);
    }
  };

  const handleConvertToIncome = () => {
    onSuccess();
    setType('INCOME');
    setCategoryId('unassigned');
    setShowConvertPrompt(false);
  };

  const handleSkipConversion = () => {
    setShowConvertPrompt(false);
    setSuccessAnim(true);
    setTimeout(() => { onSuccess(); onClose(); }, 1000);
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

        
      <DialogLayer onDismiss={loading ? undefined : onClose} active={!showReview} label="Record or edit transaction" className="fixed inset-0 z-[99998] flex items-center justify-center p-0 sm:p-4 pointer-events-none">
          
        <div className={`dialog-surface transaction-editor ${showConvertPrompt || successAnim || duplicateWarning ? 'message-state' : ''} ${showReview ? 'review-covered' : ''}`}>

          {showConvertPrompt ? (
            <div className="p-8 sm:p-12 flex flex-col items-center justify-center space-y-6 text-center my-auto">
              <div className="h-16 w-16 bg-slate-100 dark:bg-dark-floating border border-slate-200 dark:border-dark-border rounded-2xl flex items-center justify-center editor-accent shadow-sm animate-bounce">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="space-y-2 max-w-md">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Expense Saved Successfully!</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Do you want to convert or record this transaction as <strong className="editor-accent">Income</strong>? All recently saved details will be preserved so you can quickly select an income account and save it.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row w-full max-w-sm gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSkipConversion}
                  className="flex-1 py-3 px-4 bg-slate-100 dark:bg-dark-floating hover:bg-slate-200 dark:hover:bg-dark-elevated text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-200 dark:border-dark-border"
                >
                  No, Close
                </button>
                <button
                  type="button"
                  onClick={handleConvertToIncome}
                  className="flex-1 py-3 px-4 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <span>Yes, Convert to Income</span>
                </button>
              </div>
            </div>
          ) : successAnim ? (
            <div className="p-16 flex flex-col items-center justify-center space-y-4 text-center my-auto">
              <div className="h-16 w-16 bg-slate-100 dark:bg-dark-floating border border-slate-200 dark:border-dark-border rounded-2xl flex items-center justify-center editor-accent animate-bounce"><CheckCircle2 className="h-8 w-8" /></div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Transaction Saved Successfully!</h3>
            </div>
          ) : duplicateWarning ? (
            <div className="dialog-body p-8 flex flex-col items-center justify-center space-y-6 text-center h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-dark-surface">
              <div className="h-16 w-16 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400 animate-pulse shrink-0"><AlertTriangle className="h-8 w-8" /></div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Possible Duplicate Detected</h3>
                <p className="text-xs text-slate-500">A transaction with the exact same amount and category already exists on this date.</p>
              </div>
              <div className="bg-white dark:bg-dark-elevated p-4 rounded-xl border border-slate-200 dark:border-dark-border text-left text-xs w-full font-mono">
                <p className="text-slate-400 mb-1">Existing Record Details:</p>
                <p><strong>Date:</strong> {duplicateWarning.date}</p>
                <p><strong>Amount:</strong> ₱{Number(duplicateWarning.amount).toLocaleString('en-PH', {minimumFractionDigits: 2})}</p>
                <p><strong>Payee:</strong> {duplicateWarning.payee_name || 'N/A'}</p>
                <p className="truncate"><strong>Remarks:</strong> {duplicateWarning.remarks || 'N/A'}</p>
              </div>
              <div className="flex flex-col sm:flex-row w-full gap-3 mt-4">
                <button onClick={() => setDuplicateWarning(null)} className="flex-1 py-3 bg-white dark:bg-dark-elevated text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-dark-floating transition-all border border-slate-200 dark:border-dark-border">Go Back & Edit</button>
                <button onClick={(e) => handleReviewIntercept(e, true)} className="flex-1 py-3 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-all shadow-md">Yes, Save as Duplicate</button>
              </div>
            </div>
          ) : (
            <div className="transaction-editor-content">
              {/* Modal Header */}
              <div className="dialog-header flex items-center justify-between p-4 sm:p-6 bg-slate-50 dark:bg-dark-elevated border-b border-slate-200 dark:border-dark-border rounded-t-2xl shrink-0">
                <div>
                  <h2 className="text-sm font-bold tracking-wide uppercase text-slate-900 dark:text-white flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${type === 'INCOME' ? 'bg-brand' : 'bg-amber-500'}`}></span>
                    {initialData ? 'Edit' : 'Record'} {type === 'INCOME' ? 'Receipt' : 'Disbursement'}
                  </h2>
                  <p className="text-xs text-slate-500 font-mono mt-0.5 hidden sm:block">Keep an honest record. Verify the details against supporting documents.</p>
                </div>
                <button type="button" aria-label="Close dialog" onClick={onClose} className="icon-button text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-floating p-2 rounded-xl transition-colors flex"><X className="h-4 w-4" /></button>
              </div>

              {/* Modal Body */}
              <div className="dialog-body flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4 bg-slate-50/50 dark:bg-dark-surface">
                {error && (
                  <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 p-4 rounded-xl text-xs font-medium flex items-center gap-2.5 border border-rose-200 dark:border-rose-900/50"><AlertCircle className="h-4 w-4 shrink-0" /><span>{error}</span></div>
                )}

                {!initialData && (
                  <div className="switch-tabs entry-type-tabs">
                    <button type="button" aria-pressed={type === 'INCOME'} onClick={() => handleTypeChange('INCOME')} className="switch-tab">Income / Receipt</button>
                    <button type="button" aria-pressed={type === 'EXPENSE'} onClick={() => handleTypeChange('EXPENSE')} className="switch-tab">Expense / Disbursement</button>
                  </div>
                )}

                <form key={type} id="tx-form" onSubmit={(e) => handleReviewIntercept(e, false)} className="entry-form tab-panel">
<div className="entry-details-column"><section className="entry-field-group"><div className="field-section-heading"><span>Record details</span><span>Date and financial period</span></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Fixed Financial Period Dropdown Padding & Right Alignment */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 tracking-normal">Financial Period</label>
                      <div className="relative">
                        <Select aria-label="Financial Period" required className="w-full rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-elevated px-4 py-3 pr-10 text-xs font-bold text-slate-900 dark:text-white focus:border-brand outline-none appearance-none cursor-pointer" value={selectedPeriodId} onChange={(e) => setSelectedPeriodId(e.target.value)}>
                          {periods.map((p) => <option key={p.id} value={p.id}>{p.period_name} {p.status !== 'OPEN' ? `(${p.status})` : ''}</option>)}
                        </Select>

                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 tracking-normal">Transaction Date</label>
                      <Input aria-label="Transaction Date" type="date" required className="w-full rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-elevated px-4 py-3 text-xs font-bold text-slate-900 dark:text-white focus:border-brand outline-none" value={date} onChange={(e) => setDate(e.target.value)} />
                    </div>
                  </div>

                  </section><section className="entry-field-group"><div className="field-section-heading"><span>Account & reference</span><span>Classify the entry</span></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative">
                    <div className="space-y-1.5"><label htmlFor="tx-account">Account number & name</label><Select id="tx-account" aria-label="Account number & name" value={categoryId} onChange={event => { const category = categories.find(item => item.id === event.target.value); if (category) handleCategorySelect(category); }}>{categories.map(category => <option key={category.id} value={category.id}>{category.id === 'unassigned' ? 'Unassigned — review required' : `${category.export_code} · ${category.name}`}</option>)}</Select></div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 tracking-normal">Receipt / Ref No.</label>
                      <Input aria-label="Receipt / Ref No." type="text" placeholder="e.g. 1024" className="w-full rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-elevated px-4 py-3 text-xs font-bold text-slate-900 dark:text-white focus:border-brand outline-none" value={receiptNo} onChange={(e) => setReceiptNo(e.target.value)} />
                    </div>
                  </div>

                  {selectedCategory && SPECIAL_EVENT_TAGS[selectedCategory.export_code] && (
                    <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/50 p-4 rounded-xl space-y-2">
                      <div className="flex items-center gap-2 text-sky-700 dark:text-sky-400 text-xs font-bold">
                        <Tag className="h-4 w-4" /> Special Category Export Matcher
                      </div>
                      <p className="text-sm text-sky-600 dark:text-sky-300">Click a tag below to set the exact remark needed for the ComBud export:</p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {SPECIAL_EVENT_TAGS[selectedCategory.export_code].map(tag => (
                          <button key={tag} type="button" onClick={() => setRemarks(tag)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${remarks === tag ? 'bg-sky-600 text-white border-sky-600' : 'bg-white dark:bg-dark-elevated text-slate-600 dark:text-slate-300 border-slate-200 dark:border-dark-border hover:border-sky-400'}`}>
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  </section><section className="entry-field-group"><div className="field-section-heading"><span>People & purpose</span><span>Supporting context</span></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 tracking-normal">Payee / Source</label>
                      <Input aria-label="Payee / Source" type="text" placeholder={getPayeePlaceholder()} className="w-full rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-elevated px-4 py-3 text-xs font-bold text-slate-900 dark:text-white focus:border-brand outline-none" value={payeeName} onChange={(e) => setPayeeName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 tracking-normal">Remarks {categoryId === 'unassigned' && <span className="text-red-500">*</span>}</label>
                      <Input aria-label="Remarks" type="text" placeholder="Additional details..." required={categoryId === 'unassigned'} className={`w-full rounded-xl border bg-white dark:bg-dark-elevated px-4 py-3 text-xs font-bold text-slate-900 dark:text-white focus:border-brand outline-none ${categoryId === 'unassigned' ? 'border-amber-400 dark:border-amber-600' : 'border-slate-200 dark:border-dark-border'}`} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                    </div>
                  </div>

                  </section></div><section className="entry-amounts-column"><div className="bg-white dark:bg-dark-elevated p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-dark-border space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-200 dark:border-dark-border pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="entry-amount-icon"><Calculator className="h-4 w-4" /></div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white tracking-normal">Amount & itemized allocation</h4>
                          <p className="text-xs text-slate-500 hidden sm:block">Enter a total or allocate it to individual items.</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => { setUseBreakdown(!useBreakdown); if (!useBreakdown && breakdownItems.length === 0) setBreakdownItems([{name: '', amount: ''}]); }} className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 ${useBreakdown ? 'bg-brand text-white shadow-sm' : 'bg-slate-100 dark:bg-dark-floating text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-border'}`}>
                        <ListPlus className="h-3.5 w-3.5" /> {useBreakdown ? 'Itemized Active' : 'Enable Itemized'}
                      </button>
                    </div>

                    {useBreakdown ? (
                      <div className="space-y-3 bg-slate-50 dark:bg-dark-surface p-4 rounded-xl border border-slate-200 dark:border-dark-border">
                        {breakdownItems.map((item, index) => {
                          return (
                            <div key={index} className="flex flex-col sm:flex-row gap-2 items-center w-full">
                              <div className="relative w-full sm:flex-1 min-w-0">
                                 <SuggestInput label="Tither or item name" value={item.name} placeholder={isTitheOrOffering ? 'Find a member or enter a name' : 'Item name'} suggestions={isTitheOrOffering ? tithers.map(tither => tither.full_name) : []} onValueChange={name => { const updated = [...breakdownItems]; updated[index].name = name; setBreakdownItems(updated); }} />
                              </div>

                              <div className="flex gap-2 w-full sm:w-auto">
                                <Input aria-label="Item amount in pesos" type="text" placeholder="₱ 0.00" required className="flex-1 sm:w-32 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-elevated px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:border-brand outline-none text-right" value={item.amount} onChange={e => { const newItems = [...breakdownItems]; handleAmountChange(e.target.value, (masked) => { newItems[index].amount = masked; }); setBreakdownItems(newItems); }} />
                                <button type="button" onClick={() => setBreakdownItems(breakdownItems.filter((_, i) => i !== index))} className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-500/10 rounded-xl bg-white dark:bg-dark-elevated border border-slate-200 dark:border-dark-border flex items-center justify-center shrink-0"><Trash2 className="h-4 w-4" /></button>
                              </div>
                            </div>
                          );
                        })}
                        <button type="button" onClick={() => setBreakdownItems([...breakdownItems, {name: '', amount: ''}])} className="text-xs font-bold editor-accent hover:underline">+ Add Another Item</button>
                        <div className="border-t border-slate-200 dark:border-dark-border pt-3 mt-3 flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-500">Itemized total:</span>
                          <span className="font-semibold text-lg editor-accent">₱{breakdownTotal.toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-normal">Total amount</label>
                          <button type="button" onClick={() => setStrictMode(!strictMode)} className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5">
                            Strict Format {strictMode ? <ToggleRight className="h-4 w-4 text-brand" /> : <ToggleLeft className="h-4 w-4 text-slate-400" />}
                          </button>
                        </div>
                        {strictMode ? (
                          <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-2 relative">
                              <span className="absolute -top-2 left-3 bg-white dark:bg-dark-elevated px-1 text-xs font-bold text-slate-400 uppercase">Whole Number</span>
                              <Input aria-label="Whole peso amount" type="text" required placeholder="5,000" className="w-full rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-elevated px-4 py-3 text-sm font-bold text-slate-900 dark:text-white focus:border-brand outline-none" value={wholeAmount} onChange={(e) => handleAmountChange(e.target.value.replace(/[^0-9]/g, ''), setWholeAmount)} />
                            </div>
                            <div className="relative">
                              <span className="absolute -top-2 left-3 bg-white dark:bg-dark-elevated px-1 text-xs font-bold text-slate-400 uppercase">Decimal</span>
                              <Input aria-label="Centavos" type="text" maxLength={2} placeholder="00" className="w-full rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-elevated px-4 py-3 text-sm font-bold text-slate-900 dark:text-white text-center focus:border-brand outline-none" value={decimalAmount} onChange={(e) => setDecimalAmount(e.target.value.replace(/[^0-9]/g, ''))} />
                            </div>
                          </div>
                        ) : (
                          <Input aria-label="Transaction amount in pesos" inputMode="decimal" type="text" required placeholder="0.00" className="w-full rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-elevated px-4 py-3 text-sm font-bold text-slate-900 dark:text-white focus:border-brand outline-none" value={standardAmount} onChange={(e) => handleAmountChange(e.target.value, setStandardAmount)} />
                        )}
                      </div>
                    )}
                  </div><p className="entry-responsibility">Record only what is supported. Review carefully before saving.</p></section>
</form>
              </div>

              {/* Modal Footer */}
              <div className="dialog-footer p-4 sm:p-6 bg-slate-50 dark:bg-dark-elevated border-t border-slate-200 dark:border-dark-border flex justify-end gap-3 shrink-0 rounded-b-2xl">
                <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-floating transition-colors border border-slate-200 dark:border-dark-border">Cancel</button>
                <button form="tx-form" type="submit" className="px-7 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2">
                  <span>Continue to Review</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogLayer>

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

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { X, AlertCircle, Search, Check, ChevronDown, ToggleLeft, ToggleRight, ListPlus, Trash2, Calculator, Loader2, CheckCircle2 } from 'lucide-react';
import type { Category, TransactionType, FinancialPeriod, Transaction } from '../types/database.types';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  churchId: string;
  userId: string;
  initialData?: Transaction | null;
  defaultPeriodId?: string; 
}

export default function TransactionModal({ isOpen, onClose, onSuccess, churchId, userId, initialData, defaultPeriodId }: TransactionModalProps) {
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

  const [loading, setLoading] = useState(false);
  const [successAnim, setSuccessAnim] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSuccessAnim(false);
      if (initialData) {
        setType(initialData.type);
        setDate(initialData.date);
        setReceiptNo(initialData.receipt_no || '');
        setPayeeName(initialData.payee_name || '');
        setSelectedPeriodId(initialData.financial_period_id);
        setCategoryId(initialData.category_id);
        setStandardAmount(initialData.amount.toString());

        const fullRemarks = initialData.remarks || '';
        const breakdownMatch = fullRemarks.match(/\[Breakdown: (.*?)\]/);
        if (breakdownMatch) {
          const itemsText = breakdownMatch[1];
          const parsed = itemsText.split(', ').map(pair => {
            const lastColonIndex = pair.lastIndexOf(': ₱');
            if (lastColonIndex === -1) return { name: pair, amount: '' };
            return {
              name: pair.substring(0, lastColonIndex),
              amount: pair.substring(lastColonIndex + 3)
            };
          });
          setBreakdownItems(parsed);
          setUseBreakdown(true);
          setRemarks(fullRemarks.replace(/\[Breakdown:.*?\]/, '').trim());
        } else {
          setUseBreakdown(false);
          setBreakdownItems([]);
          setRemarks(fullRemarks);
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
    if (catData) {
      setCategories(catData);
      if (!initialData && catData.length > 0) {
        setCategoryId(catData[0].id);
        setCategorySearch(`[${catData[0].export_code}] ${catData[0].name}`);
      } else if (initialData) {
        const found = catData.find(c => c.id === initialData.category_id);
        if (found) setCategorySearch(`[${found.export_code}] ${found.name}`);
      }
    }

    const { data: periodData } = await supabase.from('financial_periods').select('*').eq('church_id', churchId).order('month', { ascending: true });
    if (periodData) {
      setPeriods(periodData);
      if (!initialData && periodData.length > 0) {
        if (defaultPeriodId && periodData.some(p => p.id === defaultPeriodId)) {
          setSelectedPeriodId(defaultPeriodId);
        } else {
          const openPeriod = periodData.find(p => p.status === 'OPEN');
          setSelectedPeriodId(openPeriod ? openPeriod.id : periodData[0].id);
        }
      }
    }
  };

  const selectedCategory = categories.find(c => c.id === categoryId);

  const getPayeePlaceholder = () => {
    if (!selectedCategory) return 'e.g. Source / Payee Name';
    const name = selectedCategory.name.toLowerCase();
    if (type === 'INCOME') {
      if (name.includes('tithe') || name.includes('offering') || name.includes('pledge')) return 'e.g. Member / Family Name (Optional)';
      if (name.includes('receivable') || name.includes('advance')) return 'e.g. Debtor / Personnel Name (Required)';
      return 'e.g. Donor / Source Name';
    } else {
      if (name.includes('electricity') || name.includes('water') || name.includes('internet')) return 'e.g. Utility Provider (e.g. Meralco / PLDT)';
      if (name.includes('rent')) return 'e.g. Landlord / Property Owner';
      if (name.includes('supplies') || name.includes('groceries') || name.includes('food')) return 'e.g. Store / Supplier (e.g. Puregold / SM)';
      if (name.includes('salary') || name.includes('love gift')) return 'e.g. Recipient Staff / Worker Name';
      return 'e.g. Supplier / Payee Name';
    }
  };

  const breakdownTotal = breakdownItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');

    let finalAmount = 0;
    if (useBreakdown) finalAmount = breakdownTotal;
    else if (strictMode) finalAmount = parseFloat(`${wholeAmount.replace(/,/g, '') || 0}.${decimalAmount || '00'}`);
    else finalAmount = parseFloat(standardAmount.replace(/,/g, '') || '0');

    if (isNaN(finalAmount) || finalAmount <= 0) {
      setError('Please enter a valid positive amount.');
      setLoading(false); return;
    }

    let finalRemarks = remarks.trim();
    if (useBreakdown && breakdownItems.length > 0) {
      const breakdownText = breakdownItems.map(i => `${i.name}: ₱${i.amount}`).join(', ');
      finalRemarks = finalRemarks ? `${finalRemarks} [Breakdown: ${breakdownText}]` : `[Breakdown: ${breakdownText}]`;
    }

    const payload = {
      church_id: churchId, financial_period_id: selectedPeriodId, category_id: categoryId, date, type,
      receipt_no: receiptNo.trim() || null, remarks: finalRemarks || null, payee_name: payeeName.trim() || null,
      amount: finalAmount, entered_by: userId,
    };

    let saveError;
    if (initialData) {
      const { error } = await supabase.from('transactions').update(payload).eq('id', initialData.id);
      saveError = error;
    } else {
      const { error } = await supabase.from('transactions').insert(payload);
      saveError = error;
    }

    setLoading(false);
    if (saveError) {
      setError(saveError.message);
    } else {
      setSuccessAnim(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);
    }
  };

  const filteredCategories = categories.filter(c => c.name.toLowerCase().includes(categorySearch.toLowerCase()) || c.export_code.includes(categorySearch));

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed top-0 left-0 w-screen h-screen z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 transition-opacity m-0">
      <div className="w-full max-w-2xl bg-white dark:bg-[#121212] rounded-3xl shadow-2xl relative max-h-[95vh] flex flex-col p-0 overflow-hidden border border-slate-200 dark:border-[#27272A] animate-modal">
        
        {successAnim ? (
          <div className="p-16 flex flex-col items-center justify-center space-y-4 text-center my-auto">
            <div className="h-16 w-16 bg-emerald-100 dark:bg-emerald-950/80 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 animate-bounce">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Transaction Saved Successfully!</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Ledger synchronized and audit trail updated.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between p-6 bg-slate-50 dark:bg-[#0A0A0A] border-b border-slate-200 dark:border-[#27272A]">
              <div>
                <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">{initialData ? 'Edit' : 'Record'} {type === 'INCOME' ? 'Receipt' : 'Disbursement'}</h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Ensure details match physical vouchers exactly.</p>
              </div>
              <button onClick={onClose} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/5 p-2 rounded-xl transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar space-y-5">
              {error && (
                <div className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 p-4 rounded-2xl text-xs font-medium flex items-center gap-2.5 border border-red-200 dark:border-red-900">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
              )}

              {/* HIGH-CONTRAST COLOR-CODED TABS */}
              {!initialData && (
                <div className="grid grid-cols-2 gap-2 bg-slate-200/70 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-300 dark:border-slate-800 shadow-inner">
                  <button 
                    type="button" 
                    onClick={() => setType('INCOME')} 
                    className={`py-2.5 text-xs font-bold rounded-xl transition-all shadow-sm ${
                      type === 'INCOME' 
                        ? 'bg-emerald-600 text-white shadow-md transform scale-[1.01]' 
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    Income / Receipt
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setType('EXPENSE')} 
                    className={`py-2.5 text-xs font-bold rounded-xl transition-all shadow-sm ${
                      type === 'EXPENSE' 
                        ? 'bg-amber-600 text-white shadow-md transform scale-[1.01]' 
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    Expense / Disbursement
                  </button>
                </div>
              )}

              <form id="tx-form" onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Financial Period</label>
                    <select required className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-xs font-bold text-slate-900 dark:text-white focus:border-brand dark:focus:border-emerald-500 focus:ring-1 focus:ring-brand" value={selectedPeriodId} onChange={(e) => setSelectedPeriodId(e.target.value)}>
                      {periods.map((p) => <option key={p.id} value={p.id}>{p.period_name} {p.status !== 'OPEN' ? `(${p.status})` : ''}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Transaction Date</label>
                    <input type="date" required className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-xs font-bold text-slate-900 dark:text-white focus:border-brand dark:focus:border-emerald-500 focus:ring-1 focus:ring-brand" value={date} onChange={(e) => setDate(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5 relative">
                  <div ref={dropdownRef} className="relative space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">ComBud Category</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><Search className="h-4 w-4 text-slate-400" /></div>
                      <input type="text" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 pl-10 pr-10 py-3 text-xs font-bold text-slate-900 dark:text-white focus:border-brand dark:focus:border-emerald-500 focus:ring-1 focus:ring-brand" placeholder="Search category..." value={categorySearch} onClick={() => { setIsCategoryOpen(true); setCategorySearch(''); }} onChange={(e) => { setCategorySearch(e.target.value); setIsCategoryOpen(true); }} />
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none"><ChevronDown className="h-4 w-4 text-slate-400" /></div>
                    </div>
                    {isCategoryOpen && (
                      <div className="absolute z-20 mt-1 w-full bg-white dark:bg-[#121212] shadow-2xl max-h-60 rounded-2xl py-1 text-xs overflow-auto border border-slate-200 dark:border-[#27272A] ring-1 ring-black/5 custom-scrollbar">
                        {filteredCategories.map((c) => (
                          <div key={c.id} className={`px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60 ${categoryId === c.id ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold' : 'text-slate-700 dark:text-slate-300'}`} onClick={() => { setCategoryId(c.id); setCategorySearch(`[${c.export_code}] ${c.name}`); setIsCategoryOpen(false); }}>
                            <div className="flex gap-2 items-center"><span className="font-mono text-[11px] text-slate-400">[{c.export_code}]</span><span>{c.name}</span></div>
                            {categoryId === c.id && <Check className="h-4 w-4 text-emerald-600" />}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Receipt / Ref No.</label>
                    <input type="text" placeholder="e.g. 1024" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-xs font-bold text-slate-900 dark:text-white focus:border-brand dark:focus:border-emerald-500 focus:ring-1 focus:ring-brand" value={receiptNo} onChange={(e) => setReceiptNo(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Payee / Source</label>
                    <input type="text" placeholder={getPayeePlaceholder()} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-xs font-bold text-slate-900 dark:text-white focus:border-brand dark:focus:border-emerald-500 focus:ring-1 focus:ring-brand" value={payeeName} onChange={(e) => setPayeeName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Remarks <span className="text-slate-400 font-normal">(Optional)</span></label>
                    <input type="text" placeholder="Additional details..." className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-xs font-bold text-slate-900 dark:text-white focus:border-brand dark:focus:border-emerald-500 focus:ring-1 focus:ring-brand" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-brand/10 dark:bg-emerald-950/60 rounded-xl text-brand dark:text-emerald-400">
                        <Calculator className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Itemized Receipt Breakdown</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Break down supermarket or supplier sub-items before posting total.</p>
                      </div>
                    </div>
                    
                    <button 
                      type="button" 
                      onClick={() => { 
                        setUseBreakdown(!useBreakdown); 
                        if (!useBreakdown && breakdownItems.length === 0) setBreakdownItems([{name: '', amount: ''}]);
                      }} 
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${useBreakdown ? 'bg-brand dark:bg-emerald-700 text-white shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}
                    >
                      <ListPlus className="h-4 w-4" /> {useBreakdown ? 'Itemized Active' : 'Enable Itemized'}
                    </button>
                  </div>

                  {useBreakdown ? (
                    <div className="space-y-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                      {breakdownItems.map((item, index) => (
                        <div key={index} className="flex gap-2 items-center w-full">
                          <input 
                            type="text" 
                            placeholder="Item name (e.g. Rice, Supplies)" 
                            required 
                            className="flex-1 min-w-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white shadow-sm" 
                            value={item.name} 
                            onChange={e => { const newItems = [...breakdownItems]; newItems[index].name = e.target.value; setBreakdownItems(newItems); }} 
                          />
                          <input 
                            type="number" 
                            step="0.01" 
                            placeholder="₱ Amount" 
                            required 
                            className="w-24 sm:w-32 min-w-0 shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white shadow-sm" 
                            value={item.amount} 
                            onChange={e => { const newItems = [...breakdownItems]; newItems[index].amount = e.target.value; setBreakdownItems(newItems); }} 
                          />
                          <button type="button" onClick={() => setBreakdownItems(breakdownItems.filter((_, i) => i !== index))} className="p-2 shrink-0 text-red-400 hover:text-red-600 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      ))}
                      <button type="button" onClick={() => setBreakdownItems([...breakdownItems, {name: '', amount: ''}])} className="text-xs font-bold text-brand dark:text-emerald-400 hover:underline flex items-center gap-1 pt-1">
                        + Add Another Item
                      </button>
                      <div className="border-t border-slate-200 dark:border-slate-800 pt-3 mt-3 flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-600 dark:text-slate-400">Auto-Computed Total:</span>
                        <span className="font-black text-lg text-brand dark:text-emerald-400">₱{breakdownTotal.toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Total Amount (PHP ₱)</label>
                        <button type="button" onClick={() => setStrictMode(!strictMode)} className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center gap-1.5">
                          Strict Format {strictMode ? <ToggleRight className="h-4 w-4 text-brand dark:text-emerald-400" /> : <ToggleLeft className="h-4 w-4 text-slate-400" />}
                        </button>
                      </div>

                      {strictMode ? (
                        <div className="grid grid-cols-3 gap-3">
                          <div className="col-span-2 relative">
                            <span className="absolute -top-2 left-3 bg-white dark:bg-slate-900 px-1 text-[10px] font-bold text-slate-400 uppercase">Whole Number</span>
                            <input type="text" required placeholder="5000" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-bold text-slate-900 dark:text-white shadow-sm" value={wholeAmount} onChange={(e) => setWholeAmount(e.target.value.replace(/[^0-9]/g, ''))} />
                          </div>
                          <div className="relative">
                            <span className="absolute -top-2 left-3 bg-white dark:bg-slate-900 px-1 text-[10px] font-bold text-slate-400 uppercase">Decimal</span>
                            <input type="text" maxLength={2} placeholder="00" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-bold text-slate-900 dark:text-white text-center shadow-sm" value={decimalAmount} onChange={(e) => setDecimalAmount(e.target.value.replace(/[^0-9]/g, ''))} />
                          </div>
                        </div>
                      ) : (
                        <input type="number" step="0.01" required placeholder="0.00" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-bold text-slate-900 dark:text-white shadow-sm" value={standardAmount} onChange={(e) => setStandardAmount(e.target.value)} />
                      )}
                    </div>
                  )}
                </div>

              </form>
            </div>

            <div className="p-6 bg-slate-100/50 dark:bg-[#0A0A0A] border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 rounded-b-3xl">
              <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">Cancel</button>
              <button form="tx-form" type="submit" disabled={loading} className="px-7 py-2.5 bg-brand dark:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md hover:bg-brand-dark dark:hover:bg-emerald-800 transition-all flex items-center gap-2">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>{loading ? 'Saving Record...' : initialData ? 'Update Record' : 'Save Record'}</span>
              </button>
            </div>
          </>
        )}

      </div>
    </div>,
    document.body
  );
}
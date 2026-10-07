import { createPortal } from 'react-dom';
import { X, CheckCircle2, FileText, ArrowLeft, Loader2, Tag, Receipt, Calendar, UserCircle, Layers } from 'lucide-react';

export interface ReviewData {
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  date: string;
  periodName: string;
  categoryName: string;
  payeeName: string;
  receiptNo: string;
  remarks: string;
  payload: any;
}

interface TransactionReviewModalProps {
  isOpen: boolean;
  onBack: () => void;
  onConfirm: () => void;
  data: ReviewData | null;
  loading: boolean;
  isEditing: boolean;
}

export default function TransactionReviewModal({ isOpen, onBack, onConfirm, data, loading, isEditing }: TransactionReviewModalProps) {
  if (!data) return null; 

  const fullRemarks = data.remarks || '';
  const breakdownMatch = fullRemarks.match(/\[Breakdown: (.*?)\]/);
  
  let generalRemarks = fullRemarks;
  let breakdownList: { name: string; amount: number }[] = [];

  if (breakdownMatch) {
    generalRemarks = fullRemarks.replace(/\[Breakdown:.*?\]/, '').trim();
    const itemsText = breakdownMatch[1];
    breakdownList = itemsText.split(', ').map(pair => {
      const lastColonIndex = pair.lastIndexOf(': ₱');
      if (lastColonIndex === -1) return { name: pair, amount: 0 };
      return {
        name: pair.substring(0, lastColonIndex).trim(),
        amount: parseFloat(pair.substring(lastColonIndex + 3)) || 0
      };
    });
  }

  return createPortal(
    <div className={`fixed inset-0 z-[100000] flex items-center justify-center p-0 sm:p-4 pointer-events-none transition-all duration-500 ${isOpen ? 'visible' : 'invisible delay-500'}`}>
      
      <div className={`pointer-events-auto w-full h-full sm:h-auto max-h-[100dvh] sm:max-h-[90vh] max-w-2xl bg-white dark:bg-[#0A0A0A] rounded-none sm:rounded-2xl shadow-none sm:shadow-2xl relative flex flex-col p-0 overflow-hidden border-0 sm:border border-slate-200 dark:border-[#27272A] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-12 opacity-0 scale-95'}`}>
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 bg-slate-50 dark:bg-[#111111] border-b border-slate-200 dark:border-[#27272A] rounded-t-2xl shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onBack} disabled={loading} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-[#333] transition-colors shadow-sm disabled:opacity-50">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h2 className="text-sm font-bold tracking-wide uppercase text-slate-900 dark:text-white">Review Transaction</h2>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5 hidden sm:block">Please verify all details before saving.</p>
            </div>
          </div>
          <button onClick={onBack} disabled={loading} className="text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1A1A1A] p-2 rounded-xl transition-colors hidden sm:flex disabled:opacity-50"><X className="h-4 w-4" /></button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4 bg-slate-50/50 dark:bg-[#0A0A0A]">
          <div className="bg-white dark:bg-[#121212] p-5 rounded-2xl border border-slate-200 dark:border-[#27272A] flex justify-between items-center shadow-sm">
            <div>
              <span className={`inline-flex px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${data.type === 'INCOME' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50' : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50'}`}>
                {data.type}
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1.5 font-medium">
                <Calendar className="h-3.5 w-3.5" /> {data.date} • {data.periodName}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Amount</p>
              <p className={`text-2xl font-black ${data.type === 'INCOME' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                {data.type === 'INCOME' ? '+' : '-'}₱{Number(data.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="bg-white dark:bg-[#121212] p-4 rounded-xl border border-slate-200 dark:border-[#27272A] flex items-center gap-3">
              <Tag className="h-4 w-4 text-slate-400 shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Account No. & Name</p>
                <p className={`text-xs font-bold ${data.categoryName === 'Unassigned' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>{data.categoryName}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white dark:bg-[#121212] p-4 rounded-xl border border-slate-200 dark:border-[#27272A] flex flex-col justify-center">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><UserCircle className="h-3.5 w-3.5" /> Payee / Source</p>
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{data.payeeName}</p>
              </div>
              <div className="bg-white dark:bg-[#121212] p-4 rounded-xl border border-slate-200 dark:border-[#27272A] flex flex-col justify-center">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Receipt className="h-3.5 w-3.5" /> Receipt No.</p>
                <p className="text-xs font-bold text-slate-900 dark:text-white font-mono">{data.receiptNo}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-[#121212] p-4 rounded-xl border border-slate-200 dark:border-[#27272A] space-y-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Remarks & Breakdown</p>
              
              {generalRemarks && (
                <p className="text-xs text-slate-700 dark:text-slate-300 font-medium whitespace-pre-wrap leading-relaxed">{generalRemarks}</p>
              )}

              {breakdownList.length > 0 && (
                <div className="space-y-2 bg-slate-50 dark:bg-[#0A0A0A] p-3.5 rounded-xl border border-slate-200 dark:border-[#27272A]">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">
                    <Layers className="h-3 w-3" /> Itemized Sub-Items Breakdown
                  </div>
                  <div className="divide-y divide-slate-200 dark:divide-[#27272A]/50">
                    {breakdownList.map((item, index) => (
                      <div key={index} className="py-2 flex justify-between items-center text-xs first:pt-0 last:pb-0">
                        <span className="font-medium text-slate-800 dark:text-slate-200">• {item.name}</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">₱{item.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-slate-200 dark:border-[#27272A] pt-2.5 mt-2 flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-500">Breakdown Total:</span>
                    <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                      ₱{breakdownList.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-6 bg-slate-50 dark:bg-[#111111] border-t border-slate-200 dark:border-[#27272A] flex justify-end gap-3 shrink-0 rounded-b-2xl">
          <button type="button" onClick={onBack} disabled={loading} className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1A1A1A] transition-colors border border-slate-200 dark:border-[#333]">Go Back</button>
          <button type="button" onClick={onConfirm} disabled={loading} className="flex-[2] sm:flex-none px-7 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            <span>{loading ? 'Saving...' : isEditing ? 'Confirm & Update' : 'Confirm & Save'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
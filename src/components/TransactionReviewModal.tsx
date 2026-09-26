import { createPortal } from 'react-dom';
import { X, CheckCircle2, FileText, ArrowLeft, Loader2, Tag, Receipt, Calendar, UserCircle } from 'lucide-react';

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

  return createPortal(
    // Wrapper separated from the backdrop. transition-all handles visibility safely without jumping.
    <div className={`fixed inset-0 z-[100000] flex items-center justify-center p-0 sm:p-4 pointer-events-none transition-all duration-500 ${isOpen ? 'visible' : 'invisible delay-500'}`}>
      
      {/* Synchronized Animated Container */}
      <div className={`pointer-events-auto w-full h-full sm:h-auto max-h-[100dvh] sm:max-h-[90vh] max-w-2xl bg-white dark:bg-[#121212] rounded-none sm:rounded-3xl shadow-none sm:shadow-2xl relative flex flex-col p-0 overflow-hidden border-0 sm:border border-slate-200 dark:border-[#27272A] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-12 opacity-0 scale-95'}`}>
        
        {/* Header - Aggressive space saving for mobile landscape */}
        <div className="flex items-center justify-between p-4 sm:p-6 landscape:py-2 landscape:px-4 lg:landscape:p-6 bg-slate-50 dark:bg-[#0A0A0A] border-b border-slate-200 dark:border-[#27272A] shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onBack} disabled={loading} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#27272A] transition-colors shadow-sm disabled:opacity-50">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h2 className="text-base landscape:text-sm lg:landscape:text-base font-bold tracking-tight text-slate-900 dark:text-white">Review Transaction</h2>
              <p className="text-[11px] text-slate-500 mt-0.5 hidden sm:block landscape:hidden lg:landscape:block">Please verify all details before saving.</p>
            </div>
          </div>
          <button onClick={onBack} disabled={loading} className="text-slate-500 hover:text-slate-900 dark:hover:text-white p-2 rounded-xl transition-colors hidden sm:flex disabled:opacity-50"><X className="h-4 w-4" /></button>
        </div>

        {/* Body - Aggressive space saving for mobile landscape */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 landscape:py-2.5 landscape:px-4 lg:landscape:p-6 space-y-4 sm:space-y-5 landscape:space-y-3 lg:landscape:space-y-5">
          <div className="bg-slate-50 dark:bg-[#0A0A0A] p-4 sm:p-5 landscape:p-3 lg:landscape:p-5 rounded-2xl border border-slate-200 dark:border-[#27272A] flex justify-between items-center shadow-sm">
            <div>
              <span className={`inline-flex px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border ${data.type === 'INCOME' ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900' : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900'}`}>
                {data.type}
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 landscape:mt-1 lg:landscape:mt-2 flex items-center gap-1.5 font-medium">
                <Calendar className="h-3.5 w-3.5" /> {data.date} • {data.periodName}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Amount</p>
              <p className={`text-2xl landscape:text-xl lg:landscape:text-2xl font-black ${data.type === 'INCOME' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                {data.type === 'INCOME' ? '+' : '-'}₱{Number(data.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:gap-4 landscape:gap-2 lg:landscape:gap-4">
            <div className="bg-slate-50 dark:bg-[#0A0A0A] p-4 landscape:p-3 lg:landscape:p-4 rounded-xl border border-slate-200 dark:border-[#27272A] flex items-center gap-3">
              <Tag className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Account No. & Name</p>
                <p className={`text-xs font-bold ${data.categoryName === 'Unassigned' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>{data.categoryName}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 landscape:gap-2 lg:landscape:gap-4">
              <div className="bg-slate-50 dark:bg-[#0A0A0A] p-4 landscape:p-3 lg:landscape:p-4 rounded-xl border border-slate-200 dark:border-[#27272A] flex flex-col justify-center">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><UserCircle className="h-3.5 w-3.5" /> Payee / Source</p>
                <p className="text-xs font-bold text-slate-900 dark:text-white">{data.payeeName}</p>
              </div>
              <div className="bg-slate-50 dark:bg-[#0A0A0A] p-4 landscape:p-3 lg:landscape:p-4 rounded-xl border border-slate-200 dark:border-[#27272A] flex flex-col justify-center">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Receipt className="h-3.5 w-3.5" /> Receipt No.</p>
                <p className="text-xs font-bold text-slate-900 dark:text-white font-mono">{data.receiptNo}</p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-[#0A0A0A] p-4 landscape:p-3 lg:landscape:p-4 rounded-xl border border-slate-200 dark:border-[#27272A]">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 landscape:mb-1 lg:landscape:mb-2 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Remarks & Breakdown</p>
              <p className="text-xs text-slate-700 dark:text-slate-300 font-medium whitespace-pre-wrap leading-relaxed">{data.remarks}</p>
            </div>
          </div>
        </div>

        {/* Footer - Aggressive space saving for mobile landscape */}
        <div className="p-4 sm:p-6 landscape:py-2 landscape:px-4 lg:landscape:p-6 bg-slate-100/50 dark:bg-[#0A0A0A] border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 shrink-0 sm:rounded-b-3xl">
          <button type="button" onClick={onBack} disabled={loading} className="flex-1 sm:flex-none px-5 py-3 sm:py-2.5 landscape:py-2 lg:landscape:py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700 sm:border-transparent">Go Back</button>
          <button type="button" onClick={onConfirm} disabled={loading} className="flex-[2] sm:flex-none px-7 py-3 sm:py-2.5 landscape:py-2 lg:landscape:py-2.5 bg-brand dark:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md hover:bg-brand-dark dark:hover:bg-emerald-600 transition-all flex items-center justify-center gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            <span>{loading ? 'Saving...' : isEditing ? 'Confirm & Update' : 'Confirm & Save'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
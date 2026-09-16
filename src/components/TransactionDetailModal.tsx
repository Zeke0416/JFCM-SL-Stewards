import { createPortal } from 'react-dom';
import { X, Receipt, UserCircle, Calendar, Tag, FileText, Clock } from 'lucide-react';
import type { Transaction, Category } from '../types/database.types';

type EnrichedTransaction = Transaction & { 
  categories?: Category;
  profiles?: { full_name: string }; 
};

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: EnrichedTransaction | null;
}

export default function TransactionDetailModal({ isOpen, onClose, transaction }: TransactionDetailModalProps) {
  if (!isOpen || !transaction) return null;

  // Render the modal directly into the document.body using React Portals
  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white dark:bg-[#121212] rounded-3xl shadow-2xl relative overflow-hidden border border-slate-200 dark:border-[#27272A] animate-modal">
        
        <div className="flex items-center justify-between p-6 bg-slate-50 dark:bg-[#0A0A0A] border-b border-slate-200 dark:border-[#27272A]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/40 rounded-2xl">
              <Receipt className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">Transaction Audit Details</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">ID: {transaction.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/5 p-2 rounded-xl transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto custom-scrollbar">
          
          <div className="bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex justify-between items-center shadow-sm">
            <div>
              <span className={`inline-flex px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border ${transaction.type === 'INCOME' ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900' : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900'}`}>
                {transaction.type}
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2.5 flex items-center gap-1.5 font-medium">
                <Calendar className="h-3.5 w-3.5 text-slate-400" /> Date: {transaction.date}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Amount</p>
              <p className={`text-xl font-black ${transaction.type === 'INCOME' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                {transaction.type === 'INCOME' ? '+' : '-'}₱{Number(transaction.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" /> ComBud Category
              </span>
              <p className="text-xs font-bold text-slate-900 dark:text-white pt-1">
                [{transaction.categories?.export_code}] {transaction.categories?.name}
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5" /> Receipt / Ref No.
              </span>
              <p className="text-xs font-bold text-slate-900 dark:text-white font-mono pt-1">
                {transaction.receipt_no || 'None Provided'}
              </p>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <UserCircle className="h-3.5 w-3.5" /> Payee / Source
            </span>
            <p className="text-xs font-bold text-slate-900 dark:text-white pt-1">
              {transaction.payee_name || '—'}
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Remarks & Itemized Breakdown
            </span>
            <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-white dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 font-medium mt-1">
              {transaction.remarks || 'No remarks recorded.'}
            </p>
          </div>

          <div className="bg-slate-100 dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
            <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Audit Accountability Metadata</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <UserCircle className="h-4 w-4 text-brand dark:text-emerald-400 shrink-0" />
                <span>Encoded By: <strong className="text-slate-900 dark:text-white">{transaction.profiles?.full_name || 'System Administrator'}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                <span>Created: <strong className="text-slate-900 dark:text-white">{new Date(transaction.created_at).toLocaleString()}</strong></span>
              </div>
            </div>
          </div>

        </div>

        <div className="p-4 bg-slate-50 dark:bg-[#0A0A0A] border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button onClick={onClose} className="px-6 py-2.5 bg-slate-900 dark:bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-black transition-colors shadow-sm">
            Close Details
          </button>
        </div>
      </div>
    </div>,
    document.body // Injects modal completely outside the React DOM tree
  );
}
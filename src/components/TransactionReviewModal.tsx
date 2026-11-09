import DialogLayer from './ui/DialogLayer';

import { CheckCircle2, ArrowLeft, Loader2 } from 'lucide-react';
import { MissionIcon } from './ui/StewardGlyph';

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

  return <DialogLayer label="Review transaction before saving" open={isOpen} onDismiss={loading ? undefined : onBack}><article className="dialog-surface review-dialog"><header className="dialog-header"><div className="dialog-title-group"><span className="dialog-title-icon"><MissionIcon size={24} /></span><div><span className="dialog-kicker">Step 2 / Review</span><h2>Review transaction</h2></div></div><span className="review-step-badge">Check supporting records</span></header><div className="review-dialog-body"><div className="review-amount-panel"><span className={`entry-type ${data.type === 'INCOME' ? 'income' : 'expense'}`}>{data.type === 'INCOME' ? 'Income / receipt' : 'Expense / disbursement'}</span><span>Amount to {isEditing ? 'update' : 'record'}</span><strong className="tabular-nums">{new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(Number(data.amount))}</strong><span>{data.periodName}</span></div><dl className="review-facts"><div><dt>Transaction date</dt><dd>{data.date}</dd></div><div><dt>Account</dt><dd>{data.categoryName}</dd></div><div><dt>Payee / source</dt><dd>{data.payeeName}</dd></div><div><dt>Receipt / reference</dt><dd>{data.receiptNo}</dd></div><div className="full-width"><dt>Remarks</dt><dd>{generalRemarks || 'No remarks'}</dd></div></dl>{breakdownList.length > 0 && <section className="review-breakdown"><h3>Itemized allocation</h3>{breakdownList.map((item,index) => <div key={index}><span>{item.name}</span><strong>₱{item.amount.toLocaleString('en-PH',{minimumFractionDigits:2})}</strong></div>)}<div className="breakdown-total"><span>Total</span><strong>₱{breakdownList.reduce((sum,item)=>sum+item.amount,0).toLocaleString('en-PH',{minimumFractionDigits:2})}</strong></div></section>}<p className="review-help"><CheckCircle2 size={17} />Check each detail against its supporting record. Serve faithfully before God and the church.</p></div><footer className="dialog-footer"><button type="button" className="button-secondary" aria-busy={loading} disabled={loading} onClick={onBack}><ArrowLeft size={16} /> Edit details</button><button type="button" className="button-primary" aria-busy={loading} disabled={loading} onClick={onConfirm}>{loading ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}{loading ? 'Saving…' : isEditing ? 'Confirm & update' : 'Confirm & save'}</button></footer></article></DialogLayer>;
}

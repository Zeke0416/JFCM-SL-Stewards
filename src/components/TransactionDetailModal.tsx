import UserAvatar from './ui/UserAvatar';
import DialogLayer from './ui/DialogLayer';

import { X, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { LedgerIcon } from './ui/StewardGlyph';
import type { Transaction, Category } from '../types/database.types';

type EnrichedTransaction = Transaction & { 
  categories?: Category;
  profiles?: { full_name: string; avatar_data_url?: string | null };
};

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: EnrichedTransaction | null;
}

export default function TransactionDetailModal({ isOpen, onClose, transaction }: TransactionDetailModalProps) {
  if (!isOpen || !transaction) return null;

  const fullRemarks = transaction.remarks || '';
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

  const isUnassigned = !transaction.categories || transaction.categories.export_code === '???';

  return <DialogLayer label="Transaction details" onDismiss={onClose}><article className="dialog-surface record-dialog">
    <header className="dialog-header"><div className="dialog-title-group"><span className="dialog-title-icon"><LedgerIcon size={24} /></span><div><span className="dialog-kicker">Church ledger / record</span><h2>Transaction details</h2></div></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close transaction details"><X size={19} /></button></header>
    <div className="record-dialog-layout"><section className="record-document"><div className="record-document-top"><span className={`entry-type ${transaction.type === 'INCOME' ? 'income' : 'expense'}`}>{transaction.type === 'INCOME' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}{transaction.type === 'INCOME' ? 'Receipt' : 'Disbursement'}</span><span className="record-reference">{transaction.id}</span></div><span className="record-amount-caption">Recorded amount</span><p className="record-display-amount tabular-nums">{new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(Number(transaction.amount))}</p><h3 className={`record-payee ${!transaction.payee_name ? 'record-id-title' : ''}`}>{transaction.payee_name || transaction.id}</h3><div className="receipt-perforation" />
      <dl className="record-facts"><div><dt>Transaction date</dt><dd>{transaction.date}</dd></div><div><dt>Receipt / reference</dt><dd>{transaction.receipt_no || 'Not provided'}</dd></div><div className="full-width"><dt>ComBud account</dt><dd className={isUnassigned ? 'text-amber-700 dark:text-amber-300' : ''}><span className="account-code">{transaction.categories?.export_code || '???'}</span> {transaction.categories?.name || 'Unassigned / for review'}</dd></div></dl>
      <section className="record-notes"><h3>Remarks & allocation</h3><p>{generalRemarks || (breakdownList.length ? 'See the itemized allocation below.' : 'No remarks recorded.')}</p>{breakdownList.length > 0 && <div className="record-breakdown">{breakdownList.map((item,index) => <div key={index}><span>{item.name}</span><strong className="tabular-nums">₱{item.amount.toLocaleString('en-PH',{minimumFractionDigits:2})}</strong></div>)}<div className="breakdown-total"><span>Itemized total</span><strong>₱{breakdownList.reduce((sum,item)=>sum+item.amount,0).toLocaleString('en-PH',{minimumFractionDigits:2})}</strong></div></div>}</section>
    </section><aside className="record-accountability"><span className="record-side-label">Accountability</span><h3>Audit information</h3><p>Who recorded this entry and when.</p><dl><div><dt>Entered by</dt><dd className="record-person"><UserAvatar photoUrl={transaction.profiles?.avatar_data_url} size={30}/><span>{transaction.profiles?.full_name || 'Name unavailable'}</span></dd></div><div><dt>Recorded on</dt><dd>{new Date(transaction.created_at).toLocaleString('en-PH')}</dd></div><div><dt>Record ID</dt><dd className="record-id">{transaction.id}</dd></div><div><dt>Currency</dt><dd>Philippine peso / PHP</dd></div></dl><div className="record-readonly"><span className="status-dot" />Read-only record view</div></aside></div>
    <footer className="dialog-footer"><span className="dialog-footer-note">JFCM-SL Stewards</span><button type="button" className="button-primary" onClick={onClose}>Done reviewing</button></footer>
  </article></DialogLayer>;
}

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Edit2,
  Eye,
  ReceiptText,
  ShieldAlert,
} from 'lucide-react';
import type { Category, FinancialPeriod, Transaction } from '../types/database.types';

export type DuplicateScanTransaction = Transaction & {
  categories?: Category;
  profiles?: { full_name: string };
  updated_by_profile?: { full_name: string };
};

export type DuplicateConfidence = 'HIGH' | 'REVIEW';

export type DuplicateCandidate = {
  id: string;
  first: DuplicateScanTransaction;
  second: DuplicateScanTransaction;
  confidence: DuplicateConfidence;
  score: number;
  reasons: string[];
};

type TransactionDuplicateScannerProps = {
  transactions: DuplicateScanTransaction[];
  periods: FinancialPeriod[];
  selectedPeriodFilter: string;
  activeTab: 'ALL' | 'INCOME' | 'EXPENSE';
  /** Optional precomputed candidates so the table and Alerts share one scan result. */
  candidates?: DuplicateCandidate[];
  onViewDetails: (transaction: DuplicateScanTransaction) => void;
  onEdit: (transaction: DuplicateScanTransaction) => void;
};

const amountInCents = (value: unknown): number | null => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
};

const normalizeText = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    // The generated item list is not the transaction's identifying remark.
    .replace(/\[breakdown:[\s\S]*?\]/gi, ' ')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const GENERIC_WORDS = new Set([
  'a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'with',
  'transaction', 'payment', 'paid', 'purchase', 'expense', 'expenses', 'receipt', 'church',
  'tithe', 'tithes', 'offering', 'offerings', 'local', 'others', 'collection', 'food', 'cash',
  'monthly', 'weekly', 'regular', 'misc', 'miscellaneous', 'please', 'see', 'breakdown',
]);

const meaningfulTokens = (value: unknown): Set<string> => {
  const normalized = normalizeText(value);
  if (!normalized) return new Set();
  return new Set(
    normalized
      .split(' ')
      .filter(token => token.length >= 3 && !GENERIC_WORDS.has(token)),
  );
};

const tokenComparison = (left: unknown, right: unknown) => {
  const a = meaningfulTokens(left);
  const b = meaningfulTokens(right);
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  const union = new Set([...a, ...b]).size;
  return {
    shared,
    similarity: union === 0 ? 0 : shared / union,
    exact: a.size > 0 && normalizeText(left) === normalizeText(right),
  };
};

const dateDistanceInDays = (left: unknown, right: unknown): number | null => {
  const toUtcDay = (value: unknown): number | null => {
    const text = String(value ?? '');
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return null;
    return Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  };

  const a = toUtcDay(left);
  const b = toUtcDay(right);
  if (a === null || b === null) return null;
  return Math.round(Math.abs(a - b) / 86_400_000);
};

const normalizedReceipt = (value: unknown): string =>
  String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

const buildDuplicateCandidate = (
  first: DuplicateScanTransaction,
  second: DuplicateScanTransaction,
): DuplicateCandidate | null => {
  // A matching amount by itself is not sufficient: legitimate offerings can repeat.
  const amountA = amountInCents(first.amount);
  const amountB = amountInCents(second.amount);
  if (amountA === null || amountB === null || amountA !== amountB) return null;
  if (!first.category_id || first.category_id !== second.category_id) return null;
  if (first.financial_period_id !== second.financial_period_id || first.type !== second.type) return null;
  if (first.id === second.id) return null;

  const daysApart = dateDistanceInDays(first.date, second.date);
  const sameDay = daysApart === 0;
  const receiptA = normalizedReceipt(first.receipt_no);
  const receiptB = normalizedReceipt(second.receipt_no);
  const sameReceipt = receiptA.length > 0 && receiptA === receiptB;
  const payeeMatch = tokenComparison(first.payee_name, second.payee_name);
  const remarksMatch = tokenComparison(first.remarks, second.remarks);
  const samePayee = payeeMatch.exact;
  const sameRemarks = remarksMatch.exact;
  const reasons: string[] = [];
  let score = 0;
  let confidence: DuplicateConfidence = 'REVIEW';

  if (sameReceipt) {
    score += 100;
    confidence = 'HIGH';
    reasons.push('Same receipt/reference number');
  }

  if (sameDay && samePayee) {
    score += 45;
    confidence = 'HIGH';
    reasons.push('Same date and payee');
  } else if (samePayee && daysApart !== null && daysApart <= 2) {
    score += 25;
    reasons.push('Same payee within 2 days');
  }

  if (sameDay && sameRemarks) {
    score += 45;
    confidence = 'HIGH';
    reasons.push('Same date and remarks');
  } else if (sameRemarks && daysApart !== null && daysApart <= 30) {
    score += 28;
    reasons.push('Same remarks within 30 days');
  }

  if (sameDay && remarksMatch.similarity >= 0.67 && remarksMatch.shared >= 1) {
    score += 30;
    confidence = 'HIGH';
    reasons.push('Very similar remarks on the same date');
  } else if (
    remarksMatch.similarity >= 0.75 &&
    remarksMatch.shared >= 2 &&
    daysApart !== null &&
    daysApart <= 3
  ) {
    score += 20;
    reasons.push('Similar remarks within 3 days');
  }

  // Fallback: Flag exact same amount/account on the EXACT same day, 
  // even if payee/remarks are empty or don't match.
  if (sameDay && reasons.length === 0) {
    score += 25;
    reasons.push('Same date, account, and exact amount');
  }

  // If still no reasons (e.g., different days with no matching text), ignore.
  if (reasons.length === 0) return null;
  if (confidence !== 'HIGH' && score < 20) return null;

  const pairIds = [first.id, second.id].sort();
  return {
    id: `${pairIds[0]}::${pairIds[1]}`,
    first,
    second,
    confidence,
    score,
    reasons: [...new Set(reasons)],
  };
};

/**
 * Scans existing transactions (not just newly created records) within the selected
 * period and transaction-type filter. Search-box text is intentionally excluded so
 * a matching counterpart is not hidden merely because it does not match the search.
 */
export const findDuplicateCandidates = (
  transactions: DuplicateScanTransaction[],
  selectedPeriodFilter: string,
  activeTab: 'ALL' | 'INCOME' | 'EXPENSE',
): DuplicateCandidate[] => {
  const scoped = transactions.filter(transaction =>
    (selectedPeriodFilter === 'ALL' || transaction.financial_period_id === selectedPeriodFilter) &&
    (activeTab === 'ALL' || transaction.type === activeTab) &&
    Boolean(transaction.category_id),
  );

  // Bucket before pairwise comparison to avoid comparing unrelated accounts/amounts.
  const buckets = new Map<string, DuplicateScanTransaction[]>();
  for (const transaction of scoped) {
    const cents = amountInCents(transaction.amount);
    if (cents === null) continue;
    const key = [
      transaction.financial_period_id,
      transaction.category_id,
      transaction.type,
      cents,
    ].join('|');
    const bucket = buckets.get(key) ?? [];
    bucket.push(transaction);
    buckets.set(key, bucket);
  }

  const result: DuplicateCandidate[] = [];
  for (const bucket of buckets.values()) {
    if (bucket.length < 2) continue;
    for (let i = 0; i < bucket.length - 1; i += 1) {
      for (let j = i + 1; j < bucket.length; j += 1) {
        const candidate = buildDuplicateCandidate(bucket[i], bucket[j]);
        if (candidate) result.push(candidate);
      }
    }
  }

  return result.sort((a, b) =>
    (a.confidence === b.confidence ? 0 : a.confidence === 'HIGH' ? -1 : 1) ||
    b.score - a.score ||
    String(b.second.date).localeCompare(String(a.second.date)),
  );
};

const formatPHP = (amount: unknown): string =>
  `₱${Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function TransactionDuplicateScanner({
  transactions,
  periods,
  selectedPeriodFilter,
  activeTab,
  candidates: suppliedCandidates,
  onViewDetails,
  onEdit,
}: TransactionDuplicateScannerProps) {
  const [showAll, setShowAll] = useState(false);

  const candidates = useMemo(
    () => suppliedCandidates ?? findDuplicateCandidates(transactions, selectedPeriodFilter, activeTab),
    [suppliedCandidates, transactions, selectedPeriodFilter, activeTab],
  );

  if (candidates.length === 0) return null;

  const visibleCandidates = showAll ? candidates : candidates.slice(0, 5);

  const getAccountLabel = (transaction: DuplicateScanTransaction) =>
    transaction.categories
      ? `[${transaction.categories.export_code}] ${transaction.categories.name}`
      : 'Unassigned account';

  const getPeriodLabel = (transaction: DuplicateScanTransaction) =>
    periods.find(period => period.id === transaction.financial_period_id)?.period_name ?? 'Unknown period';

  return (
    <section className="overflow-hidden rounded-2xl border border-amber-300 bg-white shadow-sm dark:border-amber-900/60 dark:bg-[#0A0A0A]">
      <div className="flex flex-col gap-3 border-b border-amber-200 bg-amber-50/80 px-5 py-4 dark:border-amber-900/50 dark:bg-amber-950/20 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl border border-amber-200 bg-white p-2 text-amber-600 dark:border-amber-900/60 dark:bg-[#121212] dark:text-amber-400">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Potential Duplicate Transactions
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
              {candidates.length} possible duplicate pair{candidates.length === 1 ? '' : 's'} found. Review before taking action; no records were changed.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-amber-700 dark:border-amber-900/60 dark:bg-[#121212] dark:text-amber-400">
            {candidates.filter(candidate => candidate.confidence === 'HIGH').length} HIGH CONFIDENCE
          </span>
        </div>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-[#27272A]">
        {visibleCandidates.map(candidate => (
          <article key={candidate.id} className="p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${candidate.confidence === 'HIGH'
                ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400'
                : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400'}`}>
                <AlertTriangle className="h-3 w-3" /> {candidate.confidence === 'HIGH' ? 'Strong duplicate clues' : 'Needs review'}
              </span>
              <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200">
                {getAccountLabel(candidate.first)}
              </span>
              <span className="font-mono text-[10px] font-bold text-slate-900 dark:text-white">
                {formatPHP(candidate.first.amount)}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                <CalendarDays className="h-3 w-3" /> {getPeriodLabel(candidate.first)}
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {[candidate.first, candidate.second].map((transaction, index) => (
                <div key={transaction.id} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-[#27272A] dark:bg-[#111111]">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Record {index + 1}</span>
                    <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">{transaction.date}</span>
                  </div>
                  <p className="truncate text-xs font-semibold text-slate-900 dark:text-white" title={transaction.payee_name || ''}>
                    {transaction.payee_name || 'No payee/source recorded'}
                  </p>
                  <p className="mt-1 line-clamp-2 min-h-[2rem] break-words text-[10px] leading-relaxed text-slate-500 dark:text-slate-400" title={transaction.remarks || ''}>
                    {transaction.remarks || 'No remarks recorded'}
                  </p>
                  {transaction.receipt_no && (
                    <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                      <ReceiptText className="h-3 w-3" /> Ref: {transaction.receipt_no}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onViewDetails(transaction)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-700 transition-colors hover:border-emerald-300 hover:text-emerald-700 dark:border-[#333] dark:bg-[#151515] dark:text-slate-300 dark:hover:border-emerald-800 dark:hover:text-emerald-400"
                    >
                      <Eye className="h-3 w-3" /> View
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(transaction)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-700 transition-colors hover:border-emerald-300 hover:text-emerald-700 dark:border-[#333] dark:bg-[#151515] dark:text-slate-300 dark:hover:border-emerald-800 dark:hover:text-emerald-400"
                    >
                      <Edit2 className="h-3 w-3" /> Review / Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-3 text-[10px] leading-relaxed text-amber-800 dark:text-amber-400">
              <strong>Why flagged:</strong> {candidate.reasons.join(' · ')}. The account, period, transaction type, and amount also match.
            </p>
          </article>
        ))}
      </div>

      {candidates.length > 5 && (
        <div className="border-t border-slate-200 px-4 py-3 text-center dark:border-[#27272A]">
          <button
            type="button"
            onClick={() => setShowAll(value => !value)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#151515]"
          >
            {showAll ? <>Show fewer <ChevronUp className="h-3.5 w-3.5" /></> : <>Show all {candidates.length} pairs <ChevronDown className="h-3.5 w-3.5" /></>}
          </button>
        </div>
      )}
    </section>
  );
}

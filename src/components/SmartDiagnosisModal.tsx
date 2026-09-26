import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, SearchCode, AlertOctagon, CheckCircle2 } from 'lucide-react';

interface SmartDiagnosisModalProps {
  isOpen: boolean;
  onClose: () => void;
  discrepancy: number;
  isBalanced: boolean;
  transactions: any[];
  recon: any;
  totalBank: number;
  totalCash: number;
}

export default function SmartDiagnosisModal({
  isOpen, onClose, discrepancy, isBalanced, transactions, recon, totalBank, totalCash
}: SmartDiagnosisModalProps) {

  const analyzerFindings = useMemo(() => {
    if (discrepancy === 0) return [];
    const findings: { type: string, message: React.ReactNode }[] = [];
    const absDisc = Math.abs(discrepancy);
    
    // 1. Missing Beginning Balance Check
    if (!recon.beginning_balance && absDisc > 0) {
      findings.push({
        type: 'no_beginning_balance',
        message: <span><strong>Missing Beginning Balance:</strong> Your starting balance is ₱0.00. Unless this is a brand-new account, you must enter the exact physical ending balance from the previous month for the math to align.</span>
      });
    }

    // 2. Empty Physical Fields Check
    const emptyFields = [];
    if (!recon.cib_savings && totalBank > 0) emptyFields.push('Savings Account');
    if (!recon.cib_current) emptyFields.push('Current Account');
    if (!recon.coh_petty_cash) emptyFields.push('Petty Cash');
    if (!recon.coh_undeposited) emptyFields.push('Undeposited Collections');
    
    if (emptyFields.length > 0 && absDisc > 0) {
       findings.push({
         type: 'empty_fields',
         message: <span><strong>Blank Physical Entries:</strong> You recorded ₱0.00 for {emptyFields.join(', ')}. Please verify if these accounts are genuinely empty, or if you simply forgot to input their current physical balances.</span>
       });
    }

    // 3. Directional Insight
    if (discrepancy < 0) {
      findings.push({
        type: 'shortage',
        message: <span><strong>Physical Shortage:</strong> You are physically short by <strong>₱{absDisc.toLocaleString('en-PH', {minimumFractionDigits: 2})}</strong>. The system ledger expects more money. Check for an unrecorded physical Expense, an automatic bank fee deducted from Savings, or check if Advances (₱{recon.coh_advances.toLocaleString()}) were given out but not logged in the ledger.</span>
      });
    } else {
      findings.push({
        type: 'overage',
        message: <span><strong>Physical Overage:</strong> You have <strong>₱{absDisc.toLocaleString('en-PH', {minimumFractionDigits: 2})}</strong> more physical cash/bank than expected. Check for unrecorded Income (like late tithes or offerings) or Coop Interest that hasn't been encoded into the ledger yet.</span>
      });
    }

    // 4. Exact Transaction Match & Duplicates
    const exactMatches = transactions.filter(t => Number(t.amount) === absDisc);
    if (exactMatches.length > 0) {
      if (exactMatches.length > 1) {
        findings.push({
          type: 'duplicate',
          message: <span><strong>Highly Probable Duplicate:</strong> We found {exactMatches.length} transactions exactly matching your discrepancy of ₱{absDisc.toLocaleString('en-PH', {minimumFractionDigits: 2})}. You likely recorded the same transaction twice. Verify: {exactMatches.map(t => `'${t.remarks || t.payee_name}'`).join(', ')}.</span>
        });
      } else {
        findings.push({
          type: 'ledger_match',
          message: <span><strong>Ledger Entry Found:</strong> 1 transaction perfectly matches your discrepancy of ₱{absDisc.toLocaleString('en-PH', {minimumFractionDigits: 2})}: '{exactMatches[0].remarks || exactMatches[0].payee_name || exactMatches[0].categories?.name}'. Check if this was physically omitted from the bank total or recorded in error.</span>
        });
      }
    }

    // 5. Polarity Flip (Income encoded as Expense)
    const flippedMatches = transactions.filter(t => Number(t.amount) === (absDisc / 2));
    if (flippedMatches.length > 0) {
      findings.push({
        type: 'polarity',
        message: <span><strong>Income/Expense Flip:</strong> Found {flippedMatches.length} transaction(s) for exactly half the variance (₱{(absDisc / 2).toLocaleString('en-PH', {minimumFractionDigits: 2})}). E.g. {flippedMatches.map(t => `'${t.remarks || t.payee_name}'`).join(', ')}. If an expense was accidentally tagged as an income (or vice versa), it doubles the mathematical error!</span>
      });
    }

    // 6. Transposition Typo Check (Modulo 9 Rule)
    const centsDisc = Math.round(absDisc * 100);
    if (centsDisc % 9 === 0 && absDisc % 10 !== 0 && absDisc !== 0) {
      findings.push({
        type: 'typo',
        message: <span><strong>Typo Check (Transposition):</strong> The variance of ₱{absDisc.toLocaleString('en-PH', {minimumFractionDigits: 2})} is perfectly divisible by 9. This mathematically guarantees a typing error in your physical counts (e.g., typing 54 instead of 45). Re-verify your Cash in Bank and Cash on Hand inputs digit-by-digit.</span>
      });
    }

    // 7. Undeposited / Petty Cash Direct Matches
    if (absDisc === recon.coh_undeposited && recon.coh_undeposited > 0) {
      findings.push({
        type: 'undeposited_match',
        message: <span><strong>Undeposited Collections Match:</strong> The discrepancy exactly equals your Undeposited Collections. Verify if you encoded this as Income but forgot to physically deposit it, or if your physical cash count is inflated.</span>
      });
    }
    if (absDisc === recon.coh_petty_cash && recon.coh_petty_cash > 0) {
      findings.push({
        type: 'petty_cash_match',
        message: <span><strong>Petty Cash Match:</strong> The discrepancy exactly matches your Petty Cash Fund. Did you replenish this from the bank without logging the transfer, or forget to include it in the beginning balance?</span>
      });
    }

    return findings;
  }, [discrepancy, transactions, recon, totalBank, totalCash]);

  if (!isOpen) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[99998] bg-black/80 backdrop-blur-md transition-opacity duration-300" aria-hidden="true" />
      <div className="fixed inset-0 z-[99998] flex items-center justify-center p-0 sm:p-4 pointer-events-none">
        <div className="pointer-events-auto w-full h-[100dvh] sm:h-auto sm:max-h-[95vh] max-w-2xl bg-white dark:bg-[#121212] rounded-none sm:rounded-3xl shadow-none sm:shadow-2xl relative flex flex-col p-0 overflow-hidden border-0 sm:border border-slate-200 dark:border-[#27272A] animate-modal">
          
          <div className="flex items-center justify-between p-4 sm:p-6 landscape:py-3 lg:landscape:p-6 bg-slate-50 dark:bg-[#0A0A0A] border-b border-slate-200 dark:border-[#27272A] shrink-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <SearchCode className="h-5 w-5 text-emerald-500" /> Smart Discrepancy Analyzer
            </h3>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl transition-colors bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10"><X className="h-5 w-5" /></button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 landscape:py-3 lg:landscape:p-6 space-y-5">
            {!isBalanced && analyzerFindings.length > 0 ? (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-5 rounded-2xl space-y-4">
                <h4 className="font-bold text-amber-900 dark:text-amber-400 flex items-center gap-2 text-sm border-b border-amber-200/50 dark:border-amber-800/50 pb-2">
                  <AlertOctagon className="h-4 w-4" /> Probable Errors Found:
                </h4>
                <ul className="space-y-3">
                  {analyzerFindings.map((finding, idx) => (
                    <li key={idx} className="text-amber-800 dark:text-amber-300 text-xs leading-relaxed font-medium bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-amber-100 dark:border-amber-900/30">
                      {finding.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : !isBalanced ? (
              <div className="bg-slate-50 dark:bg-[#1A1C23] p-5 rounded-2xl border border-slate-200 dark:border-[#2A2D35] text-center">
                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">The discrepancy pattern is irregular. Please carefully review the general checklist below to audit your inputs.</p>
              </div>
            ) : (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-2xl border border-emerald-200 dark:border-emerald-800/50 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
                <p className="text-sm text-emerald-700 dark:text-emerald-400 font-bold">Ledger perfectly reconciled. No discrepancies detected.</p>
              </div>
            )}

            <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300 pt-2">
              <h4 className="font-bold text-slate-900 dark:text-white px-1 uppercase tracking-wider text-[11px]">General Auditing Checklist</h4>
              <div className="grid gap-3">
                <div className="bg-slate-50 dark:bg-[#1A1C23] p-4 rounded-xl space-y-1.5 border border-slate-200 dark:border-[#2A2D35]">
                  <h4 className="font-bold text-slate-900 dark:text-white">1. Beginning Balance Carryover Check</h4>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed">Verify that your starting beginning balance correctly matches last month's final ending cash balance.</p>
                </div>
                <div className="bg-slate-50 dark:bg-[#1A1C23] p-4 rounded-xl space-y-1.5 border border-slate-200 dark:border-[#2A2D35]">
                  <h4 className="font-bold text-slate-900 dark:text-white">2. Unassigned or Unrecorded Transactions</h4>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed">Check if any cash collections, offerings, or disbursements were left unassigned or omitted from the ledger.</p>
                </div>
                <div className="bg-slate-50 dark:bg-[#1A1C23] p-4 rounded-xl space-y-1.5 border border-slate-200 dark:border-[#2A2D35]">
                  <h4 className="font-bold text-slate-900 dark:text-white">3. San Jose Koop Passbook Pass-Throughs</h4>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed">Ensure all Koop deposits and monthly interest earnings are logged accurately in the SJ Koop Ledger.</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-4 sm:p-6 landscape:py-3 lg:landscape:p-6 bg-slate-100/50 dark:bg-[#0A0A0A] border-t border-slate-200 dark:border-[#27272A] shrink-0 sm:rounded-b-3xl">
            <button onClick={onClose} className="w-full sm:w-auto ml-auto px-6 py-3 sm:py-2.5 bg-slate-900 dark:bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors shadow-md block">Close Guide</button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
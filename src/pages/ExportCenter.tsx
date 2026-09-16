import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Download, FileSpreadsheet, Settings } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { FinancialPeriod } from '../types/database.types';

export default function ExportCenter() {
  const { user } = useAuth();
  const [periods, setPeriods] = useState<FinancialPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [loading, setLoading] = useState(false);
  const [hideEmpty, setHideEmpty] = useState(true);

  useEffect(() => {
    if (user) fetchInitialData();
  }, [user]);

  const fetchInitialData = async () => {
    const { data: profile } = await supabase.from('profiles').select('church_id').eq('id', user?.id).single();
    if (profile) {
      const { data: periodData } = await supabase.from('financial_periods').select('*').eq('church_id', profile.church_id).order('month', { ascending: false });
      if (periodData) {
        setPeriods(periodData);
        if (periodData.length > 0) setSelectedPeriod(periodData[0].id);
      }
    }
  };

  const handleExport = async () => {
    setLoading(true);
    const periodName = periods.find(p => p.id === selectedPeriod)?.period_name || 'Export';
    
    const { data: txs } = await supabase.from('transactions').select('*, categories(name, export_code, type)').eq('financial_period_id', selectedPeriod).order('date', { ascending: true });
    
    // FIX 1: Fetch reconciliation data directly from the financial_periods table to sync with Mission Readiness
    const { data: currentPeriod } = await supabase.from('financial_periods').select('*').eq('id', selectedPeriod).single();
    const recon = currentPeriod;

    if (!txs || txs.length === 0) {
      alert("No transactions found for this period.");
      setLoading(false); return;
    }

    const sums: Record<string, number> = {};
    let totalIncome = 0;
    let totalExpense = 0;

    txs.forEach(tx => {
      const code = tx.categories?.export_code || 'UNCATEGORIZED';
      const type = tx.type;
      const key = `${code}_${type}`;
      
      sums[key] = (sums[key] || 0) + Number(tx.amount);
      if (type === 'INCOME') totalIncome += Number(tx.amount);
      if (type === 'EXPENSE') totalExpense += Number(tx.amount);
    });

    const getSum = (code: string, type: string) => sums[`${code}_${type}`] || 0;
    const processedKeys = new Set<string>();

    const buildSection = (prefix: string, title: string, type: 'INCOME' | 'EXPENSE', items: {c: string, n: string}[]) => {
      const rows: any[] = [];
      const activeItems = items.filter(i => !hideEmpty || getSum(i.c, type) !== 0);

      if (activeItems.length > 0 || !hideEmpty) {
        rows.push([null, prefix, title]);
        activeItems.forEach(i => {
          rows.push([null, i.c, i.n, null, null, getSum(i.c, type)]);
          processedKeys.add(`${i.c}_${type}`);
        });
      }
      return rows;
    };

    const b1 = [{c: '5011', n: 'Tithes - Local'}, {c: '5015', n: 'Tithes - Foreign'}, {c: '5021', n: 'Offerings - Local'}, {c: '5022', n: 'Offerings - Compassion Fund'}, {c: '5023', n: 'Offerings - Others'}, {c: '5025', n: 'Offerings - Foreign'}, {c: '5031', n: 'Pledges - Local'}, {c: '5032', n: 'Pledges - Foreign'}, {c: '7100', n: 'Interest - Bank Deposit'}, {c: '7300', n: 'Miscellaneous Receipts'}];
    const b2 = [{c: '1115', n: 'Accounts Receivable - Others'}, {c: '1116', n: 'Accounts Receivable - (Name)'}, {c: '1118', n: 'Accounts Receivable - (Name)'}, {c: '1125', n: 'Advances - (Name)'}, {c: '1171', n: 'Rental Deposit (Name)'}, {c: '2017', n: 'Accounts Payable - Others (Name)'}, {c: '2800', n: 'Missions Contribution (1117-A/R)'}, {c: '2805', n: 'Project Fund Contribution'}, {c: '2810', n: 'Subsidy from -'}, {c: '2811', n: 'Support from -'}, {c: '2204', n: 'Expanded Withholding Tax (Name)'}, {c: '2205', n: 'Withholding Tax Payable'}, {c: '2206', n: 'SSS Contribution Payable (EE + ER)'}, {c: '2210', n: 'Phil-Health Contribution Payable (EE + ER)'}, {c: '2215', n: 'Pag-Ibig Fund Contribution Payable (EE + ER)'}, {c: '2220', n: 'SSS Salary Loan Payable'}];
    const c1 = [{c: '6010', n: 'Salaries & Wages'}, {c: '6030', n: 'Love Gift - Personnel'}, {c: '6401', n: 'Love Gift - Missionaries/Workers'}, {c: '6402', n: 'Love Gifts - Others'}, {c: '6403', n: 'Love Gifts - Worship Place'}, {c: '6422', n: 'Compassion Expense'}, {c: '6040', n: 'SSS Premium - ER'}, {c: '6050', n: 'Phil-Health Premium - ER'}, {c: '6060', n: 'Pag-Ibig Fund Premium - ER'}, {c: '6070', n: 'Medical Expense'}, {c: '6105', n: 'Transportation Expense'}, {c: '6210', n: 'Food & Refreshments'}, {c: '6270', n: 'Teaching & Program Materials'}, {c: '6510', n: 'Gasoline & Diesel'}, {c: '6515', n: 'Vehicle Registration'}, {c: '6520', n: 'Repair & Maint. - Transportation Equipment'}, {c: '6691', n: 'Repair & Maint. - Building &/or Fellowship House'}, {c: '6692', n: 'Repair & Maint. - Office Equipment'}, {c: '6693', n: 'Repair & Maint. - Musical Equipment'}, {c: '6694', n: 'Repair & Maint. - Furniture & Fixtures'}, {c: '6695', n: 'Repair & Maint. - Electro/Mechanical Equipment'}, {c: '6710', n: 'Stationeries & Office Equipment Supplies'}, {c: '6715', n: 'Computer Supplies'}, {c: '6720', n: 'Musical Supplies'}, {c: '6730', n: 'Kitchen Supplies'}, {c: '6810', n: 'Rental Expense (gross amount)'}, {c: '6811', n: 'Input Vat-Rent Expense'}, {c: '6910', n: 'Electricity'}, {c: '6920', n: 'Water'}, {c: '6930', n: 'Janitorial & Utility Supplies'}, {c: '6940', n: 'Telephone, Postage & Telegraph'}, {c: '6945', n: 'Internet Expense'}, {c: '6955', n: 'Notarial & Legal Fees'}, {c: '6956', n: 'Technical Fees'}, {c: '6957', n: 'Audit Fees'}, {c: '6971', n: 'Insurance Expense - Bldg'}, {c: '6972', n: 'Insurance Expense - Transport Equipment'}, {c: '6990', n: 'Miscellaneous Expense'}, {c: '7500', n: 'Interest Expense'}, {c: '7600', n: 'Bank Charges'}];
    const c2 = [{c: '1115', n: 'Accounts Receivable - Others'}, {c: '1116', n: 'Accounts Receivable - (Name)'}, {c: '1118', n: 'Accounts Receivable - (Name)'}, {c: '1125', n: 'Advances -'}, {c: '1171', n: 'Rental Deposit'}, {c: '1800', n: 'Missions Contribution -'}, {c: '1805', n: 'Project Fund Contribution -'}, {c: '1810', n: 'Subsidy to Church -'}, {c: '1811', n: 'Support to Church -'}, {c: '2017', n: 'Accounts Payable - Others'}, {c: '2810', n: 'Subsidy from -'}, {c: '2811', n: 'Support from -'}, {c: '2204', n: 'Expanded Withholding Tax'}, {c: '2205', n: 'Withholding Tax Payable'}, {c: '2206', n: 'SSS Contribution Payable (EE + ER)'}, {c: '2210', n: 'Phil-Health Contribution Payable (EE + ER)'}, {c: '2215', n: 'Pag-Ibig Fund Contribution Payable (EE + ER)'}, {c: '2220', n: 'SSS Salary Loan Payable'}];
    const d1 = [{c: '1610', n: 'Land'}, {c: '1619', n: 'Construction in Progress-Bldg/Fhouse'}, {c: '1620', n: 'Building/Fellowship House'}, {c: '1626', n: 'Building/Fellowship House Improvement'}, {c: '1630', n: 'Musical Instruments & Sound System'}, {c: '1640', n: 'Furniture & Fixtures'}, {c: '1650', n: 'Office Equipment'}, {c: '1656', n: 'Electro/Mechanical Equipment'}, {c: '1660', n: 'Transportation Equipment'}, {c: '1670', n: 'Computer System & Software'}];
    const d2 = [{c: '6251', n: 'Doctrination'}, {c: '6252', n: 'Equipping Seminar'}, {c: '6253', n: 'National Consultation'}, {c: '6254', n: 'General Consultation'}, {c: '6261', n: 'Training Seminar (External)'}, {c: '6262', n: 'Pastor/Missionary Education'}];
    const d3 = [{c: '6301', n: 'Feeding Program'}, {c: '6302', n: 'Project Activity (Fund Raising)'}, {c: '6351', n: 'Outdoor Fellowship'}, {c: '6352', n: 'Foundation Day'}, {c: '6353', n: 'Youth Camp'}, {c: '6354', n: 'Christmas Celebration'}, {c: '6355', n: 'Sportsfest'}, {c: '6356', n: 'Retreat'}, {c: '6357', n: 'Anniversary Celebration'}, {c: '6358', n: 'Water Baptism'}, {c: '6359', n: 'Other Special Events'}];

    const beginningBalance = Number(recon?.beginning_balance) || 0;
    const totalAandB = beginningBalance + totalIncome;

    const mprData: any[] = [
      [null, null, null, 'JESUS FIRST CHRISTIAN MINISTRIES INCORPORATED - Sapang Lamig, CSJDB'],
      [null, null, null, 'STATEMENT OF CASH RECEIPTS AND DISBURSEMENTS'],
      [null, null, null, `FOR THE PERIOD ENDED - ${periodName}`],
      [],
      ['A.', 'BEGINNING BALANCE', null, null, null, beginningBalance],
      ['B.', 'CASH RECEIPTS'],
      ...buildSection('B.1', 'Income', 'INCOME', b1),
      ...buildSection('B.2', 'Other Receipts', 'INCOME', b2),
    ];

    Object.keys(sums).forEach(key => {
      const [code, type] = key.split('_');
      if (type === 'INCOME' && !processedKeys.has(key) && sums[key] !== 0) {
        const catName = txs.find(t => t.categories?.export_code === code)?.categories?.name || 'Uncategorized';
        mprData.push([null, code, `*${catName} (Auto-Appended)`, null, null, sums[key]]);
      }
    });

    mprData.push(
      ['TOTAL = (A + B)', null, null, null, null, totalAandB],
      ['C.', 'CASH DISBURSEMENTS'],
      ...buildSection('C.1', 'Operating Expenses', 'EXPENSE', c1),
      ...buildSection('C.2', 'Other Disbursements', 'EXPENSE', c2),
      ['D.', 'PROJECT EXPENSES'],
      ...buildSection('D.1', 'Acquisition', 'EXPENSE', d1),
      ...buildSection('D.2', 'Seminars/Conferences & Education', 'EXPENSE', d2),
      ...buildSection('D.3', 'Special Events', 'EXPENSE', d3),
    );

    Object.keys(sums).forEach(key => {
      const [code, type] = key.split('_');
      if (type === 'EXPENSE' && !processedKeys.has(key) && sums[key] !== 0) {
        const catName = txs.find(t => t.categories?.export_code === code)?.categories?.name || 'Uncategorized';
        mprData.push([null, code, `*${catName} (Auto-Appended)`, null, null, sums[key]]);
      }
    });

    mprData.push(
      ['TOTAL ENDING BALANCE = (A + B) - (C + D)', null, null, null, null, totalAandB - totalExpense],
      [],
      ['CASH BREAKDOWN'],
      [null, '1000', 'CASH IN-BANK'],
      [null, null, 'Savings Account', null, null, Number(recon?.cib_savings) || 0],
      [null, null, 'Current Account', null, null, Number(recon?.cib_current) || 0],
      [null, null, 'Time Deposit & Other Deposit', null, null, Number(recon?.cib_time_deposit) || 0],
      [null, '1000', 'CASH ON-HAND'],
      [null, null, 'Petty Cash Fund', null, null, Number(recon?.coh_petty_cash) || 0],
      [null, null, 'Undeposited / Unremitted Amount', null, null, Number(recon?.coh_undeposited) || 0],
      [null, null, 'Advances', null, null, Number(recon?.coh_advances) || 0],
      ['TOTAL = (Cash In-Bank + Cash On-Hand)', null, null, null, null, (Number(recon?.cib_savings)||0) + (Number(recon?.cib_current)||0) + (Number(recon?.cib_time_deposit)||0) + (Number(recon?.coh_petty_cash)||0) + (Number(recon?.coh_undeposited)||0) + (Number(recon?.coh_advances)||0)],
      ['DIFFERENCE = [(Total Ending Balance - Total Cash (CIB + COH)]', null, null, null, null, (totalAandB - totalExpense) - ((Number(recon?.cib_savings)||0) + (Number(recon?.cib_current)||0) + (Number(recon?.cib_time_deposit)||0) + (Number(recon?.coh_petty_cash)||0) + (Number(recon?.coh_undeposited)||0) + (Number(recon?.coh_advances)||0))],
      [],
      [],
      ['Date Prepared', null, null, null, null, null],
      [],
      ['Prepared by', null, '________________________________', null, null, null],
      [],
      ['Noted by', null, '________________________________', null, null, null],
      [],
      ['Notes:'],
      ['1', null, 'Expenditure) if the amount is more than Php 2,500.00.', null, null, null],
      ['2', null, 'Improvements on rented Building/Fellowship House amounting to Php20,000.00 and above shall be CAPITALIZED and booked to Leasehold Improvement', null, null, null],
      ['3', null, 'Improvements on owned Building/Fellowship House shall be CAPITALIZED and booked to Building/Fellowship House', null, null, null],
      ['4', null, 'Salaries & Wages and Rentals shall be recorded as Expense at Gross Amount', null, null, null],
      ['5', null, 'Disbursed but not remitted Payables and Contributions (EE + ER) such as Withholding Tax, Expanded Withholding Tax, SSS, PhilHealth and Pag-Ibig shall be redeposited and recorded in the SCRD under Other Receipts', null, null, null],
      ['6', null, 'xerox copy of Contract, if any, should be forwarded to IF-CO.', null, null, null],
    );

    let formattedEndDate = periodName;
    try {
      const [monthName, year] = periodName.split(' ');
      const monthIndex = new Date(`${monthName} 1, 2000`).getMonth();
      const lastDay = new Date(Number(year), monthIndex + 1, 0);
      formattedEndDate = `${lastDay.getDate()}-${monthName.substring(0,3)}-${year.substring(2)}`;
    } catch(e) {}

    mprData[2][3] = `FOR THE PERIOD ENDED - ${formattedEndDate}`;

    const mprSheet = XLSX.utils.aoa_to_sheet(mprData);
    
    // FIX 2: Reduced Column C width from 85 to 45
    mprSheet['!cols'] = [{wch: 5}, {wch: 12}, {wch: 45}, {wch: 10}, {wch: 15}, {wch: 20}];
    
    // FIX 3 & 4: Freeze columns A, B, and C (xSplit: 3) and strictly ensure no protection
    mprSheet['!views'] = [{ state: 'frozen', xSplit: 3, ySplit: 0 }];
    mprSheet['!protect'] = undefined;

    const ledgerData = txs.map(tx => ({
      "Date": tx.date,
      "Acct Code": tx.categories?.export_code || '',
      "Account Name": tx.categories?.name || '',
      "Payee / Source": tx.payee_name || '',
      "Remarks / Ref No": `${tx.receipt_no ? `[${tx.receipt_no}] ` : ''}${tx.remarks || ''}`,
      "Income (Php)": tx.type === 'INCOME' ? Number(tx.amount) : '',
      "Expense (Php)": tx.type === 'EXPENSE' ? Number(tx.amount) : '',
    }));
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, mprSheet, "SCRD Monthly Report");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(ledgerData), "Ledger Details");
    
    XLSX.writeFile(workbook, `ComBud_Report_${periodName.replace(' ', '_')}.xlsx`);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Export Center</h1>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Generate ComBud-compatible Excel reports.</p>
      </div>

      <div className="bento-card max-w-2xl mx-auto mt-10 space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-emerald-50 dark:bg-emerald-950/50 rounded-2xl flex items-center justify-center mb-4 border border-emerald-100 dark:border-emerald-900/50">
            <FileSpreadsheet className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Generate Official ComBud Report</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Downloads the structured SCRD report for the Mission Church.</p>
        </div>

        <div className="space-y-6 border-t border-brand-border dark:border-brand-darkBorder pt-6">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Financial Period</label>
            <select className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-xs font-semibold text-slate-900 dark:text-white shadow-sm focus:border-brand dark:focus:border-emerald-500 focus:ring-1 focus:ring-brand" value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
              {periods.map(p => <option key={p.id} value={p.id}>{p.period_name}</option>)}
            </select>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-start gap-3">
              <Settings className="h-5 w-5 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                  <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} className="rounded text-brand dark:text-emerald-600 focus:ring-brand h-4 w-4" />
                  Smart Export (Hide Empty Rows)
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 ml-6">
                  Automatically eliminates blank fields from the final Excel file, leaving only the accounts that have transactions this month. Uncheck to export the massive blank template.
                </p>
              </div>
            </div>
          </div>

          <button onClick={handleExport} disabled={loading || !selectedPeriod} className="w-full flex justify-center items-center gap-2 py-3.5 px-4 rounded-xl shadow-sm text-xs font-bold text-white bg-brand dark:bg-emerald-700 hover:bg-brand-dark dark:hover:bg-emerald-800 transition-colors">
            <Download className="h-4 w-4" />
            {loading ? 'Generating Excel File...' : 'Download ComBud Export'}
          </button>
        </div>
      </div>
    </div>
  );
}
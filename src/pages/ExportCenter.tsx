// ==========================================
// EXPORT CENTER COMPONENT
// Purpose: Generates ComBud-compatible Excel reports using ExcelJS for precise grid styling.
// ==========================================

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Download, FileSpreadsheet, Settings, AlertTriangle, PieChart } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { FinancialPeriod, MPRReport } from '../types/database.types';

export default function ExportCenter() {
  const { user } = useAuth();
  const [periods, setPeriods] = useState<FinancialPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewTxs, setPreviewTxs] = useState<any[]>([]);
  
  const [hideEmpty, setHideEmpty] = useState(true);
  const [exportFullYear, setExportFullYear] = useState(false);

  const [showUnassignedModal, setShowUnassignedModal] = useState(false);
  const [unassignedCount, setUnassignedCount] = useState(0);

  useEffect(() => {
    if (user) fetchInitialData();
  }, [user]);

  const fetchInitialData = async () => {
    const { data: profile } = await supabase.from('profiles').select('church_id').eq('id', user?.id).single();
    if (profile) {
      const { data: periodData } = await supabase.from('financial_periods').select('*').eq('church_id', profile.church_id).order('month', { ascending: false });
      if (periodData && periodData.length > 0) {
        setPeriods(periodData);
        
        // Cache management so it doesn't reset when switching tabs
        const cached = localStorage.getItem('exportSelectedPeriod');
        if (cached && periodData.some(p => p.id === cached)) {
          setSelectedPeriod(cached);
        } else {
          // INTELLIGENT MONTH SELECTION
          const now = new Date();
          const currentMonthNum = now.getMonth() + 1; // 1-12
          
          const currentOpenPeriod = periodData.find(p => p.month === currentMonthNum && p.status === 'OPEN');
          const fallbackOpenPeriod = periodData.find(p => p.status === 'OPEN');
          
          // Priority: Current Month -> Any Open Month -> First Period in list
          const defaultPeriod = currentOpenPeriod?.id || fallbackOpenPeriod?.id || periodData[0].id;
          
          setSelectedPeriod(defaultPeriod);
          localStorage.setItem('exportSelectedPeriod', defaultPeriod);
        }
      }
    }
  };

  useEffect(() => {
    if (selectedPeriod) {
      localStorage.setItem('exportSelectedPeriod', selectedPeriod);
      fetchPreviewData();
    }
  }, [selectedPeriod]);

  const fetchPreviewData = async () => {
    const { data: txs } = await supabase.from('transactions').select('amount, type, categories(name, export_code)').eq('financial_period_id', selectedPeriod);
    if (txs) setPreviewTxs(txs);
  };

  const previewMetrics = useMemo(() => {
    let inc = 0; let exp = 0;
    const groups: Record<string, number> = {};
    
    previewTxs.forEach(t => {
      const amt = Number(t.amount);
      if (t.type === 'INCOME') inc += amt;
      if (t.type === 'EXPENSE') exp += amt;
      
      const codeName = `[${t.categories?.export_code || '???'}] ${t.categories?.name || 'Unassigned'}`;
      groups[codeName] = (groups[codeName] || 0) + amt;
    });

    const topAccounts = Object.entries(groups).sort((a,b) => b[1] - a[1]);
    return { inc, exp, topAccounts };
  }, [previewTxs]);

  const getMonthShort = (periodName: string) => periodName.split(' ')[0].substring(0,3);

  const generateMPRSheet = (workbook: ExcelJS.Workbook, mpr: MPRReport | null, periodName: string, sheetName: string) => {
    const sheet = workbook.addWorksheet(sheetName);
    sheet.columns = [{ width: 15 }, { width: 45 }, { width: 45 }, { width: 20 }, { width: 15 }];

    sheet.addRow([null, null, null, 'JESUS FIRST CHRISTIAN MINISTRIES']);
    sheet.addRow([null, null, null, 'MONTHLY PROGRESS REPORT']);
    sheet.addRow([]);
    sheet.addRow(['Church', 'JFCM Sapang Lamig', null, null, 'Applicable Month / Year', periodName]);
    sheet.addRow(['P/M', mpr?.pm_name || '', null, null, 'Overseer', mpr?.overseer_name || '']);
    sheet.addRow([]);
    sheet.addRow(['1.0 WORSHIP SERVICE']);
    const headerRow = sheet.addRow(['Date', 'Title & Preacher', 'Objective', 'Text', 'Attendance']);

    sheet.getCell('D1').font = { bold: true };
    sheet.getCell('D2').font = { bold: true };
    sheet.getCell('A7').font = { bold: true };
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    ['A','B','C','D','E'].forEach(col => {
      sheet.getCell(`${col}8`).border = { top: {style:'thin'}, bottom: {style:'thin'}, left: {style:'thin'}, right: {style:'thin'} };
    });

    let r = 9;
    let totalAdults = 0; let totalChildren = 0; let serviceCount = 0;

    const services = mpr?.worship_services || Array.from({ length: 5 }, (_, i) => ({ week: i+1, dateStr: '', title: '', preacher: '', objective: '', text: '', adults: 0, children: 0 }));

    services.forEach(ws => {
      if (ws.adults > 0 || ws.children > 0 || ws.title || ws.preacher) serviceCount++;
      totalAdults += ws.adults; totalChildren += ws.children;

      const titleStr = ws.title?.trim() || '';
      const preacherStr = ws.preacher?.trim() || '';
      let combinedTitlePreacher = titleStr;
      if (preacherStr) combinedTitlePreacher += combinedTitlePreacher ? `\n(${preacherStr})` : `(${preacherStr})`;

      sheet.addRow([ws.dateStr, combinedTitlePreacher, ws.objective, ws.text, ws.adults]);
      sheet.addRow(['', '', '', '', ws.children]);

      sheet.getCell(`B${r}`).alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
      sheet.getCell(`C${r}`).alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
      sheet.getCell(`A${r}`).alignment = { vertical: 'middle', horizontal: 'center' };
      sheet.getCell(`D${r}`).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      sheet.getCell(`E${r}`).alignment = { vertical: 'middle', horizontal: 'center' };
      sheet.getCell(`E${r+1}`).alignment = { vertical: 'middle', horizontal: 'center' };

      sheet.mergeCells(`A${r}:A${r+1}`); sheet.mergeCells(`B${r}:B${r+1}`); sheet.mergeCells(`C${r}:C${r+1}`); sheet.mergeCells(`D${r}:D${r+1}`);

      for (let i = 0; i < 2; i++) {
        ['A','B','C','D','E'].forEach(col => { sheet.getCell(`${col}${r+i}`).border = { top: {style:'thin'}, bottom: {style:'thin'}, left: {style:'thin'}, right: {style:'thin'} }; });
      }
      r += 2;
    });

    const avgAdults = serviceCount > 0 ? Math.round(totalAdults / serviceCount) : 0;
    const avgChildren = serviceCount > 0 ? Math.round(totalChildren / serviceCount) : 0;

    sheet.addRow([null, null, null, 'Average', avgAdults]);
    sheet.addRow([null, null, null, null, avgChildren]);
    sheet.mergeCells(`D${r}:D${r+1}`);
    sheet.getCell(`D${r}`).alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getCell(`E${r}`).alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getCell(`E${r+1}`).alignment = { vertical: 'middle', horizontal: 'center' };

    for (let i = 0; i < 2; i++) {
      ['D','E'].forEach(col => { sheet.getCell(`${col}${r+i}`).border = { top: {style:'thin'}, bottom: {style:'thin'}, left: {style:'thin'}, right: {style:'thin'} }; });
    }
    r += 2;

    sheet.addRow([]); r++;
    sheet.addRow(['2.0 PROJECTS']);
    sheet.getCell(`A${r}`).font = { bold: true }; r++;

    const projs = mpr?.projects || [];
    projs.forEach(p => { sheet.addRow(['', p.type, p.name]); r++; });

    sheet.addRow([]); r++;
    const projHeader = sheet.addRow(['Project Name', null, 'Schedule', 'Actual', null]);
    sheet.mergeCells(`A${r}:B${r}`); sheet.mergeCells(`D${r}:E${r}`);
    projHeader.font = { bold: true };
    sheet.getCell(`A${r}`).alignment = { horizontal: 'center' }; sheet.getCell(`C${r}`).alignment = { horizontal: 'center' }; sheet.getCell(`D${r}`).alignment = { horizontal: 'center' };

    ['A','B','C','D','E'].forEach(col => { sheet.getCell(`${col}${r}`).border = { top: {style:'thin'}, bottom: {style:'thin'}, left: {style:'thin'}, right: {style:'thin'} }; });
    r++;

    projs.forEach(p => {
      sheet.addRow([p.name, '', p.schedule, p.actual, '']);
      sheet.mergeCells(`A${r}:B${r}`); sheet.mergeCells(`D${r}:E${r}`);
      sheet.getCell(`C${r}`).alignment = { wrapText: true, vertical: 'top' }; sheet.getCell(`D${r}`).alignment = { wrapText: true, vertical: 'top' };

      ['A','B','C','D','E'].forEach(col => { sheet.getCell(`${col}${r}`).border = { top: {style:'thin'}, bottom: {style:'thin'}, left: {style:'thin'}, right: {style:'thin'} }; });
      r++;
    });
  };

  const generateSCRDSheet = (workbook: ExcelJS.Workbook, txs: any[], recon: any, periodName: string, sheetName: string) => {
    const sheet = workbook.addWorksheet(sheetName, { views: [{ state: 'frozen', xSplit: 3, ySplit: 3, topLeftCell: 'D4' }] });
    sheet.columns = [{ width: 8 }, { width: 14 }, { width: 50 }, { width: 15 }, { width: 25 }];

    const sums: Record<string, number> = {};
    let totalIncome = 0; let totalExpense = 0;

    txs.forEach(tx => {
      const code = tx.categories?.export_code || 'UNCATEGORIZED';
      const key = `${code}_${tx.type}`;
      sums[key] = (sums[key] || 0) + Number(tx.amount);
      if (tx.type === 'INCOME') totalIncome += Number(tx.amount);
      if (tx.type === 'EXPENSE') totalExpense += Number(tx.amount);
    });

    const getSum = (code: string, type: string) => sums[`${code}_${type}`] || 0;
    const processedKeys = new Set<string>();

    const buildSection = (prefix: string, title: string, type: 'INCOME' | 'EXPENSE', items: any[]) => {
      const rows: any[] = [];
      const activeItems = items.filter(i => !hideEmpty || getSum(i.c, type) !== 0);
      if (activeItems.length > 0 || !hideEmpty) {
        rows.push([null, null, `${prefix} - ${title}`]);
        activeItems.forEach(i => { rows.push([null, i.c, i.n, null, getSum(i.c, type)]); processedKeys.add(`${i.c}_${type}`); });
        rows.push([]); 
      }
      return rows;
    };

    const buildProjectSection = (prefix: string, title: string, items: any[]) => {
      const rows: any[] = []; let hasContent = false; const secRows: any[] = [];
      items.forEach(i => {
        const matches = txs.filter(t => t.categories?.export_code === i.c && t.type === 'EXPENSE');
        if (matches.length > 0) {
          hasContent = true; secRows.push([null, i.c, i.n, null, null]); processedKeys.add(`${i.c}_EXPENSE`);
          matches.forEach(tx => {
            const breakdownMatch = tx.remarks?.match(/\[Breakdown: (.*?)\]/);
            if (breakdownMatch) {
              breakdownMatch[1].split(', ').forEach((pair: string) => {
                const lastColon = pair.lastIndexOf(': ₱');
                if (lastColon !== -1) { secRows.push([null, null, `  - ${pair.substring(0, lastColon).trim()}`, null, parseFloat(pair.substring(lastColon + 3)) || 0]); } 
                else { secRows.push([null, null, `  - ${pair}`, null, Number(tx.amount)]); }
              });
            } else { secRows.push([null, null, `  - ${tx.payee_name || tx.remarks || 'Expense Item'}`, null, Number(tx.amount)]); }
          });
        } else if (!hideEmpty) { hasContent = true; secRows.push([null, i.c, i.n, null, 0]); }
      });
      if (hasContent || !hideEmpty) { rows.push([null, null, `${prefix} - ${title}`]); rows.push(...secRows); rows.push([]); }
      return rows;
    };

    const b1 = [{c: '5011', n: 'Tithes - Local'}, {c: '5015', n: 'Tithes - Foreign'}, {c: '5021', n: 'Offerings - Local'}, {c: '5022', n: 'Offerings - Compassion Fund'}, {c: '5023', n: 'Offerings - Others'}, {c: '5025', n: 'Offerings - Foreign'}, {c: '5031', n: 'Pledges - Local'}, {c: '5032', n: 'Pledges - Foreign'}, {c: '7100', n: 'Interest - Bank Deposit'}, {c: '7300', n: 'Miscellaneous Receipts'}];
    const b2 = [{c: '1115', n: 'Accounts Receivable - Others'}, {c: '1116', n: 'Accounts Receivable - (Name)'}, {c: '1118', n: 'Accounts Receivable - (Name)'}, {c: '1125', n: 'Advances - (Name)'}, {c: '1171', n: 'Rental Deposit (Name)'}, {c: '2017', n: 'Accounts Payable - Others (Name)'}, {c: '2800', n: 'Missions Contribution (1117-A/R)'}, {c: '2805', n: 'Project Fund Contribution'}, {c: '2810', n: 'Subsidy from -'}, {c: '2811', n: 'Support from -'}, {c: '2204', n: 'Expanded Withholding Tax (Name)'}, {c: '2205', n: 'Withholding Tax Payable'}, {c: '2206', n: 'SSS Contribution Payable (EE + ER)'}, {c: '2210', n: 'Phil-Health Contribution Payable (EE + ER)'}, {c: '2215', n: 'Pag-Ibig Fund Contribution Payable (EE + ER)'}, {c: '2220', n: 'SSS Salary Loan Payable'}];
    const c1 = [{c: '6010', n: 'Salaries & Wages'}, {c: '6030', n: 'Love Gift - Personnel'}, {c: '6401', n: 'Love Gift - Missionaries/Workers'}, {c: '6402', n: 'Love Gifts - Others'}, {c: '6403', n: 'Love Gifts - Worship Place'}, {c: '6422', n: 'Compassion Expense'}, {c: '6040', n: 'SSS Premium - ER'}, {c: '6050', n: 'Phil-Health Premium - ER'}, {c: '6060', n: 'Pag-Ibig Fund Premium - ER'}, {c: '6070', n: 'Medical Expense'}, {c: '6105', n: 'Transportation Expense'}, {c: '6210', n: 'Food & Refreshments'}, {c: '6270', n: 'Teaching & Program Materials'}, {c: '6510', n: 'Gasoline & Diesel'}, {c: '6515', n: 'Vehicle Registration'}, {c: '6520', n: 'Repair & Maint. - Transportation Equipment'}, {c: '6691', n: 'Repair & Maint. - Building &/or Fellowship House'}, {c: '6692', n: 'Repair & Maint. - Office Equipment'}, {c: '6693', n: 'Repair & Maint. - Musical Equipment'}, {c: '6694', n: 'Repair & Maint. - Furniture & Fixtures'}, {c: '6695', n: 'Repair & Maint. - Electro/Mechanical Equipment'}, {c: '6710', n: 'Stationeries & Office Equipment Supplies'}, {c: '6715', n: 'Computer Supplies'}, {c: '6720', n: 'Musical Supplies'}, {c: '6730', n: 'Kitchen Supplies'}, {c: '6810', n: 'Rental Expense (gross amount)'}, {c: '6811', n: 'Input Vat-Rent Expense'}, {c: '6910', n: 'Electricity'}, {c: '6920', n: 'Water'}, {c: '6930', n: 'Janitorial & Utility Supplies'}, {c: '6940', n: 'Telephone, Postage & Telegraph'}, {c: '6945', n: 'Internet Expense'}, {c: '6955', n: 'Notarial & Legal Fees'}, {c: '6956', n: 'Technical Fees'}, {c: '6957', n: 'Audit Fees'}, {c: '6971', n: 'Insurance Expense - Bldg'}, {c: '6972', n: 'Insurance Expense - Transport Equipment'}, {c: '6990', n: 'Miscellaneous Expense'}, {c: '7500', n: 'Interest Expense'}, {c: '7600', n: 'Bank Charges'}];
    const c2 = [{c: '1115', n: 'Accounts Receivable - Others'}, {c: '1116', n: 'Accounts Receivable - (Name)'}, {c: '1118', n: 'Accounts Receivable - (Name)'}, {c: '1125', n: 'Advances -'}, {c: '1171', n: 'Rental Deposit'}, {c: '1800', n: 'Missions Contribution -'}, {c: '1805', n: 'Project Fund Contribution -'}, {c: '1810', n: 'Subsidy to Church -'}, {c: '1811', n: 'Support to Church -'}, {c: '2017', n: 'Accounts Payable - Others'}, {c: '2810', n: 'Subsidy from -'}, {c: '2811', n: 'Support from -'}, {c: '2204', n: 'Expanded Withholding Tax'}, {c: '2205', n: 'Withholding Tax Payable'}, {c: '2206', n: 'SSS Contribution Payable (EE + ER)'}, {c: '2210', n: 'Phil-Health Contribution Payable (EE + ER)'}, {c: '2215', n: 'Pag-Ibig Fund Contribution Payable (EE + ER)'}, {c: '2220', n: 'SSS Salary Loan Payable'}];
    const d1 = [{c: '1610', n: 'Land'}, {c: '1619', n: 'Construction in Progress-Bldg/Fhouse'}, {c: '1620', n: 'Building/Fellowship House'}, {c: '1626', n: 'Building/Fellowship House Improvement'}, {c: '1630', n: 'Musical Instruments & Sound System'}, {c: '1640', n: 'Furniture & Fixtures'}, {c: '1650', n: 'Office Equipment'}, {c: '1656', n: 'Electro/Mechanical Equipment'}, {c: '1660', n: 'Transportation Equipment'}, {c: '1670', n: 'Computer System & Software'}];
    const d2 = [{c: '6251', n: 'Doctrination'}, {c: '6252', n: 'Equipping Seminar'}, {c: '6253', n: 'National Consultation'}, {c: '6254', n: 'General Consultation'}, {c: '6261', n: 'Training Seminar (External)'}, {c: '6262', n: 'Pastor/Missionary Education'}];
    const d3 = [{c: '6301', n: 'Feeding Program'}, {c: '6302', n: 'Project Activity (Fund Raising)'}, {c: '6351', n: 'Outdoor Fellowship'}, {c: '6352', n: 'Foundation Day'}, {c: '6353', n: 'Youth Camp'}, {c: '6354', n: 'Christmas Celebration'}, {c: '6355', n: 'Sportsfest'}, {c: '6356', n: 'Retreat'}, {c: '6357', n: 'Anniversary Celebration'}, {c: '6358', n: 'Water Baptism'}, {c: '6359', n: 'Other Special Events'}];

    const begBal = Number(recon?.beginning_balance) || 0;
    const scrdData: any[] = [
      [null, null, null, 'JESUS FIRST CHRISTIAN MINISTRIES INCORPORATED - Sapang Lamig, CSJDB'],
      [null, null, null, 'STATEMENT OF CASH RECEIPTS AND DISBURSEMENTS'],
      [null, null, null, `FOR THE PERIOD ENDED - ${periodName}`],
      [],
      [null, null, 'A. BEGINNING BALANCE', null, begBal],
      [null, null, 'B. CASH RECEIPTS'],
      ...buildSection('B.1', 'Income', 'INCOME', b1),
      ...buildSection('B.2', 'Other Receipts', 'INCOME', b2),
    ];

    Object.keys(sums).forEach((key: string) => {
      const [code, type] = key.split('_');
      if (type === 'INCOME' && !processedKeys.has(key) && sums[key] !== 0) {
        const catName = txs.find((t: any) => t.categories?.export_code === code)?.categories?.name || 'Uncategorized';
        scrdData.push([null, code, `*${catName} (Auto-Appended)`, null, sums[key]]);
      }
    });

    scrdData.push(
      [null, null, 'TOTAL = (A + B)', null, begBal + totalIncome],
      [],
      [null, null, 'C. CASH DISBURSEMENTS'],
      ...buildSection('C.1', 'Operating Expenses', 'EXPENSE', c1),
      ...buildSection('C.2', 'Other Disbursements', 'EXPENSE', c2),
      [null, null, 'D. PROJECT EXPENSES'],
      ...buildProjectSection('D.1', 'Acquisition / Construction', d1),
      ...buildProjectSection('D.2', 'Seminars/Conferences & Education', d2),
      ...buildProjectSection('D.3', 'Special Events', d3),
    );

    Object.keys(sums).forEach((key: string) => {
      const [code, type] = key.split('_');
      if (type === 'EXPENSE' && !processedKeys.has(key) && sums[key] !== 0) {
        const catName = txs.find((t: any) => t.categories?.export_code === code)?.categories?.name || 'Uncategorized';
        scrdData.push([null, code, `*${catName} (Auto-Appended)`, null, sums[key]]);
      }
    });

    const totalCash = (Number(recon?.cib_savings)||0) + (Number(recon?.cib_current)||0) + (Number(recon?.cib_time_deposit)||0) + (Number(recon?.coh_petty_cash)||0) + (Number(recon?.coh_undeposited)||0) + (Number(recon?.coh_advances)||0);

    scrdData.push(
      [null, null, 'TOTAL ENDING BALANCE = (A + B) - (C + D)', null, (begBal + totalIncome) - totalExpense],
      [],
      [null, null, 'CASH BREAKDOWN'],
      [null, '1000', 'CASH IN-BANK'],
      [null, null, 'Savings Account', null, Number(recon?.cib_savings) || 0],
      [null, null, 'Current Account', null, Number(recon?.cib_current) || 0],
      [null, null, 'Time Deposit', null, Number(recon?.cib_time_deposit) || 0],
      [null, '1000', 'CASH ON-HAND'],
      [null, null, 'Petty Cash Fund', null, Number(recon?.coh_petty_cash) || 0],
      [null, null, 'Undeposited Collections', null, Number(recon?.coh_undeposited) || 0],
      [null, null, 'Advances / IOU', null, Number(recon?.coh_advances) || 0],
      [null, null, 'TOTAL = (Cash In-Bank + Cash On-Hand)', null, totalCash],
      [null, null, 'DIFFERENCE', null, ((begBal + totalIncome) - totalExpense) - totalCash]
    );

    const boldLabels = ['A. BEGINNING BALANCE', 'B. CASH RECEIPTS', 'TOTAL = (A + B)', 'C. CASH DISBURSEMENTS', 'D. PROJECT EXPENSES', 'TOTAL ENDING BALANCE = (A + B) - (C + D)', 'CASH BREAKDOWN', 'CASH IN-BANK', 'CASH ON-HAND', 'TOTAL = (Cash In-Bank + Cash On-Hand)', 'DIFFERENCE'];

    scrdData.forEach((rowData: any[]) => {
      const row = sheet.addRow(rowData);
      const hasContent = rowData.some((cell: any) => cell !== null && cell !== '');
      if (hasContent) {
        ['C'].forEach(col => { sheet.getCell(`${col}${row.number}`).alignment = { wrapText: true, vertical: 'middle' }; });
        const cellE = sheet.getCell(`E${row.number}`);
        if (typeof rowData[4] === 'number') { cellE.numFmt = '#,##0.00'; }

        const labelText = String(rowData[2] || '');
        if (boldLabels.includes(labelText) || labelText.startsWith('B.1') || labelText.startsWith('B.2') || labelText.startsWith('C.1') || labelText.startsWith('C.2') || labelText.startsWith('D.1') || labelText.startsWith('D.2') || labelText.startsWith('D.3')) {
          row.font = { bold: true };
        }
      }
    });
    sheet.getCell('D1').font = { bold: true }; sheet.getCell('D2').font = { bold: true };
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'JFCM-SL Stewards System';

      if (exportFullYear) {
        const targetYearId = periods.find(p => p.id === selectedPeriod)?.financial_year_id;
        const targetPeriods = periods.filter(p => p.financial_year_id === targetYearId).sort((a,b) => a.month - b.month);
        
        const scrdGenerators: any[] = [];
        const mprGenerators: any[] = [];

        for (const p of targetPeriods) {
          const { data: txs } = await supabase.from('transactions').select('*, categories(name, export_code, type)').eq('financial_period_id', p.id).order('date', { ascending: true });
          const unassignedItems = (txs || []).filter(tx => !tx.category_id || tx.categories?.export_code === '???');
          if (unassignedItems.length > 0) throw { count: unassignedItems.length, period: p.period_name };

          const { data: mprData } = await supabase.from('mpr_reports').select('*').eq('financial_period_id', p.id).single();
          const monthShort = getMonthShort(p.period_name);

          scrdGenerators.push(() => generateSCRDSheet(workbook, txs || [], p, p.period_name, monthShort));
          mprGenerators.push(() => generateMPRSheet(workbook, mprData, p.period_name, `MPR_${monthShort}`));
        }

        scrdGenerators.forEach(fn => fn()); mprGenerators.forEach(fn => fn());
        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `ComBud_FullYear_Export.xlsx`);

      } else {
        const p = periods.find(x => x.id === selectedPeriod);
        if (p) {
          const { data: txs } = await supabase.from('transactions').select('*, categories(name, export_code, type)').eq('financial_period_id', p.id).order('date', { ascending: true });
          const unassignedItems = (txs || []).filter(tx => !tx.category_id || tx.categories?.export_code === '???');
          if (unassignedItems.length > 0) throw { count: unassignedItems.length, period: p.period_name };

          const { data: mprData } = await supabase.from('mpr_reports').select('*').eq('financial_period_id', p.id).single();
          const monthShort = getMonthShort(p.period_name);
          
          generateSCRDSheet(workbook, txs || [], p, p.period_name, monthShort);
          generateMPRSheet(workbook, mprData, p.period_name, `MPR_${monthShort}`);
          
          const buffer = await workbook.xlsx.writeBuffer();
          saveAs(new Blob([buffer]), `ComBud_${p.period_name.replace(' ', '_')}.xlsx`);
        }
      }
    } catch (err: any) {
      if (err.count) { setUnassignedCount(err.count); setShowUnassignedModal(true); } 
      else alert("Export failed: " + err.message);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Export Center</h1>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Generate perfectly styled ComBud and MPR Excel reports.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-10">
        <div className="bento-card space-y-8 flex flex-col justify-center">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-emerald-50 dark:bg-emerald-950/50 rounded-2xl flex items-center justify-center mb-4 border border-emerald-100 dark:border-emerald-900/50">
              <FileSpreadsheet className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Generate Official Reports</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">Downloads strictly formatted SCRD and MPR spreadsheets exactly matched to ComBud templates.</p>
          </div>

          <div className="space-y-6 border-t border-brand-border dark:border-brand-darkBorder pt-6">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Financial Period / Year Reference</label>
              <select className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-xs font-semibold text-slate-900 dark:text-white shadow-sm focus:border-brand" value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
                {periods.map(p => <option key={p.id} value={p.id}>{p.period_name}</option>)}
              </select>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-start gap-3">
                <Settings className="h-5 w-5 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                    <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} className="rounded text-brand h-4 w-4" />
                    Smart Export (Hide Empty Rows)
                  </label>
                </div>
              </div>
              <div className="flex items-start gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <FileSpreadsheet className="h-5 w-5 text-brand mt-0.5 shrink-0" />
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                    <input type="checkbox" checked={exportFullYear} onChange={(e) => setExportFullYear(e.target.checked)} className="rounded text-brand h-4 w-4" />
                    Export Entire Year (All Months Segregated)
                  </label>
                  <p className="text-[11px] text-slate-500 mt-1 ml-6">Generates a massive workbook containing SCRD and MPR sheets for every month in the selected year.</p>
                </div>
              </div>
            </div>

            <button onClick={handleExport} disabled={loading || !selectedPeriod} className="w-full flex justify-center items-center gap-2 py-3.5 px-4 rounded-xl shadow-sm text-xs font-bold text-white bg-brand dark:bg-emerald-700 hover:bg-brand-dark transition-colors">
              <Download className="h-4 w-4" />
              {loading ? 'Generating Excel Workbook...' : 'Download ComBud & MPR Export'}
            </button>
          </div>
        </div>

        {/* Data Preview Widget */}
        <div className="bento-card bg-slate-50 dark:bg-[#121212] flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-6">
            <PieChart className="h-5 w-5 text-brand dark:text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Export Data Preview</h3>
          </div>
          
          <div className="space-y-4 flex-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Income</p>
                <p className="text-lg font-black text-emerald-600 mt-1">₱{previewMetrics.inc.toLocaleString('en-PH', {minimumFractionDigits:2})}</p>
              </div>
              <div className="p-4 bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Expense</p>
                <p className="text-lg font-black text-amber-600 mt-1">₱{previewMetrics.exp.toLocaleString('en-PH', {minimumFractionDigits:2})}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">All Populated Accounts (Preview)</p>
              <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                {previewMetrics.topAccounts.length > 0 ? previewMetrics.topAccounts.map(([name, amount], i) => (
                  <div key={i} className="flex justify-between items-center text-xs pb-2 border-b border-slate-100 dark:border-slate-800/60 last:border-0 last:pb-0">
                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[280px]">{name}</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">₱{amount.toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>
                  </div>
                )) : <p className="text-xs text-slate-400 italic">No transactions recorded for this period yet.</p>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showUnassignedModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#27272A] rounded-3xl p-8 shadow-2xl space-y-6 text-center animate-modal">
            <div className="mx-auto h-16 w-16 bg-amber-100 dark:bg-amber-950/60 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400 animate-bounce"><AlertTriangle className="h-8 w-8" /></div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Export Blocked</h3>
              <p className="text-xs text-slate-500">Found <strong className="text-amber-600 dark:text-amber-400">{unassignedCount} unassigned transaction(s)</strong>. They must be categorized before export.</p>
            </div>
            <button onClick={() => setShowUnassignedModal(false)} className="w-full py-3 bg-brand dark:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md hover:bg-brand-dark transition-all">Acknowledge</button>
          </div>
        </div>
      )}
    </div>
  );
}
import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  UploadCloud, FileSpreadsheet, Database, CheckCircle2, AlertCircle, Plus, 
  Loader2, Calendar, ChevronDown, Scale, X, Trash2, ChevronRight, ArrowLeft 
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Transaction, FinancialPeriod, Category } from '../types/database.types';
import TransactionDetailModal from '../components/TransactionDetailModal';

type EnrichedTransaction = Transaction & { 
  categories?: Category | null;
  profiles?: { full_name: string } | null; 
  updated_by_profile?: { full_name: string } | null;
};

type ExcelRecord = {
  id: string; day: string; amount: number; remarks: string; type: 'INCOME' | 'EXPENSE'; accountName: string;
};

type SummaryRow = {
  id: string;
  accountKey: string;
  categoryName: string;
  type: 'INCOME' | 'EXPENSE';
  sysTotal: number;
  exTotal: number;
  sysCount: number;
  exCount: number;
  variance: number;
  dbCategoryIds: string[];
  /** Original ComBud buckets included in this category-level reconciliation. */
  excelKeys: string[];
};

const SHEET_MONTH_MAP: Record<number, string> = {
  1: 'Jan', 2: 'Feb', 3: 'March', 4: 'April', 5: 'May', 6: 'June', 7: 'July', 8: 'August', 9: 'Sept', 10: 'Oct', 11: 'Nov', 12: 'Dec'
};

// ComBud headings are exact aliases, not fuzzy matches. Normalize only harmless
// formatting differences (case, spaces, underscores, and hyphens).
const normalizeComBudLabel = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

const normalizeStructuralToken = (value: unknown): string =>
  normalizeComBudLabel(value).replace(/[^a-z0-9]/g, '');

const COMBUD_HEADER_ALIASES: Record<string, string> = {
  'tithes': 'Tithes',
  'tithes local': 'Tithes',
  'o local': 'O_Local',
  'o others': 'O_Others',
  'pledges': 'Pledges',
  'pledges local': 'Pledges',
  'food': 'Food expenses',
  'food expense': 'Food expenses',
  'food expenses': 'Food expenses',
  'compassion': 'Compassion',
};

const COMBUD_EXPORT_CODE_BY_LABEL: Record<string, string> = {
  'tithes': '5011',
  'o local': '5021',
  'o others': '5023',
  'pledges': '5031',
  'food expenses': '6210',
  'compassion': '6422',
};

const COMBUD_EXPECTED_TYPE_BY_LABEL: Record<string, 'INCOME' | 'EXPENSE'> = {
  'tithes': 'INCOME',
  'o local': 'INCOME',
  'o others': 'INCOME',
  'pledges': 'INCOME',
  'food expenses': 'EXPENSE',
  'compassion': 'EXPENSE',
};

const COMBUD_KNOWN_ALIAS_CODES = new Set(Object.values(COMBUD_EXPORT_CODE_BY_LABEL));

const parseComBudMoney = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;

  let text = value.trim();
  if (!text) return null;
  const isAccountingNegative = /^\(.*\)$/.test(text);
  text = text
    // Excel and legacy remarks may use ₱, P, Php/PhP, or no currency marker.
    .replace(/[₱$]/g, '')
    .replace(/^(?:php|p)\s*/i, '')
    .replace(/,/g, '')
    .replace(/\s+/g, '')
    .replace(/^\((.*)\)$/, '$1');

  if (!/^-?\d+(?:\.\d+)?$/.test(text)) return null;
  const amount = Number(text) * (isAccountingNegative ? -1 : 1);
  return Number.isFinite(amount) ? amount : null;
};

const toCents = (value: unknown): number => {
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
};

const formatCentsAsAmount = (cents: number): number => cents / 100;

const MONTH_NUMBER_BY_ALIAS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

/** A calendar date explicitly written in a transaction remark/breakdown. */
type EventDateClue = { month: number; day: number; year?: number };

/**
 * Extracts explicit month/day dates from free-form text. Audit timestamps such as
 * "encoded Oct.11" are ignored because they describe entry time, not event time.
 */
const extractEventDateClues = (value: unknown): EventDateClue[] => {
  const text = String(value ?? '');
  const lower = text.toLowerCase();
  const clues: EventDateClue[] = [];
  const auditPrefix = /\b(encoded|entered|logged|created|recorded|updated|saved|inputted)\s*(?:(?:on|at|date)\s*)?$/i;
  const isAuditDate = (index: number) =>
    auditPrefix.test(lower.slice(Math.max(0, index - 32), index).trim());

  const namedDatePattern = /\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\.?\s*[-/. ]?\s*(\d{1,2})(?:st|nd|rd|th)?(?:,\s*((?:19|20)\d{2}))?\b/gi;
  for (const match of text.matchAll(namedDatePattern)) {
    const index = match.index ?? 0;
    if (isAuditDate(index)) continue;
    const month = MONTH_NUMBER_BY_ALIAS[match[1].toLowerCase()];
    const day = Number(match[2]);
    const year = match[3] ? Number(match[3]) : undefined;
    if (month && Number.isInteger(day) && day >= 1 && day <= 31) {
      clues.push({ month, day, ...(year ? { year } : {}) });
    }
  }

  // MM/DD, MM-DD, MM/DD/YY, and MM/DD/YYYY formats.
  const numericDatePattern = /\b(0?[1-9]|1[0-2])[/-](0?[1-9]|[12]\d|3[01])(?:[/-](\d{2}|(?:19|20)\d{2}))?\b/g;
  for (const match of text.matchAll(numericDatePattern)) {
    const index = match.index ?? 0;
    if (isAuditDate(index)) continue;
    const month = Number(match[1]);
    const day = Number(match[2]);
    const rawYear = match[3];
    const year = rawYear ? (rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear)) : undefined;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      clues.push({ month, day, ...(year ? { year } : {}) });
    }
  }

  // De-duplicate dates that can be found in overlapping formats.
  const unique = new Map<string, EventDateClue>();
  for (const clue of clues) unique.set(`${clue.month}-${clue.day}-${clue.year ?? ''}`, clue);
  return [...unique.values()];
};

/**
 * Finds event-day clues for the selected ComBud sheet. If a full calendar date is
 * present but belongs to a different month, do not reinterpret it as an unqualified
 * "Day X" clue. Day-only labels remain valid because the selected sheet supplies month.
 */
const extractEventDaysForMonth = (value: unknown, targetMonth: number): Set<number> => {
  const text = String(value ?? '');
  const calendarClues = extractEventDateClues(text);
  const days = new Set<number>();

  for (const clue of calendarClues) {
    if (clue.month === targetMonth) days.add(clue.day);
  }

  if (calendarClues.length === 0) {
    const labeledDayPattern = /\bday\s*#?\s*(\d{1,2})\b/gi;
    for (const match of text.matchAll(labeledDayPattern)) {
      const day = Number(match[1]);
      if (Number.isInteger(day) && day >= 1 && day <= 31) days.add(day);
    }
  }

  return days;
};

type BreakdownItem = { name: string; amountCents: number };

const parseTransactionBreakdown = (remarks: unknown): BreakdownItem[] => {
  const text = String(remarks ?? '');
  // Accept inconsistent spacing/case in legacy remarks and use the last breakdown block.
  const markers = [...text.matchAll(/\[\s*breakdown\s*:/gi)];
  const marker = markers[markers.length - 1];
  if (!marker || marker.index === undefined) return [];

  const bodyStart = marker.index + marker[0].length;
  const closingBracket = text.indexOf(']', bodyStart);
  const body = text.slice(bodyStart, closingBracket >= 0 ? closingBracket : text.length);
  const items: BreakdownItem[] = [];

  // Currency marker is optional and case-insensitive: ₱490, P490, Php 490,
  // PhP 490, or plain 490. The comma separators are the app's item delimiters.
  const itemPattern = /(?:^|,\s*)([^,:]+?)\s*:\s*(?:(?:₱|php|p)\s*)?(-?\d[\d,]*(?:\.\d{1,2})?)(?=\s*(?:,|$))/gi;
  for (const itemMatch of body.matchAll(itemPattern)) {
    const amount = parseComBudMoney(itemMatch[2]);
    const name = itemMatch[1].trim();
    if (amount === null || !name) continue;
    items.push({ name, amountCents: toCents(amount) });
  }

  return items;
};

const getComBudAccountCode = (value: unknown): string | null => {
  if (value === null || value === undefined || typeof value === 'boolean') return null;
  const text = String(value).trim();
  return /^\d{4}$/.test(text) ? text : null;
};

const isComBudFooterLabel = (value: unknown): boolean => {
  const token = normalizeStructuralToken(value);
  if (!token) return false;
  return (
    token.includes('attendance') ||
    token.includes('subtotal') ||
    token.includes('overallcollection') ||
    token === 'total' ||
    token.includes('beginningbalance') ||
    token.includes('balance') ||
    (token.includes('worshipplace') && token.includes('deduction'))
  );
};

const isComBudRemark = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || parseComBudMoney(trimmed) !== null) return false;
  if (isComBudFooterLabel(trimmed)) return false;
  const token = normalizeComBudLabel(trimmed);
  return !['adult', 'children', 'child', 'kids', 'average', 'regular expenses', 'expenses'].includes(token);
};

export default function Reconciliation() {
  const { user } = useAuth();
  const [churchId, setChurchId] = useState<string>('');
  
  const [periods, setPeriods] = useState<FinancialPeriod[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dbTransactions, setDbTransactions] = useState<EnrichedTransaction[]>([]);
  const [selectedPeriodFilter, setSelectedPeriodFilter] = useState<string>('');
  
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [parsedData, setParsedData] = useState<Record<string, ExcelRecord[]>>({});
  
  const [selectedSummary, setSelectedSummary] = useState<SummaryRow | null>(null);
  const [isInserting, setIsInserting] = useState<string | null>(null); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [viewingTx, setViewingTx] = useState<EnrichedTransaction | null>(null);

  useEffect(() => { if (user) fetchInitialData(); }, [user]);

  useEffect(() => {
    if (selectedPeriodFilter && churchId) fetchDbTransactions();
    if (selectedPeriodFilter && workbook) {
      processWorkbookSheet(workbook, selectedPeriodFilter);
      setSelectedSummary(null);
    }
  }, [selectedPeriodFilter, churchId]);

  const fetchInitialData = async () => {
    const { data: profile } = await supabase.from('profiles').select('church_id').eq('id', user?.id).single();
    if (profile) {
      setChurchId(profile.church_id);
      const [periodRes, catRes] = await Promise.all([
        supabase.from('financial_periods').select('*').eq('church_id', profile.church_id).order('month', { ascending: true }),
        supabase.from('categories').select('*').eq('church_id', profile.church_id)
      ]);

      if (periodRes.data) {
        setPeriods(periodRes.data);
        const cachedPeriod = localStorage.getItem('selectedPeriodFilter');
        if (cachedPeriod && periodRes.data.some(p => p.id === cachedPeriod)) {
          setSelectedPeriodFilter(cachedPeriod);
        } else {
          const openPeriod = periodRes.data.find(p => p.status === 'OPEN') || periodRes.data[0];
          if (openPeriod) {
            setSelectedPeriodFilter(openPeriod.id);
            localStorage.setItem('selectedPeriodFilter', openPeriod.id);
          }
        }
      }
      if (catRes.data) setCategories(catRes.data);
    }
  };

  const handlePeriodChange = (val: string) => {
    setSelectedPeriodFilter(val);
    localStorage.setItem('selectedPeriodFilter', val); 
  };

  const fetchDbTransactions = async () => {
    const { data } = await supabase.from('transactions').select('*, categories(*)').eq('church_id', churchId).eq('financial_period_id', selectedPeriodFilter);
    if (data) setDbTransactions(data as unknown as EnrichedTransaction[]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setFileName(file.name);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      setWorkbook(wb);
      if (selectedPeriodFilter) processWorkbookSheet(wb, selectedPeriodFilter);
    } catch (error) {
      alert("Failed to read the Excel file.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const clearFile = () => {
    setFileName(null); setWorkbook(null); setParsedData({}); setSelectedSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ----------------------------------------------------------------------
  // 1. COMBUD PARSER: HEADER-ANCHORED INCOME + VALIDATED EXPENSE BOUNDING BOX
  // ----------------------------------------------------------------------
  const processWorkbookSheet = (wb: XLSX.WorkBook, periodId: string) => {
    const period = periods.find(p => p.id === periodId);
    if (!period) {
      setParsedData({});
      return;
    }

    const targetSheetName = SHEET_MONTH_MAP[period.month];
    if (!targetSheetName || !wb.SheetNames.includes(targetSheetName)) {
      setParsedData({});
      return;
    }

    const worksheet = wb.Sheets[targetSheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: null,
      raw: true,
      blankrows: true,
    });
    const maxColumns = rows.reduce((max, row) => Math.max(max, row?.length ?? 0), 0);
    const extractedRecords: Record<string, ExcelRecord[]> = {};

    const ensureBucket = (key: string): ExcelRecord[] => {
      if (!extractedRecords[key]) extractedRecords[key] = [];
      return extractedRecords[key];
    };

    const isDayColumnKillSwitch = (value: unknown): boolean => {
      if (typeof value !== 'string') return false;
      return isComBudFooterLabel(value);
    };

    const isBlankCell = (value: unknown): boolean =>
      value === null || value === undefined || String(value).trim() === '';

    const hasFooterInExpenseArea = (row: unknown[], startCol: number): boolean =>
      row.slice(startCol, Math.min(row.length, startCol + 8)).some(cell => isComBudFooterLabel(cell));

    const isAccountName = (value: unknown): value is string => {
      if (typeof value !== 'string') return false;
      const label = value.trim();
      if (!label || label.toLowerCase() === 'x') return false;
      if (isComBudFooterLabel(label)) return false;
      if (['regular expenses', 'expenses'].includes(normalizeComBudLabel(label))) return false;
      return true;
    };

    const findAmount = (
      row: unknown[],
      firstColumn: number,
      lastColumn: number,
    ): { amount: number; column: number } | null => {
      // The amount may be separated from the account name by blanks or an X marker.
      // Do not search indefinitely: attendance/date columns are outside this window.
      for (let col = firstColumn; col <= Math.min(lastColumn, row.length - 1); col++) {
        const amount = parseComBudMoney(row[col]);
        if (amount !== null && Math.abs(amount) > 0) return { amount, column: col };
      }
      return null;
    };

    const findRemark = (rowIndex: number, amountColumn: number): string => {
      const row = rows[rowIndex] ?? [];
      // Remarks are most often in the cell immediately right of the amount.
      for (let col = amountColumn + 1; col <= Math.min(amountColumn + 2, row.length - 1); col++) {
        if (isComBudRemark(row[col])) return String(row[col]).trim();
      }
      // Some print-layout remarks are placed directly underneath the amount.
      const belowRow = rows[rowIndex + 1] ?? [];
      const belowCodeCell = belowRow[0];
      if (
        belowRow.length > amountColumn &&
        isComBudRemark(belowRow[amountColumn])
      ) {
        return String(belowRow[amountColumn]).trim();
      }
      return '--';
    };

    // A. Locate the first usable Tithes header within the first 20 rows.
    let headerRowIdx = -1;
    const incomeCols: Array<{ idx: number; name: string; normalized: string }> = [];
    for (let rowIndex = 0; rowIndex < Math.min(20, rows.length); rowIndex++) {
      const row = rows[rowIndex] ?? [];
      const hasTithes = row.some(cell => COMBUD_HEADER_ALIASES[normalizeComBudLabel(cell)] === 'Tithes');
      if (!hasTithes) continue;

      headerRowIdx = rowIndex;
      row.forEach((cell, idx) => {
        if (typeof cell !== 'string') return;
        const normalized = normalizeComBudLabel(cell);
        const canonicalName = COMBUD_HEADER_ALIASES[normalized];
        if (!canonicalName) return;
        // Duplicate labels in a header row are not expected, but keep each real column.
        incomeCols.push({ idx, name: canonicalName, normalized });
        ensureBucket(canonicalName);
      });
      break;
    }

    // A few legacy months omit the text "Sub-total" in column A. Detect those
    // rows by checking whether most populated account cells repeat the running totals
    // accumulated above them. This avoids mistaking a day-less transaction continuation
    // (which can contain several amounts) for a printed subtotal.
    const findIncomeBoundaryRow = (): number => {
      if (headerRowIdx === -1 || incomeCols.length === 0) return -1;
      const runningCentsByColumn = new Map<number, number>();

      for (let rowIndex = headerRowIdx + 1; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex] ?? [];
        if (isDayColumnKillSwitch(row[0])) return rowIndex;

        const populated = incomeCols.flatMap(col => {
          const amount = parseComBudMoney(row[col.idx]);
          return amount !== null && amount !== 0 ? [{ idx: col.idx, amount }] : [];
        });

        if (rowIndex >= headerRowIdx + 5 && isBlankCell(row[0]) && populated.length >= 4) {
          const repeatingTotals = populated.filter(({ idx, amount }) => {
            const runningCents = runningCentsByColumn.get(idx) ?? 0;
            return runningCents !== 0 && runningCents === toCents(amount);
          }).length;
          if (repeatingTotals >= Math.ceil(populated.length * 0.6)) return rowIndex;
        }

        for (const { idx, amount } of populated) {
          runningCentsByColumn.set(idx, (runningCentsByColumn.get(idx) ?? 0) + toCents(amount));
        }
      }
      return -1;
    };
    const incomeBoundaryRowIdx = findIncomeBoundaryRow();

    const isIncomeBoundaryRow = (rowIndex: number): boolean =>
      rowIndex >= 0 && (rowIndex === incomeBoundaryRowIdx);

    // B. Income scanning is bounded by the Day column and a validated subtotal row.
    if (headerRowIdx !== -1 && incomeCols.length > 0) {
      let currentDay = '--';
      for (let rowIndex = headerRowIdx + 1; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex] ?? [];
        const dayCell = row[0];
        if (isDayColumnKillSwitch(dayCell) || isIncomeBoundaryRow(rowIndex)) break;

        if (dayCell !== null && dayCell !== undefined && String(dayCell).trim() !== '') {
          const dayText = String(dayCell).trim();
          // Only carry a plausible day number/date label forward; numeric Excel dates
          // and arbitrary text must not become a transaction day.
          const dayNumber = Number(dayText);
          if (Number.isInteger(dayNumber) && dayNumber >= 1 && dayNumber <= 31) {
            currentDay = dayText;
          } else if (typeof dayCell === 'string' && /^day\s*\d{1,2}$/i.test(dayText)) {
            currentDay = dayText.replace(/^day\s*/i, '');
          }
        }

        for (const col of incomeCols) {
          const amount = parseComBudMoney(row[col.idx]);
          if (amount === null || amount === 0) continue;

          const key = col.name;
          const bucket = ensureBucket(key);
          bucket.push({
            id: `inc-${rowIndex}-${col.idx}`,
            day: currentDay,
            amount,
            remarks: findRemark(rowIndex, col.idx),
            // The true DB type is assigned later using the strict export-code map.
            type: 'INCOME',
            accountName: key,
          });
        }
      }
    }

    // C. Find the expense code column structurally instead of relying on 6403/6910
    // being the first codes. A candidate column must contain repeated 4-digit codes
    // with a readable account name immediately to the right, to the right of income.
    if (headerRowIdx !== -1 && incomeCols.length > 0 && maxColumns > 1) {
      const lastIncomeCol = Math.max(...incomeCols.map(col => col.idx));
      const scoreByColumn = new Map<number, number>();
      const firstIncomeFooterRow = incomeBoundaryRowIdx;
      const scanEnd = firstIncomeFooterRow >= 0 ? firstIncomeFooterRow : rows.length;

      for (let rowIndex = 0; rowIndex < scanEnd; rowIndex++) {
        const row = rows[rowIndex] ?? [];
        for (let col = lastIncomeCol + 1; col < Math.min(maxColumns - 1, row.length); col++) {
          const code = getComBudAccountCode(row[col]);
          if (!code || !isAccountName(row[col + 1])) continue;
          scoreByColumn.set(col, (scoreByColumn.get(col) ?? 0) + 1);
        }
      }

      const rankedColumns = [...scoreByColumn.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
      const expCodeCol = rankedColumns[0]?.[0] ?? -1;
      const expNameCol = expCodeCol + 1;

      if (expCodeCol !== -1) {
        const isValidExpenseRow = (rowIndex: number): boolean => {
          const row = rows[rowIndex] ?? [];
          return !!getComBudAccountCode(row[expCodeCol]) && isAccountName(row[expNameCol]);
        };
        const firstExpenseRow = rows.findIndex((_row, rowIndex) => isValidExpenseRow(rowIndex));
        let activeExpense: { key: string; code: string; name: string } | null = null;

        if (firstExpenseRow >= 0) {
          for (let rowIndex = firstExpenseRow; rowIndex < rows.length; rowIndex++) {
            const row = rows[rowIndex] ?? [];
            // These labels are hard boundaries. In the attached workbook some months
            // have a single blank code cell between valid expense rows, so blank-cell
            // termination is confirmed with a short look-ahead before stopping.
            if (isDayColumnKillSwitch(row[0]) || hasFooterInExpenseArea(row, expCodeCol)) break;

            const code = getComBudAccountCode(row[expCodeCol]);
            const nameValue = row[expNameCol];
            if (code && isAccountName(nameValue)) {
              const name = nameValue.trim();
              const key = `[${code}] ${name}`;
              ensureBucket(key);
              activeExpense = { key, code, name };

              const amountCell = findAmount(row, expNameCol + 1, expNameCol + 4);
              if (amountCell) {
                ensureBucket(key).push({
                  id: `exp-${rowIndex}-${expCodeCol}-${amountCell.column}`,
                  day: '--',
                  amount: amountCell.amount,
                  remarks: findRemark(rowIndex, amountCell.column),
                  type: 'EXPENSE',
                  accountName: key,
                });
              }
              continue;
            }

            // Do not let an isolated blank code row trigger data loss when a valid
            // account resumes immediately below. Only inspect at most two rows ahead.
            const nextValidCodeRow = [rowIndex + 1, rowIndex + 2].find(
              candidate => candidate < rows.length && isValidExpenseRow(candidate)
            );
            if (nextValidCodeRow === undefined) break;

            // Some ComBud rows put a second amount/remark under the preceding account
            // without repeating the account code. Capture it only inside this one/two-row
            // gap and inside the same bounded amount columns.
            if (activeExpense) {
              const continuationAmount = findAmount(row, expNameCol + 1, expNameCol + 4);
              if (continuationAmount) {
                ensureBucket(activeExpense.key).push({
                  id: `exp-cont-${rowIndex}-${expCodeCol}-${continuationAmount.column}`,
                  day: '--',
                  amount: continuationAmount.amount,
                  remarks: findRemark(rowIndex, continuationAmount.column),
                  type: 'EXPENSE',
                  accountName: activeExpense.key,
                });
              }
            }
          }
        }
      }
    }

    setParsedData(extractedRecords);
  };

  // ----------------------------------------------------------------------
  // 2. MASTER SUMMARY: STRICT ACCOUNT CODES + CATEGORY-LEVEL AGGREGATION
  // ----------------------------------------------------------------------
  const summaryData = useMemo(() => {
    type SourceEntry = { key: string; records: ExcelRecord[]; category: Category | undefined };
    type WorkingSummary = {
      id: string;
      accountKey: string;
      categoryName: string;
      type: 'INCOME' | 'EXPENSE';
      category?: Category;
      dbCategoryIds: string[];
      excelKeys: string[];
      excelRecords: ExcelRecord[];
    };

    const categoryByCodeAndType = (code: string, type?: 'INCOME' | 'EXPENSE'): Category | undefined =>
      categories.find(category =>
        String(category.export_code ?? '').trim() === code && (!type || category.type === type)
      );

    const resolveCategory = (excelKey: string): Category | undefined => {
      // The right-hand expense block is matched only by its exact 4-digit code.
      const expenseCode = excelKey.match(/^\[(\d{4})\]/)?.[1];
      if (expenseCode) return categoryByCodeAndType(expenseCode, 'EXPENSE');

      const normalized = normalizeComBudLabel(excelKey);
      const mappedCode = COMBUD_EXPORT_CODE_BY_LABEL[normalized];
      if (mappedCode) {
        const requiredType = COMBUD_EXPECTED_TYPE_BY_LABEL[normalized];
        return categoryByCodeAndType(mappedCode, requiredType);
      }

      // No fuzzy includes()/substring fallback: unmapped labels must not silently
      // collapse onto a similarly named account.
      return categories.find(category => normalizeComBudLabel(category.name) === normalized);
    };

    const sources: SourceEntry[] = Object.entries(parsedData).map(([key, records]) => ({
      key,
      records,
      category: resolveCategory(key),
    }));

    // A few ComBud months print the same expense twice: itemized on the left and as
    // a single total in the right expense block. If their exact cents totals agree,
    // keep the more detailed source rather than double-counting the same account.
    const suppressedSourceKeys = new Set<string>();
    for (const source of sources) {
      if (!source.category || source.key.startsWith('[') || source.records.length === 0) continue;
      const sourceTotalCents = source.records.reduce((sum, record) => sum + toCents(record.amount), 0);
      const matchingExpenseSource = sources.find(candidate =>
        candidate.category?.id === source.category?.id &&
        candidate.key.startsWith('[') &&
        candidate.records.length > 0 &&
        candidate.records.reduce((sum, record) => sum + toCents(record.amount), 0) === sourceTotalCents
      );
      if (!matchingExpenseSource) continue;

      // Prefer the itemized/non-code-column source; on equal counts it remains the
      // source because the alias mapping explicitly identifies that ComBud column.
      if (source.records.length >= matchingExpenseSource.records.length) {
        suppressedSourceKeys.add(matchingExpenseSource.key);
      } else {
        suppressedSourceKeys.add(source.key);
      }
    }

    const working = new Map<string, WorkingSummary>();
    const getOrCreateSummary = (category?: Category, fallbackKey?: string): WorkingSummary => {
      const mapKey = category ? `category:${category.id}` : `unmapped:${fallbackKey ?? 'unknown'}`;
      let item = working.get(mapKey);
      if (!item) {
        const displayName = category?.name ?? fallbackKey ?? 'Unmapped ComBud account';
        item = {
          id: mapKey,
          accountKey: displayName,
          categoryName: displayName,
          type: category?.type === 'EXPENSE' ? 'EXPENSE' : category?.type === 'INCOME' ? 'INCOME' : (fallbackKey?.startsWith('[') ? 'EXPENSE' : 'INCOME'),
          category,
          dbCategoryIds: category ? [category.id] : [],
          excelKeys: [],
          excelRecords: [],
        };
        working.set(mapKey, item);
      }
      return item;
    };

    for (const source of sources) {
      if (suppressedSourceKeys.has(source.key)) continue;
      // Keep an empty mapped source if DB records exist, so missing-in-Excel records
      // can still be shown in the detail view.
      const item = getOrCreateSummary(source.category, source.key);
      item.excelKeys.push(source.key);
      item.excelRecords.push(...source.records);
    }

    // Include database categories with transactions even if the selected report has
    // no corresponding header/account row. This is what makes DB-only discrepancies visible.
    for (const category of categories) {
      const matchingTransactions = dbTransactions.filter(transaction => transaction.category_id === category.id);
      if (matchingTransactions.length === 0) continue;
      if (category.export_code && COMBUD_KNOWN_ALIAS_CODES.has(String(category.export_code).trim())) {
        getOrCreateSummary(category);
        continue;
      }
      // Non-alias categories are relevant when their account code appeared in this sheet.
      const codeAppearsInSheet = sources.some(source => {
        const code = source.key.match(/^\[(\d{4})\]/)?.[1];
        return !!code && code === String(category.export_code ?? '').trim();
      });
      if (codeAppearsInSheet) getOrCreateSummary(category);
    }

    const result: SummaryRow[] = [];
    for (const item of working.values()) {
      const matchingDbTxs = item.category
        ? dbTransactions.filter(transaction => transaction.category_id === item.category!.id)
        : [];
      const sysTotalCents = matchingDbTxs.reduce((sum, transaction) => sum + toCents(transaction.amount), 0);
      const exTotalCents = item.excelRecords.reduce((sum, record) => sum + toCents(record.amount), 0);

      if (matchingDbTxs.length === 0 && item.excelRecords.length === 0) continue;
      result.push({
        id: item.id,
        accountKey: item.accountKey,
        categoryName: item.categoryName,
        type: item.type,
        sysTotal: formatCentsAsAmount(sysTotalCents),
        exTotal: formatCentsAsAmount(exTotalCents),
        sysCount: matchingDbTxs.length,
        exCount: item.excelRecords.length,
        variance: formatCentsAsAmount(exTotalCents - sysTotalCents),
        dbCategoryIds: item.dbCategoryIds,
        excelKeys: [...new Set(item.excelKeys)],
      });
    }

    return result.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'INCOME' ? -1 : 1;
      return a.accountKey.localeCompare(b.accountKey);
    });
  }, [parsedData, dbTransactions, categories]);

  // ----------------------------------------------------------------------
  // 3. DETAILED LEDGER MATCHING
  // ----------------------------------------------------------------------
  const detailData = useMemo(() => {
    if (!selectedSummary) return null;

    const activePeriod = periods.find(period => period.id === selectedPeriodFilter);
    const targetMonth = activePeriod?.month ?? 0;
    let dbPool = dbTransactions.filter(tx => tx.category_id && selectedSummary.dbCategoryIds.includes(tx.category_id));
    let exPool = selectedSummary.excelKeys.flatMap(key => parsedData[key] || []);

    type ExactMatch = { dbTx: EnrichedTransaction; excelTx: ExcelRecord };
    type GroupMatch = {
      id: string;
      dbTxs: EnrichedTransaction[];
      excelTxs: ExcelRecord[];
      label: string;
      reason: string;
    };

    const exactMatches: ExactMatch[] = [];
    const groupMatches: GroupMatch[] = [];

    const getExcelDay = (record: ExcelRecord): number | null => {
      const day = Number(String(record.day ?? '').replace(/\D/g, ''));
      return Number.isInteger(day) && day >= 1 && day <= 31 ? day : null;
    };

    const getStoredDateDay = (tx: EnrichedTransaction): number | null => {
      const dateText = String(tx.date ?? '');
      const iso = dateText.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) {
        const month = Number(iso[2]);
        const day = Number(iso[3]);
        return (!targetMonth || month === targetMonth) && day >= 1 && day <= 31 ? day : null;
      }
      const parsedDate = new Date(dateText);
      if (!Number.isNaN(parsedDate.getTime())) {
        const month = parsedDate.getMonth() + 1;
        const day = parsedDate.getDate();
        return (!targetMonth || month === targetMonth) && day >= 1 && day <= 31 ? day : null;
      }
      return null;
    };

    const getTransactionDayScore = (tx: EnrichedTransaction, excelTx: ExcelRecord): { score: number; evidence: boolean } => {
      const excelDay = getExcelDay(excelTx);
      if (!excelDay || !targetMonth) return { score: 0, evidence: false };

      // Search both free-form remarks and their generated [Breakdown: ...] content.
      const text = `${tx.remarks ?? ''} ${tx.payee_name ?? ''}`;
      const remarkDays = extractEventDaysForMonth(text, targetMonth);
      let score = 0;
      let evidence = false;

      if (remarkDays.has(excelDay)) {
        score += 100;
        evidence = true;
      } else if (remarkDays.size > 0) {
        // An explicit different event date is weaker evidence for this Excel day.
        score -= 20;
      }

      // The stored transaction date is a useful clue, but never overrides a date
      // explicitly mentioned in remarks. Some older entries were encoded on another day.
      const storedDay = getStoredDateDay(tx);
      if (storedDay === excelDay) {
        score += 25;
        evidence = true;
      }

      return { score, evidence };
    };

    const getExcelToTransactionScore = (excelTx: ExcelRecord, tx: EnrichedTransaction): { score: number; evidence: boolean } => {
      const excelDay = getExcelDay(excelTx);
      if (!excelDay || !targetMonth) return { score: 0, evidence: false };

      const text = `${tx.remarks ?? ''} ${tx.payee_name ?? ''}`;
      const transactionDays = extractEventDaysForMonth(text, targetMonth);
      let score = 0;
      let evidence = false;

      if (transactionDays.has(excelDay)) {
        score += 100;
        evidence = true;
      }
      const storedDay = getStoredDateDay(tx);
      if (storedDay === excelDay) {
        score += 25;
        evidence = true;
      }

      const remark = normalizeStructuralToken(excelTx.remarks);
      if (remark && remark !== normalizeStructuralToken('--')) {
        const breakdownItems = parseTransactionBreakdown(tx.remarks);
        const nameMatch = breakdownItems.some(item => {
          const nameToken = normalizeStructuralToken(item.name);
          return nameToken.length >= 4 && (remark.includes(nameToken) || nameToken.includes(remark));
        });
        if (nameMatch) {
          score += 15;
          evidence = true;
        }
      }

      return { score, evidence };
    };

    /**
     * Amount-subset search for a printed daily total represented by multiple
     * system transactions (or vice versa). Values are stored in integer cents.
     * The evidence flag prevents a coincidental sum from being labelled balanced
     * when neither dates nor breakdown descriptions support the relationship.
     */
    const findBestSubset = <T,>(
      candidates: T[],
      targetCents: number,
      getAmountCents: (item: T) => number,
      getScore: (item: T) => number,
      hasEvidence: (item: T) => boolean,
      minItems = 2,
      requireEvidence = true,
    ): T[] | null => {
      if (targetCents <= 0 || candidates.length < minItems) return null;

      type State = { sum: number; items: T[]; score: number; evidence: boolean };
      const stateKey = (sum: number, evidence: boolean) => `${sum}:${evidence ? 1 : 0}`;
      let states = new Map<string, State>();
      states.set(stateKey(0, false), { sum: 0, items: [], score: 0, evidence: false });
      const ordered = [...candidates].sort((a, b) => getScore(b) - getScore(a));
      const MAX_STATES = 50000;

      const isBetter = (candidate: State, previous: State): boolean =>
        candidate.score > previous.score ||
        (candidate.score === previous.score && candidate.items.length < previous.items.length);

      for (const item of ordered) {
        const amountCents = getAmountCents(item);
        if (amountCents <= 0 || amountCents > targetCents) continue;
        const score = getScore(item);
        const itemHasEvidence = hasEvidence(item);
        const snapshot = [...states.values()];

        for (const state of snapshot) {
          const sum = state.sum + amountCents;
          if (sum > targetCents) continue;
          const evidence = state.evidence || itemHasEvidence;
          const nextState: State = {
            sum,
            items: [...state.items, item],
            score: state.score + score,
            evidence,
          };
          const key = stateKey(sum, evidence);
          const existing = states.get(key);
          if (!existing || isBetter(nextState, existing)) states.set(key, nextState);
        }

        // Keep the search bounded on unusually large ledgers while preserving states
        // closest to the target and the strongest date/remark evidence.
        if (states.size > MAX_STATES) {
          const pruned = [...states.values()]
            .sort((a, b) =>
              Math.abs(targetCents - a.sum) - Math.abs(targetCents - b.sum) ||
              b.score - a.score ||
              a.items.length - b.items.length
            )
            .slice(0, MAX_STATES);
          states = new Map(pruned.map(state => [stateKey(state.sum, state.evidence), state]));
        }
      }

      const result = states.get(stateKey(targetCents, true));
      if (!result || result.items.length < minItems || (requireEvidence && !result.evidence)) return null;
      return result.items;
    };

    // PRIORITY MATCH (formerly PASS 2B): resolve explicit transaction breakdowns FIRST.
    // These high-intent matches reserve their Excel component rows before exact-amount
    // matching can consume a component as an unrelated standalone transaction.
    // PASS 2B: one database transaction can contain an itemized [Breakdown: ...],
    // while ComBud contains separate daily rows. Match each breakdown component to
    // one distinct Excel row using exact cents and that component's own date clue.
    // Excel remarks are optional; date + amount is sufficient when the breakdown gives
    // a date, and amount-only matching is allowed for undated components in this sheet.
    for (const tx of [...dbPool]) {
      if (!dbPool.some(candidate => candidate.id === tx.id)) continue;
      if (exPool.length < 2) break;

      const breakdownItems = parseTransactionBreakdown(tx.remarks);
      if (breakdownItems.length < 2) continue;

      const breakdownTotalCents = breakdownItems.reduce((sum, item) => sum + item.amountCents, 0);
      if (breakdownTotalCents !== toCents(tx.amount)) continue;

      type ComponentCandidate = {
        componentIndex: number;
        component: BreakdownItem;
        options: Array<{ record: ExcelRecord; score: number }>;
      };

      const componentCandidates: ComponentCandidate[] = breakdownItems.map((component, componentIndex) => {
        const explicitDates = extractEventDateClues(component.name);
        const componentDays = extractEventDaysForMonth(component.name, targetMonth);
        const explicitDateConflictsWithSheet = targetMonth > 0 && explicitDates.length > 0 &&
          !explicitDates.some(clue => clue.month === targetMonth);

        const options = explicitDateConflictsWithSheet
          ? []
          : exPool
              .filter(record => {
                if (toCents(record.amount) !== component.amountCents) return false;
                // If the breakdown names the event day, require the Excel row to use
                // that day. Never allow a same-amount row from another date instead.
                if (componentDays.size > 0) {
                  const excelDay = getExcelDay(record);
                  return excelDay !== null && componentDays.has(excelDay);
                }
                // No event-day clue: the record is already bounded to the selected
                // monthly sheet/category, so exact amount is valid without Excel remarks.
                return true;
              })
              .map(record => {
                let score = 0;
                const remarkToken = normalizeStructuralToken(record.remarks === '--' ? '' : record.remarks);
                const nameToken = normalizeStructuralToken(component.name);
                if (remarkToken && nameToken && nameToken.length >= 4 &&
                    (remarkToken.includes(nameToken) || nameToken.includes(remarkToken))) {
                  score += 30;
                } else if (remarkToken) {
                  const meaningfulWords = component.name
                    .split(/\s+/)
                    .map(word => normalizeStructuralToken(word))
                    .filter(word => word.length >= 4);
                  if (meaningfulWords.some(word => remarkToken.includes(word))) score += 10;
                }
                if (componentDays.size > 0 && componentDays.has(getExcelDay(record) ?? -1)) score += 100;
                return { record, score };
              })
              .sort((a, b) => b.score - a.score || a.record.id.localeCompare(b.record.id));

        return { componentIndex, component, options };
      });

      // Fail closed if any component has no amount/date-compatible Excel row.
      if (componentCandidates.some(component => component.options.length === 0)) continue;

      // Solve as a one-to-one assignment rather than greedily taking the first amount:
      // duplicate component amounts can appear on different dates, and one Excel row
      // must never be consumed by two breakdown components.
      const orderedComponents = [...componentCandidates].sort((a, b) =>
        a.options.length - b.options.length || a.component.amountCents - b.component.amountCents
      );
      const selectedByComponent = new Map<number, ExcelRecord>();
      const usedExcelIds = new Set<string>();
      // Keep the result in a mutable holder because TypeScript does not reliably
      // track assignments to an outer local variable made inside a nested recursive
      // function. Reading the holder after recursion avoids an incorrect `never`
      // narrowing while preserving the intended Map<number, ExcelRecord> type.
      const bestAssignmentRef: { current: Map<number, ExcelRecord> | null } = {
        current: null,
      };
      let bestScore = Number.NEGATIVE_INFINITY;
      let exploredStates = 0;
      const MAX_ASSIGNMENT_STATES = 50000;

      const assignComponents = (position: number, score: number): void => {
        if (exploredStates++ >= MAX_ASSIGNMENT_STATES) return;
        if (position === orderedComponents.length) {
          if (score > bestScore) {
            bestScore = score;
            bestAssignmentRef.current = new Map(selectedByComponent);
          }
          return;
        }

        // Scores are non-negative. Once a complete solution exists, a branch that
        // cannot possibly beat it may be skipped without affecting reconciliation.
        const component = orderedComponents[position];
        for (const option of component.options) {
          if (usedExcelIds.has(option.record.id)) continue;
          usedExcelIds.add(option.record.id);
          selectedByComponent.set(component.componentIndex, option.record);
          assignComponents(position + 1, score + option.score);
          selectedByComponent.delete(component.componentIndex);
          usedExcelIds.delete(option.record.id);
          if (exploredStates >= MAX_ASSIGNMENT_STATES) break;
        }
      };

      assignComponents(0, 0);
      const bestAssignment = bestAssignmentRef.current;
      if (!bestAssignment || bestAssignment.size !== breakdownItems.length) continue;

      const selectedExcel = breakdownItems.map((_, index) => bestAssignment.get(index)!);
      const matchedExcelIds = new Set(selectedExcel.map(record => record.id));
      const selectedTotalCents = selectedExcel.reduce((sum, record) => sum + toCents(record.amount), 0);

      // Final integrity checks: all components matched once, each row is distinct,
      // the exact cents total agrees with the database transaction, and any explicit
      // component date was already enforced during candidate generation.
      if (
        matchedExcelIds.size !== breakdownItems.length ||
        selectedExcel.length !== breakdownItems.length ||
        selectedTotalCents !== toCents(tx.amount)
      ) continue;

      const matchedDays = breakdownItems.map((component, index) => {
        const days = extractEventDaysForMonth(component.name, targetMonth);
        const excelDay = getExcelDay(selectedExcel[index]);
        return days.size === 0 || (excelDay !== null && days.has(excelDay));
      });
      if (!matchedDays.every(Boolean)) continue;

      groupMatches.push({
        id: `excel-breakdown-${tx.id}`,
        dbTxs: [tx],
        excelTxs: selectedExcel,
        label: 'Database breakdown matched',
        reason: `All ${breakdownItems.length} breakdown components match distinct ComBud rows by exact amounts${breakdownItems.some(item => extractEventDaysForMonth(item.name, targetMonth).size > 0) ? ' and event dates' : ''}; Excel remarks are not required.`,
      });
      dbPool = dbPool.filter(candidate => candidate.id !== tx.id);
      exPool = exPool.filter(record => !matchedExcelIds.has(record.id));
    }


    // PASS 1: exact 1:1 matches. When duplicate amounts exist, use date/remark clues
    // to choose the most relevant record instead of the first arbitrary occurrence.
    for (const excelTx of [...exPool]) {
      const amountCents = toCents(excelTx.amount);
      const candidateMatches = dbPool
        .filter(dbTx => toCents(dbTx.amount) === amountCents)
        .map(dbTx => ({ dbTx, clue: getTransactionDayScore(dbTx, excelTx) }))
        .sort((a, b) => b.clue.score - a.clue.score);
      const selected = candidateMatches[0]?.dbTx;
      if (!selected) continue;

      exactMatches.push({ dbTx: selected, excelTx });
      dbPool = dbPool.filter(tx => tx.id !== selected.id);
      exPool = exPool.filter(record => record.id !== excelTx.id);
    }

    // PASS 2A: a single ComBud daily amount may represent several DB transactions.
    // Match each Excel subtotal independently and let explicit dates in transaction
    // remarks/breakdowns guide the subset. Unannotated rows may join a subset only
    // when the combined sum is exact and at least one member anchors the correct day.
    const orderedExcelTotals = [...exPool].sort((a, b) => {
      const aDay = getExcelDay(a) ?? 99;
      const bDay = getExcelDay(b) ?? 99;
      return aDay - bDay;
    });

    for (const excelTx of orderedExcelTotals) {
      if (!exPool.some(record => record.id === excelTx.id)) continue;
      const targetCents = toCents(excelTx.amount);
      const subset = findBestSubset(
        dbPool,
        targetCents,
        tx => toCents(tx.amount),
        tx => getTransactionDayScore(tx, excelTx).score,
        tx => getTransactionDayScore(tx, excelTx).evidence,
        2,
        true,
      );
      if (!subset) continue;

      const day = getExcelDay(excelTx);
      groupMatches.push({
        id: `db-subtotal-${excelTx.id}`,
        dbTxs: subset,
        excelTxs: [excelTx],
        label: day ? `Day ${day} subtotal` : 'ComBud subtotal',
        reason: `The Excel amount matches ${subset.length} system records by exact cents; date or remark evidence supports this grouping.`,
      });
      const matchedDbIds = new Set(subset.map(tx => tx.id));
      dbPool = dbPool.filter(tx => !matchedDbIds.has(tx.id));
      exPool = exPool.filter(record => record.id !== excelTx.id);
    }

    // PASS 2C: a DB total without a usable itemized breakdown may still equal several
    // ComBud rows. Permit that only when dates/remarks explicitly support the group.
    for (const tx of [...dbPool]) {
      if (!dbPool.some(candidate => candidate.id === tx.id) || exPool.length < 2) continue;
      const subset = findBestSubset(
        exPool,
        toCents(tx.amount),
        record => toCents(record.amount),
        record => getExcelToTransactionScore(record, tx).score,
        record => getExcelToTransactionScore(record, tx).evidence,
        2,
        true,
      );
      if (!subset) continue;

      groupMatches.push({
        id: `excel-subtotal-${tx.id}`,
        dbTxs: [tx],
        excelTxs: subset,
        label: 'System subtotal matched',
        reason: `The system total equals ${subset.length} ComBud rows and the date/remark clues align.`,
      });
      dbPool = dbPool.filter(candidate => candidate.id !== tx.id);
      const matchedExcelIds = new Set(subset.map(record => record.id));
      exPool = exPool.filter(record => !matchedExcelIds.has(record.id));
    }

    // PASS 2D: preserve the old aggregate fallback only for static expense-block rows
    // with no day labels. Daily income-side records must be matched by day evidence,
    // never by a coincidental month-wide total alone.
    if (
      dbPool.length > 0 && exPool.length > 0 &&
      exPool.every(record => !getExcelDay(record))
    ) {
      const remainingDbCents = dbPool.reduce((sum, tx) => sum + toCents(tx.amount), 0);
      const remainingExCents = exPool.reduce((sum, record) => sum + toCents(record.amount), 0);
      if (remainingDbCents === remainingExCents) {
        groupMatches.push({
          id: 'static-block-aggregate',
          dbTxs: [...dbPool],
          excelTxs: [...exPool],
          label: 'Balanced by account totals',
          reason: 'The remaining static expense-block totals agree exactly.',
        });
        dbPool = [];
        exPool = [];
      }
    }

    return {
      exactMatches,
      groupMatches,
      unmatchedDB: dbPool,
      unmatchedExcel: exPool,
    };
  }, [selectedSummary, dbTransactions, parsedData, periods, selectedPeriodFilter]);

  const handleViewDetails = (tx: EnrichedTransaction) => { setViewingTx(tx); setIsDetailModalOpen(true); };

  const handleImportToSystem = async (excelTx: ExcelRecord, rowId: string) => {
    if (!churchId || !user || !selectedPeriodFilter || !selectedSummary) return;
    setIsInserting(rowId);
    try {
      const targetCategory = categories.find(c => selectedSummary.dbCategoryIds.includes(c.id));
      if (!targetCategory) throw new Error("Could not definitively map category. Please assign manually.");
      
      const targetPeriod = periods.find(p => p.id === selectedPeriodFilter);
      const currentYear = new Date().getFullYear();
      const dayNum = excelTx.day.replace(/\D/g, '') || '01';
      const dateStr = `${currentYear}-${String(targetPeriod?.month || 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

      const { error } = await supabase.from('transactions').insert({
        church_id: churchId, financial_period_id: selectedPeriodFilter,
        category_id: targetCategory.id, type: selectedSummary.type, amount: excelTx.amount,
        date: dateStr, remarks: excelTx.remarks !== '--' ? excelTx.remarks : excelTx.accountName,
        entered_by: user.id, status: 'VALIDATED'
      });
      if (error) throw error;
      await fetchDbTransactions();
    } catch (err: any) {
      alert("Failed to import transaction: " + err.message);
    } finally {
      setIsInserting(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-16">
      
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Reconciliation Center</h1>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Cross-reference internal records against external ComBud reports.</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-[#27272A] rounded-xl px-3 py-2 w-full sm:w-auto shadow-sm min-w-[200px] relative">
          <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
          <select 
            className="w-full bg-transparent border-none text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-0 outline-none cursor-pointer pr-4 appearance-none"
            value={selectedPeriodFilter} onChange={(e) => handlePeriodChange(e.target.value)}
          >
            {periods.map(p => <option key={p.id} value={p.id} className="bg-white dark:bg-[#121212] text-slate-900 dark:text-white">{p.period_name} {p.status === 'OPEN' ? '(OPEN)' : ''}</option>)}
          </select>
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none"><ChevronDown className="h-4 w-4 text-slate-400" /></div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#27272A] rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        {!fileName ? (
          <div className="flex-1 w-full flex items-center">
            <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="flex-1 flex items-center justify-center gap-3 px-6 py-4 border-2 border-dashed border-slate-300 dark:border-[#27272A] bg-slate-50 dark:bg-[#121212] hover:bg-slate-100 dark:hover:bg-[#1A1A1A] rounded-xl transition-all text-slate-600 dark:text-slate-400">
              {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />}
              <div className="flex flex-col items-start text-left">
                <span className="text-sm font-bold leading-tight">Upload Excel Ledger</span>
                <span className="text-[10px] font-medium opacity-80">Drop .xlsx file here to begin reconciliation</span>
              </div>
            </button>
          </div>
        ) : (
          <div className="flex-1 w-full flex items-center justify-between px-5 py-3 border border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl">
             <div className="flex items-center gap-3">
               <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
               <div className="flex flex-col text-left">
                 <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 leading-tight">File Active & Parsed</span>
                 <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-500">{fileName}</span>
               </div>
             </div>
             <button onClick={clearFile} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-rose-600 bg-white dark:bg-[#121212] border border-rose-200 dark:border-rose-900/50 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors shadow-sm">
               <Trash2 className="h-3 w-3" /> Remove File
             </button>
          </div>
        )}
        <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
      </div>

      {/* VIEW A: MASTER OVERVIEW TABLE (Hides when a summary is clicked) */}
      {fileName && !selectedSummary && (
        <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#27272A] rounded-xl overflow-hidden shadow-sm animate-in slide-in-from-bottom-4 duration-500">
           <div className="px-5 py-3 border-b border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#111111] flex justify-between items-center">
             <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">Account Reconciliation Overview</h3>
             <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{summaryData.length} Accounts Active</span>
           </div>
           <div className="overflow-x-auto custom-scrollbar">
             <table className="w-full text-left border-collapse text-xs whitespace-nowrap min-w-[900px]">
               <thead>
                 <tr className="bg-transparent border-b border-slate-200 dark:border-[#27272A] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                   <th className="p-3 pl-5">Account Name</th>
                   <th className="p-3 text-center">System Records</th>
                   <th className="p-3 text-center">Excel Records</th>
                   <th className="p-3 text-right">System Total</th>
                   <th className="p-3 text-right">Excel Total</th>
                   <th className="p-3 text-center">Variance Status</th>
                   <th className="p-3 text-right pr-5">Action</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 dark:divide-[#27272A]/50 bg-transparent">
                 {summaryData.map(row => (
                   <tr key={row.id} onClick={() => setSelectedSummary(row)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-[#121212] transition-colors group">
                     <td className="p-3 pl-5">
                       <div className="flex items-center gap-2.5">
                         <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold tracking-widest border ${row.type === 'INCOME' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50' : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50'}`}>{row.type}</span>
                         <span className="font-bold text-slate-800 dark:text-slate-200">{row.accountKey}</span>
                       </div>
                     </td>
                     <td className="p-3 text-center text-slate-600 dark:text-slate-400 font-medium">{row.sysCount}</td>
                     <td className="p-3 text-center text-slate-600 dark:text-slate-400 font-medium">{row.exCount}</td>
                     <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">₱{row.sysTotal.toLocaleString('en-PH', {minimumFractionDigits: 2})}</td>
                     <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">₱{row.exTotal.toLocaleString('en-PH', {minimumFractionDigits: 2})}</td>
                     <td className="p-3 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest border shadow-sm ${
                          row.variance === 0 ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-500 border-amber-200 dark:border-amber-900/50'
                        }`}>
                          {row.variance === 0 ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                          {row.variance === 0 ? 'Balanced' : `₱${Math.abs(row.variance).toLocaleString('en-PH', {minimumFractionDigits: 2})}`}
                        </span>
                     </td>
                     <td className="p-3 text-right pr-5">
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-[#1A1A1A] text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold group-hover:bg-brand-dark group-hover:text-white dark:group-hover:bg-brand-soft dark:group-hover:text-brand-dark transition-all shadow-sm">
                          View Breakdown <ChevronRight className="h-3 w-3" />
                        </span>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
           {summaryData.length === 0 && <div className="p-8 text-center text-slate-500 text-xs">No recognizable accounts found in the selected period.</div>}
        </div>
      )}

      {/* VIEW B: FULL-PAGE DETAILED BREAKDOWN (Takes over the screen) */}
      {selectedSummary && detailData && (
        <div className="space-y-4 animate-in slide-in-from-right-8 duration-300">
          
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedSummary(null)} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#27272A] rounded-xl hover:bg-slate-50 dark:hover:bg-[#121212] transition-colors shadow-sm text-xs font-bold text-slate-600 dark:text-slate-400">
              <ArrowLeft className="h-4 w-4" /> Back to Overview
            </button>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-slate-400 font-normal">Breakdown /</span> {selectedSummary.categoryName}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 bg-white dark:bg-[#0A0A0A] rounded-2xl overflow-hidden shadow-sm border border-slate-200 dark:border-[#27272A]">
            <div className="p-4 flex flex-col items-center justify-center border-b sm:border-b-0 sm:border-r border-slate-200 dark:border-[#27272A]">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mb-1"><Database className="h-3.5 w-3.5" /> Internal System Total</span>
              <span className="text-xl font-black text-slate-900 dark:text-white tabular-nums">₱{selectedSummary.sysTotal.toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>
            </div>
            <div className={`p-4 flex flex-col items-center justify-center border-b sm:border-b-0 sm:border-r border-slate-200 dark:border-[#27272A] ${selectedSummary.variance === 0 ? 'bg-emerald-50/50 dark:bg-emerald-950/10' : 'bg-amber-50/50 dark:bg-amber-950/10'}`}>
               <span className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 mb-1 ${selectedSummary.variance === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-500'}`}>
                 {selectedSummary.variance === 0 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />} Variance
               </span>
               <span className={`text-xl font-black tabular-nums ${selectedSummary.variance === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-500'}`}>
                 {selectedSummary.variance > 0 ? '+' : ''}₱{selectedSummary.variance.toLocaleString('en-PH', {minimumFractionDigits: 2})}
               </span>
            </div>
            <div className="p-4 flex flex-col items-center justify-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mb-1"><FileSpreadsheet className="h-3.5 w-3.5" /> Excel Total</span>
              <span className="text-xl font-black text-slate-900 dark:text-white tabular-nums">₱{selectedSummary.exTotal.toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>
            </div>
          </div>

          <div className="space-y-4">
            {detailData.exactMatches.length > 0 && (
              <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#27272A] rounded-xl overflow-hidden shadow-sm">
                <div className="bg-slate-50 dark:bg-[#111111] px-4 py-2.5 border-b border-slate-200 dark:border-[#27272A] flex items-center justify-between">
                   <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                     <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Exact Matches
                   </div>
                   <span className="text-[10px] font-bold uppercase text-slate-400">({detailData.exactMatches.length} Records)</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-[#27272A]/50">
                  {detailData.exactMatches.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_auto_1fr] items-stretch">
                      <div onClick={() => handleViewDetails(row.dbTx)} className="p-3 pr-4 flex flex-col gap-1 cursor-pointer hover:bg-slate-50 dark:hover:bg-[#141414] transition-colors group">
                        <div className="flex justify-between items-center w-full">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 transition-colors">{new Date(row.dbTx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">₱{Number(row.dbTx.amount).toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 truncate max-w-[300px]">{row.dbTx.remarks || row.dbTx.categories?.name}</span>
                      </div>
                      <div className="w-20 flex flex-col items-center justify-center relative">
                        <div className="absolute left-0 right-0 h-[1px] top-1/2 bg-slate-200 dark:bg-[#27272A] -z-10"></div>
                        <div className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-white dark:bg-[#141414] text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-[#333]">Balanced</div>
                      </div>
                      <div className="p-3 pl-4 flex flex-col gap-1 items-end text-right">
                        <div className="flex justify-between items-center w-full flex-row-reverse">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{row.excelTx.day !== '--' ? `Day ${row.excelTx.day}` : 'Excel Entry'}</span>
                            <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">₱{row.excelTx.amount.toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono truncate max-w-[300px]">{row.excelTx.remarks !== '--' ? row.excelTx.remarks : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detailData.groupMatches.length > 0 && (
              <div className="space-y-3">
                {detailData.groupMatches.map(group => (
                  <div key={group.id} className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#27272A] rounded-xl overflow-hidden shadow-sm relative">
                    <div className="bg-slate-50 dark:bg-[#111111] px-4 py-2.5 border-b border-slate-200 dark:border-[#27272A] flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        <Scale className="h-4 w-4 text-emerald-500" /> {group.label}
                      </div>
                      <span className="text-[10px] font-medium text-slate-500 normal-case">{group.reason}</span>
                    </div>
                    <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-[#27272A]">
                      <div className="flex-1 p-3 space-y-2 bg-slate-50/30 dark:bg-[#111]">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">System records ({group.dbTxs.length})</div>
                        {group.dbTxs.map(tx => (
                          <div key={tx.id} onClick={() => handleViewDetails(tx)} className="bg-white dark:bg-[#1A1A1A] p-2.5 rounded-xl border border-slate-200 dark:border-[#333] shadow-sm cursor-pointer hover:border-emerald-400 transition-colors">
                            <div className="flex justify-between text-xs font-bold text-slate-800 dark:text-slate-200 mb-1 gap-3">
                              <span>{tx.date}</span>
                              <span className="font-mono whitespace-nowrap">₱{Number(tx.amount).toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>
                            </div>
                            <div className="text-[10px] text-slate-500">{tx.remarks || tx.categories?.name}</div>
                          </div>
                        ))}
                      </div>
                      <div className="flex-1 p-3 space-y-2">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">ComBud rows ({group.excelTxs.length})</div>
                        {group.excelTxs.map(ex => (
                          <div key={ex.id} className="bg-white dark:bg-[#1A1A1A] p-2.5 rounded-xl border border-slate-200 dark:border-[#333] shadow-sm">
                            <div className="flex justify-between text-xs font-bold text-slate-800 dark:text-slate-200 mb-1 gap-3">
                              <span>{ex.day !== '--' ? `Day ${ex.day}` : 'Excel Entry'}</span>
                              <span className="font-mono whitespace-nowrap">₱{ex.amount.toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>
                            </div>
                            <div className="text-[10px] font-mono text-slate-500">{ex.remarks !== '--' ? ex.remarks : ''}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {(detailData.unmatchedDB.length > 0 || detailData.unmatchedExcel.length > 0) && (
              <div className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#27272A] rounded-xl overflow-hidden shadow-sm">
                <div className="bg-slate-50 dark:bg-[#111111] px-4 py-2.5 border-b border-slate-200 dark:border-[#27272A] flex items-center justify-between">
                   <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                     <AlertCircle className="h-4 w-4 text-amber-500" /> Discrepancies (Unmatched Records)
                   </div>
                </div>
                
                <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-[#27272A]">
                  <div className="flex-1 bg-slate-50/50 dark:bg-[#111]">
                    <div className="bg-amber-50/90 dark:bg-amber-950/40 px-4 py-2 border-b border-amber-200 dark:border-amber-900/50 text-[10px] font-bold text-amber-800 dark:text-amber-500 uppercase tracking-wider flex justify-between">
                       <span>Recorded Only in System</span>
                       <span>({detailData.unmatchedDB.length} Records)</span>
                    </div>
                    <div className="p-3 space-y-2">
                      {detailData.unmatchedDB.length === 0 && <div className="text-xs text-slate-400 italic">No isolated system records.</div>}
                      {detailData.unmatchedDB.map(tx => (
                        <div key={tx.id} onClick={() => handleViewDetails(tx)} className="bg-white dark:bg-[#1A1A1A] p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/30 shadow-sm relative overflow-hidden group cursor-pointer hover:border-amber-400 transition-colors">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400"></div>
                          <div className="flex justify-between items-center mb-1 pl-2">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{new Date(tx.date).toLocaleDateString()}</span>
                            <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">₱{Number(tx.amount).toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 pl-2">{tx.remarks || tx.categories?.name}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="bg-rose-50/90 dark:bg-rose-950/40 px-4 py-2 border-b border-rose-200 dark:border-rose-900/50 text-[10px] font-bold text-rose-800 dark:text-rose-500 uppercase tracking-wider flex justify-between">
                       <span>Not in System (Needs Entry)</span>
                       <span>({detailData.unmatchedExcel.length} Records)</span>
                    </div>
                    <div className="p-3 space-y-2">
                      {detailData.unmatchedExcel.length === 0 && <div className="text-xs text-slate-400 italic">No isolated external records.</div>}
                      {detailData.unmatchedExcel.map(ex => (
                        <div key={ex.id} className="bg-white dark:bg-[#1A1A1A] p-3 rounded-xl border border-rose-200 dark:border-rose-900/30 shadow-sm relative overflow-hidden group">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-400"></div>
                          <div className="flex justify-between items-center mb-1 pl-1.5">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{ex.day !== '--' ? `Day ${ex.day}` : 'Excel Entry'}</span>
                            <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">₱{ex.amount.toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-mono pl-1.5 mb-2.5">{ex.remarks !== '--' ? ex.remarks : ''}</p>
                          <div className="pl-1.5">
                            <button onClick={() => handleImportToSystem(ex, ex.id)} disabled={isInserting === ex.id} className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-[#333] rounded-lg text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 dark:hover:bg-emerald-950/30 transition-all shadow-sm">
                              {isInserting === ex.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Import Record
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Explicit double cast guarantees no TypeScript conflicts with the Modal */}
      <TransactionDetailModal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} transaction={viewingTx as any} />
    </div>
  );
}
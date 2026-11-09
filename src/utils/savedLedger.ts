import * as XLSX from 'xlsx';
export const MAX_LEDGER_BYTES = 10 * 1024 * 1024;
export interface SavedLedger {
  file_name: string;
  file_size: number;
  file_base64: string;
  uploaded_at: string;
  uploaded_by: string;
}
export function encodeLedger(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 32768) binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  return btoa(binary);
}
export function readSavedLedger(row: Pick<SavedLedger, 'file_base64' | 'file_size'>): XLSX.WorkBook {
  if (!Number.isInteger(row.file_size) || row.file_size < 1 || row.file_size > MAX_LEDGER_BYTES || row.file_base64.length > 13981016) throw new Error('Invalid saved ledger size.');
  const binary = atob(row.file_base64);
  if (binary.length !== row.file_size) throw new Error('Incomplete saved ledger.');
  return readLedger(Uint8Array.from(binary, character => character.charCodeAt(0)));
}
export function readLedger(bytes: Uint8Array): XLSX.WorkBook {
  if (!bytes.length || bytes.length > MAX_LEDGER_BYTES) throw new Error('Choose an Excel ledger smaller than 10 MB.');
  const workbook = XLSX.read(bytes, { type: 'array' });
  if (!workbook.SheetNames.length) throw new Error('The workbook has no worksheets.');
  return workbook;
}

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export const exportLogsToExcel = async (logs: any[], catMap: Map<string, string>, profMap: Map<string, string>) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'JFCM-SL Stewards System';
  const sheet = workbook.addWorksheet('Audit Logs');

  // Title & Header styling
  sheet.addRow(['JFCM-SL Stewards - Database Event Logs']);
  sheet.addRow(['Immutable tracking of Insertions, Updates, and Deletions.']);
  sheet.addRow([]);

  sheet.getCell('A1').font = { bold: true, size: 14 };
  sheet.getCell('A2').font = { italic: true, color: { argb: 'FF666666' } };

  const headers = [
    'Event Timestamp', 
    'Action', 
    'Active User (Modifier)', 
    'Original Encoder', 
    'Transaction Date', 
    'Account Code & Name', 
    'Amount (PHP)', 
    'Payee / Source', 
    'Remarks', 
    'Detailed Audit Changes'
  ];
  
  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }; // Slate-800 Background
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

  // Strict column widths so text doesn't cut off
  sheet.columns = [
    { width: 22 }, // Timestamp
    { width: 12 }, // Action
    { width: 22 }, // Active User
    { width: 22 }, // Original Encoder
    { width: 18 }, // Tx Date
    { width: 45 }, // Account
    { width: 18 }, // Amount
    { width: 30 }, // Payee
    { width: 50 }, // Remarks
    { width: 75 }, // Changes Detail (Uncut)
  ];

  logs.forEach(log => {
    const oldData = log.old_data || {};
    const newData = log.new_data || {};
    
    const oldCat = catMap.get(oldData.category_id) || '[???] Unassigned / For Review';
    const newCat = catMap.get(newData.category_id) || '[???] Unassigned / For Review';
    
    const originalEncoderId = oldData.entered_by || newData.entered_by;
    const originalEncoder = profMap.get(originalEncoderId) || 'System';

    const txDate = newData.date || oldData.date || '';
    const account = newData.category_id ? newCat : oldCat;
    const amount = newData.amount || oldData.amount || 0;
    const payee = newData.payee_name || oldData.payee_name || '—';
    const remarks = newData.remarks || oldData.remarks || '—';
    let auditDetails = '';

    if (log.action === 'INSERT') {
      auditDetails = 'Record Originally Created';
    } else if (log.action === 'DELETE') {
      auditDetails = 'Record Permanently Deleted';
    } else if (log.action === 'UPDATE') {
      const changes = [];
      if (oldData.date !== newData.date) changes.push(`Date: ${oldData.date} ➔ ${newData.date}`);
      if (oldData.category_id !== newData.category_id) changes.push(`Account: ${oldCat} ➔ ${newCat}`);
      if (Number(oldData.amount) !== Number(newData.amount)) changes.push(`Amount: ₱${Number(oldData.amount).toLocaleString('en-PH')} ➔ ₱${Number(newData.amount).toLocaleString('en-PH')}`);
      if (oldData.payee_name !== newData.payee_name) changes.push(`Payee: ${oldData.payee_name || 'N/A'} ➔ ${newData.payee_name || 'N/A'}`);
      if (oldData.remarks !== newData.remarks) changes.push(`Remarks: ${oldData.remarks || 'N/A'} ➔ ${newData.remarks || 'N/A'}`);
      
      // Use newline characters so Excel automatically line-breaks the details
      auditDetails = changes.join('\n');
    }

    const row = sheet.addRow([
      new Date(log.created_at).toLocaleString(),
      log.action,
      log.changed_by_name,
      originalEncoder,
      txDate,
      account,
      Number(amount).toLocaleString('en-PH', {minimumFractionDigits: 2}),
      payee,
      remarks,
      auditDetails
    ]);

    // Force text wrapping so nothing gets cut off
    row.alignment = { vertical: 'top', wrapText: true };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `JFCM_Audit_Logs_${new Date().toISOString().split('T')[0]}.xlsx`);
};
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { encodeLedger, MAX_LEDGER_BYTES, readLedger, readSavedLedger } from '../src/utils/savedLedger.ts';
for (const bookType of ['xlsx','biff8']) {
 const original=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(original,XLSX.utils.aoa_to_sheet([['Synthetic account','Amount'],['Fixture',1234.50],['Rounding',0.01],['Duplicate',1234.50]]),'Jan');
 XLSX.utils.book_append_sheet(original,XLSX.utils.aoa_to_sheet([['Other month',99.99]]),'Feb');
 const bytes=new Uint8Array(XLSX.write(original,{bookType,type:'buffer'}));
 const encoded=encodeLedger(bytes);
 assert.deepEqual(new Uint8Array(Buffer.from(encoded,'base64')),bytes,'Original workbook bytes preserved');
 const restored=readSavedLedger({file_size:bytes.length,file_base64:encoded});
 assert.deepEqual(restored.SheetNames,['Jan','Feb']);
 assert.equal(restored.Sheets.Jan.B2.v,1234.5); assert.equal(restored.Sheets.Jan.B3.v,0.01); assert.equal(restored.Sheets.Jan.B4.v,1234.5);
 assert.equal(restored.Sheets.Feb.B1.v,99.99);
 assert.throws(()=>readSavedLedger({file_size:bytes.length-1,file_base64:encoded}));
}
const chunks=Uint8Array.from({length:100000},(_,index)=>index%256);
assert.deepEqual(new Uint8Array(Buffer.from(encodeLedger(chunks),'base64')),chunks);
assert.throws(()=>readLedger(new Uint8Array(0)));
assert.throws(()=>readLedger(new Uint8Array(MAX_LEDGER_BYTES+1)));
assert.throws(()=>readSavedLedger({file_size:MAX_LEDGER_BYTES+1,file_base64:'AA=='}));
console.log('PASS: xlsx/xls round trips, unchanged cents, duplicate rows, multi-month sheets, chunked encoding and size validation.');

// Synthetic browser persistence checks. Every remote request is intercepted.
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.STEWARDS_BASE_URL||'http://127.0.0.1:5174/JFCM-SL-Stewards/';
const target=await fetch('http://127.0.0.1:9333/json/new?about:blank',{method:'PUT'}).then(r=>r.json());
const socket=new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let counter=0, failSave=false, failLoad=false, revision=0, reads=0, loseSaveResponse=false, photo=null, failPhoto=false, profileRole='admin';
const photoWrites=[];
const pending=new Map(), saved=new Map(), writes=[], errors=[], requests=[];
function send(method,params={}) {return new Promise((resolve,reject)=>{const id=++counter;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});}
socket.addEventListener('message',async ({data})=>{
 const message=JSON.parse(data);
 if(message.id){const p=pending.get(message.id);pending.delete(message.id);message.error?p?.reject(new Error(message.error.message)):p?.resolve(message.result);}
 if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text);
 if(message.method!=='Fetch.requestPaused')return;
 const {requestId,request}=message.params,url=new URL(request.url);
 if(url.origin===new URL(base).origin||url.hostname==='fonts.googleapis.com'||url.hostname==='fonts.gstatic.com'){await send('Fetch.continueRequest',{requestId});return;}
 let body=[], status=200;
 const table=url.pathname.split('/').pop();requests.push({table,method:request.method});const single=(request.headers.Accept||request.headers.accept||'').includes('vnd.pgrst.object');
 if(table==='profiles'){
  if(request.method==='PATCH') { const change=JSON.parse(request.postData);assert.deepEqual(Object.keys(change),['avatar_data_url']);assert.equal(profileRole,'admin');photoWrites.push(change);if(failPhoto){status=503;body={message:'Synthetic photo failure'};}else{photo=change.avatar_data_url;body=[{id:'ui-user',avatar_data_url:photo}];} }
  else {if(!['GET','OPTIONS'].includes(request.method))throw new Error('Unexpected profile write');body=[{id:'ui-user',church_id:'ui-church',role:profileRole,full_name:'Preview Steward',is_active:true,avatar_data_url:photo}];}
 }
 if(table==='categories')body=[{id:'photo-category',church_id:'ui-church',name:'Tithes - Local',export_code:'5011',type:'INCOME'}];
 if(table==='transactions')body=[{id:'photo-transaction',church_id:'ui-church',financial_period_id:'period-1',category_id:'photo-category',type:'INCOME',amount:123.45,date:'2026-01-10',created_at:'2026-01-10T08:00:00Z',entered_by:'ui-user',payee_name:'Preview source',remarks:'Synthetic profile photo check'}];
 if(table==='financial_periods')body=[{id:'period-1',church_id:'ui-church',financial_year_id:'year-1',month:1,period_name:'January 2026',status:'OPEN'},{id:'period-2',church_id:'ui-church',financial_year_id:'year-1',month:2,period_name:'February 2026',status:'OPEN'},{id:'period-3',church_id:'ui-church',financial_year_id:'year-2',month:1,period_name:'January 2027',status:'OPEN'}];
 if(table==='reconciliation_workbooks'){
  if(request.method==='POST'){
   writes.push(table);
   if(failSave){status=503;body={message:'Synthetic unavailable'};}
   else {
    const payload=JSON.parse(request.postData);assert.equal(payload.church_id,'ui-church');assert.equal(payload.financial_year_id,'year-1');
    const row={...payload,uploaded_by:'ui-user',uploaded_at:`2026-11-09T14:0${revision++}:00Z`};saved.set(payload.church_id+':'+payload.financial_year_id,row);
    body=[{file_name:row.file_name,file_size:row.file_size,uploaded_at:row.uploaded_at,uploaded_by:row.uploaded_by}];if(loseSaveResponse){status=503;body={message:'Synthetic lost acknowledgement'};}
   }
  }else {
   reads++;
   if(failLoad){status=503;body={message:'Synthetic load failure'};}
   else {const row=saved.get((url.searchParams.get('church_id')||'').replace('eq.','')+':'+(url.searchParams.get('financial_year_id')||'').replace('eq.',''));body=row?[row]:[];}
  }
 }else if(table==='admin_personnel_last_logins' && request.method==='POST'){body=[{profile_id:'ui-user',last_sign_in_at:null}];}else if(table!=='profiles'&&!['GET','OPTIONS'].includes(request.method)) throw new Error('Unexpected financial write: '+table);
 if(single&&Array.isArray(body))body=body[0]||null;
 await send('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Headers',value:'*'},{name:'Access-Control-Allow-Methods',value:'GET,POST,PATCH,OPTIONS'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});
});
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text);return result.result.value;}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function capture(name){const output=process.env.STEWARDS_SCREENSHOTS;if(!output)return;await wait(300);await mkdir(output,{recursive:true});const {data}=await send('Page.captureScreenshot',{format:'png'});await writeFile(output+'/'+name+'.png',Buffer.from(data,'base64'));}
async function until(expression){for(let i=0;i<80;i++){if(await evaluate(expression))return;await wait(100);}throw new Error('Timed out: '+expression+'; '+await evaluate('location.hash')+'; '+JSON.stringify(errors)+'; '+await evaluate('document.body.innerText.slice(0,450)')+'; '+JSON.stringify(requests.slice(-8)));}
const payload=Buffer.from(JSON.stringify({sub:'ui-user',exp:4102444800,role:'authenticated'})).toString('base64url');
const token=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+payload+'.fixture';
const session={access_token:token,refresh_token:'fixture',expires_at:4102444800,expires_in:3600,token_type:'bearer',user:{id:'ui-user',aud:'authenticated',role:'authenticated',email:'preview@example.invalid',app_metadata:{},user_metadata:{}}};
const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Synthetic fixture',1234.50]]),'Jan');XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Other fixture',99.99]]),'Feb');
const bytes=XLSX.write(book,{type:'buffer',bookType:'xlsx'}), encoded=bytes.toString('base64');
async function upload(name,content=encoded){await evaluate(`(()=>{const bytes=Uint8Array.from(atob(${JSON.stringify(content)}),c=>c.charCodeAt(0));const file=new File([bytes],${JSON.stringify(name)},{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});const transfer=new DataTransfer();transfer.items.add(file);const input=document.querySelector('input[aria-label="Upload Excel ledger"]');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);}
async function period(name){await evaluate(`document.querySelector('button[aria-label="Reconciliation period"]').click()`);await until(`!!document.querySelector('[role=option]')`);await evaluate(`[...document.querySelectorAll('[role=option]')].find(o=>o.textContent.includes(${JSON.stringify(name)})).click()`);await wait(300);}
try {
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Network.setBlockedURLs',{urls:['*/realtime/*']});await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.clear();localStorage.setItem('jfcm_theme','light');const original=Storage.prototype.getItem;Storage.prototype.getItem=function(key){return key.startsWith('sb-')&&key.endsWith('-auth-token')?JSON.stringify(${JSON.stringify(session)}):original.call(this,key)};`});
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:base+'?fixture=ledger#/reconciliation'});
 await until(`!!document.querySelector('.saved-ledger-panel button:not(:disabled)')`);
 await upload('ledger-original.xlsx');await until(`document.querySelector('.saved-ledger-summary strong')?.textContent==='ledger-original.xlsx'`);
 assert.equal(saved.get('ui-church:year-1').file_base64,encoded,'Original bytes persisted');
 await send('Page.reload');await wait(350);await until(`document.querySelector('.saved-ledger-summary strong')?.textContent==='ledger-original.xlsx'`);
 assert.equal(await evaluate(`document.querySelector('.saved-ledger-summary time').dateTime`),'2026-11-09T14:00:00Z','Server upload time restored');await capture('saved-ledger-restored');
 const before=reads;await period('February 2026');assert.equal(reads,before,'Same-year period change reuses saved workbook');
 await period('January 2027');await until(`document.querySelector('.saved-ledger-summary strong')?.textContent==='Upload Excel ledger'`);assert.ok(await evaluate(`!document.querySelector('.saved-ledger-summary time')`),'Other year does not leak previous file');
 await period('January 2026');await until(`document.querySelector('.saved-ledger-summary strong')?.textContent==='ledger-original.xlsx'`);
 await upload('ledger-newer.xlsx');await until(`document.querySelector('.saved-ledger-summary strong')?.textContent==='ledger-newer.xlsx'`);assert.equal(saved.size,1,'Replacement keeps one current workbook');
 failSave=true;await upload('ledger-failed.xlsx');await until(`!!document.querySelector('.saved-ledger-error')`);assert.equal(await evaluate(`document.querySelector('.saved-ledger-summary strong').textContent`),'ledger-newer.xlsx','Failed save preserves loaded workbook');assert.equal(saved.get('ui-church:year-1').file_name,'ledger-newer.xlsx');failSave=false;
 loseSaveResponse=true;await upload('ledger-unconfirmed.xlsx');await until(`document.querySelector('.saved-ledger-error')?.textContent.includes('could not be confirmed')`);assert.equal(saved.get('ui-church:year-1').file_name,'ledger-unconfirmed.xlsx');assert.equal(await evaluate(`document.querySelector('.saved-ledger-summary strong').textContent`),'ledger-newer.xlsx','Lost acknowledgement preserves preview until verified');loseSaveResponse=false;await evaluate(`[...document.querySelectorAll('.saved-ledger-actions button')].find(b=>b.textContent.includes('Retry')).click()`);await until(`document.querySelector('.saved-ledger-summary strong')?.textContent==='ledger-unconfirmed.xlsx'`);
 failLoad=true;await send('Page.reload');await wait(350);await until(`!!document.querySelector('.saved-ledger-error')`);failLoad=false;await evaluate(`[...document.querySelectorAll('.saved-ledger-actions button')].find(b=>b.textContent.includes('Retry')).click()`);await until(`document.querySelector('.saved-ledger-summary strong')?.textContent==='ledger-unconfirmed.xlsx'`);
 const beforeInvalid=writes.length;await upload('not-excel.txt');await until(`!!document.querySelector('.saved-ledger-error')`);assert.equal(writes.length,beforeInvalid,'Invalid file never sent');
 await send('Page.setInterceptFileChooserDialog',{enabled:true});
 await evaluate(`location.hash='/admin'`);await until(`!!document.querySelector('.profile-photo')`);
 async function uploadPhoto(color,type='image/png',oversize=false) {
  const encodedPhoto=await evaluate(`(()=>{const canvas=document.createElement('canvas');canvas.width=480;canvas.height=320;const context=canvas.getContext('2d');context.fillStyle=${JSON.stringify(color)};context.fillRect(0,0,480,320);return canvas.toDataURL('image/png').split(',')[1]})()`);
  await evaluate(`document.querySelector('.profile-photo').click()`);
  await evaluate(`(()=>{const bytes=${oversize?'new Uint8Array(5*1024*1024+1)':`Uint8Array.from(atob(${JSON.stringify(encodedPhoto)}),c=>c.charCodeAt(0))`};const file=new File([bytes],'synthetic-photo.png',{type:${JSON.stringify(type)}});const transfer=new DataTransfer();transfer.items.add(file);const input=document.querySelector('[aria-label="Upload user profile photo"]');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 }
 await uploadPhoto('#326482');await until(`document.querySelector('.profile-photo img')?.naturalWidth===256`);assert.ok(photo.startsWith('data:image/jpeg;base64,'));assert.ok(photo.length<200000);assert.equal(await evaluate(`document.querySelector('.profile-photo img').naturalHeight`),256,'Portrait is square');await capture('admin-profile-photo'); await until(`!!document.querySelector('.sidebar-current-user img')`);assert.equal(await evaluate(`document.querySelector('.sidebar-current-user img').getAttribute('src')`),photo,'Signed-in sidebar photo updates immediately'); await evaluate(`location.hash='/transactions'`);await until(`document.querySelector('.ledger-audit .user-avatar img')?.naturalWidth===256`);assert.equal(await evaluate(`document.querySelector('.ledger-audit img').getAttribute('src')`),photo,'Encoder photo is reused in Transactions');await capture('transaction-encoder-photo');await evaluate(`document.querySelector('.ledger-clickable-row .ledger-date').click()`);await until(`document.querySelector('.record-person .user-avatar img')?.naturalWidth===256`);assert.equal(await evaluate(`document.querySelector('.record-person img').getAttribute('src')`),photo,'Entered-by photo is reused in Details');await capture('transaction-detail-photo');await evaluate(`document.querySelector('[aria-label="Close transaction details"]').click()`);await evaluate(`location.hash='/admin'`);await until(`document.querySelector('.profile-photo img')?.naturalWidth===256`);
 const originalPhoto=photo;await send('Page.reload');await wait(350);await until(`document.querySelector('.profile-photo img')?.naturalWidth===256`);assert.equal(await evaluate(`document.querySelector('.profile-photo img').getAttribute('src')`),originalPhoto,'Portrait restored after reload');
 failPhoto=true;await uploadPhoto('#8C495A');await until(`document.querySelector('.feedback-message')?.textContent.includes('current preview')`);assert.equal(photo,originalPhoto);assert.equal(await evaluate(`document.querySelector('.profile-photo img').getAttribute('src')`),originalPhoto,'Failed replacement preserves portrait');failPhoto=false;
 await evaluate(`[...document.querySelectorAll('.profile-photo-actions button')].find(b=>b.textContent==='Remove photo').click()`);await until(`document.querySelector('.profile-photo-actions')?.textContent.includes('Add photo') && !document.querySelector('.profile-photo img')`);assert.ok(photo===null,'Remove clears saved photo');assert.ok(await evaluate(`!document.querySelector('.sidebar-current-user img')`),'Removing own photo immediately updates sidebar');
 const countBefore=photoWrites.length;await uploadPhoto('#326482','image/svg+xml');await wait(200);assert.equal(photoWrites.length,countBefore,'Unsafe image type is not uploaded');await uploadPhoto('#326482','image/png',true);await wait(200);assert.equal(photoWrites.length,countBefore,'Oversize image is not uploaded');
 profileRole='auditor';await send('Page.reload');await wait(350);await until(`!!document.querySelector('.profile-photo')`);assert.equal(await evaluate(`document.querySelector('.profile-photo').disabled`),true,'Only admins can manage photos');assert.equal(await evaluate(`document.querySelectorAll('.profile-photo-actions').length`),0);
 assert.ok(writes.every(table=>table==='reconciliation_workbooks'));assert.deepEqual(errors,[]);
 console.log('PASS: save, reload, server timestamp, same-year reuse, year isolation, replacement, failed-save preservation, retry and invalid extension. Synthetic backend only; profile-photo resize, save/reload, failed replacement, removal, invalid type/size and admin-only controls also passed.');
}finally{try{await send('Page.close');}finally{socket.close();}}

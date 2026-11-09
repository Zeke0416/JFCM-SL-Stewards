// Local visual smoke check. All backend responses and session data are synthetic.
// Start Vite and a temporary headless Chrome with --remote-debugging-port=9333 first.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.STEWARDS_BASE_URL || 'http://127.0.0.1:5174/JFCM-SL-Stewards/';
const output = process.env.STEWARDS_SCREENSHOTS || 'tests/screenshots';
await mkdir(output, { recursive: true });
const target = await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' }).then(r => r.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
let id = 0;
const pending = new Map();
const errors = [];
const backendWrites = [];
function send(method, params = {}) { return new Promise((resolve, reject) => { const key = ++id; pending.set(key, { resolve, reject }); socket.send(JSON.stringify({ id: key, method, params })); }); }
socket.addEventListener('message', async ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) { const handler = pending.get(message.id); pending.delete(message.id); if (message.error) handler?.reject(new Error(message.error.message)); else handler?.resolve(message.result); }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
  if (message.method === 'Fetch.requestPaused') {
    const { requestId, request } = message.params;
    const url = new URL(request.url);
    if (url.origin === new URL(base).origin || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') { await send('Fetch.continueRequest', { requestId }); return; }
    if (!['GET','OPTIONS'].includes(request.method) && !(request.method === 'POST' && url.pathname === '/rest/v1/rpc/admin_personnel_last_logins')) backendWrites.push({method:request.method,path:url.pathname});
    let body = [];
    const table = url.pathname.split('/').pop();
    if (table === 'admin_personnel_last_logins') body = [{profile_id:'ui-user',last_sign_in_at:'2026-11-09T01:00:00Z'}];
    if (table === 'profiles') body = [{ id: 'ui-user', full_name: 'Preview Steward', church_id: 'ui-church', role: 'admin', is_active:true, email:'preview@example.invalid', must_change_password: false }];
    if (table === 'financial_years') body = [{ id: 'ui-year', year: 2026, category_targets: { 'ui-income': 200000, 'ui-expense': 100000, ...Object.fromEntries(Array.from({length:8},(_,i)=>[`fund-${i}`,10000])) } }];
    if (table === 'financial_periods') body = [1,2,3,4,5,6].map((month, i) => ({ id: `period-${month}`, financial_year_id: 'ui-year', church_id: 'ui-church', month, year: 2026, period_name: `${['January','February','March','April','May','June'][i]} 2026`, status: 'OPEN', beginning_balance:0, cib_savings:0, cib_current:0, cib_time_deposit:0, coh_petty_cash:0, coh_undeposited:0, coh_advances:0 }));
    if (table === 'categories') body = [{ id:'ui-income', name:'General offerings', export_code:'INC', type:'INCOME', church_id:'ui-church' }, { id:'ui-expense', name:'Ministry operations', export_code:'EXP', type:'EXPENSE', church_id:'ui-church' }];
    if (table === 'transactions') body = [1,2,3,4,5,6].flatMap(month => ['INCOME','EXPENSE'].map(type => ({ id:`tx-${month}-${type}`, church_id:'ui-church', financial_period_id:`period-${month}`, category_id:type === 'INCOME' ? 'ui-income' : 'ui-expense', amount: (type === 'INCOME' ? [1,2,7,4,5,2][month-1]*3200 : [1,2,9,3,4,2][month-1]*1700), type, date:`2026-0${month}-10`, created_at:`2026-0${month}-10T08:00:00Z`, payee_name:'Sample ministry record', remarks:'Synthetic UI fixture', receipt_no:`DEMO-${month}`, entered_by:'ui-user', categories:{ name:type === 'INCOME' ? 'General offerings' : 'Ministry operations', export_code:type === 'INCOME' ? 'INC' : 'EXP', type }, profiles:{ full_name:'Preview Steward' } })));
    if (table === 'transactions') body=body.map(tx=>tx.id==='tx-1-EXPENSE'?{...tx,id:'00000000-0000-4000-8000-000000000006',payee_name:'',category_id:'unassigned',categories:null}:tx);
    if (table === 'categories') body.push(...Array.from({length:8},(_,index)=>({id:`fund-${index}`,name:`Ministry fund ${index+1}`,type:'INCOME',export_code:`F${index+1}`,church_id:'ui-church'})));
    if (table === 'tithers') body=[{id:'member-demo',full_name:'Preview member',church_id:'ui-church',is_active:true},{id:'member-recorded',full_name:'Sample ministry record',church_id:'ui-church',is_active:true},...Array.from({length:4},(_,i)=>({id:'member-extra-'+i,full_name:'Preview member '+(i+2),church_id:'ui-church',is_active:true}))];
    if (table === 'coop_monthly_logs') body=[{id:'coop-demo',financial_period_id:'period-1',church_id:'ui-church',beginning_balance:0,interest_rate:0,weekly_logs:[{id:'weekly-demo',date:'2026-01-10',type:'DEPOSIT',amount:200,remarks:'Preview deposit',encoded_by:'Preview Steward'}]}];
    if (table === 'transactions') body=body.flatMap(tx=>tx.type==='INCOME'?[{...tx,id:tx.id+'-a',amount:tx.amount/2},{...tx,id:tx.id+'-b',amount:tx.amount/2,date:tx.date.replace('-10','-18')}]:[tx]);
    if (table === 'transaction_logs') body = [1,2,3].map(i => ({ id:`log-${i}`, action:'INSERT', created_at:`2026-06-0${i}T08:00:00Z`, new_data:{ payee_name:`Sample ministry record ${i}`, amount:i * 1200 } }));
    if ((request.headers.Accept || request.headers.accept || '').includes('vnd.pgrst.object')) body = body[0] || null;
    await send('Fetch.fulfillRequest', { requestId, responseCode:200, responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Headers',value:'*'}], body:Buffer.from(JSON.stringify(body)).toString('base64') });
  }
});
const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue:true, awaitPromise:true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(expression) { for (let i=0;i<80;i++) { if (await evaluate(expression)) return; await wait(150); } throw new Error(`Timed out: ${expression}; ${await evaluate("location.hash")}; ${JSON.stringify(errors)}`); }
async function screenshot(name, delay = 800) { await wait(delay); const { data } = await send('Page.captureScreenshot', { format:'png', captureBeyondViewport:false }); await writeFile(`${output}/${name}.png`, Buffer.from(data,'base64')); }
async function viewport(width, height=1000) { await send('Emulation.setDeviceMetricsOverride',{ width,height,deviceScaleFactor:1,mobile:false }); await wait(150); }
async function noOverflow(label) { const sizes = await evaluate(`({width:innerWidth, document:document.documentElement.scrollWidth, main:document.querySelector('.workspace-main') ? [document.querySelector('.workspace-main').clientWidth,document.querySelector('.workspace-main').scrollWidth] : null})`); assert.ok(sizes.document <= sizes.width + 1, `${label}: document overflow ${JSON.stringify(sizes)}`); if (sizes.main) assert.ok(sizes.main[1] <= sizes.main[0] + 1, `${label}: main overflow ${JSON.stringify(sizes)}`); }
try {
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
await send('Network.setBlockedURLs', { urls:['*/realtime/*'] });
await send('Fetch.enable', { patterns:[{urlPattern:'*',requestStage:'Request'}] });
await send('Page.addScriptToEvaluateOnNewDocument', { source:`localStorage.clear();localStorage.setItem('jfcm_theme','light');localStorage.setItem('jfcm_saved_accounts',JSON.stringify([{fullName:'Preview steward',email:'preview@example.invalid'}]));` });
await viewport(1440);
await send('Page.navigate', {url:base+'#/login'});
await until(`!!document.querySelector('#login-email')`);
assert.equal(await evaluate(`document.querySelector('.login-brand').tagName`),'DIV','Brand is static, not a hash-router link'); assert.ok(await evaluate(`document.querySelector('.login-footer').textContent.includes('Jesus First Christian Ministries Inc. - Sapang Lamig')`),'Church ownership is visible on sign-in'); await screenshot('login-desktop'); await noOverflow('login desktop');
if(process.env.STEWARDS_CAPTURE_MOTION==='true') {
  await mkdir(`${output}/motion-frames`,{recursive:true});
  const clip=await evaluate(`(()=>{const r=document.querySelector('.login-motion-stage .ledger-motion').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:.9}})()`);
  for(let index=0;index<48;index++){const frame=await send('Page.captureScreenshot',{format:'png',clip});await writeFile(`${output}/motion-frames/${String(index).padStart(3,'0')}.png`,Buffer.from(frame.data,'base64'));await wait(125);}
}

assert.equal(await evaluate(`getComputedStyle(document.querySelector('.orbital-traveler')).animationIterationCount`),'infinite');
const orbitStart = await evaluate(`getComputedStyle(document.querySelector('.orbital-traveler')).transform`);
await wait(500); assert.notEqual(await evaluate(`getComputedStyle(document.querySelector('.orbital-traveler')).transform`),orbitStart,'Login motion continues after startup');
await evaluate(`document.querySelector('.login-motion-stage .motion-toggle').click()`);
assert.equal(await evaluate(`getComputedStyle(document.querySelector('.orbital-traveler')).animationPlayState`),'paused');
await evaluate(`document.querySelector('.login-motion-stage .motion-toggle').click()`);

assert.equal(await evaluate(`document.querySelector('#login-password').type`), 'password');
await evaluate(`document.querySelector('button[aria-label="Show password"]').click()`);
assert.equal(await evaluate(`document.querySelector('#login-password').type`), 'text');
await evaluate(`document.documentElement.classList.add('dark')`); await screenshot('login-dark'); assert.equal(await evaluate(`getComputedStyle(document.querySelector('.login-heading h2')).color`),'rgb(236, 242, 248)','Dark login heading follows theme'); await evaluate(`document.documentElement.classList.remove('dark')`);
await viewport(390,844); await screenshot('login-mobile'); await noOverflow('login mobile');
await send('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'reduce'}]});
assert.equal(await evaluate(`getComputedStyle(document.querySelector('.login-form-wrap')).animationName`),'none');
await send('Emulation.setEmulatedMedia',{features:[]});
const payload = Buffer.from(JSON.stringify({sub:'ui-user',exp:4102444800,role:'authenticated'})).toString('base64url');
const token = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+payload+'.fixture';
await send('Page.addScriptToEvaluateOnNewDocument', { source:`const session=${JSON.stringify({access_token:token,refresh_token:'fixture',expires_at:4102444800,expires_in:3600,token_type:'bearer',user:{id:'ui-user',aud:'authenticated',role:'authenticated',email:'preview@example.invalid',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}})}; const originalGet=Storage.prototype.getItem; Storage.prototype.getItem=function(key){if(key.startsWith('sb-')&&key.endsWith('-auth-token'))return JSON.stringify(session);return originalGet.call(this,key);};` });
await viewport(1440); await send('Page.navigate',{url:base+'?fixture=1#/'});
await until(`!!document.querySelector('.financial-summary')`);
await until(`document.querySelector('.balance-amount .animated-number')?.getAttribute('aria-label')==='₱31,500.00'`); await wait(100); const counting=await evaluate(`Number(document.querySelector('.balance-amount .animated-number').textContent.replaceAll(',','').replace('₱',''))`); assert.ok(counting>=0&&counting<31500,'Dashboard amount counts from zero'); await wait(1100); assert.equal(await evaluate(`document.querySelector('.balance-amount .animated-number').textContent`),'₱31,500.00','Counter settles on exact cents');
assert.ok(await evaluate(`document.querySelector('.workspace-footer').textContent.includes('Jesus First Christian Ministries Inc. - Sapang Lamig')`),'Church ownership appears throughout the workspace'); await evaluate(`document.querySelector('.stewardship-trigger').focus();document.querySelector('.stewardship-trigger').click()`); await until(`!!document.querySelector('[aria-label="Faithful stewardship"]')`); assert.ok(await evaluate(`document.querySelector('.stewardship-guide').textContent.includes('Review with integrity')`)); assert.equal(await evaluate(`document.querySelectorAll('.stewardship-guide li').length`),3); await evaluate(`document.querySelector('[aria-label="Close stewardship guide"]').click()`); await until(`!document.querySelector('.stewardship-guide')`); assert.ok(await evaluate(`document.activeElement.matches('.stewardship-trigger')`),'Guide restores focus'); await screenshot('dashboard-desktop'); assert.ok(await evaluate(`getComputedStyle(document.querySelector('.dashboard-motion-panel')).backgroundImage.includes('255, 255, 255')`),'Light dashboard motion card uses light surfaces'); await noOverflow('dashboard desktop');
assert.equal(await evaluate(`getComputedStyle(document.querySelector('.budget-list')).gridTemplateColumns.split(' ').length`),3,'Desktop budget uses three columns');
for(const width of [1440,1024,768,390,320]) {
 await viewport(width,1000);
 for(const phase of [0,.5,1]) {assert.ok(await evaluate(`(()=>{const scene=document.querySelector('.dashboard-motion-panel .ledger-motion');for(const animation of scene.getAnimations({subtree:true})){animation.pause();animation.currentTime=Number(animation.effect.getTiming().delay)+Number(animation.effect.getTiming().duration)*${phase};}const review=scene.querySelector('.ticket-review').getBoundingClientRect();const logo=scene.querySelector('.motion-coin').getBoundingClientRect();const panel=scene.closest('.dashboard-motion-panel').getBoundingClientRect();return review.left-logo.right>=14&&review.right<=panel.right-3&&review.top>=panel.top&&review.bottom<=panel.bottom})()`),'Dashboard Review card stays clear of logo and inside panel at '+width+' phase '+phase);}
 await evaluate(`document.querySelector('.dashboard-motion-panel .ledger-motion').getAnimations({subtree:true}).forEach(animation=>animation.play())`);
}
await viewport(1440,1000);
assert.equal(await evaluate(`document.querySelectorAll('.sidebar-current-user').length`),1,'One signed-in account appears in sidebar');

assert.equal(await evaluate(`document.querySelectorAll('.workspace-role,.sidebar-account,.account-monogram,.header-currency').length`),0,'Redundant profile and currency decorations removed');
assert.ok(await evaluate(`!!document.querySelector('.motion-church-logo')`),'Church logo appears in motion');
const navIconBefore=await evaluate(`(()=>{const r=document.querySelector('.navigation-group a .nav-glyph').getBoundingClientRect();return {x:r.x,y:r.y}})()`);
await evaluate(`document.querySelector('[aria-label="Collapse navigation"]').click()`); await wait(100); assert.ok(await evaluate(`(()=>{const r=document.querySelector('.navigation-group a .nav-glyph').getBoundingClientRect();return Math.abs(r.x-${navIconBefore.x})<1})()`),'Navigation icons stay horizontally anchored during collapse'); await wait(260); assert.equal(await evaluate(`Math.round(document.querySelector('.stewards-sidebar').getBoundingClientRect().width)`),80,'Desktop navigation collapses to 80 pixels'); assert.ok(await evaluate(`(()=>{const links=[...document.querySelectorAll('.navigation-group a')];return links.slice(1).every((a,i)=>Math.abs(a.getBoundingClientRect().top-links[i].getBoundingClientRect().bottom)<2)})()`),'Collapsed icon groups have no gaps'); await screenshot('navigation-collapsed'); await evaluate(`document.querySelector('[aria-label="Expand navigation"]').click()`); await wait(300);
assert.ok(await evaluate(`(()=>{const widths=[...document.querySelectorAll('.chart-panel .segmented-control button')].map(b=>b.getBoundingClientRect().width);return Math.max(...widths)-Math.min(...widths)<2})()`),'Chart tabs use equal selection widths');

assert.equal(await evaluate(`getComputedStyle(document.querySelector('.dashboard-motion-panel .orbital-traveler')).animationIterationCount`),'infinite');
assert.ok(await evaluate(`document.querySelector('.chart-panel .recharts-area-curve')?.getAttribute('d').includes('C')`),'Trend lines use smooth cubic curves');
assert.equal(await evaluate(`document.querySelectorAll('.chart-panel linearGradient').length`),4,'Income and expenses have separate line/fill gradients');
assert.ok(await evaluate(`document.querySelectorAll('.chart-panel animate[repeatCount="indefinite"]').length>0`),'Chart has looping light motion');
 assert.ok(await evaluate(`(()=>{const ticks=[...document.querySelectorAll('.chart-panel .recharts-cartesian-axis-tick-label text')];return ticks.length>0&&ticks.every(t=>!t.textContent.includes('PHP')&&[...t.textContent].every(character=>character.trim()!=='')&&t.querySelectorAll('tspan').length<=1)})()`),'Axis uses uniform single-line numbers without PHP');
const incomeDashBefore=await evaluate(`parseFloat(getComputedStyle(document.querySelector('.income-tracer .recharts-area-curve')).strokeDashoffset)`);await wait(200);const incomeDashAfter=await evaluate(`parseFloat(getComputedStyle(document.querySelector('.income-tracer .recharts-area-curve')).strokeDashoffset)`);assert.ok(Math.abs(incomeDashAfter-incomeDashBefore)>1,'Income tracer actually moves along the line');

await evaluate(`document.querySelector('[aria-label="Pause motion"]').click()`);await until(`document.querySelector('.chart-panel').dataset.chartMotion==='paused'`);assert.equal(await evaluate(`document.querySelectorAll('.chart-panel animate').length`),0,'Pause stops chart sweeps'); assert.equal(await evaluate(`document.querySelectorAll('.income-tracer').length`),0,'Pause removes the income tracer');
await evaluate(`document.querySelector('[aria-label="Play motion"]').click()`);await until(`document.querySelector('.chart-panel').dataset.chartMotion==='running'`);
await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await until(`document.querySelector('.chart-panel').dataset.chartMotion==='paused'`);assert.equal(await evaluate(`document.querySelectorAll('.chart-panel animate').length`),0,'Reduced motion renders a static chart'); assert.equal(await evaluate(`document.querySelectorAll('.income-tracer').length`),0,'Reduced motion removes income tracer');await send('Emulation.setEmulatedMedia',{features:[]});await until(`document.querySelector('.chart-panel').dataset.chartMotion==='running'`);

await evaluate(`(()=>{const main=document.querySelector('.workspace-main');main.scrollTop+=document.querySelector('.chart-panel').getBoundingClientRect().top-main.getBoundingClientRect().top})()`); await screenshot('dashboard-performance'); const plot=await evaluate(`(()=>{const r=document.querySelector('.chart-canvas').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:plot.x,y:plot.y});await until(`document.querySelectorAll('.recharts-tooltip-item').length>0`);assert.equal(await evaluate(`document.querySelectorAll('.recharts-tooltip-item').length`),2,'Motion layer does not duplicate financial tooltip values');await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:4,y:4}); await evaluate(`document.querySelector('.workspace-main').scrollTop=0`);
for (const width of [768,1024]) { await viewport(width); await noOverflow(`dashboard ${width}`); } await viewport(1440);
assert.ok(await evaluate(`document.querySelector('.balance-amount').textContent.includes('31,500')`),'Net balance uses fixture totals');
await evaluate(`document.querySelector('.command-trigger').click()`); await until(`!!document.querySelector('.command-dialog')`);
await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',modifiers:8}); await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',modifiers:8});
assert.ok(await evaluate(`document.querySelector('.command-dialog').contains(document.activeElement)`),'Keyboard focus stays inside dialog');
await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'}); await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'}); await until(`!document.querySelector('.command-dialog')`);
await evaluate(`document.querySelector('button[aria-label="Sign out"]').click()`); await until(`!!document.querySelector('[aria-label="Sign out of Stewards"]')`);
await evaluate(`[...document.querySelectorAll('[aria-label="Sign out of Stewards"] button')].find(button=>button.textContent.includes('Stay here')).click()`); await until(`!document.querySelector('[aria-label="Sign out of Stewards"]')`);

await evaluate(`document.querySelector('.segmented-control button:nth-child(3)').click()`);
assert.equal(await evaluate(`document.querySelector('.segmented-control button:nth-child(3)').getAttribute('aria-pressed')`),'true');
await evaluate(`document.querySelector('.chart-data').open=true`);
assert.equal(await evaluate(`document.querySelectorAll('.chart-data tbody tr').length`),6);
await evaluate(`document.querySelector('.chart-data').open=false; document.querySelector('button[aria-label="Switch to dark mode"]').click()`);
await until(`!!document.querySelector('.theme-transition')`); await screenshot('theme-transition',250); await until(`!document.querySelector('.theme-transition')`);
await until(`document.documentElement.classList.contains('dark')`); await screenshot('dashboard-dark');
await viewport(390,844); await screenshot('dashboard-mobile'); await noOverflow('dashboard mobile');
await evaluate(`document.querySelector('[aria-label="Open navigation"]').click()`);
await until(`document.querySelector('.stewards-sidebar').getBoundingClientRect().left>=-0.1`);
await evaluate(`document.querySelector('.stewards-sidebar a[href="#/transactions"]').click()`); await until(`!!document.querySelector('.ledger-summary')`); await wait(500); await noOverflow('transactions mobile'); await screenshot('transactions-mobile');
await viewport(1440); await screenshot('transactions-desktop'); assert.ok(await evaluate(`document.querySelector('.compact-ledger-toolbar').getBoundingClientRect().height<80`),'Desktop transaction controls fit one compact row'); await evaluate(`document.querySelector('.review-queue').open=true`); await screenshot('transaction-review-queue'); await evaluate(`document.querySelector('.review-queue').open=false`);
await evaluate(`document.querySelector('button[role=combobox][aria-label="Financial period"]').click()`); await until(`!!document.querySelector('[data-select-popup]')`); await screenshot('dropdown-period');
await evaluate(`[...document.querySelectorAll('[role=option]')].find(option=>option.textContent.toLowerCase().includes('all financial periods')).click()`); await wait(300);
assert.equal(await evaluate(`document.querySelectorAll('.ledger-table tbody tr').length`),12,'Period dropdown updates React state');
await evaluate(`document.querySelector('button[aria-label="Next page"]').click()`); await wait(100); assert.equal(await evaluate(`document.querySelectorAll('.ledger-table tbody tr').length`),6,'Ledger pagination shows remaining records');
await evaluate(`document.querySelector('button[aria-label="Previous page"]').click()`);
await evaluate(`document.querySelector('button[role=combobox][aria-label="Sort transactions"]').click()`); await until(`!!document.querySelector('[role=option]')`);
await evaluate(`[...document.querySelectorAll('[role=option]')].find(option=>option.textContent.includes('Type: A to Z')).click()`);
assert.ok(await evaluate(`[...document.querySelectorAll('.ledger-table tbody tr')].slice(0,6).every(row=>row.dataset.txType==='EXPENSE')`),'Type sorting compares both records');

assert.equal(await evaluate(`document.querySelector('.ledger-table th:nth-child(4)').textContent`),'Receipt','Receipt column heading'); assert.equal(await evaluate(`document.querySelectorAll('.ledger-actions button').length`),await evaluate(`document.querySelectorAll('.ledger-table tbody tr').length*2`),'Rows expose only Edit and Delete'); assert.equal(await evaluate(`document.querySelectorAll('button.record-title').length`),0,'Account name is plain text'); assert.ok(await evaluate(`getComputedStyle([...document.querySelectorAll('.route-transactions button')].find(b=>b.textContent.includes('Add Transaction'))).backgroundImage.includes('gradient')`),'Blue primary actions use a gradient'); assert.equal(await evaluate(`getComputedStyle(document.querySelector('.ledger-table th button')).backgroundImage`),'none','Sort controls keep flat styling'); assert.ok(await evaluate(`document.querySelector('.ledger-account .ledger-remarks').textContent.includes('Synthetic UI fixture')`),'Remarks appear in Account column'); assert.ok(await evaluate(`[...document.querySelectorAll('.ledger-record .record-title')].some(b=>b.textContent==='General offerings')`),'Transaction label shows account name'); assert.ok(await evaluate(`document.querySelector('.ledger-account-number').textContent.includes('Account no.')`),'Account number replaces remarks beneath main label');
const selectedRowId=await evaluate(`document.querySelector('tr[data-tx-id="00000000-0000-4000-8000-000000000006"] .record-title').closest('tr').dataset.txId`); await evaluate(`document.querySelector('tr[data-tx-id="00000000-0000-4000-8000-000000000006"] .record-title').closest('tr').querySelector('.ledger-date').click()`); await until(`!!document.querySelector('.record-dialog')`); assert.equal(await evaluate(`document.querySelector('.record-payee').textContent`),selectedRowId,'Unnamed transaction uses its actual full ID'); assert.equal(await evaluate(`document.querySelector('.record-reference').textContent`),selectedRowId,'Detail reference shows the full ID'); await screenshot('transaction-detail');
await viewport(390,844); await screenshot('transaction-detail-mobile');
await evaluate(`document.querySelector('[aria-label="Close transaction details"]').click()`); await viewport(1440); await evaluate(`document.querySelector('.ledger-clickable-row').focus()`); await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter'}); await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter'}); await until(`!!document.querySelector('.record-dialog')`); await evaluate(`document.querySelector('[aria-label="Close transaction details"]').click()`); await evaluate(`document.querySelector('.ledger-actions button[aria-label^="Edit "]').click()`); await until(`!!document.querySelector('.transaction-editor')`); assert.ok(await evaluate(`!document.querySelector('.record-dialog')`),'Row edit action does not open Details'); await evaluate(`document.querySelector('.transaction-editor [aria-label="Close dialog"]').click()`);
await evaluate(`[...document.querySelectorAll('.route-transactions button')].find(button=>button.textContent.includes('Add Transaction')).click()`); await until(`!!document.querySelector('.transaction-editor')`); await wait(300); assert.equal(await evaluate(`document.querySelectorAll('.entry-details-column > .entry-field-group').length`),3,'Three detail groups share one card');
await viewport(1366,768); await screenshot('transaction-entry'); assert.equal(await evaluate(`getComputedStyle(document.querySelector('.entry-amount-icon')).color`),'rgb(156, 214, 229)','Amount icon uses visible theme accent');
assert.ok(await evaluate(`(()=>{const a=document.querySelector('.entry-details-column').getBoundingClientRect();const b=document.querySelector('.entry-amounts-column').getBoundingClientRect();return b.left>=a.right})()`),'Details and amount controls sit side by side');
assert.ok(await evaluate(`(()=>{const button=document.querySelector('.transaction-editor button[form="tx-form"]');const r=button.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===button})()`),'Review/save action remains visible and reachable');
assert.ok(await evaluate(`(()=>{const body=document.querySelector('.transaction-editor .dialog-body');return body.scrollHeight<=body.clientHeight+2})()`),'Standard desktop transaction entry needs no scrolling');
await viewport(1440);
await evaluate(`document.querySelector('.entry-type-tabs button:nth-child(2)').click()`); await wait(100); assert.ok(await evaluate(`(()=>{const tabs=document.querySelector('.entry-type-tabs');const x=new DOMMatrix(getComputedStyle(tabs,'::before').transform).m41;return x>0&&x<tabs.clientWidth/2})()`),'Transaction selection panel moves between types'); assert.equal(await evaluate(`getComputedStyle(document.querySelector('.entry-form')).animationName`),'panel-switch'); await wait(250); assert.equal(await evaluate(`getComputedStyle(document.querySelector('.entry-type-tabs'),'::before').backgroundColor`),'rgb(147, 100, 47)','Disbursement selection uses amber'); await screenshot('transaction-expense'); await evaluate(`document.querySelector('.entry-type-tabs button:first-child').click()`); await wait(350);

await evaluate(`document.querySelector('.transaction-editor button[aria-label="Account number & name"]').click()`); await until(`!!document.querySelector('[role=option]')`);
assert.ok(await evaluate(`!!document.querySelector('.select-search input')`),'Long dropdowns provide search');
await evaluate(`(()=>{const input=document.querySelector('.select-search input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'General');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
await evaluate(`[...document.querySelectorAll('[role=option]')].find(option=>option.textContent.includes('General offerings')).click()`);
await evaluate(`[...document.querySelectorAll('.transaction-editor button')].find(button=>button.textContent.includes('Enable Itemized')).click()`);
await evaluate(`(()=>{const input=document.querySelector('.transaction-editor input[aria-label="Tither or item name"]');input.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Preview');input.dispatchEvent(new Event('input',{bubbles:true}));})()`); await until(`!!document.querySelector('[aria-label="Member suggestions"] [role=option]')`);
await evaluate(`document.querySelector('[aria-label="Member suggestions"] [role=option]').click()`);
assert.equal(await evaluate(`document.querySelector('.transaction-editor input[aria-label="Tither or item name"]').value`),'Preview member');
await evaluate(`[...document.querySelectorAll('.transaction-editor button')].find(button=>button.textContent.includes('Itemized Active')).click()`);

assert.ok(await evaluate(`document.querySelector('.transaction-editor button[aria-label="Account number & name"]').textContent.includes('General offerings')`),'Account selection updates');
await evaluate(`(()=>{const input=document.querySelector('.transaction-editor input[placeholder="0.00"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'1234.50'); input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
await evaluate(`document.getElementById('tx-form').requestSubmit()`); await until(`!!document.querySelector('.review-dialog')`); await screenshot('transaction-review');
assert.ok(await evaluate(`document.querySelector('.review-amount-panel').textContent.includes('1,234.50')`));
await evaluate(`[...document.querySelectorAll('.review-dialog button')].find(button=>button.textContent.includes('Edit details')).click()`); await until(`!document.querySelector('.review-dialog')`);
await viewport(390,844); await screenshot('transaction-entry-mobile');
await evaluate(`document.querySelector('.transaction-editor .dialog-header button[aria-label="Close dialog"]').click()`); await viewport(1440);
await evaluate(`[...document.querySelectorAll('.route-transactions button')].find(button=>button.textContent.includes('Audit Logs')).click()`); await until(`document.querySelectorAll('.audit-event').length===3`); await screenshot('audit-history'); await viewport(390,844); await screenshot('audit-history-mobile'); await evaluate(`document.querySelector('.audit-history [aria-label="Close dialog"]').click()`); await viewport(1440);
await evaluate(`[...document.querySelectorAll('.route-transactions button')].find(button=>button.textContent.includes('Guide')).click()`); await until(`!!document.querySelector('[data-dialog-layer]')`); await screenshot('category-guide'); await viewport(390,844); await screenshot('category-guide-mobile'); await viewport(1440);
await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'}); await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'}); await until(`!document.querySelector('[data-dialog-layer]')`);

await evaluate(`location.hash='/reconciliation'`); await until(`!!document.querySelector('.reconciliation-steps')`); await screenshot('reconciliation-desktop');
await viewport(390,844); await noOverflow('reconciliation mobile'); await screenshot('reconciliation-mobile');
for (const route of ['export-center','tithers','financial-setup','admin','coop-ledger','mission-readiness','missionary-report']) {
  await viewport(1440); await evaluate(`location.hash='/${route}'`); await wait(300); await until(`!!document.querySelector('.workspace-main h1')`); await wait(500); await noOverflow(`${route} desktop`); if(route!=='missionary-report') await screenshot(`${route}-desktop`);
  if(route==='export-center') { assert.equal(await evaluate(`getComputedStyle([...document.querySelectorAll('.route-export-center button')].find(b=>b.textContent.includes('Download ComBud'))).backgroundColor`),'rgb(52, 93, 122)','Export button follows dark action palette'); }
  if(route==='missionary-report') {
    assert.ok(await evaluate(`(()=>{const row=document.querySelector('.service-row');const fields=[row.querySelector('.service-message textarea'),row.querySelector('.service-objective textarea'),row.querySelector('.service-scripture input'),row.querySelector('.service-attendance input')];const tops=fields.map(f=>f.getBoundingClientRect().top);return Math.max(...tops)-Math.min(...tops)<2})()`),'Ministry report field tops align');
    await evaluate(`(()=>{for(const [label,value] of [['P / M Name','Preview missionary'],['Overseer','Preview overseer']]){const input=document.querySelector('input[aria-label="'+label+'"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));}})()`); await screenshot('missionary-report-desktop');
  }
  if(route==='financial-setup') {
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.setup-panel')).backgroundColor`),'rgb(21, 28, 38)','Financial Setup uses shared dark surface');
    await evaluate(`document.querySelector('[aria-label^="Edit budget for"]').click()`); await until(`!!document.querySelector('[aria-label="Cancel budget edit"]')`); await screenshot('setup-edit-base-budget'); await evaluate(`document.querySelector('[aria-label="Cancel budget edit"]').click()`);
    for(const [index,name] of [[2,'budget'],[3,'reset']]) {await evaluate(`document.querySelector('.route-financial-setup .system-switch-tabs button:nth-child(${index})').click()`);await wait(350); await screenshot('setup-'+name+'-desktop');await viewport(390,844);await noOverflow('setup '+name+' mobile');await screenshot('setup-'+name+'-mobile');await viewport(1440);}
    assert.ok(await evaluate(`document.querySelector('.setup-reset-fields>div:last-child>button').disabled`),'Reset remains disabled without confirmation'); await evaluate(`document.querySelector('.route-financial-setup .system-switch-tabs button:nth-child(2)').click()`); await wait(350);assert.equal(await evaluate(`getComputedStyle([...document.querySelectorAll('.setup-panel button')].find(b=>b.textContent.includes('Save Targets'))).backgroundColor`),'rgb(52, 93, 122)','Setup save action uses blue');await evaluate(`document.querySelector('.setup-type-tabs button:nth-child(2)').click()`);await wait(350);assert.equal(await evaluate(`document.querySelectorAll('.setup-targets-table tbody tr').length`),1,'Expense budget filter shows matching accounts');assert.equal(await evaluate(`document.querySelector('.setup-targets-table tbody td:first-child').getAttribute('data-label')`),'Account number','Budget codes have the correct mobile label');await screenshot('setup-expense-targets');await evaluate(`document.querySelector('.route-financial-setup .system-switch-tabs button:first-child').click()`);await wait(350);
  }
  if(route==='admin') {
    await until(`document.querySelector('.route-admin time')?.textContent.includes('9:00')`); assert.ok(await evaluate(`document.querySelector('.route-admin thead').textContent.includes('Last login (PHT)')`));
    assert.equal(await evaluate(`getComputedStyle([...document.querySelectorAll('.route-admin button')].find(b=>b.textContent.includes('Add New User'))).backgroundColor`),'rgb(52, 93, 122)','Admin primary button follows dark action palette'); assert.equal(await evaluate(`getComputedStyle(document.querySelector('.route-admin .bento-card')).backgroundColor`),'rgb(21, 28, 38)','Admin card follows shared dark surface');
    await evaluate(`document.querySelector('.route-admin .switch-tabs button:nth-child(2)').click()`); await wait(100); assert.ok(await evaluate(`(()=>{const t=document.querySelector('.route-admin .switch-tabs');const x=new DOMMatrix(getComputedStyle(t,'::before').transform).m41;return x>0&&x<t.clientWidth/3})()`),'Admin selection panel animates'); await wait(250); await screenshot('admin-system'); await evaluate(`document.querySelector('.route-admin .switch-tabs button:nth-child(3)').click()`); await wait(350); await screenshot('admin-categories'); await evaluate(`document.querySelector('.route-admin .switch-tabs button:first-child').click()`); await wait(350);
    await evaluate(`[...document.querySelectorAll('.route-admin button')].find(button=>button.textContent.trim()==='Delete').click()`); await until(`!!document.querySelector('.feedback-message')`); assert.ok(await evaluate(`document.querySelector('.feedback-message').textContent.includes('cannot delete your own')`)); await screenshot('feedback-message'); await evaluate(`document.querySelector('[aria-label="Dismiss notification"]').click()`);
  }
  if(route==='coop-ledger') {
    const rowCount=await evaluate(`document.querySelectorAll('.route-coop-ledger tbody tr').length`);
    await evaluate(`document.querySelector('[aria-label="Remove cooperative transaction"]').click()`); await until(`!!document.querySelector('[aria-label="Confirm action"]')`); await screenshot('confirmation-dialog'); await evaluate(`document.querySelector('[aria-label="Confirm action"] .button-secondary').click()`); assert.equal(await evaluate(`document.querySelectorAll('.route-coop-ledger tbody tr').length`),rowCount,'Cancelling confirmation preserves ledger');
  }
  await viewport(390,844); await wait(250); await noOverflow(`${route} mobile`); await screenshot(`${route}-mobile`);
}
for(const route of ['transactions','reconciliation','export-center','tithers','financial-setup','admin','coop-ledger','mission-readiness','missionary-report']) {
  await viewport(1440); await evaluate(`location.hash='/${route}'`); await wait(250); await until(`!!document.querySelector('.workspace-main h1')`);
  if(await evaluate(`document.documentElement.classList.contains('dark')`)) { await evaluate(`document.querySelector('button[aria-label="Switch to light mode"]').click()`); await until(`!!document.querySelector('.theme-transition.to-light')`); await screenshot('theme-transition-light',250); assert.equal(await evaluate(`getComputedStyle(document.querySelector('.theme-transition .orbit-system')).stroke`),'rgb(71, 106, 128)'); await until(`!document.querySelector('.theme-transition')`); }
  if(route==='financial-setup') { for(const [index,name] of [[1,'years'],[2,'budget'],[3,'reset']]) { await evaluate(`document.querySelector('.route-financial-setup .system-switch-tabs button:nth-child(${index})').click()`);await wait(350);assert.equal(await evaluate(`getComputedStyle(document.querySelector('.setup-panel')).backgroundColor`),'rgb(255, 255, 255)','Setup panel follows light theme');await screenshot('setup-'+name+'-light');} }
  await noOverflow(`${route} light desktop`);
  await viewport(390,844); await noOverflow(`${route} light mobile`);
}
assert.deepEqual(backendWrites,[],'No live or mocked backend writes during visual checks');
assert.deepEqual(errors,[],'No uncaught browser exceptions');
console.log('PASS: every route desktop/mobile; continuous login/dashboard motion with pause and reduced motion; full-screen theme transition; custom dropdown selection; transaction entry/review/detail dialogs; dashboard totals/chart; responsive ledger, pagination and type sorting; both themes on every route. Synthetic backend only; no saves.');
} finally {
  try { await send('Page.close'); } finally { socket.close(); }
}

/** Little Shopper Mission: direct static website + Google Sheets. */
const TOTAL_PAGES = 15;
const SESSION_HEADERS = ['session_id','visitor_id','started_at','last_seen_at','device','browser','platform','source','last_page','pages_seen_json','page_seconds_json','reading_seconds','completed','exited','sequence'];
const PAGE_TITLES = ['ยินดีต้อนรับ นักช้อปตัวน้อย','เมื่อวานซื้ออะไรกันนะ?','ต้องมี หรือแค่อยากได้?','ความจำเป็น','ความต้องการ','ช่วยแก๊งเหมียวแยกของหน่อย!','เงินเรามีจำกัด!','กฎเหล็กของนักช้อปที่ฉลาด','พลังวิเศษของการออมเงิน','ภารกิจนักช้อปเริ่มแล้ว!','ช้อปอย่างไรในงบ 200 บาท','กติกาภารกิจ','ได้อะไรมาบ้างเอ่ย?','ภารกิจสำเร็จ!','ถึงตาเพื่อน ๆ ลุยเดี่ยวแล้ว'];

function setup() {
  const p = PropertiesService.getScriptProperties();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('เปิด Apps Script จาก Extensions ใน Google Sheet ก่อนรัน setup');
  p.setProperty('SPREADSHEET_ID', ss.getId());
  if (!p.getProperty('ADMIN_PIN')) p.setProperty('ADMIN_PIN', '1234');
  ensureSheet_(ss, 'Sessions', SESSION_HEADERS);
  ensureSheet_(ss, 'PageTime', ['หน้า','หัวข้อ','เวลาอ่านรวม (วินาที)','ครั้งที่เปิด','ผู้เปิดอ่านไม่ซ้ำ','ครั้งที่หยุดอ่านหน้านี้']);
  ensureSheet_(ss, 'Dashboard', ['สถิติ','ค่า']);
  ss.setSpreadsheetTimeZone('Asia/Bangkok');
  if (!ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='refreshDashboard')) ScriptApp.newTrigger('refreshDashboard').timeBased().everyMinutes(5).create();
  refreshDashboard();
  console.log('ตั้งค่าชีตเรียบร้อย: '+ss.getUrl());
}
function onOpen(){SpreadsheetApp.getUi().createMenu('Little Shopper').addItem('อัปเดตสถิติทันที','refreshDashboard').addToUi();}
function ensureSheet_(ss,name,headers){let sh=ss.getSheetByName(name);if(!sh)sh=ss.insertSheet(name);if(sh.getLastRow()===0){sh.getRange(1,1,1,headers.length).setValues([headers]);sh.getRange(1,1,1,headers.length).setBackground('#31483e').setFontColor('#ffffff').setFontWeight('bold');sh.setFrozenRows(1);sh.autoResizeColumns(1,headers.length);}return sh;}
function output_(ok,data,error,code){return ContentService.createTextOutput(JSON.stringify({ok:ok,data:data||null,error:error||null,code:code||200})).setMimeType(ContentService.MimeType.JSON);}
function doGet(e){
 const q=e&&e.parameter||{};if(!q.callback)return output_(true,{service:'Little Shopper Sheets',ready:!!PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')});
 if(!/^ls_[a-f0-9]{32}$/.test(q.callback))return output_(false,null,'Invalid callback',400);
 let result;try{if(!q.payload||q.payload.length>16000)error_('Invalid payload',400);result=dispatch_(JSON.parse(q.payload));}catch(ex){result=output_(false,null,'Invalid request',400);}
 return ContentService.createTextOutput(q.callback+'('+result.getContent()+');').setMimeType(ContentService.MimeType.JAVASCRIPT);
}
function doPost(e){try{const b=JSON.parse(e.postData.contents);if(b.action!=='track')return output_(false,null,'Invalid action',400);return dispatch_(b);}catch(ex){return output_(false,null,'Invalid request',400);}}

function equal_(a,b){a=String(a||'');b=String(b||'');let difference=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)difference|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return difference===0;}
function sha_(s){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(s)).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');}
function error_(message,code){const e=new Error(message);e.code=code;throw e;}
function ss_(){const id=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');if(!id)error_('กรุณารัน setup ใน Apps Script ก่อน',503);return SpreadsheetApp.openById(id);}
function dispatch_(b){
 let lock;
 try{
  const p=PropertiesService.getScriptProperties();
  if(b.action==='login'){
   lock=LockService.getScriptLock();lock.waitLock(10000);
   if(typeof b.pin!=='string'||!/^\d{4}$/.test(b.pin)||!/^[a-f0-9]{32}$/.test(b.rateKey))error_('คำขอไม่ถูกต้อง',400);
   const cache=CacheService.getScriptCache();const key='rate:'+b.rateKey+':'+Math.floor(Date.now()/900000);const count=Number(cache.get(key)||0)+1;cache.put(key,String(count),900);
   if(count>5)error_('ลอง PIN หลายครั้งแล้ว กรุณารอ 15 นาที',429);
   if(!equal_(b.pin,p.getProperty('ADMIN_PIN')))error_('PIN ไม่ถูกต้อง',401);
   const token=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');cache.put('auth:'+sha_(token),'1',21600);
   return output_(true,{token:token});
  }
  if(b.action==='logout'){if(b.token)CacheService.getScriptCache().remove('auth:'+sha_(b.token));return output_(true,{loggedOut:true});}
  if(b.action==='stats'){
   if(!/^[a-f0-9]{64}$/.test(String(b.token))||!CacheService.getScriptCache().get('auth:'+sha_(b.token)))error_('กรุณากรอก PIN อีกครั้ง',401);
   return output_(true,stats_([7,30,90].indexOf(Number(b.days))>=0?Number(b.days):7));
  }
  if(b.action!=='track')error_('Unknown action',400);
  lock=LockService.getScriptLock();lock.waitLock(10000);track_(b.event);
  return output_(true,{saved:true});
 }catch(ex){return output_(false,null,ex.code?ex.message:'ระบบชีตไม่พร้อมใช้งาน กรุณาตรวจว่าได้รัน setup แล้ว',ex.code||503);}
 finally{if(lock)lock.releaseLock();}
}
function track_(b){
 const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
 if(!b||!uuid.test(String(b.sessionId))||!uuid.test(String(b.visitorId))||['start','page','tick','exit'].indexOf(b.type)<0||!Number.isInteger(b.sequence)||b.sequence<1||!Number.isInteger(b.page)||b.page<1||b.page>15||!Array.isArray(b.seen)||b.seen.length>15||!b.seen.every(n=>Number.isInteger(n)&&n>=1&&n<=15)||!Array.isArray(b.pageSeconds)||b.pageSeconds.length!==15||!b.pageSeconds.every(n=>typeof n==='number'&&isFinite(n)&&n>=0&&n<=86400))error_('Invalid event',400);
 const sh=ensureSheet_(ss_(),'Sessions',SESSION_HEADERS);const now=new Date();
 const found=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,1).createTextFinder(b.sessionId).matchEntireCell(true).findNext():null;
 let row=found?sh.getRange(found.getRow(),1,1,15).getValues()[0]:null;
 if(row&&row[1]!==b.visitorId)error_('Session belongs to another visitor',403);
 if(!row){const started=new Date(Math.min(now.getTime(),Math.max(now.getTime()-86400000,Number(b.startedAt)||now.getTime())));row=[b.sessionId,b.visitorId,started,now,safe_(b.device),safe_(b.browser),safe_(b.platform),safe_(b.source),b.page,'[]',JSON.stringify(Array(15).fill(0)),0,false,false,0];}
 const seen=Array.from(new Set(JSON.parse(row[9]).concat(b.seen))).sort((a,b)=>a-b);
 const old=JSON.parse(row[10]);const incoming=b.pageSeconds.map((n,i)=>Math.max(old[i]||0,n));
 const previous=old.reduce((a,b)=>a+b,0);const wanted=incoming.reduce((a,b)=>a+b,0);const budget=Math.max(previous,(now.getTime()-new Date(row[2]).getTime())/1000+3);
 const scale=wanted>previous?Math.min(1,Math.max(0,budget-previous)/(wanted-previous)):1;
 const durations=incoming.map((n,i)=>Math.round(((old[i]||0)+(n-(old[i]||0))*scale)*10)/10);
 row[9]=JSON.stringify(seen);row[10]=JSON.stringify(durations);row[11]=Math.round(durations.reduce((a,b)=>a+b,0)*10)/10;row[12]=!!row[12]||seen.length===TOTAL_PAGES;
 if(b.sequence>Number(row[14])){row[3]=now;row[8]=b.page;row[13]=b.type==='exit';row[14]=b.sequence;}
 const target=found?found.getRow():sh.getLastRow()+1;sh.getRange(target,1,1,15).setValues([row]);sh.getRange(target,3,1,2).setNumberFormat('yyyy-mm-dd hh:mm:ss');
}
function safe_(v){const s=String(v||'').slice(0,100);return /^[=+@-]/.test(s)?"'"+s:s;}
function records_(){const sh=ss_().getSheetByName('Sessions');return !sh||sh.getLastRow()<2?[]:sh.getRange(2,1,sh.getLastRow()-1,15).getValues().map(r=>({id:r[0],visitorId:r[1],createdAt:new Date(r[2]).getTime()/1000,lastSeen:new Date(r[3]).getTime()/1000,device:r[4],browser:r[5],platform:r[6],source:r[7],lastPage:Number(r[8]),seen:JSON.parse(r[9]||'[]'),seconds:JSON.parse(r[10]||'[]'),readingSeconds:Number(r[11]),completed:r[12]===true||r[12]==='TRUE',exited:r[13]===true||r[13]==='TRUE'}));}
function stats_(days){
 const now=Math.floor(Date.now()/1000);const since=days?Math.floor((now+25200)/86400)*86400-25200-(days-1)*86400:0;
 const rows=records_().filter(r=>r.createdAt>=since);const visitors=new Set(rows.map(r=>r.visitorId));const finished=new Set(rows.filter(r=>r.completed).map(r=>r.visitorId));
 const daily={};const devices={};const pageStats=Array.from({length:15},(_,i)=>({page:i+1,count:0,seconds:0,dropouts:0,visitors:new Set()}));
 rows.forEach(r=>{const day=Utilities.formatDate(new Date(r.createdAt*1000),'Asia/Bangkok','yyyy-MM-dd');if(!daily[day])daily[day]={day:day,visits:0,visitors:new Set(),readers:0};daily[day].visits++;daily[day].readers++;daily[day].visitors.add(r.visitorId);devices[r.device]=(devices[r.device]||0)+1;
  r.seen.forEach(n=>{pageStats[n-1].count++;pageStats[n-1].visitors.add(r.visitorId);});r.seconds.forEach((n,i)=>{pageStats[i].seconds+=Number(n)||0;});if(!r.completed&&(r.exited||now-r.lastSeen>1800)&&r.lastPage>=1)pageStats[r.lastPage-1].dropouts++;
 });
 const pages=pageStats.map(p=>({page:p.page,count:p.count,seconds:Math.round(p.seconds*10)/10,dropouts:p.dropouts,uniqueReaders:p.visitors.size}));const totalSeconds=rows.reduce((s,r)=>s+r.readingSeconds,0);const hot=pages.reduce((best,p)=>p.seconds>best.seconds?p:best,{page:0,seconds:0});
 return {days:days||0,updatedAt:now,storage:'google-sheets',configured:true,totals:{sessions:rows.length,visitors:visitors.size,readers:visitors.size,completed:finished.size,incomplete:visitors.size-finished.size,readingSeconds:totalSeconds,avgSeconds:rows.length?totalSeconds/rows.length:0,hottestPage:hot.page,hottestSeconds:hot.seconds},active:new Set(rows.filter(r=>!r.exited&&now-r.lastSeen<=90).map(r=>r.visitorId)).size,daily:Object.keys(daily).sort().map(k=>({day:k,visits:daily[k].visits,visitors:daily[k].visitors.size,readers:daily[k].readers})),devices:Object.keys(devices).map(k=>({device:k,count:devices[k]})),pages:pages,recent:rows.slice().sort((a,b)=>b.createdAt-a.createdAt).slice(0,50).map(r=>({visitor:r.visitorId.slice(0,8),createdAt:r.createdAt,device:r.device,browser:r.browser,platform:r.platform,source:r.source,readingSeconds:r.readingSeconds,started:1,lastPage:r.lastPage,pagesRead:r.seen.length,exited:r.exited}))};
}
function refreshDashboard(){
 const lock=LockService.getScriptLock();lock.waitLock(10000);
 try{const data=stats_(0);const ss=ss_();const sh=ensureSheet_(ss,'Dashboard',['สถิติ','ค่า']);
 const values=[['คนกดเริ่มอ่าน (เบราว์เซอร์ไม่ซ้ำ)',data.totals.readers],['คนอ่านจบ (เปิดครบ 15 หน้า)',data.totals.completed],['คนยังอ่านไม่จบ',data.totals.incomplete],['จำนวนครั้งที่เริ่มอ่าน',data.totals.sessions],['หน้าที่ใช้เวลาอ่านมากที่สุด',data.totals.hottestPage||'ยังไม่มีข้อมูล'],['เวลาอ่านรวมของหน้านั้น (วินาที)',data.totals.hottestSeconds],['เวลาอ่านรวมทั้งหมด (วินาที)',data.totals.readingSeconds],['อัปเดตล่าสุด',new Date()],['นิยามยังไม่จบ','รวมผู้ที่กำลังอ่านอยู่; หากคนเดิมอ่านจบภายหลัง จะย้ายไปฝั่งอ่านจบ']];sh.getRange(2,1,values.length,2).setValues(values);sh.autoResizeColumns(1,2);
 const p=ensureSheet_(ss,'PageTime',['หน้า','หัวข้อ','เวลาอ่านรวม (วินาที)','ครั้งที่เปิด','ผู้เปิดอ่านไม่ซ้ำ','ครั้งที่หยุดอ่านหน้านี้']);p.getRange(2,1,15,6).setValues(data.pages.map(x=>[x.page,PAGE_TITLES[x.page-1],x.seconds,x.count,x.uniqueReaders,x.dropouts]));p.autoResizeColumns(1,6);
 }finally{lock.releaseLock();}
}

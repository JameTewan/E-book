import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createHash,randomUUID} from 'node:crypto';

let now=Date.now();class TestDate extends Date{constructor(v){super(arguments.length?v:now);}static now(){return now;}}
class Range{constructor(s,r,c,n=1,m=1){Object.assign(this,{s,r,c,n,m});}getValues(){return Array.from({length:this.n},(_,i)=>Array.from({length:this.m},(_,j)=>this.s.rows[this.r+i-1]?.[this.c+j-1]??''));}setValues(values){values.forEach((row,i)=>row.forEach((value,j)=>{this.s.rows[this.r+i-1]??=[];this.s.rows[this.r+i-1][this.c+j-1]=value;}));return this;}createTextFinder(text){const range=this;return {matchEntireCell(){return this;},findNext(){for(let i=0;i<range.n;i++)if(range.s.rows[range.r+i-1]?.[range.c-1]===text)return {getRow:()=>range.r+i};return null;}};}setBackground(){return this;}setFontColor(){return this;}setFontWeight(){return this;}setNumberFormat(){return this;}}
class Sheet{constructor(){this.rows=[];}getLastRow(){return this.rows.length;}getRange(...args){return new Range(this,...args);}setFrozenRows(){}autoResizeColumns(){}}
const sheets=new Map();const ss={getId:()=> 'test-sheet',getUrl:()=> 'https://test.invalid/sheet',getSheetByName:n=>sheets.get(n),insertSheet:n=>{const s=new Sheet();sheets.set(n,s);return s;},setSpreadsheetTimeZone(){}};
const props=new Map([['SPREADSHEET_ID','test-sheet'],['INGEST_SECRET','unit-test-secret'],['ADMIN_PIN','8056']]);const cache=new Map();
const context=vm.createContext({console,Date:TestDate,Set,Array,JSON,Math,Number,String,isFinite,Error,PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v)})},SpreadsheetApp:{getActiveSpreadsheet:()=>ss,openById:()=>ss},ScriptApp:{getProjectTriggers:()=>[],newTrigger:()=>({timeBased(){return this;},everyMinutes(){return this;},create(){}})},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},CacheService:{getScriptCache:()=>({get:k=>{const v=cache.get(k);return v&&v.until>now?v.value:null;},put:(k,v,ttl)=>cache.set(k,{value:v,until:now+ttl*1000}),remove:k=>cache.delete(k)})},Utilities:{getUuid:randomUUID,DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,v)=>[...createHash('sha256').update(v).digest()].map(n=>n>127?n-256:n),formatDate:d=>new Date(d.getTime()+25200000).toISOString().slice(0,10)},ContentService:{MimeType:{JSON:'json',JAVASCRIPT:'javascript'},createTextOutput:text=>({getContent:()=>text,setMimeType(){return {text,getContent:()=>text};}})}});
vm.runInContext(await readFile('google-apps-script/Code.gs','utf8'),context);
context.setup();let checks=0;const check=(condition,name)=>{assert.ok(condition,name);checks++;console.log('PASS',name);};
const call=b=>JSON.parse(context.dispatch_(b).getContent());
check(call({action:'stats'}).code===401,'Statistics require PIN session');
check(call({action:'login',pin:'0000',rateKey:'a'.repeat(32)}).code===401,'Incorrect PIN rejected');
const login=call({action:'login',pin:'8056',rateKey:'a'.repeat(32)});check(login.ok,'PIN login returns session');
const token=login.data.token;
const sid=randomUUID(),vid=randomUUID();const event={type:'start',sessionId:sid,visitorId:vid,sequence:1,startedAt:now,page:1,seen:[],pageSeconds:Array(15).fill(0),device:'มือถือ'};
check(call({action:'track',event}).ok,'Start recorded');check(sheets.get('Sessions').rows.length===2,'One row per attempt');
now+=20000;event.type='exit';event.sequence=2;event.seen=Array.from({length:15},(_,i)=>i+1);event.page=15;event.pageSeconds=Array(15).fill(1);event.pageSeconds[3]=4;
check(call({action:'track',event}).ok,'Reading completion stored');call({action:'track',event});
check(sheets.get('Sessions').rows.length===2,'Retry does not duplicate');
let stats=call({action:'stats',token,days:7}).data;
check(stats.totals.completed===1&&stats.totals.incomplete===0,'Complete readers computed');check(stats.totals.hottestPage===4&&stats.totals.hottestSeconds===4,'Longest page measured');
call({action:'track',event:{...event,sessionId:randomUUID(),visitorId:randomUUID(),seen:[1,5],page:5,pageSeconds:Array(15).fill(0)}});
stats=call({action:'stats',token,days:7}).data;check(stats.totals.readers===2&&stats.totals.incomplete===1,'Unfinished readers computed');check(stats.pages[4].dropouts===1,'Last abandoned page recorded');
const callback='ls_'+'a'.repeat(32);const jsonp=context.doGet({parameter:{callback,payload:JSON.stringify({action:'stats',token})}}).getContent();check(jsonp.startsWith(callback+'('),'Direct cross-origin callback supported');
check(JSON.parse(context.doGet({parameter:{callback:'alert(1)',payload:'{}'}}).getContent()).code===400,'Callback injection rejected');
check(JSON.parse(context.doPost({postData:{contents:JSON.stringify({action:'stats',token})}}).getContent()).code===400,'Unload POST only accepts tracking');
check(JSON.parse(context.doPost({postData:{contents:JSON.stringify({action:'track',event})}}).getContent()).ok,'Unload beacon tracking supported');
context.refreshDashboard();check(sheets.get('PageTime').rows.length===16,'Sheet summary generated');
call({action:'logout',token});check(call({action:'stats',token}).code===401,'Logout revokes token');
for(let i=0;i<5;i++)call({action:'login',pin:'0000',rateKey:'b'.repeat(32)});check(call({action:'login',pin:'8056',rateKey:'b'.repeat(32)}).code===429,'PIN attempt limit');
console.log(`Verified ${checks} assertions in simulated Apps Script / Sheets. Live Google connection requires your URL.`);

declare global {interface Window {EBOOK_CONFIG?:{WEB_APP_URL:string};[key:string]:any;}}
const tokenKey='shopper-admin-token';
function url(){const u=window.EBOOK_CONFIG?.WEB_APP_URL?.trim()||'';if(!/^https:\/\/script.google.com\/macros\/s\/[^/]+\/exec$/.test(u))throw new Error('กรุณาวาง Web App URL ใน config.js ก่อน');return u;}
function token(){try{return sessionStorage.getItem(tokenKey)||'';}catch{return '';}}
function identity(){try{let id=localStorage.getItem('shopper-login-key');if(!id){id=crypto.randomUUID().replace(/-/g,'');localStorage.setItem('shopper-login-key',id);}return id;}catch{return crypto.randomUUID().replace(/-/g,'');}}
function eventData(event:any){const ua=navigator.userAgent;let source='เข้าชมโดยตรง';try{const ref=new URL(event.referrer);if(ref.hostname!==location.hostname)source=ref.hostname;}catch{}return {...event,device:/iPad|Tablet/i.test(ua)||(/Android/i.test(ua)&&!/Mobile/i.test(ua))?'แท็บเล็ต':/Mobile|iPhone/i.test(ua)?'มือถือ':'คอมพิวเตอร์',browser:/Edg/i.test(ua)?'Edge':/Firefox|FxiOS/i.test(ua)?'Firefox':/Chrome|CriOS/i.test(ua)?'Chrome':/Safari/i.test(ua)?'Safari':'อื่น ๆ',platform:/iPhone|iPad/i.test(ua)?'iOS':/Android/i.test(ua)?'Android':/Windows/i.test(ua)?'Windows':/Macintosh/i.test(ua)?'macOS':/Linux/i.test(ua)?'Linux':'อื่น ๆ',source};}
export async function apiCall(path:string,options:RequestInit={}){
 const action=path.includes('/track')?'track':path.includes('/login')?'login':path.includes('/logout')?'logout':'stats';
 const body=options.body?JSON.parse(String(options.body)):{};
 const payload=action==='track'?{action,event:eventData(body)}:{action,...body,days:Number(new URL(path,'https://local.test').searchParams.get('days')||7),token:token(),rateKey:identity()};
 const endpoint=url();const result:any=await new Promise((resolve,reject)=>{const callback='ls_'+crypto.randomUUID().replace(/-/g,'');const script=document.createElement('script');let timer:ReturnType<typeof setTimeout>;const cleanup=()=>{clearTimeout(timer);script.remove();delete window[callback];};window[callback]=(data:any)=>{cleanup();resolve(data);};script.onerror=()=>{cleanup();reject(new Error('เชื่อม Google Script ไม่ได้ ตรวจ URL และสิทธิ์ Anyone'));};timer=setTimeout(()=>{cleanup();reject(new Error('Google Script ตอบช้า กรุณาลองอีกครั้ง'));},35000);script.src=endpoint+'?callback='+callback+'&payload='+encodeURIComponent(JSON.stringify(payload));script.referrerPolicy='no-referrer';document.head.appendChild(script);});
 if(result.ok&&action==='login'){try{sessionStorage.setItem(tokenKey,result.data.token);}catch{}}
 if(action==='logout'||result.code===401){try{sessionStorage.removeItem(tokenKey);}catch{}}
 return {ok:!!result.ok,status:result.code||200,json:async()=>result.ok?result.data:{error:result.error}};
}
export function sendExit(snapshot:unknown){try{navigator.sendBeacon?.(url(),new Blob([JSON.stringify({action:'track',event:eventData(snapshot)})],{type:'text/plain;charset=UTF-8'}));}catch{}}

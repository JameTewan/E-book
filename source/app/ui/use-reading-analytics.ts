'use client';
import {apiCall,sendExit} from '../lib/google-client';

import {useCallback,useEffect,useRef} from 'react';
type Snapshot={type:'start'|'page'|'tick'|'exit';sessionId:string;visitorId:string;sequence:number;startedAt:number;page:number;seen:number[];pageSeconds:number[];referrer:string};
const KEY='shopper-analytics-pending-v2';
function read<T>(key:string,fallback:T):T{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback;}catch{return fallback;}}
function write(key:string,v:unknown){try{localStorage.setItem(key,JSON.stringify(v));}catch{}}
export default function useReadingAnalytics(readerActive:boolean,page:number,optOut:boolean){
 const session=useRef('');const visitor=useRef('');const startAt=useRef(0);const sequence=useRef(0);const seen=useRef(new Set<number>());const times=useRef(Array(15).fill(0) as number[]);const currentPage=useRef(page);const active=useRef(readerActive);const enabled=useRef(!optOut);const lastAction=useRef(Date.now());const pending=useRef<Snapshot[]>([]);const flushing=useRef(false);const loaded=useRef(false);
 const save=useCallback(()=>write(KEY,pending.current),[]);
 const flush=useCallback(async()=>{
  if(flushing.current||!enabled.current)return;flushing.current=true;
  try{
   while(pending.current.length&&enabled.current){const item=pending.current[0];if(Date.now()-item.startedAt>86400000){pending.current.shift();save();continue;}
    const response=await apiCall('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item),credentials:'same-origin',keepalive:true});if(!response.ok)break;
    pending.current=pending.current.filter(x=>x.sessionId!==item.sessionId||x.sequence>item.sequence);save();
   }
  }catch{}finally{flushing.current=false;}
 },[save]);
 const emit=useCallback((type:Snapshot['type'],beacon=false)=>{
  if(!enabled.current||!session.current)return;
  const snapshot:Snapshot={type,sessionId:session.current,visitorId:visitor.current,sequence:++sequence.current,startedAt:startAt.current,page:currentPage.current,seen:[...seen.current].sort((a,b)=>a-b),pageSeconds:times.current.map(x=>Math.round(x*10)/10),referrer:document.referrer};
  pending.current=pending.current.filter(x=>x.sessionId!==snapshot.sessionId);pending.current.push(snapshot);pending.current=pending.current.slice(-20);save();
  if(beacon)sendExit(snapshot);else void flush();
 },[flush,save]);
 const start=useCallback((from:number)=>{
  if(!enabled.current)return;
  if(!visitor.current){visitor.current=read<string>('shopper-reader-id','')||crypto.randomUUID();write('shopper-reader-id',visitor.current);}
  session.current=crypto.randomUUID();startAt.current=Date.now();sequence.current=0;seen.current=new Set();times.current=Array(15).fill(0);currentPage.current=from;lastAction.current=Date.now();emit('start');
 },[emit]);
 const end=useCallback(()=>{emit('exit');active.current=false;session.current='';},[emit]);
 useEffect(()=>{enabled.current=!optOut;if(optOut){pending.current=[];save();}},[optOut,save]);
 useEffect(()=>{active.current=readerActive;currentPage.current=page;if(readerActive&&session.current){seen.current.add(page);lastAction.current=Date.now();emit('page');}},[readerActive,page,emit]);
 useEffect(()=>{
  if(!loaded.current){loaded.current=true;enabled.current=!read<boolean>('shopper-optout',false);visitor.current=read<string>('shopper-reader-id','');pending.current=enabled.current?read<Snapshot[]>(KEY,[]):[];void flush();}
  const activity=()=>{lastAction.current=Date.now();};const visibility=()=>{if(session.current&&active.current){if(document.visibilityState==='hidden')emit('tick',true);else {lastAction.current=Date.now();emit('page');}}};
  const leave=()=>{if(active.current)emit('exit',true);};const online=()=>{void flush();};
  document.addEventListener('pointerdown',activity,{passive:true});document.addEventListener('keydown',activity);document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',leave);window.addEventListener('online',online);
  let previous=Date.now(),sent=Date.now();const timer=setInterval(()=>{const now=Date.now();if(active.current&&enabled.current&&session.current&&document.visibilityState==='visible'&&now-lastAction.current<120000)times.current[currentPage.current-1]+=Math.min((now-previous)/1000,2);previous=now;
   if(now-sent>=30000){if(active.current&&document.visibilityState==='visible')emit('tick');else void flush();sent=now;}
  },1000);
  return()=>{clearInterval(timer);document.removeEventListener('pointerdown',activity);document.removeEventListener('keydown',activity);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',leave);window.removeEventListener('online',online);};
 },[emit,flush]);
 return {start,end};
}

'use client';
import {apiCall} from './lib/google-client';

import {useCallback,useEffect,useRef,useState} from 'react';
import {BookOpen,ArrowRight,ArrowLeft,ChevronLeft,ChevronRight,PawPrint,Sparkles,ShoppingBag,Bookmark,ZoomIn,ZoomOut,Maximize,Minimize,LockKeyhole,Download,Check,RotateCcw,ShieldCheck,LoaderCircle} from 'lucide-react';
import {pages,pageImage,BOOK_TITLE} from './lib/book';
import Dashboard from './ui/dashboard';
import Modal from './ui/modal';
import useReadingAnalytics from './ui/use-reading-analytics';

type View='home'|'reader'|'dashboard';
function stored<T>(key:string,fallback:T):T {try{return JSON.parse(localStorage.getItem(key)??'null')??fallback;}catch{return fallback;}}
function persist(key:string,value:unknown){try{localStorage.setItem(key,JSON.stringify(value));}catch{}}
const wordmark=<span className="wordmark">little shopper<span>THE LEARNING CLUB</span></span>;

export default function Home(){
 const [view,setView]=useState<View>('home');const [opening,setOpening]=useState(false);const [page,setPage]=useState(1);const [savedPage,setSavedPage]=useState(1);
 const [bookmarks,setBookmarks]=useState<number[]>([]);const [zoom,setZoom]=useState(1);const [fullscreen,setFullscreen]=useState(false);const [supportsFullscreen,setSupportsFullscreen]=useState(false);
 const [pinOpen,setPinOpen]=useState(false);const [pin,setPin]=useState('');const [pinError,setPinError]=useState('');const [pinBusy,setPinBusy]=useState(false);
 const [privacy,setPrivacy]=useState(false);const [optOut,setOptOut]=useState(false);const [toast,setToast]=useState('');const [direction,setDirection]=useState('next');const [imageError,setImageError]=useState(false);const [imageLoaded,setImageLoaded]=useState(false);
 const readerRef=useRef<HTMLElement>(null);const sceneRef=useRef<HTMLDivElement>(null);const touch=useRef<{x:number;y:number}|null>(null);
 const mounted=useRef(false);const openTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const analytics=useReadingAnalytics(view==='reader',page,optOut);
 const announce=useCallback((message:string)=>{setToast(message);},[]);
 useEffect(()=>{
  if(!mounted.current){mounted.current=true;const last=stored<number>('shopper-page',1);setSavedPage(Math.min(15,Math.max(1,Number.isInteger(last)?last:1)));setBookmarks(stored<number[]>('shopper-bookmarks',[]).filter(n=>Number.isInteger(n)&&n>=1&&n<=15));setOptOut(stored<boolean>('shopper-optout',false));}
  setSupportsFullscreen(!!document.fullscreenEnabled);const fs=()=>setFullscreen(!!document.fullscreenElement);document.addEventListener('fullscreenchange',fs);return()=>document.removeEventListener('fullscreenchange',fs);
 },[]);
 useEffect(()=>{if(view==='reader'){persist('shopper-page',page);setSavedPage(page);setImageError(false);setImageLoaded(false);}const next=new Image();if(page<15)next.src=pageImage(page+1);},[view,page]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),2600);return()=>clearTimeout(t);},[toast]);
 useEffect(()=>()=>{if(openTimer.current)clearTimeout(openTimer.current);},[]);
 const go=useCallback((n:number)=>{const bounded=Math.max(1,Math.min(15,n));if(bounded===page)return;setDirection(bounded>page?'next':'previous');setPage(bounded);setZoom(1);},[page]);
 useEffect(()=>{const handle=(e:KeyboardEvent)=>{if(view!=='reader'||/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement)?.tagName)||e.ctrlKey||e.metaKey)return;if(e.key==='ArrowRight'){e.preventDefault();go(page+1);}if(e.key==='ArrowLeft'){e.preventDefault();go(page-1);}if(e.key==='Home'){e.preventDefault();go(1);}if(e.key==='End'){e.preventDefault();go(15);}};document.addEventListener('keydown',handle);return()=>document.removeEventListener('keydown',handle);},[view,page,go]);
 const startReading=(from=1)=>{if(opening)return;analytics.start(from);setPage(from);setOpening(true);setZoom(1);const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;openTimer.current=setTimeout(()=>{setView('reader');setOpening(false);setTimeout(()=>readerRef.current?.focus(),40);},reduce?180:2450);};
 const backHome=()=>{analytics.end();if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});setView('home');};
 const toggleBookmark=()=>{const next=bookmarks.includes(page)?bookmarks.filter(n=>n!==page):[...bookmarks,page].sort((a,b)=>a-b);setBookmarks(next);persist('shopper-bookmarks',next);announce(next.includes(page)?'คั่นหน้านี้ไว้แล้ว':'นำที่คั่นหน้าออกแล้ว');};
 const toggleFullscreen=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await readerRef.current?.requestFullscreen();}catch{announce('เบราว์เซอร์นี้ยังไม่รองรับเต็มจอ');}};
 const login=async(e:React.FormEvent)=>{e.preventDefault();setPinBusy(true);setPinError('');try{const res=await apiCall('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin})});const data=await res.json() as {error?:string};if(!res.ok)throw new Error(data.error);setPinOpen(false);setPin('');setView('dashboard');}catch(error){setPinError(error instanceof Error?error.message:'เชื่อมต่อไม่ได้ ลองอีกครั้ง');}finally{setPinBusy(false);}};
 const togglePrivacy=()=>{const next=!optOut;setOptOut(next);persist('shopper-optout',next);};
 const tilt=(e:React.PointerEvent<HTMLDivElement>)=>{if(e.pointerType!=='mouse'||opening)return;const r=e.currentTarget.getBoundingClientRect();sceneRef.current?.style.setProperty('--tilt-y',`${((e.clientX-r.left)/r.width-.5)*9}deg`);sceneRef.current?.style.setProperty('--tilt-x',`${-((e.clientY-r.top)/r.height-.5)*7}deg`);};
 return <>
 {view==='home'&&<div className={`landing ${opening?'is-opening':''}`}>
  <header className="site-header"><a href="/" className="brand" aria-label="Little Shopper หน้าหลัก"><span className="brand-icon"><ShoppingBag size={21}/><span/></span>{wordmark}</a><div className="header-right"><span className="edition"><span className="live-dot"/> A LITTLE BOOK, A BIG ADVENTURE</span></div></header>
  <main>
   <section className="hero" aria-labelledby="hero-title">
    <div className="hero-copy">
     <span className="eyebrow"><span/> เศรษฐศาสตร์ใกล้ตัว · E-BOOK</span>
     <h1 id="hero-title">เรื่องเงินเล็ก ๆ<br/>กับ<span className="orange-word">ภารกิจใหญ่<span className="scribble"/></span><br/>ของนักช้อปตัวน้อย<span className="title-star">✳</span></h1>
     <p className="hero-description">เตรียมกระเป๋าให้พร้อม แล้วออกไปเรียนรู้กับแก๊งเหมียว<br className="desktop-break"/>รู้จักเลือก รู้จักใช้ และค้นพบพลังวิเศษของการออม</p>
     <div className="start-actions"><button className="primary-button" onClick={()=>startReading(1)} disabled={opening}><BookOpen size={21}/>{opening?'กำลังเปิดโลกใบเล็ก…':'เริ่มอ่าน E-book'}<ArrowRight size={19}/></button>{savedPage>1&&!opening&&<button className="resume-button" onClick={()=>startReading(savedPage)}><RotateCcw size={14}/> อ่านต่อหน้า {savedPage}</button>}</div>
     <div className="reading-details"><span><BookOpen size={15}/> 15 หน้าของการค้นพบ</span><span className="detail-dot">·</span><span>อ่านฟรี ทุกที่ ทุกเวลา</span></div>
    </div>
    <div className="book-scene" ref={sceneRef} onPointerMove={tilt} onPointerLeave={()=>{sceneRef.current?.style.setProperty('--tilt-y','0deg');sceneRef.current?.style.setProperty('--tilt-x','0deg');}}>
     <div className="scene-orbit orbit-one"/><div className="scene-orbit orbit-two"/><span className="floating-star star-a">✧</span><span className="floating-star star-b">✦</span><span className="floating-star star-c">✧</span>
     <div className="chapter-stamp"><span>เปิดโลก</span><strong>นักช้อป<br/>ตัวน้อย</strong><Sparkles size={15}/></div>
     <div className="coin coin-one" aria-hidden="true">฿</div><div className="coin coin-two" aria-hidden="true">฿</div>
     <div className="book-float"><div className="book-3d"><div className="book-back"/><div className="book-stack"/><div className="book-inside"><img src={pageImage(2)} alt=""/></div><div className="book-glow"/><div className="book-cover"><img src={pageImage(1)} alt="ปกหนังสือ เศรษฐศาสตร์ใกล้ตัว: ภารกิจนักช้อปตัวน้อย" fetchPriority="high"/><div className="cover-spine"/></div><div className="book-ribbon"/></div></div>
     <div className="book-shadow"/><div className="handwritten-note">เรื่องสนุก ๆ รออยู่ข้างใน <svg width="69" height="43" viewBox="0 0 69 43" fill="none" aria-hidden="true"><path d="M4 7C12 32 44 37 62 15M51 18l13-6-1 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
     <div className="page-counter"><span className="stack-dots">▥</span><span>15 PAGES OF LITTLE DISCOVERIES</span></div>
    </div>
   </section>

  </main>
  <footer className="site-footer"><span>ทำให้การเรียนรู้ เป็นเรื่องสนุกเล็ก ๆ ทุกวัน <span className="footer-flower">✿</span></span><div><button onClick={()=>setPrivacy(true)} className="privacy-link"><ShieldCheck size={13}/> สถิติแบบไม่ระบุชื่อ</button><button className="secret-button" aria-label="เข้าพื้นที่ผู้ดูแล" title="พื้นที่ผู้ดูแล" onClick={()=>{setPinOpen(true);setPinError('');setPin('');}}><PawPrint size={17}/></button></div></footer>
  {opening&&<div className="opening-wash" aria-hidden="true"><i/><i/><i/></div>}
 </div>}
 {view==='reader'&&<main className="reader" ref={readerRef} tabIndex={-1} aria-label="ตัวอ่านหนังสือ">
  <header className="reader-header"><button className="icon-button back-button" onClick={backHome} aria-label="กลับหน้าปก"><ArrowLeft size={21}/></button><div className="reader-book-title"><span>LITTLE SHOPPER MISSION</span><strong>{BOOK_TITLE}</strong></div><div className="reader-tools"><button className={`icon-button ${bookmarks.includes(page)?'selected':''}`} aria-label={bookmarks.includes(page)?'นำที่คั่นหน้าออก':'คั่นหน้านี้'} title="คั่นหน้า" onClick={toggleBookmark}><Bookmark size={20} fill={bookmarks.includes(page)?'currentColor':'none'}/></button><span className="toolbar-divider"/><button className="icon-button zoom-control" aria-label="ย่อหน้า" onClick={()=>setZoom(z=>Math.max(1,z-.25))} disabled={zoom<=1}><ZoomOut size={20}/></button><button className="zoom-reset" onClick={()=>setZoom(1)} aria-label="กลับขนาดพอดีหน้าจอ">{Math.round(zoom*100)}%</button><button className="icon-button" aria-label="ขยายหน้า" onClick={()=>setZoom(z=>Math.min(3,z+.25))} disabled={zoom>=3}><ZoomIn size={20}/></button>{supportsFullscreen&&<button className="icon-button fullscreen-button" onClick={toggleFullscreen} aria-label={fullscreen?'ออกจากเต็มจอ':'เปิดเต็มจอ'}>{fullscreen?<Minimize size={20}/>:<Maximize size={20}/>}</button>}<a href="/book/little-shopper-mission.pdf" className="icon-button download-button" download aria-label="ดาวน์โหลด PDF ต้นฉบับ" title="ดาวน์โหลด PDF"><Download size={20}/></a></div></header>
  <div className="reader-caption"><span>{pages[page-1].chapter}</span><span>บทเรียนเล็ก ๆ สำหรับนักช้อปที่ฉลาด</span></div>
  <div className={`reading-area ${zoom>1?'is-zoomed':''}`} onTouchStart={e=>{if(zoom===1&&e.touches.length===1)touch.current={x:e.touches[0].clientX,y:e.touches[0].clientY};else touch.current=null;}} onTouchEnd={e=>{if(touch.current&&e.changedTouches.length){const dx=e.changedTouches[0].clientX-touch.current.x;const dy=e.changedTouches[0].clientY-touch.current.y;if(Math.abs(dx)>55&&Math.abs(dy)<80)go(page+(dx<0?1:-1));}touch.current=null;}}>
   {zoom===1&&<button className="page-side-arrow prev" onClick={()=>go(page-1)} disabled={page===1} aria-label="หน้าก่อนหน้า"><ChevronLeft size={25}/></button>}
   <div className="page-scroll"><div className={`page-sheet turn-${direction} ${imageLoaded?'loaded':''}`} key={page} style={{'--zoom':zoom} as React.CSSProperties}>{!imageLoaded&&!imageError&&<div className="image-loader"><LoaderCircle className="spin"/> กำลังเปิดหน้า {page}</div>}{imageError?<div className="image-failure"><p>หน้านี้ยังโหลดไม่สำเร็จ</p><button className="secondary-button" onClick={()=>{setImageError(false);setImageLoaded(false);}}>ลองใหม่</button><a href="/book/little-shopper-mission.pdf" download>ดาวน์โหลด PDF</a></div>:<img src={pageImage(page)} alt={pages[page-1].alt} width={1376} height={768} draggable={false} onLoad={()=>setImageLoaded(true)} onError={()=>setImageError(true)}/>}</div></div>
   {zoom===1&&<button className="page-side-arrow next" onClick={()=>go(page+1)} disabled={page===15} aria-label="หน้าถัดไป"><ChevronRight size={25}/></button>}
  </div>
  <footer className="reader-bottom"><div className="page-title" aria-live="polite"><span>หน้า {String(page).padStart(2,'0')}</span><strong>{pages[page-1].title}</strong></div><div className="navigation-controls"><button className="icon-button" onClick={()=>go(page-1)} disabled={page===1} aria-label="หน้าก่อนหน้า"><ChevronLeft size={22}/></button><div className="page-progress"><label htmlFor="page-slider"><strong>{page}</strong><span> / 15 หน้า</span></label><input id="page-slider" aria-label="เลือกหน้าหนังสือ" type="range" min={1} max={15} value={page} onChange={e=>go(Number(e.target.value))} style={{'--progress':`${(page-1)/14*100}%`} as React.CSSProperties}/></div><button className="icon-button" onClick={()=>go(page+1)} disabled={page===15} aria-label="หน้าถัดไป"><ChevronRight size={22}/></button></div><span className="reader-hint">{page===15?<button className="finish-button" onClick={backHome}><Check size={16}/> จบภารกิจ กลับหน้าปก</button>:<>ปัดหน้าจอ หรือใช้ปุ่ม <kbd>←</kbd><kbd>→</kbd></>}</span></footer>
 </main>}
 {view==='dashboard'&&<Dashboard onBack={()=>setView('home')} onExpired={()=>{setView('home');setPinOpen(true);setPinError('กรุณากรอก PIN อีกครั้ง');}}/>}
 <Modal open={pinOpen} onClose={()=>setPinOpen(false)} title="มุมเล็ก ๆ ของผู้ดูแล"><div className="modal-emblem"><LockKeyhole size={26}/></div><span className="mini-label">TEACHER'S CORNER</span><h2>มุมเล็ก ๆ ของผู้ดูแล</h2><p>กรอก PIN 4 หลัก เพื่อดูเรื่องราวการอ่าน<br/>ของนักช้อปตัวน้อย</p><form onSubmit={login}><label className="sr-only" htmlFor="pin-input">รหัส PIN 4 หลัก</label><input id="pin-input" className={`pin-input ${pinError?'has-error':''}`} type="password" inputMode="numeric" pattern="[0-9]{4}" autoComplete="off" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="• • • •" maxLength={4} required autoFocus aria-describedby={pinError?'pin-error':undefined}/>{pinError&&<p className="form-error" id="pin-error" role="alert">{pinError}</p>}<button type="submit" className="primary-button full-width" disabled={pin.length!==4||pinBusy}>{pinBusy?<LoaderCircle className="spin" size={18}/>:<LockKeyhole size={18}/>} {pinBusy?'กำลังตรวจสอบ…':'เข้าสู่แดชบอร์ด'}<ArrowRight size={18}/></button></form><span className="modal-footnote">พื้นที่สำหรับดูสถิติการอ่านเท่านั้น</span></Modal>
 <Modal open={privacy} onClose={()=>setPrivacy(false)} title="สถิติเล็ก ๆ เพื่อการเรียนรู้"><div className="modal-emblem"><ShieldCheck size={27}/></div><span className="mini-label">YOUR READING, YOUR SPACE</span><h2>สถิติเล็ก ๆ เพื่อการเรียนรู้</h2><p>เราเริ่มบันทึกเมื่อกดเริ่มอ่านเท่านั้น โดยเก็บรหัสนักอ่านแบบสุ่ม หน้าที่เปิด เวลาอ่านแต่ละหน้าขณะที่ใช้งาน ประเภทอุปกรณ์ และเว็บไซต์ที่พามาที่นี่ โดยใช้รหัสสุ่มแทนตัวตน ไม่เก็บชื่อ อีเมล หรือที่อยู่ IP ลงในสถิติ</p><p className="privacy-note">หน้าที่อ่านล่าสุดและที่คั่นหน้าเก็บไว้ในอุปกรณ์นี้ จำนวนผู้ชมจึงเป็นค่าประมาณตามเบราว์เซอร์</p><button className={`privacy-toggle ${!optOut?'on':''}`} onClick={togglePrivacy} role="switch" aria-checked={!optOut}><span>อนุญาตสถิติแบบไม่ระบุชื่อ</span><i/></button></Modal>
 {toast&&<div className="toast" role="status"><Check size={17}/>{toast}</div>}
 </>;
}

'use client';
import {useEffect,useRef} from 'react';
import {X} from 'lucide-react';
export default function Modal({open,onClose,title,children}:{open:boolean;onClose:()=>void;title:string;children:React.ReactNode}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const d=ref.current;if(open&&!d?.open)d?.showModal();if(!open&&d?.open)d?.close();},[open]);
 return <dialog ref={ref} className="modal" aria-label={title} onCancel={onClose} onClick={e=>{if(e.target===ref.current)onClose();}}><div className="modal-content"><button className="icon-button modal-close" onClick={onClose} aria-label="ปิดหน้าต่าง"><X size={20}/></button>{children}</div></dialog>;
}

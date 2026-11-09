import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, ShieldAlert, X } from 'lucide-react';
import DialogLayer from './DialogLayer';
import { FeedbackContext } from './useFeedback';
import type { Tone } from './useFeedback';
export function FeedbackProvider({ children }: { children:React.ReactNode }) {
  const [messages,setMessages] = useState<{id:number;text:string;tone:Tone}[]>([]);
  const [confirmation,setConfirmation] = useState<string|null>(null);
  const pending = useRef<((value:boolean)=>void)|null>(null);
  const serial = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(()=>()=>{ pending.current?.(false); timers.current.forEach(clearTimeout); },[]);
  const notify = (text:string,tone:Tone='error') => { const id=++serial.current; setMessages(items=>[...items.slice(-2),{id,text,tone}]); if(tone==='success')timers.current.push(setTimeout(()=>setMessages(items=>items.filter(item=>item.id!==id)),6000)); };
  const confirmAction = (message:string) => { if(pending.current)return Promise.resolve(false); setConfirmation(message); return new Promise<boolean>(resolve=>{ pending.current=resolve; }); };
  const answer = (value:boolean) => { pending.current?.(value);pending.current=null;setConfirmation(null); };
  return <FeedbackContext.Provider value={{notify,confirmAction}}>{children}{confirmation&&<DialogLayer label="Confirm action" onDismiss={()=>answer(false)}><div className="dialog-surface confirmation-dialog"><div className="confirmation-emblem warning"><ShieldAlert size={28}/></div><h2>Please confirm.</h2><p>{confirmation}</p><div className="confirmation-actions"><button type="button" className="button-secondary" onClick={()=>answer(false)}>Cancel</button><button type="button" className="button-primary destructive" onClick={()=>answer(true)}>Confirm action</button></div></div></DialogLayer>}{messages.length>0&&createPortal(<div className="feedback-stack">{messages.map(item=><div key={item.id} className={`feedback-message ${item.tone}`} role={item.tone==='error'?'alert':'status'}>{item.tone==='error'?<AlertCircle size={19}/>:<CheckCircle2 size={19}/>}<div><strong>{item.tone==='error'?'Action needs attention':'Action completed'}</strong><p>{item.text}</p></div><button type="button" className="icon-button" aria-label="Dismiss notification" onClick={()=>setMessages(items=>items.filter(message=>message.id!==item.id))}><X size={15}/></button></div>)}</div>,document.body)}</FeedbackContext.Provider>;
}

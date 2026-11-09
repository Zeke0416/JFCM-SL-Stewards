import { createContext, useContext } from 'react';
export type Tone = 'error' | 'success';
interface Feedback { notify:(message:string,tone?:Tone)=>void; confirmAction:(message:string)=>Promise<boolean> }
export const FeedbackContext = createContext<Feedback>({ notify:()=>{}, confirmAction:async()=>false });
export const useFeedback = () => useContext(FeedbackContext);

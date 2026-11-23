"use client";
import {createContext,useContext,useEffect,useMemo,useRef,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {createOrderSearchHandoff} from '@/lib/order-search-handoff';
type Handoff=ReturnType<typeof createOrderSearchHandoff>;
const Context=createContext<Handoff|null>(null);
export function useAdminOrderSearch(){return useContext(Context);}
/** In-memory only: no contact details in URLs, storage, cookies, logs or analytics. */
export default function AdminOrderSearch({children}:{children:ReactNode}){
  const store=useRef(createOrderSearchHandoff()),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const pathname=usePathname();
  const value=useMemo<Handoff>(()=>({
    prepare(email){if(timer.current)clearTimeout(timer.current);const ok=store.current.prepare(email);if(ok)timer.current=setTimeout(()=>store.current.clear(),60000);return ok;},
    take(){if(timer.current)clearTimeout(timer.current);timer.current=null;return store.current.take();},
    clear(){if(timer.current)clearTimeout(timer.current);timer.current=null;store.current.clear();},
  }),[]);
  useEffect(()=>{if(pathname==='/admin')value.clear();},[pathname,value]);
  useEffect(()=>{window.addEventListener('pagehide',value.clear);return()=>{window.removeEventListener('pagehide',value.clear);value.clear();};},[value]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

import { createContext, useContext, useState, type Dispatch, type SetStateAction, type ReactNode } from 'react';

const Context=createContext<{ids:string[]|null;setIds:Dispatch<SetStateAction<string[]|null>>}|null>(null);
export const usePayloadDraft=()=>useContext(Context);
export function PayloadDraftProvider({children}:{children:ReactNode}){
  const [ids,setIds]=useState<string[]|null>(null);
  return <Context.Provider value={{ids,setIds}}>{children}</Context.Provider>;
}

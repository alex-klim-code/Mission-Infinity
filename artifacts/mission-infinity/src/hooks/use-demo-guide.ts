import {useCallback,useEffect,useMemo,useSyncExternalStore} from 'react';
import {useGetDemoPlan,getGetDemoPlanQueryKey,type GameSession} from '@workspace/api-client-react';

type Mode={enabled:boolean;storageWarning:boolean};
const states=new Map<string,{value:Mode;listeners:Set<()=>void>}>();
const emptyStore={value:{enabled:false,storageWarning:false},listeners:new Set<()=>void>()};
function storeFor(me:string) {
  if(!me)return emptyStore;
  let store=states.get(me);
  if(!store) {
    let value:Mode={enabled:false,storageWarning:false};
    try{value.enabled=localStorage.getItem(`mission-demo:v1:${me}`)==='true';}catch{value.storageWarning=true;}
    store={value,listeners:new Set()};states.set(me,store);
  }
  return store;
}
export function useDemoMode(meId:string) {
  const store=useMemo(()=>storeFor(meId),[meId]);
  const subscribe=useCallback((fn:()=>void)=>{store.listeners.add(fn);return()=>{store.listeners.delete(fn);};},[store]);
  const state=useSyncExternalStore(subscribe,()=>store.value);
  const toggle=useCallback(()=>{
    if(!meId)return;
    const enabled=!store.value.enabled;
    let storageWarning=false;
    try{localStorage.setItem(`mission-demo:v1:${meId}`,String(enabled));}catch{storageWarning=true;}
    store.value={enabled,storageWarning};store.listeners.forEach(fn=>fn());
  },[meId,store]);
  useEffect(()=>{
    const sync=(e:StorageEvent)=>{
      if(!meId)return;
      if(e.key!==null&&e.key!==`mission-demo:v1:${meId}`)return;
      store.value={enabled:e.newValue==='true',storageWarning:false};store.listeners.forEach(fn=>fn());
    };
    window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);
  },[meId,store]);
  return {...state,toggle};
}
export function useDemoGuide(session:GameSession,meId:string) {
  const {enabled}=useDemoMode(meId);
  const preparing=(!session.journey||session.journey.phase==='NONE')&&!session.fueling?.opened;
  const query=useGetDemoPlan(session.id,{query:{
    queryKey:[...getGetDemoPlanQueryKey(session.id),meId,session.revision],enabled:enabled&&preparing&&!!meId,
    staleTime:Infinity,gcTime:60_000,retry:false,refetchOnWindowFocus:false,
  }});
  // Never show a stale recommendation from a previous revision or a disabled guide.
  return {enabled,plan:enabled&&preparing?query.data:undefined,loading:enabled&&preparing&&query.isPending,error:query.error,refetch:query.refetch};
}

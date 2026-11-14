import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useGetGameCatalog, type GameSession } from '@workspace/api-client-react';
import { collectNotifications, mergeNotifications, notificationKey, type MissionNotification, type NotificationSeed } from '@/lib/mission-notifications';

type State={items:MissionNotification[];storageWarning:boolean};
type Store={state:State;listeners:Set<()=>void>;key:string};
const stores=new Map<string,Store>();
const valid=(x:unknown):x is MissionNotification=>{
  if(!x||typeof x!=='object')return false;
  const n=x as MissionNotification;
  return typeof n.id==='string'&&typeof n.title==='string'&&typeof n.message==='string'&&typeof n.createdAt==='string'&&
    ['warning','error','info','success'].includes(n.severity)&&['live','event'].includes(n.scope)&&
    typeof n.read==='boolean'&&typeof n.active==='boolean'&&typeof n.category==='string';
};
function read(key:string):State {
  try {
    const raw=localStorage.getItem(key);
    const value:unknown=raw?JSON.parse(raw):[];
    if(!Array.isArray(value)||!value.every(valid))return {items:[],storageWarning:true};
    // Retire the old repeated "Unverified" diagnostics, not user messages or real risks.
    const items=value.filter(n=>!n.id.startsWith('fuel:')||(n.id.startsWith('fuel:main-engines')&&n.severity==='warning'));
    return {items:items.slice(0,200),storageWarning:false};
  }catch{return {items:[],storageWarning:true};}
}
function storeFor(sessionId:string,meId:string) {
  const key=notificationKey(sessionId,meId);
  let store=stores.get(key);
  if(!store){store={key,state:read(key),listeners:new Set()};stores.set(key,store);}
  return store;
}
function save(store:Store,items:MissionNotification[]) {
  if(JSON.stringify(items)===JSON.stringify(store.state.items))return;
  let storageWarning=false;
  try{localStorage.setItem(store.key,JSON.stringify(items));}catch{storageWarning=true;}
  store.state={items,storageWarning};
  store.listeners.forEach(fn=>fn());
}
/** Optional events (including rejected candidate previews), scoped to the actual player and room. */
export function recordMissionNotifications(sessionId:string,meId:string,seeds:NotificationSeed[]) {
  const store=storeFor(sessionId,meId);
  save(store,mergeNotifications(store.state.items,seeds));
}
export function useMissionNotifications(session:GameSession,meId:string) {
  const catalog=useGetGameCatalog();
  const store=useMemo(()=>storeFor(session.id,meId),[session.id,meId]);
  const snapshot=useSyncExternalStore(
    useMemo(()=>(fn:()=>void)=>{
      store.listeners.add(fn);
      const changed=(e:StorageEvent)=>{
        if(e.key!==null&&e.key!==store.key)return;
        store.state=read(store.key);store.listeners.forEach(f=>f());
      };
      window.addEventListener('storage',changed);
      return()=>{store.listeners.delete(fn);window.removeEventListener('storage',changed);};
    },[store]),
    ()=>store.state,
  );
  useEffect(()=>{
    // Wait for the catalog, otherwise a refetch could falsely resolve chemistry warnings.
    if(!catalog.data)return;
    const selected=new Set((session.assembly?.selections??[]).map(selection=>selection.optionId));
    const parts=catalog.data.rocketCatalog.flatMap(s=>s.categories.flatMap(c=>c.options)).filter(o=>selected.has(o.id));
    save(store,mergeNotifications(store.state.items,collectNotifications(session,parts),undefined,true));
  },[session,catalog.data,store]);
  const markAllRead=useCallback(()=>save(store,store.state.items.map(n=>({...n,read:true}))),[store]);
  return {...snapshot,unread:snapshot.items.filter(n=>!n.read).length,markAllRead};
}

type Window={count:number;until:number};
/** Controls have bounded high-frequency updates; social/profile writes retain
 * their original lower limit and cannot be starved by piloting the lander. */
export function gameRatePolicy(method:string,path:string) {
  if(method==="GET")return {bucket:"read",limit:240};
  if(method==="POST"&&/^\/api\/game\/sessions\/[^/]+\/actions$/.test(path))
    return {bucket:"controls",limit:600};
  return {bucket:"write",limit:80};
}
export function consumeGameRate(windows:Map<string,Window>,key:string,limit:number,now=Date.now()) {
  const window=windows.get(key);
  if(!window||window.until<now){windows.set(key,{count:1,until:now+60000});return true;}
  window.count++;
  return window.count<=limit;
}

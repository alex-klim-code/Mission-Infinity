import type { GameSession, RocketComponent } from '@workspace/api-client-react';
import { assessFuel, fuelCopy, fuelDescription } from './rocket-fuel';

export type NotificationSeed = {
  id: string; title: string; message: string;
  severity: 'warning' | 'error' | 'info' | 'success'; category: string; scope: 'live' | 'event';
};
export type MissionNotification = NotificationSeed & { createdAt: string; read: boolean; active: boolean };
export const notificationKey = (sessionId:string, meId:string) => `mission-notifications:v1:${meId}:${sessionId}`;

/** Polling does not create duplicates or reset read state. A recurring issue is unread again. */
export function mergeNotifications(previous:MissionNotification[], seeds:NotificationSeed[], now=new Date().toISOString(), reconcile=false) {
  const incoming=new Set(seeds.map(s=>s.id));
  const map=new Map(previous.map(n=>[n.id,reconcile&&n.scope==='live'&&!incoming.has(n.id)?{...n,active:false}:n]));
  for(const seed of seeds) {
    const old=map.get(seed.id);
    const active=seed.scope==='live';
    const changed=!old||old.message!==seed.message||old.title!==seed.title||old.severity!==seed.severity||(active&&!old.active);
    map.set(seed.id,{...seed,active,createdAt:changed?now:old.createdAt,read:changed?false:old.read});
  }
  return [...map.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,200);
}

export function collectNotifications(session:GameSession, parts:RocketComponent[]):NotificationSeed[] {
  const seeds:NotificationSeed[]=[];
  const add=(id:string,title:string,message:string,severity:NotificationSeed['severity']='warning',category='Engineering',scope:NotificationSeed['scope']='live')=>
    seeds.push({id,title,message,severity,category,scope});
  for(const pair of assessFuel(parts).comparisons) {
    if(pair.engine.categoryId!=='main-engines'||pair.status!=='conflict')continue;
    add(`fuel:${pair.engine.id}:${pair.tank.id}`,'Main engine / tank propellant mismatch',
      `${pair.engine.name} (${fuelDescription(pair.engine)}) ↔ ${pair.tank.name} (${fuelDescription(pair.tank)}). ${fuelCopy.mismatch} In this training model, the selected main tank supplies the main engine.`,
      'warning','Propellant');
  }
  for(const issue of session.engineering?.issues??[]) add(`engineering:${issue.id}`,issue.title,issue.message,'error');
  for(const check of session.engineering?.checks??[]) if(check.status==='FAIL')add(`integration:${session.engineering?.attempt}:${check.id}`,`${check.label} failed`,check.message,'error','Construction');
  const journey=session.journey;
  for(const d of journey?.diagnostics??[])if(d.status==='DAMAGED'||d.status==='CRITICAL_FAILURE')
    add(`instrument:${journey?.plan?.launchAttempts?.at(-1)?.id??'legacy'}:${d.instrumentId}`,`${d.name} damaged`,d.failure??'Instrument diagnostics detected a failure. Scientific output may be reduced.','error','Science');
  if(journey?.plan&&journey.plan.fuelLoadedKg<journey.plan.requiredFuelKg&&['ROUTE','CALENDAR','MISSION_DAY'].includes(journey.phase))
    add('outbound-fuel','Insufficient outbound fuel',`Loaded ${journey.plan.fuelLoadedKg.toLocaleString('en-US')} kg; the outbound route requires ${journey.plan.requiredFuelKg.toLocaleString('en-US')} kg.`,'error','Flight');
  for(const c of [...journey?.flightAlerts??[],...journey?.operations?.hardwareChecks??[]])
    if(c.status==='DAMAGED')add(`damage:${journey?.plan?.launchAttempts?.at(-1)?.id??'legacy'}:${c.id}`,`${c.name} damaged`,c.critical?'This is a return-critical component. Returning to Earth is blocked until the mission assessment is resolved.':'This component was damaged during the mission. Review the mission checks for its effect.','error','Hardware');
  for(const message of journey?.operations?.warnings??[])add(`operation:${message}`,'Mission warning',message,'warning','Operations');
  for(const a of journey?.plan?.launchAttempts??[])if(a.failed)
    add(`weather:${a.id}`,'Launch aborted in rain',`The rocket landed near the launch site. Repair cost: $${a.repairCost.toLocaleString('en-US')}. All loaded fuel was lost.`,'error','Launch','event');
  for(const r of session.finance?.requests??[]) {
    const status={SUBMITTED:'Funding request submitted',UNDER_REVIEW:'Funding request under review',APPROVED:'Funding request approved',DENIED:'Funding request denied'}[r.status];
    add(`funding:${r.id}:${r.status}`,status,`Mission funding: $${r.amount.toLocaleString('en-US')}.`,r.status==='APPROVED'?'success':r.status==='DENIED'?'warning':'info','Funding','event');
  }
  return seeds;
}

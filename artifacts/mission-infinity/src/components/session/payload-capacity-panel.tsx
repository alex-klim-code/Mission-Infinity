import type { PayloadAssessment } from '@workspace/mission-physics';
import type { GameSession } from '@workspace/api-client-react';
import { usePayloadCapacity } from '@/hooks/use-payload-capacity';
import { cn } from '@/lib/utils';

const number=(n:number|null,digits=0)=>n===null?'—':n.toLocaleString('en-US',{maximumFractionDigits:digits});
export function SessionPayloadCapacityPanel({session}:{session:GameSession}) {
  const assessment=usePayloadCapacity(session);
  return <PayloadCapacityPanel assessment={assessment}/>;
}
export function PayloadCapacityPanel({assessment:a}:{assessment:PayloadAssessment}) {
  const stats=[
    ['Maximum Payload Capacity',a.maximumPayloadKg,'kg','maximum'],
    ['Current Payload Mass',a.currentPayloadKg,'kg','current'],
    ['Remaining Payload Capacity',a.remainingPayloadKg,'kg','remaining'],
    ['Total Rocket Mass',a.totalMassKg,'kg','total-mass'],
  ] as const;
  return <section className="rounded-md border border-ion/20 bg-void/85 p-3" aria-label="Payload capacity" data-testid="panel-payload-capacity">
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="kicker text-ion">Payload capacity</h3>
      {a.basis==='QUALITY'&&<span className="font-mono text-[9px] text-ion" data-testid="text-payload-quality">Quality estimate</span>}
      {a.status==='INCOMPLETE'&&<span className="font-mono text-[10px] text-burn" data-testid="text-payload-incomplete">INCOMPLETE</span>}
    </div>
    <dl className="grid grid-cols-2 gap-2">
      {stats.map(([label,value,unit,key])=><div key={key} className="min-w-0">
        <dt className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</dt>
        <dd className={cn('break-words font-mono text-xs',key==='remaining'&&value!==null&&value<0?'text-destructive':'text-foreground')} data-testid={`text-payload-${key}`}>{number(value,2)} {unit}</dd>
      </div>)}
      <div><dt className="font-mono text-[9px] uppercase text-muted-foreground">Launch TWR</dt><dd className="font-mono text-xs" data-testid="text-payload-twr">{number(a.launchTwr,3)}</dd></div>
      <div><dt className="font-mono text-[9px] uppercase text-muted-foreground">Delta-V available / required</dt><dd className="font-mono text-xs" data-testid="text-payload-delta-v">{number(a.availableDeltaVMps)} / {number(a.requiredDeltaVMps)} m/s</dd></div>
    </dl>
    {a.fuelIsEstimate&&<p className="mt-2 font-mono text-[10px] text-muted-foreground">Planned fuel: {number(a.referenceFuelKg??null)} kg</p>}
    {a.launchTwr!==null&&a.launchTwr>1&&a.launchTwr<1.2&&<p className="mt-2 text-[11px] text-burn">Low launch margin — TWR of 1.2 or higher recommended.</p>}
    {a.warnings.length>0&&<ul role="status" className="mt-2 space-y-1">{a.warnings.map(w=><li key={w} className="font-mono text-[10px] font-bold text-destructive" data-testid={`warning-payload-${w.toLowerCase().replaceAll(' ','-')}`}>{w}</li>)}</ul>}
    {a.missingData.length>0&&<details className="mt-2 text-[11px] text-muted-foreground" data-testid="details-payload-missing">
      <summary className="cursor-pointer text-burn">Missing specifications ({a.missingData.length})</summary>
      <ul className="mt-1 max-h-40 list-disc overflow-y-auto overscroll-contain pl-4">{a.missingData.map(s=><li key={s}>{s}</li>)}</ul>
    </details>}
    {a.burns.length>0&&<details className="mt-2 text-[11px] text-muted-foreground"><summary className="cursor-pointer">Stage performance and return fuel</summary>
      <p className="mt-1">Return fuel: {number(a.availableReturnFuelKg,2)} / {number(a.requiredReturnFuelKg,2)} kg required</p>
      <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto overscroll-contain">{a.burns.map((b,i)=><li key={`${b.id}:${i}`}>{b.id}: {number(b.availableDeltaVMps)} / {number(b.requiredDeltaVMps)} m/s · {number(b.consumedFuelKg,2)} kg fuel</li>)}</ul>
    </details>}
  </section>;
}

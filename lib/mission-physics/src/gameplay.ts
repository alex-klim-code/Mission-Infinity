import { G0, type PayloadAssessment, type PayloadInput, type PayloadWarning, type BurnAssessment } from "./index";

const PAYLOAD=new Set(["sample-collection","sample-container","scientific-instruments"]);
const RETURN=new Set(["lunar-ascent-system","return-capsule","re-entry-heat-shield","recovery-system"]);
const hulls:Record<string,{mass:number;quality:number}>={
  "falcon-shadow":{mass:12000,quality:60},
  "titan-explorer":{mass:16000,quality:75},
  "nova-prime":{mass:22000,quality:90},
};
const valid=(n:unknown):n is number=>typeof n==="number"&&Number.isFinite(n)&&n>=0;
const quality=(n:unknown,fallback=50)=>valid(n)?Math.max(0,Math.min(100,n)):fallback;

/** Deliberately balanced game estimates, shared by client and server. These
 * coefficients are not written back as manufacturer component specifications. */
export function assessGameplayPayload(input:PayloadInput):PayloadAssessment {
  const parts=[...new Map(input.components.map(p=>[p.id,p])).values()];
  const instruments=[...new Map(input.instruments.map(p=>[p.id,p])).values()];
  const body=parts.find(p=>p.categoryId==="rocket-body");
  const hull=hulls[body?.id??""]??hulls["falcon-shadow"];
  const q=(p:typeof parts[number])=>quality(p.quality,p.categoryId==="rocket-body"?hull.quality:50);
  const hardware=parts.filter(p=>!PAYLOAD.has(p.categoryId));
  const overall=hardware.length?hardware.reduce((n,p)=>n+q(p),0)/hardware.length:hull.quality;
  const categoryQ=(category:string)=>{const p=parts.find(p=>p.categoryId===category);return p?q(p):overall;};
  const mass=(p:typeof parts[number])=>valid(p.massKg)&&(p.categoryId!=="rocket-body"||p.massKg>0)?p.massKg:p.categoryId==="rocket-body"?hull.mass:50+q(p)*3;
  const payload=parts.filter(p=>PAYLOAD.has(p.categoryId)).reduce((n,p)=>n+mass(p),0)
    +instruments.reduce((n,p)=>n+(valid(p.massKg)?p.massKg:5),0);
  const dry=hardware.reduce((n,p)=>n+mass(p),0)+(body?0:hull.mass);
  const fuelIsEstimate=!valid(input.fuelKg);
  const fuel=fuelIsEstimate?30000:input.fuelKg!;
  const mainQ=categoryQ("main-engines"),upperQ=categoryQ("upper-stage-engines");
  const stageQ=categoryQ("rocket-stages");
  const architecture=parts.find(p=>p.categoryId==="rocket-stages")?.name.toLowerCase()??"";
  const stageCount=/triple|three/.test(architecture)?3:/single/.test(architecture)?1:2;
  const efficiency=.9+stageQ/500+.08*(stageCount-1);
  const exhaust=(260+(mainQ*.6+upperQ*.4)*1.3)*G0*efficiency;
  const thrust=400000+mainQ*20000+upperQ*2000;
  const lunarDry=Math.min(dry,500+hardware.filter(p=>RETURN.has(p.categoryId)||p.categoryId.startsWith("lunar-")||p.categoryId==="landing-legs").reduce((n,p)=>n+mass(p),0));
  const returnDry=Math.min(lunarDry,500+hardware.filter(p=>RETURN.has(p.categoryId)).reduce((n,p)=>n+mass(p),0));
  const returnExhaust=(260+categoryQ("lunar-ascent-system")*1.3)*G0;
  const maneuvers=[
    {id:"Earth–Moon transfer",stageId:"launch",phase:"LAUNCH" as const,dry,dv:2200,ve:exhaust},
    {id:"Lunar landing",stageId:"lander",phase:"LUNAR_LANDING" as const,dry:lunarDry,dv:450,ve:exhaust},
    {id:"Earth return",stageId:"return",phase:"EARTH_RETURN" as const,dry:returnDry,dv:1600*(1.1-categoryQ("lunar-ascent-system")*.002),ve:returnExhaust},
  ];
  function evaluate(cargo:number,details=false){
    let remaining=fuel,achieved=0,shortage=false,returnShortage=false,returnRequired=0,returnAvailable=0;
    const burns:BurnAssessment[]=[];
    for(const m of maneuvers){
      const initial=m.dry+cargo+remaining;
      const required=initial*(-Math.expm1(-m.dv/m.ve));
      const available=m.ve*Math.log(initial/(m.dry+cargo));
      const failed=required>remaining+1e-7;
      if(failed){shortage=true;if(m.phase==="EARTH_RETURN")returnShortage=true;}
      if(m.phase==="EARTH_RETURN"){returnRequired=required;returnAvailable=remaining;}
      const used=Math.min(required,remaining);
      achieved+=m.ve*Math.log(initial/(initial-used));
      remaining=Math.max(0,remaining-used);
      if(details)burns.push({id:m.id,stageId:m.stageId,phase:m.phase,initialMassKg:initial,finalMassKg:initial-used,consumedFuelKg:used,availableDeltaVMps:available,requiredDeltaVMps:m.dv});
    }
    const twr=thrust/((dry+cargo+fuel)*G0);
    const margin=returnExhaust*Math.log((returnDry+cargo+remaining)/(returnDry+cargo));
    return {feasible:twr>1&&!shortage,twr,shortage,returnShortage,returnRequired,returnAvailable,available:achieved+margin,burns};
  }
  const current=evaluate(payload,true);
  let low=0,high=Math.max(0,thrust/G0-dry-fuel);
  if(evaluate(0).feasible)for(let i=0;i<60;i++){
    const mid=(low+high)/2;
    if(evaluate(mid).feasible)low=mid;else high=mid;
  }
  const maximum=Math.floor(low*100)/100;
  const warnings:PayloadWarning[]=[];
  if(payload>maximum+.01)warnings.push("OVERWEIGHT");
  if(current.twr<=1)warnings.push("INSUFFICIENT THRUST");
  if(current.shortage)warnings.push("INSUFFICIENT DELTA-V");
  if(current.returnShortage)warnings.push("INSUFFICIENT RETURN FUEL");
  return {
    basis:"QUALITY",referenceFuelKg:fuel,fuelIsEstimate,status:"COMPLETE",feasible:current.feasible,
    maximumPayloadKg:maximum,currentPayloadKg:payload,remainingPayloadKg:maximum-payload,
    totalMassKg:dry+payload+fuel,totalThrustN:thrust,launchThrustN:thrust,launchTwr:current.twr,
    availableDeltaVMps:current.available,requiredDeltaVMps:maneuvers.reduce((n,m)=>n+m.dv,0),
    requiredReturnFuelKg:current.returnRequired,availableReturnFuelKg:current.returnAvailable,
    missingData:[],warnings,burns:current.burns,
  };
}

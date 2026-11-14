import type {DemoPlan,GameSession} from "@workspace/api-zod";
import {componentCategories,componentById} from "./rocket-catalog";
import {scientificInstruments} from "./scientific-instruments";
import {compatibilityIssues} from "./engineering-rules";
import {criticalReturnCategories} from "./hardware-health";
import {makeFlightPlan} from "./mission-flight-model";
import {fuelSettings} from "./fuel-loads";

type Choice={ids:Record<string,string>;cost:number;score:number};
const assumptions="Educational recommendations use the game's integration, power, fuel and quality rules, not manufacturer certification. Missing source specifications remain unknown. Recommendations do not purchase parts, prevent random damage or guarantee success. Use a full fuel load, choose sunny weather and review the return checks.";
const categories=componentCategories.filter(c=>c.id!=="rocket-body");
const groups=[
  ["main-engines","rocket-stages","fuel-tanks"],["navigation-sensors","onboard-computer"],
  ["lunar-lander","payload-adapter"],
  ...categories.filter(c=>!["main-engines","rocket-stages","fuel-tanks","navigation-sensors","onboard-computer","lunar-lander","payload-adapter"].includes(c.id))
    .sort((a,b)=>Number(criticalReturnCategories.has(b.id))-Number(criticalReturnCategories.has(a.id))).map(c=>[c.id]),
];
const score=(id:string)=>{
  const p=componentById.get(id)!;
  const weight=criticalReturnCategories.has(p.categoryId)?3:p.categoryId==="main-engines"?2:1;
  return (100-p.damageRisk)*weight+(p.quality??55)*0.05-(p.massKg??100)*0.00001;
};

/** Bounded, deterministic whole-design search. No RNG, purchases or session writes. */
export function makeDemoPlan(session:GameSession):DemoPlan {
  const current=Object.fromEntries((session.assembly?.selections??[]).map(s=>[s.categoryId,s.optionId]));
  const hull=session.build?.selectedHullId??"falcon-shadow";
  const spent=session.build?.spent??0;
  const budget=session.finance?.totalBudget??0;
  const repair=session.engineering?.repairing??false;
  const fuelKg=fuelSettings.capacityKg;
  const fuelReserveCost=session.fueling?.completed?0:Math.ceil(Math.max(0,fuelKg-(session.fueling?.loadedKg??0))*fuelSettings.pricePerKg);
  const hullCost=session.build?.selectedHullId?0:componentById.get(hull)!.price;
  const payloads=session.science?.completed?[session.science.instrumentIds]:[
    ["multispectral-camera","advanced-sample-analyzer"],["multispectral-camera"],["panchromatic-camera"],[],
  ];
  const options=groups.map(group=>{
    let choices:Choice[]=[{ids:{},cost:0,score:0}];
    for(const categoryId of group) {
      const locked=!!current[categoryId]&&(!!session.assembly?.completed||(repair&&!session.engineering?.failedCategoryIds.includes(categoryId)));
      const list=categories.find(c=>c.id===categoryId)!.options.filter(o=>!locked||o.id===current[categoryId]);
      choices=choices.flatMap(c=>list.map(o=>({
        ids:{...c.ids,[categoryId]:o.id},
        cost:c.cost+(o.id===current[categoryId]?0:o.price-(repair?0:(componentById.get(current[categoryId])?.price??0))),
        score:c.score+score(o.id),
      })));
    }
    return choices.filter(c=>compatibilityIssues(c.ids,[]).length===0);
  });
  let best:{choice:Choice;instruments:string[];additional:number;score:number}|undefined;
  let bestMinimum=Infinity;
  for(const instruments of payloads) {
    const scienceCost=session.science?.completed?0:scientificInstruments.filter(i=>instruments.includes(i.id)).reduce((s,i)=>s+i.price,0);
    const reserve=hullCost+scienceCost+fuelReserveCost;
    const minRemaining=Array(options.length+1).fill(0) as number[];
    for(let i=options.length-1;i>=0;i--)minRemaining[i]=minRemaining[i+1]+Math.min(...options[i].map(o=>o.cost));
    bestMinimum=Math.min(bestMinimum,spent+reserve+minRemaining[0]);
    let beam:Choice[]=[{ids:{},cost:0,score:0}];
    for(let i=0;i<options.length;i++) {
      const next:Choice[]=[];
      for(const state of beam)for(const choice of options[i]) {
        const cost=state.cost+choice.cost;
        if(spent+reserve+cost+minRemaining[i+1]>budget)continue;
        const ids={...state.ids,...choice.ids};
        if(compatibilityIssues(ids,instruments).length)continue;
        next.push({ids,cost,score:state.score+choice.score});
      }
      next.sort((a,b)=>b.score-a.score||a.cost-b.cost);
      beam=next.slice(0,96);
      if(!beam.length)break;
    }
    for(const choice of beam) {
      if(Object.keys(choice.ids).length!==categories.length)continue;
      const flight=makeFlightPlan(hull,choice.ids,instruments,fuelKg);
      if(flight.requiredFuelKg>fuelKg)continue;
      const scienceScore=scientificInstruments.filter(i=>instruments.includes(i.id))
        .reduce((s,i)=>s+i.quality*0.1+i.maxSciencePoints*0.1,0)+(instruments.some(id=>id.includes("camera"))?500:0);
      const totalScore=choice.score+scienceScore;
      const additional=reserve+choice.cost;
      if(!best||totalScore>best.score||(totalScore===best.score&&additional<best.additional))
        best={choice,instruments,additional,score:totalScore};
    }
  }
  if(!best)return {
    feasible:false,partIds:[],instrumentIds:[],additionalCost:Math.max(0,Number.isFinite(bestMinimum)?bestMinimum-spent:0),
    estimatedTotalSpent:Number.isFinite(bestMinimum)?bestMinimum:spent,remainingBudget:budget-spent,fuelReserveCost,recommendedFuelKg:fuelKg,
    message:"No complete compatible, fuel-feasible plan was found within the remaining budget and locked parts. Review existing choices or request mission funding; DEMO will not mark an unsafe plan as recommended.",assumptions,
  };
  return {
    feasible:true,partIds:[hull,...Object.values(best.choice.ids)],instrumentIds:best.instruments,
    additionalCost:best.additional,estimatedTotalSpent:spent+best.additional,remainingBudget:budget-spent-best.additional,
    fuelReserveCost,recommendedFuelKg:fuelKg,
    message:"Follow the highlighted parts as one balanced loadout: lower modeled damage risk, compatible integration and a reserved fuel budget. Optional instruments are highlighted in Stage 2.",assumptions,
  };
}

const cache=new Map<string,{signature:string;plan:DemoPlan}>();
export function demoPlan(session:GameSession) {
  const signature=JSON.stringify([session.build,session.assembly?.selections,session.assembly?.completed,
    session.engineering?.repairing,session.engineering?.failedCategoryIds,session.science?.completed,
    session.science?.instrumentIds,session.finance?.totalBudget,session.fueling?.completed,session.fueling?.loadedKg]);
  const existing=cache.get(session.id);
  if(existing?.signature===signature)return existing.plan;
  const plan=makeDemoPlan(session);
  if(cache.size>=200)cache.delete(cache.keys().next().value!);
  cache.set(session.id,{signature,plan});
  return plan;
}

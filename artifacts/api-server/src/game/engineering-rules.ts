import type {CompatibilityIssue} from "@workspace/api-zod";
import {componentById,rocketCatalog} from "./rocket-catalog";
import {scientificInstruments} from "./scientific-instruments";
export const ENGINEERING_DISCLAIMER="Simplified engineering training rules, not verified manufacturer compatibility. Quality tiers are game-balance values. Unverified fuel chemistry or mechanical interfaces are not treated as proven incompatibilities.";
export const tier=(quality:number|null|undefined)=>(quality??55)>85?3:(quality??55)>65?2:1;

function rawIssues(selections:Record<string,string>,instrumentIds:string[]):CompatibilityIssue[]{
  const issues:CompatibilityIssue[]=[];
  const part=(id:string)=>componentById.get(selections[id]);
  const mismatch=(id:string,loadId:string,supportId:string,label:string)=>{
    const load=part(loadId),support=part(supportId);
    if(load&&support&&tier(load.quality)>tier(support.quality))
      issues.push({id:`${id}:${load.id}:${support.id}`,title:label,
        message:`${load.name} requires integration tier ${tier(load.quality)}, but ${support.name} supports tier ${tier(support.quality)} in this training model. ${support.name} will fail the integration check.`,
        categoryIds:[loadId,supportId],optionIds:[load.id,support.id],repairCategoryId:supportId,alternatives:[],source:"GAME_RULE"});
  };
  mismatch("engine-stage","main-engines","rocket-stages","Engine / stage integration mismatch");
  mismatch("engine-tank","main-engines","fuel-tanks","Engine / tank integration mismatch");
  mismatch("lander-adapter","lunar-lander","payload-adapter","Lander / payload adapter mismatch");
  mismatch("navigation-computer","navigation-sensors","onboard-computer","Navigation / computer integration mismatch");
  const eps=part("electrical-power-system");
  const selected=scientificInstruments.filter(i=>instrumentIds.includes(i.id));
  const demand=20+selected.reduce((sum,i)=>sum+i.powerW,0);
  const capacity=eps?60+Math.max(0,(eps.quality??55)-55)*4:0;
  if(eps&&demand>capacity)issues.push({
    id:`science-power:${eps.id}:${selected.map(i=>i.id).sort().join(",")}`,title:"Science payload / power system mismatch",
    message:`${selected.map(i=>i.name).join(", ")} and baseline avionics require ${demand} model W. ${eps.name} supports ${capacity} model W. The science power bus will fail integration; upgrade the power system or reduce the optional payload.`,
    categoryIds:["electrical-power-system","scientific-instruments"],optionIds:[eps.id,...selected.map(i=>i.id)],
    repairCategoryId:"electrical-power-system",alternatives:[],source:"GAME_RULE",
  });
  return issues;
}
export function compatibilityIssues(selections:Record<string,string>,instrumentIds:string[]):CompatibilityIssue[]{
  return rawIssues(selections,instrumentIds).map(issue=>{
    const cat=rocketCatalog.flatMap(s=>s.categories).find(c=>c.id===issue.repairCategoryId);
    return {...issue,alternatives:(cat?.options??[]).filter(option=>{
      if(option.id===selections[cat!.id])return false;
      const next=rawIssues({...selections,[cat!.id]:option.id},instrumentIds);
      return !next.some(i=>i.repairCategoryId===issue.repairCategoryId)&&next.length<rawIssues(selections,instrumentIds).length;
    }).sort((a,b)=>a.price-b.price).map(o=>o.id)};
  });
}

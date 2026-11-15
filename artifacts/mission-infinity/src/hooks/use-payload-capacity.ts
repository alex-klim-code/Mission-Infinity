import { useGetGameCatalog, type GameSession } from '@workspace/api-client-react';
import { assessGameplayPayload } from '@workspace/mission-physics';
import { useMemo } from 'react';
import { usePayloadDraft } from '@/components/session/payload-draft';

/** Local draft and server selection share the same quality-based game estimate. */
export function usePayloadCapacity(session: GameSession, instrumentIds?: string[]) {
  const { input } = useGameplayPayloadInput(session, instrumentIds);
  return assessGameplayPayload(input);
}

/** One catalog mapping for both payload allowance and fuel guidance. */
export function useGameplayPayloadInput(session: GameSession, instrumentIds?: string[]) {
  const {data}=useGetGameCatalog();
  const draft=usePayloadDraft();
  const selectedInstruments=instrumentIds??draft?.ids??session.science?.instrumentIds;
  const input=useMemo(()=>{
  const selections:Record<string,string>=Object.fromEntries((session.assembly?.selections??[]).map(s=>[s.categoryId,s.optionId]));
  const ids=[...new Set([session.build?.selectedHullId,...Object.values(selections)].filter((s):s is string=>!!s))];
  const options=new Map((data?.rocketCatalog??[]).flatMap(s=>s.categories.flatMap(c=>c.options)).map(p=>[p.id,p]));
  const science=new Map((data?.scientificInstruments??[]).map(p=>[p.id,p]));
  return {
    components:ids.map(id=>options.get(id)??{id,name:id,categoryId:'unknown',massKg:null}),
    instruments:(selectedInstruments??[]).map(id=>science.get(id)??{id,massKg:null}),
    fuelKg:session.fueling?.opened?session.fueling.loadedKg:null,
    profile:data?.payloadProfiles?.[selections['rocket-stages']],
  };
  },[data,session.assembly?.selections,session.build?.selectedHullId,selectedInstruments,session.fueling?.opened,session.fueling?.loadedKg]);
  return {input,catalogReady:!!data};
}

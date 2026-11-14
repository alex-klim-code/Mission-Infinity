import { useGetGameCatalog, type GameSession } from '@workspace/api-client-react';
import { assessGameplayPayload } from '@workspace/mission-physics';
import { usePayloadDraft } from '@/components/session/payload-draft';

/** Local draft and server selection share the same quality-based game estimate. */
export function usePayloadCapacity(session: GameSession, instrumentIds?: string[]) {
  const {data}=useGetGameCatalog();
  const draft=usePayloadDraft();
  const selections:Record<string,string>=Object.fromEntries((session.assembly?.selections??[]).map(s=>[s.categoryId,s.optionId]));
  const ids=[...new Set([session.build?.selectedHullId,...Object.values(selections)].filter((s):s is string=>!!s))];
  const options=new Map((data?.rocketCatalog??[]).flatMap(s=>s.categories.flatMap(c=>c.options)).map(p=>[p.id,p]));
  const science=new Map((data?.scientificInstruments??[]).map(p=>[p.id,p]));
  return assessGameplayPayload({
    components:ids.map(id=>options.get(id)??{id,name:id,categoryId:'unknown',massKg:null}),
    instruments:(instrumentIds??draft?.ids??session.science?.instrumentIds??[]).map(id=>science.get(id)??{id,massKg:null}),
    fuelKg:session.fueling?.opened?session.fueling.loadedKg:null,
    profile:data?.payloadProfiles?.[selections['rocket-stages']],
  });
}

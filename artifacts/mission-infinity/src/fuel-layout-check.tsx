import {useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {getGameCatalog,getGetGameCatalogQueryKey} from '@workspace/api-client-react';
import {PrefsProvider} from './lib/prefs';
import {FuelStage} from './components/session/fuel-stage';
import {SessionTopBar} from './components/session/session-shared';
import {CrewBar} from './components/session/crew-bar';
import type {Props} from './components/session/rocket-shared';
import './index.css';
const catalog=await getGameCatalog();
const qc=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});
qc.setQueryData(getGetGameCatalogQueryKey(),catalog);
const props={session:{id:'fuel-layout-verification',status:'MISSION_STARTED',hostId:'fixture',players:[],scene:0,revision:1,
  build:{spent:391000700,elapsedMonths:35},science:{opened:true,completed:true,instrumentIds:[],proposals:[],spent:0},
  fueling:{opened:true,completed:false,connected:true,loading:false,capacityKg:30000,targetKg:30000,loadedKg:30000,spent:240000,rateKgPerSecond:1500,pricePerKg:8,fuelType:'RP-1 / LOX (training simulation)'}},
  mission:{...catalog.missions[0],title:'LUNA — Lunar Sample Return',budget:400000000},me:'fixture',isHost:true,pending:false,act:(_input:unknown,after?:()=>void)=>after?.()} as unknown as Props;
const rect=(e:Element|null)=>e?.getBoundingClientRect();
function Check(){
  useEffect(()=>{const id=requestAnimationFrame(()=>requestAnimationFrame(()=>{
    const header=document.querySelector('[data-testid="bar-session-top"]')!;
    const footer=document.querySelector('[data-testid="bar-crew"]')!;
    const initial={headerTop:rect(header)!.top,footerBottom:rect(footer)!.bottom};
    window.scrollTo(0,1000);
    if(location.search.includes('scroll'))document.querySelector<HTMLElement>('[aria-label="Fuel dashboard and quantity"]')?.scrollTo(0,10000);
    const button=document.querySelector<HTMLButtonElement>('[data-testid="button-fuel-confirm"]')!;
    const b=rect(button)!;
    console.log('Fuel layout check',JSON.stringify({viewport:[innerWidth,innerHeight],headerTop:rect(header)!.top,footerBottom:rect(footer)!.bottom,stable:initial.headerTop===rect(header)!.top&&initial.footerBottom===rect(footer)!.bottom,titleLeft:rect(document.querySelector('[data-testid="text-mission-name"]'))?.left,crewLeft:rect(document.querySelector('[aria-label="Crew"]'))?.left,confirmVisible:b.top>=rect(header)!.bottom&&b.bottom<=rect(footer)!.top,confirmEnabled:!button.disabled,button:[b.top,b.bottom],footerTop:rect(footer)!.top,documentScroll:document.documentElement.scrollHeight>innerHeight+1,horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1}));
  }));return()=>cancelAnimationFrame(id);},[]);
  return <main className="fixed inset-0 flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-background">
    <SessionTopBar session={props.session} mission={props.mission} me={undefined} act={props.act} pending={false} onOpenBadge={()=>{}}/>
    <div className="flex min-h-0 flex-1 overflow-hidden"><div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"><FuelStage {...props}/></div>
      <aside className="scroll-thin hidden w-80 shrink-0 overflow-y-auto border-l border-white/10 p-4 md:block"><div className="kicker">Your rocket</div>{Array.from({length:22},(_,n)=><p key={n} className="mt-4 border-b border-white/10 py-2 font-mono text-xs">Rocket characteristics {n+1}</p>)}</aside></div>
    <CrewBar session={props.session} meId="fixture" flag={()=>({label:'Ready',on:false})} onOpenBadge={()=>{}}><div className="h-8" aria-hidden/></CrewBar>
  </main>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={qc}><PrefsProvider><Check/></PrefsProvider></QueryClientProvider>);

import { useMemo, useRef, useState, type RefObject } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Lock, Rocket, ShoppingCart } from 'lucide-react';
import type { RocketCategory, RocketComponent, RocketSection } from '@workspace/api-client-react';
import { imgUrl } from '@/lib/game';
import { cn } from '@/lib/utils';
import { useEngineeringGuard } from './engineering-guard';
import { BODY_CATEGORY, categoryIcon, damageRiskOf, fmtKg, fmtRisk, fmtSigned, formatExact, hullById, isRepairLocked, shortDescription, type Props } from './rocket-shared';
import { PartArt, partKind } from '@/components/visual/part-art';
import { OptionDialog } from './rocket-option-dialog';
import { useDemoGuide } from '@/hooks/use-demo-guide';
import { DEMO_RING, DemoChoiceBadge, DemoGuidePanel } from './demo-guide';
import { Breadcrumb, RootOverview, SectionOverview, type Crumb } from './rocket-overviews';

type NavProps = { sections: RocketSection[]; official: Map<string, string>; byOption: Map<string, RocketComponent>; props: Props; remaining: number };
const READY = '__ready__';

export function Navigator({ sections, official, byOption, props, remaining }: NavProps) {
  const flat = useMemo(() => sections.flatMap((s) => s.categories.map((c) => ({ sec: s, cat: c }))), [sections]);
  const hullBought = !!props.session.build?.selectedHullId;
  const { guard } = useEngineeringGuard();
  const demo = useDemoGuide(props.session, props.me);
  const demoIds = demo.enabled && demo.plan?.feasible ? demo.plan.partIds : undefined;
  const repair = props.session.engineering?.repairing ? props.session.engineering : undefined;
  const [catId, setCatId] = useState<string>(() => {
    if (repair) { const f = flat.find((x) => repair.failedCategoryIds.includes(x.cat.id) && !official.has(x.cat.id)) ?? flat.find((x) => repair.failedCategoryIds.includes(x.cat.id)); if (f) return f.cat.id; }
    if (!hullBought) return flat.find((x) => x.cat.id === BODY_CATEGORY)?.cat.id ?? flat[0]?.cat.id ?? READY;
    return flat.find((x) => !official.has(x.cat.id))?.cat.id ?? flat.find((x) => x.cat.id === BODY_CATEGORY)?.cat.id ?? flat[0]?.cat.id ?? READY;
  });
  const [optId, setOptId] = useState<string | null>(null);
  const openRef = useRef<string | null>(null);
  openRef.current = optId;
  const advancedRef = useRef(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const headRef = useRef<HTMLHeadingElement>(null);

  const idx = flat.findIndex((x) => x.cat.id === catId);
  const currentCategoryRef = useRef(catId);
  currentCategoryRef.current = catId;
  const entry = idx >= 0 ? flat[idx] : undefined;
  const sec = entry?.sec;
  const cat = entry?.cat;
  const dialogCat = optId ? flat.find((x) => x.cat.options.some((o) => o.id === optId))?.cat : undefined;
  const dialogOpt = optId ? dialogCat?.options.find((o) => o.id === optId) ?? byOption.get(optId) : undefined;

  const [view, setView] = useState<'root' | 'section' | 'category'>('category');
  const viewRef = useRef(view);
  viewRef.current = view;
  const [secId, setSecId] = useState<string | null>(null);
  const viewSec = sections.find((s) => s.id === secId);
  const goto = (id: string) => { setCatId(id); setOptId(null); setView('category'); };
  const openRoot = () => { setOptId(null); setView('root'); };
  const openSection = (id: string) => { setOptId(null); setSecId(id); setView('section'); };
  const step = (d: number) => { const n = flat[idx + d]; if (n) goto(n.cat.id); };
  const advanceFrom = (fromCat: string) => {
    const i = flat.findIndex((x) => x.cat.id === fromCat);
    const needsRepair=(x:typeof flat[number])=>x.cat.id!==fromCat&&!!repair?.failedCategoryIds.includes(x.cat.id)&&!official.has(x.cat.id);
    const next=repair?(flat.slice(i+1).find(needsRepair)??flat.find(needsRepair)):flat[i+1];
    setCatId(next?.cat.id ?? READY);
    setView('category');
  };
  const onSelected = (forOpt: string, fromCat: string) => () => {
    if (openRef.current !== forOpt) return; // dialog was closed meanwhile: no navigation
    advancedRef.current = true;
    setOptId(null);
    advanceFrom(fromCat);
  };
  const doneCount = flat.filter((x) => official.has(x.cat.id)).length;
  const root: Crumb = { label: 'Rocket Builder', onClick: openRoot, testId: 'crumb-root' };
  const crumbs: Crumb[] = view === 'root' ? [root]
    : view === 'section' && viewSec ? [root, { label: viewSec.name, testId: 'crumb-section' }]
    : sec && cat ? [root, { label: sec.name, onClick: () => openSection(sec.id), testId: 'crumb-section' }, { label: cat.name, testId: 'crumb-category' }]
    : [root, { label: 'Configuration review', testId: 'crumb-ready' }];

  return (
    <div className="pb-6">
      <div className="flex justify-end">
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground" data-testid="text-nav-progress">{doneCount}/{flat.length} categories set</span>
      </div>
      {repair && (
        <div className="mt-2 rounded-md border border-burn/40 bg-burn/[.07] p-3 text-sm" data-testid="panel-repair-banner">
          <div className="kicker text-burn">Repair / attempt {repair.attempt}</div>
          <p className="mt-1 text-muted-foreground">Replace the failed parts: <span className="text-foreground" data-testid="text-repair-categories">{flat.filter((x) => repair.failedCategoryIds.includes(x.cat.id)).map((x) => x.cat.name).join(', ') || 'none'}</span>. Working parts and the hull are kept and locked. Replacements are charged at full price; broken parts are not refunded.</p>
        </div>
      )}
      {demo.enabled && <div className="mt-2"><DemoGuidePanel plan={demo.plan} loading={demo.loading} error={demo.error} refetch={demo.refetch} /></div>}
      {!hullBought && <p className="mt-1 text-sm text-muted-foreground">Start with the rocket body. Other parts unlock once it is bought.</p>}

      <Breadcrumb items={crumbs} />

      {view === 'root' ? (
        <RootOverview sections={sections} official={official} onSection={openSection} />
      ) : view === 'section' && viewSec ? (
        <SectionOverview section={viewSec} official={official} byOption={byOption} hullBought={hullBought} onCategory={goto} />
      ) : catId === READY || !cat ? (
        <ReadyPanel done={doneCount} total={flat.length} isHost={props.isHost} onBack={() => flat.length && goto(flat[flat.length - 1].cat.id)} headRef={headRef} />
      ) : (
        <CategoryPanel
          cat={cat} secName={sec?.name ?? ''} pos={sec ? sec.categories.indexOf(cat) + 1 : 0} of={sec?.categories.length ?? 0}
          official={official} byOption={byOption} remaining={remaining} props={props} hullBought={hullBought} headRef={headRef} demoIds={demoIds}
          onPrev={idx > 0 ? () => step(-1) : undefined} onNext={() => (flat[idx + 1] ? step(1) : goto(READY))}
          onOpen={(id) => { openerRef.current = document.activeElement as HTMLElement; setOptId(id); }}
          onPurchase={(id) => guard({ kind: 'part', categoryId: cat.id, optionId: id, after: () => {
            if (currentCategoryRef.current !== cat.id || viewRef.current !== 'category') return;
            advanceFrom(cat.id);
            requestAnimationFrame(() => headRef.current?.focus());
          } })}
        />
      )}

      <OptionDialog
        option={dialogOpt} category={dialogCat} props={props} official={official} byOption={byOption} remaining={remaining}
        demoRecommended={!!dialogOpt && !!demoIds?.includes(dialogOpt.id)}
        onSelected={dialogOpt && dialogCat ? onSelected(dialogOpt.id, dialogCat.id) : undefined}
        onClose={() => setOptId(null)}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          if (advancedRef.current) { advancedRef.current = false; headRef.current?.focus(); }
          else openerRef.current?.focus();
        }}
      />
    </div>
  );
}

function CategoryPanel({ cat, secName, pos, of, official, byOption, remaining, props, hullBought, headRef, onPrev, onNext, onOpen, onPurchase, demoIds }: {
  demoIds?: string[];
  cat: RocketCategory; secName: string; pos: number; of: number; official: Map<string, string>; byOption: Map<string, RocketComponent>; remaining: number; props: Props; hullBought: boolean;
  headRef: RefObject<HTMLHeadingElement | null>; onPrev?: () => void; onNext: () => void; onOpen: (id: string) => void; onPurchase: (id: string) => void;
}) {
  const Icon = categoryIcon(cat);
  const body = cat.id === BODY_CATEGORY;
  const proposals = body
    ? (props.session.build?.votes ?? []).filter((v) => v.playerId === props.me).map((v) => v.hullId)
    : (props.session.assembly?.proposals ?? []).filter((p) => p.categoryId === cat.id && p.playerId === props.me).map((p) => p.optionId);
  const navBtn = 'inline-flex h-9 items-center gap-1.5 rounded-md border border-white/15 bg-void/60 px-3 text-xs uppercase tracking-wider transition-colors hover:border-ion hover:text-ion focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ion disabled:opacity-40';
  return (
    <section className="mt-5" data-testid={`panel-category-${cat.id}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-ion/30 bg-ion/10 text-ion"><Icon className="h-5 w-5" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-[.22em] text-muted-foreground" data-testid="text-current-section">{secName} / {pos} of {of}</div>
          <h2 ref={headRef} tabIndex={-1} className="font-display text-2xl font-bold uppercase leading-tight outline-none [overflow-wrap:anywhere]" data-testid="text-category-name">{cat.name}</h2>
        </div>
        <div className="flex gap-1.5">
          <button type="button" className={navBtn} disabled={!onPrev} onClick={onPrev} data-testid="button-prev-category"><ArrowLeft className="h-3.5 w-3.5" /> Back</button>
          <button type="button" className={navBtn} onClick={onNext} data-testid="button-next-category">Next <ArrowRight className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      {!body && !hullBought && <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" /> Buy the rocket body first. You can still review every part.</p>}
      {body && hullBought && <p className="mt-3 text-xs text-muted-foreground">The body is already bought. Review the three hulls freely; it cannot be bought again.</p>}
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid={`grid-options-${cat.id}`}>
        {cat.options.map((o) => {
          const sel = official.get(cat.id) === o.id;
          const mine = proposals.includes(o.id);
          const hull = body ? hullById(o.id) : undefined;
          const price = hull?.price ?? o.price;
          const currentPrice = byOption.get(official.get(cat.id) ?? '')?.price ?? 0;
          const repairLocked = isRepairLocked(props.session, cat.id);
          const locked = !!props.session.assembly?.completed || repairLocked || (body ? hullBought : !hullBought);
          const overBudget = price - currentPrice > remaining;
          const purchaseDisabled = !props.isHost || props.pending || locked || sel || overBudget;
          const purchaseReason = repairLocked ? 'Working part kept' : sel ? 'Purchased' : locked ? 'Locked' : !props.isHost ? 'Leader only' : overBudget ? 'Insufficient budget' : undefined;
          const desc = shortDescription(o);
          const demoPick = !!demoIds?.includes(o.id);
          return (
            <li key={o.id} className="flex min-w-0 flex-col">
              <button type="button" onClick={() => onOpen(o.id)} aria-haspopup="dialog"
                className={cn('group relative flex h-full w-full min-w-0 flex-col overflow-hidden rounded-lg border bg-void/70 text-left transition-[border-color,transform,background-color] duration-200 hover:-translate-y-0.5 hover:border-ion/50 hover:bg-ion/[.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ion',
                  sel ? 'border-burn/70 bg-burn/[.06]' : demoPick ? 'border-[hsl(44_95%_60%)]/70' : 'border-white/10', demoPick && DEMO_RING)}
                data-testid={`button-option-${o.id}`}>
                {hull ? (
                  <div className="relative flex h-48 items-end justify-center bg-gradient-to-b from-ion/[.06] to-transparent pt-3">
                    <div className="absolute inset-x-10 bottom-2 h-4 rounded-full bg-burn/25 blur-xl transition-opacity group-hover:opacity-100" />
                    <img src={imgUrl(hull.image)} alt={`${hull.name} rocket`} loading="lazy" className="relative h-full w-auto object-contain transition-transform duration-300 group-hover:scale-[1.03]" data-testid={`img-option-${o.id}`} />
                  </div>
                ) : (
                  <div className="relative flex h-24 items-center justify-center overflow-hidden border-b border-white/[.04] bg-[radial-gradient(ellipse_at_50%_80%,hsl(186_92%_56%/.10),transparent_70%)]" data-testid={`icon-option-${o.id}`}>
                    <PartArt kind={partKind(cat)} live={sel} className="h-20 w-32" />
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] uppercase tracking-widest text-muted-foreground/50">Schematic</span>
                  </div>
                )}
                <div className="flex min-w-0 flex-1 flex-col p-3.5">
                  <div className="flex items-start gap-2">
                    <span className="min-w-0 flex-1 font-display text-sm font-bold uppercase leading-snug tracking-wide [overflow-wrap:anywhere]" data-testid={`text-option-card-name-${o.id}`}>{o.name}</span>
                    {sel && <CheckCircle2 className="h-4 w-4 shrink-0 text-burn" aria-label="Official choice" />}
                  </div>
                  {desc && <p className={cn('mt-1.5 text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]', hull ? 'line-clamp-2' : 'line-clamp-3')} data-testid={`text-option-card-desc-${o.id}`}>{desc}</p>}
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pt-3">
                    <span className="font-mono text-xs text-ion" data-testid={`text-option-card-price-${o.id}`}>{formatExact(price)}</span>
                    {damageRiskOf(o, cat) != null && <span className="w-full font-mono text-[10px] text-[hsl(44_95%_60%)]" title="Game damage risk, rolled once after lunar arrival" data-testid={`text-option-card-risk-${o.id}`}>Game risk {fmtRisk(damageRiskOf(o, cat)!)}{o.quality == null ? ' (est.)' : ''}</span>}
                    {!hull && <span className="font-mono text-[10px] text-muted-foreground">{o.massKg == null ? 'Mass: no data' : fmtKg(o.massKg)}</span>}
                  </div>
                  {(sel || mine || demoPick) && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {demoPick && <DemoChoiceBadge />}
                      {sel && <span className="rounded-sm bg-burn/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-burn">Official</span>}
                      {mine && <span className="rounded-sm bg-ion/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-ion">Your proposal</span>}
                    </div>
                  )}
                </div>
              </button>
              <button type="button" disabled={purchaseDisabled} onClick={() => onPurchase(o.id)}
                aria-label={`Purchase ${o.name}`} title={purchaseReason}
                className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-burn/50 bg-burn/15 px-3 py-2 font-display text-xs font-bold uppercase tracking-wider text-burn transition-colors hover:bg-burn/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burn disabled:cursor-not-allowed disabled:opacity-45"
                data-testid={`button-purchase-option-${o.id}`}>
                <ShoppingCart className="h-3.5 w-3.5" /> Purchase{purchaseReason ? ` · ${purchaseReason}` : currentPrice > 0 ? ` · ${fmtSigned(price - currentPrice)}` : ''}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ReadyPanel({ done, total, isHost, onBack, headRef }: { done: number; total: number; isHost: boolean; onBack: () => void; headRef: RefObject<HTMLHeadingElement | null> }) {
  const ready = done === total && total > 0;
  return (
    <section className="glass hud-corners mt-6 rounded-lg p-5" data-testid="panel-builder-ready">
      <div className="kicker flex items-center gap-2"><Rocket className="h-3.5 w-3.5" /> Configuration review</div>
      <h2 ref={headRef} tabIndex={-1} className="mt-1 font-display text-2xl font-bold uppercase outline-none" data-testid="text-ready-title">
        {ready ? 'Configuration ready' : 'End of the catalog'}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground" data-testid="text-ready-status">
        {ready
          ? isHost ? `All ${total} categories are set. Use Finish rocket in the assembly panel when the crew is satisfied.` : `All ${total} categories are set. The Leader finishes the rocket.`
          : `${done} of ${total} categories are set. Every category needs an official part before the Leader can finish.`}
      </p>
      <button type="button" onClick={onBack} className="mt-4 inline-flex items-center gap-1.5 text-sm text-ion hover:underline" data-testid="button-ready-back"><ArrowLeft className="h-4 w-4" /> Back to last category</button>
    </section>
  );
}

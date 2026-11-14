import { Paged } from './paged';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowRight, Loader2, RefreshCw, ShieldAlert, Wrench } from 'lucide-react';
import { usePreviewEngineering, useGetGameCatalog, type CompatibilityIssue, type EngineeringAdvice, type RocketComponent } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { HudButton } from '@/components/ui-kit';
import { errMsg } from '@/lib/game';
import { cn } from '@/lib/utils';
import { purchaseRocketPart } from '@/lib/rocket-purchase';
import { recordMissionNotifications } from '@/hooks/use-mission-notifications';
import { BODY_CATEGORY, categoryIcon, formatExact, hullById, isRepairLocked, type Props } from './rocket-shared';

/** A purchase waiting for the engineering preview. Nothing is charged until `run`. */
export type GuardCandidate =
  | { kind: 'part'; categoryId: string; optionId: string; after?: () => void }
  | { kind: 'science'; instrumentIds: string[]; after?: () => void };

type Ctx = { guard: (c: GuardCandidate) => void; checking: boolean };
const GuardContext = createContext<Ctx | null>(null);

/** Use inside EngineeringGuardProvider. Falls back to no-op outside (never buys unchecked). */
export function useEngineeringGuard(): Ctx {
  return useContext(GuardContext) ?? { guard: () => undefined, checking: false };
}

type State =
  | { phase: 'idle' }
  | { phase: 'checking'; c: GuardCandidate }
  | { phase: 'error'; c: GuardCandidate; message: string }
  | { phase: 'issues'; c: GuardCandidate; advice: EngineeringAdvice };

export function EngineeringGuardProvider({ props, byOption, children }: { props: Props; byOption: Map<string, RocketComponent>; children: ReactNode }) {
  const preview = usePreviewEngineering();
  const catalog = useGetGameCatalog();
  const [state, setState] = useState<State>({ phase: 'idle' });
  const seq = useRef(0);
  const propsRef = useRef(props); propsRef.current = props;
  const mutateRef = useRef(preview.mutate); mutateRef.current = preview.mutate;

  const run = useCallback((c: GuardCandidate, acceptedIssueIds?: string[]) => {
    const p = propsRef.current;
    if (c.kind === 'part') purchaseRocketPart(p, c.categoryId, c.optionId, c.after, acceptedIssueIds);
    else if (p.isHost && !p.pending) p.act({ action: 'purchase-instruments', instrumentIds: c.instrumentIds, ...(acceptedIssueIds ? { acceptedIssueIds } : {}) }, c.after);
  }, []);

  const guard = useCallback((c: GuardCandidate) => {
    const p = propsRef.current;
    if (!p.isHost || p.pending) return;
    const n = ++seq.current;
    setState({ phase: 'checking', c });
    mutateRef.current(
      { id: p.session.id, data: c.kind === 'part' ? { optionId: c.optionId } : { instrumentIds: c.instrumentIds } },
      {
        onSuccess: (advice) => {
          if (n !== seq.current || p.session.id!==propsRef.current.session.id || p.me!==propsRef.current.me) return;
          recordMissionNotifications(p.session.id,p.me,(advice.easy?advice.issues:[]).map(issue=>({
            id:`preview:${c.kind==='part'?c.optionId:[...c.instrumentIds].sort().join(',')}:${issue.id}`,
            title:issue.title,message:issue.message,category:'Purchase review',severity:'warning',scope:'event',
          })));
          if (!advice.easy || advice.issues.length === 0) { setState({ phase: 'idle' }); run(c); }
          else setState({ phase: 'issues', c, advice });
        },
        onError: (e) => { if (n === seq.current) setState({ phase: 'error', c, message: errMsg(e, 'Engineering review unavailable.') }); },
      },
    );
  }, [run]);

  const close = () => { seq.current++; setState({ phase: 'idle' }); };
  const instruments = catalog.data?.scientificInstruments ?? [];
  const nameOf = (id: string) => byOption.get(id)?.name ?? hullById(id)?.name ?? instruments.find((i) => i.id === id)?.name ?? id;
  const ctx = useMemo(() => ({ guard, checking: state.phase === 'checking' }), [guard, state.phase]);

  const c = state.phase === 'idle' ? null : state.c;
  const candidateName = c ? (c.kind === 'part' ? nameOf(c.optionId) : `${c.instrumentIds.length} instrument payload`) : '';

  const chooseAlt = (issue: CompatibilityIssue, altId: string) => {
    if (!c || c.kind !== 'part') return;
    const alt = byOption.get(altId);
    const categoryId = alt?.categoryId ?? issue.repairCategoryId;
    // Picking an alternative only starts a fresh preview; it never charges directly.
    guard({ kind: 'part', categoryId, optionId: altId, after: categoryId === c.categoryId ? c.after : undefined });
  };

  return (
    <GuardContext.Provider value={ctx}>
      {children}
      <Dialog open={state.phase !== 'idle'} onOpenChange={(o) => { if (!o) close(); }}>
        <DialogContent className="flex max-h-[88dvh] w-[calc(100vw-1.5rem)] max-w-xl flex-col gap-0 overflow-hidden border-burn/30 bg-card p-0" data-testid="dialog-engineering-advice">
          <div className="border-b border-white/10 p-5 pr-12">
            <div className="kicker flex items-center gap-2 text-burn"><ShieldAlert className="h-3.5 w-3.5" /> Engineering review</div>
            <DialogTitle className="mt-1 font-display text-xl font-bold uppercase leading-tight tracking-wide sm:text-2xl" data-testid="text-engineering-title">
              {state.phase === 'checking' ? 'Checking compatibility' : state.phase === 'error' ? 'Review did not complete' : 'Integration risk found'}
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              Candidate: <span className="text-foreground" data-testid="text-engineering-candidate">{candidateName}</span>. Nothing is charged until you decide.
            </DialogDescription>
          </div>
          <Paged className="min-h-0 flex-1" innerClassName="space-y-3  p-5" label="Review">
            {state.phase === 'checking' && (
              <div className="space-y-2" data-testid="status-engineering-checking">
                <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-ion"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Engineers comparing interfaces</p>
                {[0, 1].map((i) => <div key={i} className="h-14 animate-pulse rounded-md bg-white/5" />)}
              </div>
            )}
            {state.phase === 'error' && (
              <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" data-testid="alert-engineering-error">
                {state.message} The purchase was not made.
              </div>
            )}
            {state.phase === 'issues' && (
              <>
                {state.advice.issues.map((issue) => {
                  const alts = issue.alternatives.filter((id) => id !== (c?.kind === 'part' ? c.optionId : '') && !(byOption.get(id) && isRepairLocked(propsRef.current.session, byOption.get(id)!.categoryId)));
                  return (
                    <section key={issue.id} className="rounded-md border border-burn/30 bg-burn/[.06] p-3" data-testid={`card-issue-${issue.id}`}>
                      <h3 className="flex items-start gap-2 font-display text-sm font-bold uppercase tracking-wider text-burn"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{issue.title}</h3>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                        {issue.optionIds.map((id, i) => (
                          <span key={id} className="contents">
                            {i > 0 && <span className="font-mono text-[10px] uppercase text-muted-foreground">vs</span>}
                            <span className="rounded-sm border border-white/15 bg-void/70 px-1.5 py-0.5 [overflow-wrap:anywhere]" data-testid={`text-issue-part-${issue.id}-${id}`}>{nameOf(id)}</span>
                          </span>
                        ))}
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-foreground/85" data-testid={`text-issue-message-${issue.id}`}>{issue.message}</p>
                      {alts.length > 0 && (
                        <div className="mt-3">
                          <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Compatible alternatives</div>
                          <ul className="mt-1.5 space-y-1.5">
                            {alts.map((id) => {
                              const o = byOption.get(id);
                              const Icon = categoryIcon({ id: o?.categoryId ?? issue.repairCategoryId, name: o?.name ?? '' });
                              const selectable = c?.kind === 'part' && !!o && o.categoryId !== BODY_CATEGORY;
                              return (
                                <li key={id}>
                                  <button type="button" disabled={!selectable || !propsRef.current.isHost}
                                    onClick={() => chooseAlt(issue, id)}
                                    className={cn('flex w-full items-center gap-2 rounded-md border border-white/10 bg-void/70 px-2.5 py-2 text-left text-xs transition-colors', selectable && 'hover:border-ion hover:text-ion')}
                                    data-testid={`button-issue-alternative-${id}`}>
                                    <Icon className="h-3.5 w-3.5 shrink-0 text-ion" />
                                    <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{nameOf(id)}</span>
                                    {o && <span className="font-mono text-ion">{formatExact(o.price)}</span>}
                                    {selectable && <ArrowRight className="h-3.5 w-3.5 shrink-0" />}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                          {c?.kind === 'part' && <p className="mt-1 text-[10px] text-muted-foreground">Choosing an alternative runs a fresh review first.</p>}
                        </div>
                      )}
                    </section>
                  );
                })}
                {c?.kind === 'science' && <p className="text-xs text-muted-foreground">Cancel to adjust the instrument selection, or purchase anyway and accept the risk.</p>}
                <p className="flex gap-2 rounded-md border border-white/10 bg-void/60 p-2.5 text-[11px] leading-snug text-muted-foreground" data-testid="text-engineering-disclaimer">
                  <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ion" />
                  {state.advice.disclaimer || 'These are disclosed training-game rules, not verified manufacturer compatibility data.'}
                </p>
                <p className="text-[11px] text-burn/90">Buying anyway means construction will fail at integration. Repairs cost a full replacement price and extra months.</p>
              </>
            )}
          </Paged>
          <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 p-4">
            <HudButton variant="ghost" onClick={close} data-testid="button-engineering-cancel">Cancel</HudButton>
            {state.phase === 'error' && (
              <HudButton variant="ion" onClick={() => guard(state.c)} data-testid="button-engineering-retry"><RefreshCw className="h-4 w-4" /> Retry review</HudButton>
            )}
            {state.phase === 'issues' && (
              <HudButton variant="burn" disabled={props.pending}
                onClick={() => { const { c: cand, advice } = state; setState({ phase: 'idle' }); run(cand, advice.issues.map((i) => i.id)); }}
                data-testid="button-engineering-buy-anyway">
                <AlertTriangle className="h-4 w-4" /> Purchase anyway
              </HudButton>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </GuardContext.Provider>
  );
}

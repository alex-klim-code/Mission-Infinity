import { Paged } from './paged';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, FileText, Landmark, Loader2, RefreshCw, Scale, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetGameSessionQueryKey, useUpdateGameSession, type GameSession, type MissionFundingRequest } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { HudButton } from '@/components/ui-kit';
import { errMsg } from '@/lib/game';
import { cn } from '@/lib/utils';
import { formatExact } from './rocket-shared';

const MIN = 1_000_000;
const MAX = 400_000_000;
const isPending = (r: MissionFundingRequest) => r.status === 'SUBMITTED' || r.status === 'UNDER_REVIEW';

/** Request ids survive dialog close/remount until success or server reconciliation. */
const pendingIds = new Map<string, string>();
const drafts = new Map<string, { amount: string; reason: string }>();

/** One in-flight funding-tick loop while a request is pending. Any crew member may tick; it grants no decision power. */
function useFundingTicker(session: GameSession) {
  const qc = useQueryClient();
  const mut = useUpdateGameSession();
  const inflight = useRef(false);
  const [failures, setFailures] = useState(0);
  const mutateRef = useRef(mut.mutate); mutateRef.current = mut.mutate;
  const active = (session.finance?.requests ?? []).some(isPending);
  const id = session.id;

  const tick = useCallback(() => {
    if (inflight.current) return;
    inflight.current = true;
    mutateRef.current({ id, data: { action: 'funding-tick' } }, {
      onSuccess: (res) => { if (res.session) qc.setQueryData(getGetGameSessionQueryKey(id), res.session); setFailures(0); },
      onError: () => setFailures((f) => f + 1),
      onSettled: () => { inflight.current = false; },
    });
  }, [id, qc]);

  const stalled = failures >= 3;
  useEffect(() => {
    if (!active || stalled) return;
    const t = window.setInterval(tick, 1500);
    return () => window.clearInterval(t);
  }, [active, stalled, tick]);

  return { stalled: active && stalled, retry: () => { setFailures(0); tick(); } };
}

function Stages({ r }: { r: MissionFundingRequest }) {
  const decided = !isPending(r);
  const steps = [
    { label: 'Application received', icon: FileText, state: 'done' as const },
    { label: 'Committee assessment', icon: Scale, state: r.status === 'SUBMITTED' ? 'wait' as const : r.status === 'UNDER_REVIEW' ? 'active' as const : 'done' as const },
    { label: 'Decision', icon: Landmark, state: decided ? 'done' as const : 'wait' as const },
  ];
  const pct = Math.round(Math.max(0, Math.min(1, r.progress > 1 ? r.progress / 100 : r.progress)) * 100);
  return (
    <div data-testid={`status-funding-stages-${r.id}`}>
      <ol className="grid grid-cols-3 gap-1.5">
        {steps.map((s) => (
          <li key={s.label} className={cn('flex flex-col items-center gap-1 rounded-md border px-1 py-2 text-center text-[10px] uppercase tracking-wider transition-colors duration-500',
            s.state === 'done' ? 'border-ion/40 bg-ion/10 text-ion' : s.state === 'active' ? 'border-burn/50 bg-burn/10 text-burn' : 'border-white/10 text-muted-foreground')}>
            {s.state === 'active' ? <Loader2 className="h-4 w-4 animate-spin" /> : <s.icon className="h-4 w-4" />}
            <span className="leading-tight">{s.label}</span>
          </li>
        ))}
      </ol>
      {!decided && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Review progress">
          <div className="h-full origin-left bg-gradient-to-r from-burn to-ion transition-transform duration-700" style={{ transform: `scaleX(${pct / 100})` }} />
        </div>
      )}
    </div>
  );
}

function FundingDialog({ open, onOpenChange, session, isHost, ticker }: {
  open: boolean; onOpenChange: (o: boolean) => void; session: GameSession; isHost: boolean; ticker: { stalled: boolean; retry: () => void };
}) {
  const qc = useQueryClient();
  const mut = useUpdateGameSession();
  const f = session.finance;
  const key = `funding:${session.id}`;
  const [amount, setAmount] = useState(() => drafts.get(key)?.amount ?? '');
  const [reason, setReason] = useState(() => drafts.get(key)?.reason ?? '');
  const [error, setError] = useState<string | null>(null);
  const requests = f?.requests ?? [];
  const pending = requests.find(isPending);
  const used = requests.length;
  const max = f?.maxRequests ?? 3;

  // Reconcile: once the server lists our id, a fresh id is used next time.
  useEffect(() => {
    const id = pendingIds.get(key);
    if (id && requests.some((r) => r.id === id)) pendingIds.delete(key);
  }, [requests, key]);

  const save = (a: string, r: string) => drafts.set(key, { amount: a, reason: r });
  const value = Number(amount.replace(/[^0-9]/g, ''));
  const amountOk = Number.isInteger(value) && value >= MIN && value <= MAX;
  const reasonOk = reason.trim().length >= 10 && reason.length <= 600;
  const canRequest = isHost && !pending && used < max;

  const submit = () => {
    if (!canRequest || !amountOk || !reasonOk || mut.isPending) return;
    let requestId = pendingIds.get(key);
    if (!requestId) { requestId = crypto.randomUUID(); pendingIds.set(key, requestId); }
    setError(null);
    mut.mutate({ id: session.id, data: { action: 'request-funding', requestId, amount: value, reason: reason.trim() } }, {
      onSuccess: (res) => {
        pendingIds.delete(key);
        if (res.session) qc.setQueryData(getGetGameSessionQueryKey(session.id), res.session);
        setAmount(''); setReason(''); drafts.delete(key);
      },
      // Keep the same requestId so a retry is idempotent on the server.
      onError: (e) => setError(errMsg(e, 'Request did not reach the committee.')),
    });
  };

  const list = [...requests].reverse();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] w-[calc(100vw-1.5rem)] max-w-lg flex-col gap-0 overflow-hidden border-ion/25 bg-card p-0" data-testid="dialog-funding">
        <div className="border-b border-white/10 p-4 pr-12">
          <div className="kicker text-ion">Program office / simulation</div>
          <DialogTitle className="mt-1 font-display text-xl font-bold uppercase tracking-wider">Mission funding</DialogTitle>
          <DialogDescription className="mt-1 text-xs text-muted-foreground" data-testid="text-funding-disclaimer">
            A game simulation of a supplementary budget review. It is not real NASA funding, no agency is contacted and no payment is made.
          </DialogDescription>
        </div>
        <Paged className="min-h-0 flex-1" innerClassName="space-y-4  p-4" label="Funding">
          <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-white/10 bg-white/10 text-left">
            <div className="bg-void/85 p-2.5"><dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Base</dt><dd className="mt-0.5 font-mono text-xs" data-testid="text-funding-base">{formatExact(f?.baseBudget ?? 0)}</dd></div>
            <div className="bg-void/85 p-2.5"><dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Approved</dt><dd className="mt-0.5 font-mono text-xs text-ion" data-testid="text-funding-approved">+{formatExact(f?.approvedFunding ?? 0)}</dd></div>
            <div className="bg-void/85 p-2.5"><dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Total budget</dt><dd className="mt-0.5 font-mono text-xs text-burn" data-testid="text-funding-total">{formatExact(f?.totalBudget ?? 0)}</dd></div>
          </dl>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground" data-testid="text-funding-count">Requests used {used} / {max}</p>

          {ticker.stalled && (
            <div role="alert" className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive" data-testid="alert-funding-tick">
              <span className="flex-1">Lost contact with the review desk. Status updates paused.</span>
              <button type="button" onClick={ticker.retry} className="rounded border border-destructive/60 px-2 py-1 font-mono text-[10px] uppercase tracking-widest" data-testid="button-funding-tick-retry">Retry</button>
            </div>
          )}

          {isHost && !pending && used < max && (
            <form className="space-y-2 rounded-md border border-white/10 bg-void/60 p-3" onSubmit={(e) => { e.preventDefault(); submit(); }} data-testid="form-funding">
              <label className="block text-xs text-muted-foreground" htmlFor="funding-amount">Amount (USD, $1,000,000 to $400,000,000)</label>
              <input id="funding-amount" inputMode="numeric" value={amount} disabled={mut.isPending}
                onChange={(e) => { const v = e.target.value.replace(/[^0-9,]/g, '').slice(0, 13); setAmount(v); save(v, reason); }}
                placeholder="25,000,000" className="w-full rounded-md border border-white/15 bg-void/70 p-2.5 font-mono text-sm outline-none focus:border-ion/60" data-testid="input-funding-amount" />
              {amount && !amountOk && <p className="text-[11px] text-destructive">Enter whole dollars between $1,000,000 and $400,000,000.</p>}
              <label className="block text-xs text-muted-foreground" htmlFor="funding-reason">Justification</label>
              <textarea id="funding-reason" rows={3} value={reason} disabled={mut.isPending}
                onChange={(e) => { const v = e.target.value.slice(0, 600); setReason(v); save(amount, v); }}
                placeholder="Explain what the money is for and why the mission needs it." className="w-full resize-none rounded-md border border-white/15 bg-void/70 p-2.5 text-sm outline-none focus:border-ion/60" data-testid="input-funding-reason" />
              <div className="flex justify-between font-mono text-[10px] text-muted-foreground"><span>{reason.trim().length < 10 ? 'At least 10 characters' : 'Ready'}</span><span>{reason.length}/600</span></div>
              {error && (
                <div role="alert" className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive" data-testid="alert-funding-request">
                  <span className="flex-1">{error}</span>
                  <button type="button" onClick={submit} className="inline-flex items-center gap-1 rounded border border-destructive/60 px-2 py-1 font-mono text-[10px] uppercase tracking-widest" data-testid="button-funding-retry"><RefreshCw className="h-3 w-3" /> Retry</button>
                </div>
              )}
              <HudButton type="submit" variant="burn" className="w-full" disabled={!amountOk || !reasonOk || mut.isPending} loading={mut.isPending} data-testid="button-request-funding">
                <Landmark className="h-4 w-4" /> Request money for mission
              </HudButton>
            </form>
          )}
          {!isHost && <p className="text-xs text-muted-foreground" data-testid="text-funding-leader-only">Only the Leader can file a request. Everyone can follow the review here.</p>}
          {isHost && pending && <p className="text-xs text-muted-foreground">One request at a time. Wait for the committee decision.</p>}
          {used >= max && !pending && <p className="text-xs text-muted-foreground" data-testid="text-funding-limit">All {max} requests for this mission have been used.</p>}

          <section>
            <h3 className="kicker">History</h3>
            {list.length === 0 ? (
              <p className="mt-2 rounded-md border border-dashed border-white/15 p-3 text-center text-xs text-muted-foreground" data-testid="text-funding-empty">No requests filed. The mission runs on its base budget.</p>
            ) : (
              <ul className="mt-2 space-y-2" data-testid="list-funding-requests">
                {list.map((r) => (
                  <li key={r.id} className={cn('rounded-md border p-3', r.status === 'APPROVED' ? 'border-ion/40 bg-ion/[.05]' : r.status === 'DENIED' ? 'border-destructive/40 bg-destructive/[.05]' : 'border-burn/40 bg-burn/[.05]')} data-testid={`row-funding-${r.id}`}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-sm">{formatExact(r.amount)}</span>
                      <span className={cn('inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest', r.status === 'APPROVED' ? 'text-ion' : r.status === 'DENIED' ? 'text-destructive' : 'text-burn')} data-testid={`status-funding-${r.id}`}>
                        {r.status === 'APPROVED' ? <Check className="h-3 w-3" /> : r.status === 'DENIED' ? <X className="h-3 w-3" /> : null}
                        {r.status === 'UNDER_REVIEW' ? 'Under review' : r.status.toLowerCase()}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">{r.reason}</p>
                    <div className="mt-2">{isPending(r) ? <Stages r={r} /> : (
                      <p className="text-xs" data-testid={`text-funding-decision-${r.id}`}>
                        {r.status === 'APPROVED' ? <span className="text-ion">Approved. {formatExact(r.amount)} added to the mission budget.</span> : <span className="text-destructive">Refused. The budget is unchanged.</span>}
                        {r.decidedAt && <span className="ml-1 font-mono text-[10px] text-muted-foreground">{new Date(r.decidedAt).toLocaleTimeString()}</span>}
                      </p>
                    )}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Paged>
      </DialogContent>
    </Dialog>
  );
}

const roundBtn = 'relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ion';

/** Footer button + dialog + background review ticker (runs even when the dialog is closed). */
export function FundingControl({ session, meId }: { session: GameSession; meId: string }) {
  const [open, setOpen] = useState(false);
  const ticker = useFundingTicker(session);
  const pending = (session.finance?.requests ?? []).some(isPending);
  if (!session.finance) return null;
  return (
    <>
      <button type="button" className={cn(roundBtn, 'border-ion/40 bg-ion/10 text-ion hover:border-ion')} onClick={() => setOpen(true)}
        aria-label="Mission funding" title="Mission funding" data-testid="button-open-funding">
        <Landmark className="h-4 w-4" />
        {pending && <span className="absolute right-1.5 top-1.5 h-2 w-2 animate-pulse rounded-full bg-burn" aria-hidden />}
      </button>
      <FundingDialog key={`funding:${session.id}:${meId}`} open={open} onOpenChange={setOpen} session={session} isHost={session.hostId === meId} ticker={ticker} />
    </>
  );
}

import { Check, ChevronRight, Circle, Lock } from 'lucide-react';
import type { RocketComponent, RocketSection } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';
import { BODY_CATEGORY, hullById } from './rocket-shared';
import { PartArt, partKind } from '@/components/visual/part-art';
import { completionPercent, completionStats } from '@/lib/rocket-completion';

export type Crumb = { label: string; onClick?: () => void; testId: string };

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Builder path" className="mt-4" data-testid="nav-builder-breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-1 font-mono text-[11px] uppercase tracking-[.16em]">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={c.testId} className="flex min-w-0 max-w-full items-center gap-1">
              {i > 0 && <span className="shrink-0 px-1 text-muted-foreground/50" aria-hidden>/</span>}
              {last ? (
                <span aria-current="page" className="min-w-0 rounded-sm bg-burn/10 px-1.5 py-1 text-foreground [overflow-wrap:anywhere]" data-testid={c.testId}>{c.label}</span>
              ) : (
                <button type="button" onClick={c.onClick} className="min-w-0 rounded-sm px-1.5 py-1 text-left text-ion transition-colors hover:bg-ion/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ion [overflow-wrap:anywhere]" data-testid={c.testId}>
                  {c.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Bar({ pct, label, testId }: { pct: number; label: string; testId: string }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-1.5 w-full overflow-hidden rounded-full bg-white/10" data-testid={testId}>
      <div className={cn('h-full origin-left rounded-full transition-transform duration-500', pct === 100 ? 'bg-burn' : 'bg-ion')} style={{ transform: `scaleX(${pct / 100})` }} />
    </div>
  );
}

type Common = { sections: RocketSection[]; official: Map<string, string>; byOption: Map<string, RocketComponent> };

export function RootOverview({ sections, official, onSection }: Omit<Common, 'byOption'> & { onSection: (id: string) => void }) {
  const st = completionStats(sections, official);
  return (
    <section className="mt-5" data-testid="panel-builder-overview">
      <div className="glass rounded-lg p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-bold uppercase tracking-wider">Overall completion</h2>
          <span className="font-mono text-2xl text-burn" data-testid="text-overall-percent">{st.pct}%</span>
        </div>
        <div className="mt-2"><Bar pct={st.pct} label="Overall completion" testId="progress-overall" /></div>
        <p className="mt-1.5 font-mono text-[11px] text-muted-foreground" data-testid="text-overall-count">{st.done}/{st.total} categories confirmed</p>
      </div>
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {sections.map((s, i) => {
          const p = st.per[i];
          const full = p.total > 0 && p.done === p.total;
          return (
            <li key={s.id} className="min-w-0">
              <button type="button" onClick={() => onSection(s.id)} className={cn('group flex h-full w-full flex-col rounded-lg border bg-void/70 p-4 text-left transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-ion/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ion', full ? 'border-burn/50' : 'border-white/10')} data-testid={`button-section-${s.id}`}>
                <div className="flex items-start gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                  <span className="min-w-0 flex-1 font-display text-sm font-bold uppercase tracking-wider [overflow-wrap:anywhere]">{s.name}</span>
                  {full ? <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase text-burn"><Check className="h-3 w-3" /> Complete</span> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-ion" />}
                </div>
                <div className="mt-2 flex h-12 items-center gap-1" aria-hidden>
                  {s.categories.slice(0, 5).map((c) => <PartArt key={c.id} kind={partKind(c)} className={cn('h-10 w-14', official.has(c.id) ? 'opacity-100' : 'opacity-40')} />)}
                </div>
                <div className="mt-2"><Bar pct={p.pct} label={`${s.name} completion`} testId={`progress-section-${s.id}`} /></div>
                <div className="mt-1.5 flex justify-between font-mono text-[11px] text-muted-foreground">
                  <span data-testid={`text-section-count-${s.id}`}>{p.done}/{p.total}</span>
                  <span data-testid={`text-section-percent-${s.id}`}>{p.pct}%</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function SectionOverview({ section, official, byOption, hullBought, onCategory }: Omit<Common, 'sections'> & { section: RocketSection; hullBought: boolean; onCategory: (id: string) => void }) {
  const done = section.categories.filter((c) => official.has(c.id)).length;
  const pct = completionPercent(done, section.categories.length);
  return (
    <section className="mt-5" data-testid={`panel-section-${section.id}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl font-bold uppercase leading-tight [overflow-wrap:anywhere]" data-testid="text-section-name">{section.name}</h2>
        <span className="font-mono text-sm text-burn" data-testid="text-section-percent">{done}/{section.categories.length} / {pct}%</span>
      </div>
      <div className="mt-2"><Bar pct={pct} label={`${section.name} completion`} testId="progress-section" /></div>
      <ul className="mt-4 divide-y divide-white/[.06] overflow-hidden rounded-lg border border-white/10 bg-void/70">
        {section.categories.map((c) => {
          const optId = official.get(c.id);
          const name = optId ? byOption.get(optId)?.name ?? hullById(optId)?.name : undefined;
          const locked = !hullBought && c.id !== BODY_CATEGORY;
          return (
            <li key={c.id}>
              <button type="button" onClick={() => onCategory(c.id)} className="group flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-ion/[.05] focus-visible:bg-ion/[.08] focus-visible:outline-none" data-testid={`button-category-${c.id}`}>
                <span className={cn('flex h-11 w-16 shrink-0 items-center justify-center rounded-md border bg-ion/[.05] transition-colors group-hover:border-ion/40', optId ? 'border-burn/40' : 'border-white/10')}><PartArt kind={partKind(c)} className="h-9 w-14" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm [overflow-wrap:anywhere]">{c.name}</span>
                  <span className={cn('block truncate text-[11px]', name ? 'text-foreground/80' : 'text-muted-foreground/60')} data-testid={`text-category-choice-${c.id}`}>{name ?? 'Not selected'}</span>
                </span>
                {optId ? <Check className="h-4 w-4 shrink-0 text-burn" aria-label="Confirmed" />
                  : locked ? <Lock className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-label="Locked until the body is bought" />
                  : <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" aria-label="Not selected" />}
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-ion" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

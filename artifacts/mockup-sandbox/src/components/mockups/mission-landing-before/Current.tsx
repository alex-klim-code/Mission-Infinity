import { useRef } from 'react';
import './_group.css';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowDown, ArrowRight, Lock, Radio, Users } from 'lucide-react';
import { Starfield } from './_starfield';
import { Link, Wordmark, ErrorState, SkeletonBlock, errMsg, formatBudget, imgUrl, useGetGameCatalog, type Mission } from './_baseline';

const CHAPTERS = [
  { img: '/images/graduation.png', n: '01', t: 'Graduation', d: 'Where it started. Then three years on Asterion engineering teams.' },
  { img: '/images/headquarters.png', n: '02', t: 'Headquarters', d: 'Glass, steel, and a decommissioned booster in the plaza. Your badge says Mission Leader.' },
  { img: '/images/laboratory.png', n: '03', t: 'The Lab', d: 'Clean suits. Flight hardware. The first time you realize how much can go wrong.' },
  { img: '/images/director-office.png', n: '04', t: "Director's Office", d: 'One desk, one window, one decision that has been waiting for you.' },
  { img: '/images/briefing-room.png', n: '05', t: 'Briefing', d: 'Budget. Timeline. Orbit. Every number is a constraint your crew will live inside.' },
  { img: '/images/mission-control.png', n: '06', t: 'Acceptance', d: 'Every crew member signs. Then the host speaks the words: mission initiated.' },
];

const CREW = Array.from({ length: 10 }, (_, i) => `/images/portrait-${String(i + 1).padStart(2, '0')}.png`);

function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '25%']);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  return (
    <section ref={ref} className="relative flex min-h-[100dvh] items-end overflow-hidden">
      <motion.div style={{ y }} className="absolute inset-0">
        <img src={imgUrl('/images/earth-orbit.png')} alt="Satellite above Earth" className="kenburns h-full w-full object-cover opacity-80" />
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-background/70" />
      <div className="vignette absolute inset-0" />
      <Starfield density={0.5} className="mix-blend-screen" />
      <header className="absolute inset-x-0 top-0 z-20 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-10">
        <Wordmark />
        <div className="flex items-center gap-2">
          <Link href="/sign-in" className="rounded-md px-4 py-2 font-display text-xs font-semibold uppercase tracking-[.18em] text-muted-foreground hover:text-foreground" data-testid="link-sign-in">
            Sign in
          </Link>
          <Link href="/sign-up" className="rounded-md border border-ion/50 px-4 py-2 font-display text-xs font-semibold uppercase tracking-[.18em] text-ion hover:bg-ion/10" data-testid="link-sign-up-header">
            Enlist
          </Link>
        </div>
      </header>
      <motion.div style={{ opacity: fade }} className="relative z-10 mx-auto w-full max-w-7xl px-5 pb-20 md:px-10 md:pb-28">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="kicker mb-6 flex items-center gap-3">
          <span className="h-px w-10 bg-ion" /> Asterion Aerospace / Recruitment Channel 7
        </motion.div>
        <h1 className="font-display text-[15vw] font-bold uppercase leading-[.85] tracking-tight md:text-[9.5rem]">
          {['Mission', 'Infinity'].map((w, i) => (
            <motion.span key={w} className="block" initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
              {i === 1 ? (
                <>
                  <span className="text-burn">/</span>
                  {w}
                </>
              ) : (
                w
              )}
            </motion.span>
          ))}
        </h1>
        <motion.div initial={{ opacity: 0.4, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4 }} className="mt-8 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <p className="max-w-lg text-lg text-foreground/80 md:text-xl">
            Three years of engineering at Asterion Aerospace taught you the trade. Now the director is handing you your first independent mission. Lead a crew of up to four players from the director's desk to launch authority.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/sign-up" className="inline-flex min-h-12 items-center gap-2 rounded-md bg-burn px-6 font-display text-sm font-bold uppercase tracking-[.16em] text-void transition-transform hover:-translate-y-0.5" data-testid="link-cta-enlist">
              Start your journey <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/sign-in" className="inline-flex min-h-12 items-center gap-2 rounded-md border border-ion/50 px-6 font-display text-sm font-semibold uppercase tracking-[.16em] text-ion hover:bg-ion/10" data-testid="link-cta-google">
              Sign in with Google
            </Link>
            <a href="#missions" className="inline-flex min-h-12 items-center gap-2 rounded-md border border-white/20 px-6 font-display text-sm font-semibold uppercase tracking-[.16em] hover:border-ion" data-testid="link-cta-missions">
              Mission files <ArrowDown className="h-4 w-4" />
            </a>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

function MissionTile({ m, i }: { m: Mission; i: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ delay: i * 0.08 }}
      className={`group relative overflow-hidden rounded-lg border ${m.enabled ? 'border-ion/40 md:col-span-2 md:row-span-2' : 'border-white/10'}`}
      data-testid={`card-mission-${m.id}`}
    >
      <img src={imgUrl(m.image)} alt={m.title} className={`absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 ${m.enabled ? '' : 'grayscale-[.6] opacity-60'}`} />
      <div className="absolute inset-0 bg-gradient-to-t from-void via-void/60 to-transparent" />
      <div className={`relative flex h-full flex-col justify-end p-6 ${m.enabled ? 'min-h-[440px] md:p-10' : 'min-h-[210px]'}`}>
        <div className="mb-auto flex items-center justify-between">
          <span className="font-mono text-xs tracking-[.25em] text-ion">MISSION {m.number}</span>
          {m.enabled ? (
            <span className="flex items-center gap-1.5 rounded-sm bg-burn px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-void">
              <Radio className="h-3 w-3" /> Open for crews
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-sm border border-white/20 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <Lock className="h-3 w-3" /> Coming soon
            </span>
          )}
        </div>
        <h3 className={`font-display font-bold uppercase ${m.enabled ? 'text-4xl md:text-6xl' : 'text-2xl'}`}>{m.title}</h3>
        <p className="mt-1 text-sm text-foreground/70">{m.subtitle}</p>
        {m.enabled && (
          <>
            <p className="mt-4 max-w-xl text-foreground/80">{m.description}</p>
            <dl className="mt-6 grid max-w-xl grid-cols-2 gap-px overflow-hidden rounded-md border border-white/10 bg-white/10 sm:grid-cols-4">
              {[
                ['Budget', formatBudget(m.budget)],
                ['Build', `${m.developmentMonths} mo`],
                ['Ops', `${m.operationalYears} yr`],
                ['Orbit', m.destination],
              ].map(([k, v]) => (
                <div key={k} className="bg-void/80 p-3">
                  <dt className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{k}</dt>
                  <dd className="mt-1 font-display text-lg font-semibold text-ion">{v}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </div>
    </motion.article>
  );
}

export default function Current() {
  const { data, isLoading, error, refetch } = useGetGameCatalog();
  const missions = [...(data?.missions ?? [])].sort((a, b) => Number(b.enabled) - Number(a.enabled));
  return (
    <div className="grain relative overflow-x-hidden bg-background">
      <Hero />

      <section className="relative mx-auto max-w-7xl px-5 py-28 md:px-10">
        <div className="grid gap-12 md:grid-cols-[1fr_1.4fr]">
          <div>
            <div className="kicker mb-4">The premise</div>
            <h2 className="font-display text-4xl font-bold uppercase leading-tight md:text-5xl">Not a dashboard. A first day on the job.</h2>
          </div>
          <div className="space-y-5 text-lg text-foreground/75">
            <p>Mission: Infinity is a cooperative story game about the people who build spacecraft. You graduated, spent three years as an engineer at Asterion Aerospace, a fictional company with very real constraints, and have just been promoted to Mission Leader.</p>
            <p>
              Every scene is synchronized across your crew. When the director speaks, everyone hears it together. When the briefing lands, everyone reads the same numbers. Nobody moves on until the crew is ready.
            </p>
            <p className="text-base text-muted-foreground">Phase 1 covers the story, the briefing, and mission acceptance. It ends the moment your crew initiates the mission, before spacecraft design and simulation, which arrive in a later phase.</p>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-y border-white/[.06] py-20">
        <div className="mx-auto mb-10 flex max-w-7xl items-end justify-between px-5 md:px-10">
          <div>
            <div className="kicker mb-3">The engineers</div>
            <h2 className="font-display text-3xl font-bold uppercase md:text-4xl">Ten faces. One is yours.</h2>
          </div>
          <span className="hidden font-mono text-xs text-muted-foreground md:block">AGES 21 TO 60 / ANY BACKGROUND</span>
        </div>
        <div className="flex w-max gap-4 marquee">
          {[...CREW, ...CREW].map((src, i) => (
            <div key={i} className="relative h-64 w-48 shrink-0 overflow-hidden rounded-lg border border-white/10 md:h-80 md:w-60">
              <img src={imgUrl(src)} alt="Asterion engineer" className="h-full w-full object-cover" loading="lazy" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-void to-transparent p-3 font-mono text-[10px] tracking-[.2em] text-ion">
                ENGINEER-{String((i % 10) + 1).padStart(2, '0')}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-5 py-28 md:px-10">
        <div className="kicker mb-4">Six scenes, played together</div>
        <h2 className="mb-14 max-w-3xl font-display text-4xl font-bold uppercase md:text-5xl">From the graduation stage to mission control.</h2>
        <div className="grid gap-5 md:grid-cols-6">
          {CHAPTERS.map((c, i) => (
            <motion.div
              key={c.n}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: (i % 3) * 0.1 }}
              className={`group relative overflow-hidden rounded-lg border border-white/10 ${i === 0 || i === 5 ? 'md:col-span-4' : 'md:col-span-2'} ${i === 3 ? 'md:col-span-4' : ''} ${i === 4 ? 'md:col-span-2' : ''}`}
            >
              <img src={imgUrl(c.img)} alt={c.t} className="h-72 w-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-void via-void/40 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <div className="font-mono text-xs text-burn">SCENE {c.n}</div>
                <div className="mt-1 font-display text-2xl font-bold uppercase">{c.t}</div>
                <p className="mt-1 max-w-md text-sm text-foreground/75">{c.d}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="missions" className="relative mx-auto max-w-7xl scroll-mt-10 px-5 pb-28 md:px-10">
        <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="kicker mb-4">Mission files</div>
            <h2 className="font-display text-4xl font-bold uppercase md:text-5xl">One mission is cleared for launch.</h2>
          </div>
          <p className="max-w-sm text-muted-foreground">The rest are still on the director's desk. Prove yourself on the first, and the Moon is next.</p>
        </div>
        {isLoading ? (
          <div className="grid gap-5 md:grid-cols-3 md:grid-rows-2">
            <SkeletonBlock className="h-[440px] md:col-span-2 md:row-span-2" />
            <SkeletonBlock className="h-52" />
            <SkeletonBlock className="h-52" />
          </div>
        ) : error ? (
          <ErrorState message={errMsg(error, 'Mission catalog is unreachable.')} onRetry={() => refetch()} />
        ) : (
          <div className="grid gap-5 md:grid-cols-3">
            {missions.map((m, i) => (
              <MissionTile key={m.id} m={m} i={i} />
            ))}
          </div>
        )}
      </section>

      <section className="relative overflow-hidden">
        <img src={imgUrl('/images/mission-control.png')} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/70 to-background" />
        <Starfield density={0.4} />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-5 py-36 text-center">
          <Users className="mb-6 h-8 w-8 text-ion" />
          <h2 className="font-display text-4xl font-bold uppercase md:text-6xl">
            Bring your crew.
            <br />
            <span className="text-burn">Or fly solo.</span>
          </h2>
          <p className="mt-6 max-w-xl text-lg text-foreground/75">One to four players per session. Find friends by name, send invitations, and start when everyone is ready.</p>
          <Link href="/sign-up" className="mt-10 inline-flex min-h-12 items-center gap-2 rounded-md bg-ion px-8 font-display text-sm font-bold uppercase tracking-[.16em] text-void transition-transform hover:-translate-y-0.5" data-testid="link-cta-bottom">
            Create your engineer <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/[.06] px-5 py-10 md:px-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground md:flex-row">
          <Wordmark small />
          <span className="font-mono text-xs">Asterion Aerospace is a fictional company. Phase 1: Earth Observer.</span>
        </div>
      </footer>
    </div>
  );
}

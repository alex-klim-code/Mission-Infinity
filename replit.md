# Mission: Infinity

A browser-based cooperative space mission story for 1–4 players.

## Product scope

- Fuel warnings are advisory only: compare documented engine/tank chemistry, mark missing chemistry as unverified, and never infer shared fuel connections across stages or claim flight certification. Preserve exact workbook fuel text for audit and display chemistry in English.

- The user's title is **Mission: Infinity**, overriding the title in the original attached brief.
- `MISSION_STARTED` opens the full **Rocket Builder** in Stage 1 — Rocket Construction. Crew members browse/propose parts independently; the Leader confirms shared purchases and completion. It remains an active, resumable mission until explicitly left.
- The Rocket Builder now includes seven sections and 28 categories. Use all 116 non-body Excel options plus the three retained hulls (119 total). The user explicitly rejected replacing those hulls with the four LUNA Frame options from Excel.
- Navigate using **Rocket Builder / Section / Category** breadcrumbs, not an all-section tab strip. Rocket Builder opens all sections with overall and per-section completion percentages; a section opens its category overview. Progress counts confirmed categories only, including the purchased body, not proposals.
- Show component cards with names, USD prices, short English descriptions and category icons; the three Rocket Body cards use their rocket images. Desktop cards are three per row. Clicking opens a full-details dialog; opening or dismissing it must never purchase. Keep the rocket preview, selected parts and total spent visible alongside the selector.
- Every Rocket Builder card also has a separate **Purchase** button for the Leader to buy directly without opening details. Keep replacement net charges/refunds visible, enforce existing locks/budget, and advance only after successful purchase. Do not show the old “Pick one part per category. Crew proposes, the Leader confirms.” instruction.
- During gameplay the header kicker shows **Stage 1 / Rocket Construction**, **Stage 2 / Scientific Instruments** or **Stage 3 / Rocket Fueling**, not the mission number or room code. Keep the mission title underneath unchanged.
- In Rocket Builder, show the Stage 1 label only in the header, without a repeated stage label or large Rocket Builder title above the breadcrumbs. Keep Rocket Builder as the clickable root of the path.
- After a successful guest proposal or Leader-confirmed purchase, close details and advance locally to the next category, continuing into the next section when appropriate. A Leader's proposal stays open for confirmation. Do not advance on failure, browsing, cancellation or other players' changes. Final rocket completion still requires the Leader's explicit approval.
- Crew members propose components; the Leader confirms purchases and may replace non-hull parts for the price difference before completion. Preserve existing hull purchases and all spent funds.
- Stage 1 ends at **Rocket Built** (design complete). New missions do not spend construction months merely by selecting parts. The Leader then opens **Stage 2 — Scientific Instruments**; preserve elapsed time already saved in older missions.
- Stage 2 offers seven optional instruments: the crew may select any subset, including all or none. The Leader's **Purchase** commits the entire selection and budget debit once, then shows **Payload Locked**; guests can propose a selection but cannot spend shared funds. An empty $0 purchase also completes the stage.
- Keep the rocket summary visible during Stage 2 and Stage 3, with the same outer header and crew footer. Use the existing compact persistent summary on small screens.
- Before Stage 3, show **Construction & Delivery** after Stage 2. Estimate 12–36 months by piecewise interpolation through the user's cost table ($50M/12, $100M/15, $150M/18, $200M/22, $250M/26, $300M/30, $350M/33, $400M/36), rounded up to whole months. Use the selected rocket parts' catalog value, excluding optional science and fuel, so identical configurations take identical time even for historical discounted purchases; do not alter payment receipts. **WAIT FOR CONSTRUCTION** runs a resumable 10-second build/delivery animation, advances the saved month counter and automatically opens Fuel on completion. Older missions already fueling bypass this new gate without losing purchases or elapsed time.
- Stage 3 is **Fuel Loading Station**, subtitle **Refuel Your Rocket Before Launch**. The Leader selects the quantity, connects the hose, holds to refuel, then confirms the load; crew observes the shared state. Persist partial fuel and costs, enforce capacity and budget, and never charge again on confirmation. The brief's example values (30,000 kg, 1,500 kg/s, $8/kg, RP-1 / LOX) are explicitly training/gameplay values, not verified engineering specifications or inferred compatibility of the selected tank.
- After Fuel, **Stage 4 — Mission Briefing** shows the fixed **Earth → Moon → Earth** route, a 28-day calendar starting on its first opening (UTC), then Mission Day and flight. The user explicitly chose the fixed route and a clearly disclosed gameplay model using selected engines, mass and fuel, not a real orbital simulator. Persist weather and confirmed date; warn for storms/strong wind but permit selection. Keep the old right rocket summary through the calendar; replace it with Rocket Status from Mission Day onward. Keep header and crew footer.
- Flight resumes from server time and consumes fuel only during departure/insertion burns, never coasting. Fuel exhaustion halts the mission; it must not grant Moon arrival or diagnostics. Effective propulsion values, missing masses and one unit per selected engine category are disclosed game assumptions, not manufacturer claims. The paid fuel receipt stays unchanged; remaining flight fuel is separate telemetry.
- At Moon arrival the Leader runs **CHECK SCIENTIFIC INSTRUMENTS LIVENESS** once (Stage 5). Persist separate instrument outcomes; use the supplied quality failure bands (3/7/12/20/30/45%). Conditional on failure, gameplay severity is 70% damaged / 30% critical. UNKNOWN becomes OPERATIONAL/DAMAGED/CRITICAL FAILURE as sequential diagnostics reveal results. Potential points retain 100%/50%/0%; diagnostics alone award no Science Points.
- Stage 6 is playable lunar descent and sample collection. The Leader adjusts engine thrust; server-time lunar-gravity integration determines landing, fuel use and a safe touchdown (at most 4 m/s, landing-legs quality at least 40). The 90-second descent window and all accelerations are explicit gameplay parameters. Missing or failed cameras show NO VIDEO SIGNAL. Landing without a camera requires selected lunar-capable inertial/star-tracker navigation; Earth-only GNSS is not sufficient. Missing optional instruments limit activities/points; no analyzer never blocks physical collection. Three unique 8-second collection sites award samples and instrument-dependent mission Science Points once, with persistence across reloads.
- Stage 7 uses the paid reserve remaining after outbound flight and lunar descent, with no refilling. Heavy launch stages/descent lander stay behind; selected return hardware, a 500 kg service allowance, ascent-system quality, collected samples and effective Isp determine the simplified return requirement. Only ascent/Earth-insertion burns consume fuel, not coasting. Fuel exhaustion visibly misses Earth; heat shield/thermal protection/capsule determine re-entry and recovery-system quality determines safe recovery. Persist failures and never grant recovery on a fuel failure.
- Stage 8 records immutable MISSION RESULTS: main-objective success requires safe Earth recovery with at least 1 kg samples. Display collected versus recovered sample mass and mission science, duration, remaining budget, success/failure explanations and weighted completion objectives: Moon 10%, landing 20%, three collection sites 20%, full instrument science program 10%, Earth return 20%, re-entry 10%, recovery 10%. Missing optional science may reduce percentage even if the main sample-return objective succeeds. All stage-changing actions remain Leader-only; preserve prior saves, receipts, header, crew footer and the right Rocket Status panel.
- Instrument prices, quality and maximum science points are gameplay-balancing figures, not verified manufacturer offers or earned science. Preserve the submitted values and show mass, power, descriptions, scientific purpose and selection totals in English.
- Do not claim actual lunar-flight compatibility, verified reliability or calculated performance from the catalog's gameplay quality score. Display known dry-mass subtotals, not an invented total/wet mass; legacy hull mass is unspecified.
- All player-facing game text must be English, including imported component descriptions, technical parameters, source-category labels, section headings and completion screens. Preserve original workbook data for audit and stable IDs for saved selections; apply English display translations separately.
- LUNA — Lunar Sample Return is the only enabled mission: $400M, Easy, 36 months of preparation, four weeks of spaceflight. Keep the legacy internal mission ID so existing rooms and chat history survive.
- Current hull prices are USD: Falcon Shadow $50,000,000, Titan Explorer $60,000,000, Nova Prime $90,000,000. Deduct these exact amounts from mission funds for new purchases. Never retroactively charge older purchases; preserve their saved spending and actual paid hull amount in configuration summaries.
- Preparation time advances only after completing full stages, never with real time. A hull choice alone does not finish the 12-month design stage; the counter remains 0/36 at this point.
- Friends and game invitations are distinct; crew chat is session-scoped, not a direct-message system.
- No guest authentication, seeded fake players, or nonfunctional primary actions.
- Product requirement: a single shared sign-in/sign-up entry screen with Google and Apple only; no email field or separate Sign Up link. Preserve OAuth callbacks and account completion. Hiding email/password UI does not disable that method in the authentication service.
- Multiplayer product rule: the person who creates the mission and invites others is Leader. Only the Leader approves stage transitions and purchases; crew members can propose builder parts and choose readiness/mission acceptance.
- Current story requirements: the first three scenes use the provided Warsaw graduation and NASA images, followed by Get a Message (mission description), Meet Your Crew (mission parameters), and Start Mission. Crew may signal readiness there; only Leader launches.
- The AI advisor is currently a private text draft only. Do not connect a model, send the draft, or invent AI responses until the user asks for that integration.
- Crew chat must be non-modal and must not block gameplay. Show live player messages as temporary notifications on the right, not as avatar speech bubbles.
- Preserve mission chat history in PostgreSQL across refreshes; expiring a right-side notification must never remove the saved message.
- Position the product as an educational space mission game for ages 14+, accessible without prior engineering knowledge and with planned beginner-to-advanced scenarios.
- Monthly missions are a goal, not an established release schedule. Never invent advisers, credentials or NASA involvement.
- Character onboarding now targets ages 14–60 (default 20), Female/Male bases, and a searchable country selector defaulting to Poland. Preserve legacy profiles and their portraits until their owner explicitly customizes them.
- Custom characters use deterministic DiceBear avatars with the same Asterion Aerospace uniform and an integrated country flag. Save appearance configuration, not generated images.
- Character creation must happen entirely inside the game, without external redirects or another provider login. The user rejected the Avaturn option for that reason; keep the built-in appearance editor as the only creation option. Retain existing saved models and profile data for compatibility, without exposing the external editor.
- Preserve all legacy character data during 3D upgrades. Activate an uploaded GLB only after validation and successful profile save; keep app authentication, age, country and multiplayer behavior unchanged.

## Run and verify

- Frontend: `pnpm --filter @workspace/mission-infinity run dev` (managed workflow).
- API: `pnpm --filter @workspace/api-server run dev` (managed workflow).
- `pnpm run typecheck` — all TypeScript packages.
- `pnpm --filter @workspace/api-server test` — disposable PostgreSQL-backed domain tests.
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas.
- `pnpm --filter @workspace/db run push` — development schema only.

## Architecture

- React, TypeScript, Vite, Tailwind, shadcn/ui, Framer Motion, TanStack Query.
- Clerk manages real sign-in and OAuth. Canonical Express middleware and production proxy are the authentication edge; Fastify owns the game API and parses request bodies.
- Kysely handles game queries and transactions. Existing Drizzle schema tooling is retained for development/publish schema integration rather than introducing a second migration executor.
- PostgreSQL stores all player, friendship, invitation, lobby and story state.
- Socket.IO uses `/api/socket.io` under the API artifact path. Cookies authenticate both HTTP and socket connections.
- One running API instance is required for socket presence and room notifications. Use an always-running VM for this version; distributed scaling needs a shared Socket.IO adapter and shared presence storage.
- No production DDL in builds or startup. Publishing applies the development schema. Startup only upserts versioned mission/character content.

## Locations

- `artifacts/mission-infinity` — frontend and generated visual assets.
- `artifacts/api-server/src/game` — game services, content and domain tests.
- `artifacts/api-server/src/routes/game.ts` — Fastify endpoints and request security.
- `lib/api-spec/openapi.yaml` — source-of-truth HTTP contract.
- `lib/db/src/schema/game.ts` — schema.
- `README.md` — setup, deployment and verification limitations.

## Reliability

- Critical transitions lock the session row in a transaction.
- Joining also locks the user, preventing concurrent membership in different rooms.
- One active membership per user and one pending invitation per room/recipient are database-enforced.
- Scene progression requires the expected current scene, preventing double clicks from skipping a scene.
- A disconnected host has a reconnect grace period; explicit leave transfers ownership immediately.
- Do not claim a successful Google OAuth round trip or multi-browser real-time verification without actually performing those checks.

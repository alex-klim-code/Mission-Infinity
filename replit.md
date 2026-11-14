# Mission: Infinity

A browser-based cooperative space mission story for 1–4 players.

## Product scope

- The user's title is **Mission: Infinity**, overriding the title in the original attached brief.
- `MISSION_STARTED` opens the full **Rocket Builder** in Etap 1 — Budowa Rakiety. Crew members browse/propose parts independently; the Leader confirms shared purchases and completion. It remains an active, resumable mission until explicitly left.
- The Rocket Builder now includes seven sections and 28 categories. Use all 116 non-body Excel options plus the three retained hulls (119 total). The user explicitly rejected replacing those hulls with the four LUNA Frame options from Excel.
- Lists show only component names and prices. Clicking opens the full details; browsing must never purchase. Keep the rocket preview, selected parts and total spent visible alongside the selector.
- Crew members propose components; the Leader confirms purchases and may replace non-hull parts for the price difference before completion. Preserve existing hull purchases and all spent funds.
- The final screen is **Rocket Built**, with no further gameplay until requested. Finishing the complete design advances preparation to 12/36 months; part selection alone does not.
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

# Mission: Infinity

A browser-based cooperative space mission story for 1–4 players.

## Product scope

- The user's title is **Mission: Infinity**, overriding the title in the original attached brief.
- Phase 1 stops at **MISSION INITIATED / TO BE CONTINUED**, with the session persisted as `MISSION_STARTED`.
- Do not add spacecraft engineering, rocket selection, orbital calculations or mission simulation in this phase.
- All game text is initially English; keep content outside UI components.
- Earth Observer is the only enabled mission. Its $150M budget, 24-month development and 3-year lifetime are fictional educational parameters, not NASA specifications.
- No chat or direct messages. Friends and game invitations are distinct.
- No guest authentication, seeded fake players, or nonfunctional primary actions.
- Product requirement: Google-only sign-in with no separate registration form. Do not confuse hiding email/password UI with disabling that method in the authentication service.
- Position the product as an educational space mission game for ages 14+, accessible without prior engineering knowledge and with planned beginner-to-advanced scenarios.
- Monthly missions are a goal, not an established release schedule. Never invent advisers, credentials or NASA involvement.
- Character onboarding now targets ages 14–60 (default 20), Female/Male bases, and a searchable country selector defaulting to Poland. Preserve legacy profiles and their portraits until their owner explicitly customizes them.
- Custom characters use deterministic DiceBear avatars with the same Asterion Aerospace uniform and an integrated country flag. Save appearance configuration, not generated images.
- The user approved the **free Avaturn pilot**, not Pro: use only standard SDK embedding/export with an owned project. Paid API sessions, programmatic appearance controls and custom 3D uniforms require renewed approval. The existing DiceBear uniform/flag describes legacy portraits only; do not imply the free 3D pilot enforces that outfit.
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

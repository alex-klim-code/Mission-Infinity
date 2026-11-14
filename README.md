# Mission: Infinity

A cinematic, cooperative browser game about becoming a mission leader at the fictional **Asterion Aerospace**. Phase 1 covers sign-in, character creation, friends, invitations, a 1–4-player lobby, six introductory scenes, a mission briefing and synchronized acceptance. It ends at **MISSION INITIATED — TO BE CONTINUED**.

There is deliberately no spacecraft engineering, rocket selection, orbital mechanics or mission simulation.

## Stack

- **Web:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Framer Motion, TanStack Query and Zustand for local preferences.
- **Game API:** Node.js, Fastify, Zod, Kysely and PostgreSQL.
- **Authentication edge:** Replit-managed Clerk with its canonical Express integration and production proxy.
- **Realtime:** authenticated Socket.IO rooms at `/api/socket.io`.
- **Database schema tooling:** the workspace's existing Drizzle schema integration.
- **Contract:** OpenAPI and generated React Query hooks/Zod schemas.

Express is retained only as the supported Clerk/proxy edge. Fastify handles the game API and body parsing. Kysely executes runtime queries; Drizzle remains the development schema source so Replit's managed publish flow can apply schema changes without a custom production migration runner. Wouter is used for browser routes to preserve the canonical managed Clerk callback setup.

## Local development in Replit

Dependencies are managed with **pnpm**:

```sh
pnpm install
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-spec run codegen
```

Run the managed **API Server** and **Mission: Infinity web** workflows. Their configuration supplies the required `PORT` and `BASE_PATH`; do not run a second server on the same port.

The frontend is at `/`, the API at `/api`, and the health endpoint at `/api/healthz`.

### Environment and authentication

Replit provides `DATABASE_URL`. Clerk setup provisions `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, and `VITE_CLERK_PUBLISHABLE_KEY` securely. Do not paste their values into source, logs or chat.

Manage Google sign-in and any custom production Google OAuth credentials through the project's **Auth** pane. The app uses dedicated `/sign-in` and `/sign-up` routes with callback subroutes. Session management and logout are owned by Clerk; no custom passwords or local authentication tokens are stored.

`CLERK_PROXY_URL`/`VITE_CLERK_PROXY_URL` are managed for production by the platform. Empty proxy configuration in development is expected. Do not hardcode a production domain or proxy environment override.

Development and production authentication are separate user stores. A development user does not automatically become a published-app user.

## Content and game state

`artifacts/api-server/src/game/content.ts` defines the initial missions, ten character preset IDs, story and briefing. Startup transactionally upserts this content; it does **not** create or alter database tables.

The initial PostgreSQL SQL migration and schema snapshot are retained under `lib/db/drizzle/` for review. Development uses schema push; production schema application remains owned by the publish flow.

The database persists:

- Clerk identity mapping (no authentication secrets).
- Character name, fictional age, gender and appearance ID.
- Pending/accepted friendships, with canonical participant ordering.
- Sessions, current scene, status, host and revision.
- Membership, readiness, scene readiness and mission acceptance.
- Independent mission invitations with a 30-minute expiration.

There are no seeded player accounts. Test identities are disposable and removed after tests.

### Rules

- Solo begins at the first story scene; cooperative play begins in a lobby.
- A lobby holds 1–4 players. Only the host starts it. Connected non-host crew must be ready.
- Only accepted friends can be invited. Room codes are display identifiers, not authorization credentials.
- An invitation is required to join a private lobby. No late joins after story start.
- Only the host advances scenes and initiates the mission.
- Concurrent scene advances require the same expected-scene value; only one can succeed.
- All connected players must accept before the final screen.
- Explicit host departure transfers ownership. Temporary socket loss has a 15-second grace period; reconnecting players recover persisted state.
- Every mutation is checked by the server, not just hidden or disabled in the UI.

Pending friend requests and accepted friendships share one relationship table, preventing inverse duplicate requests. Story progress and acceptances are stored with session and membership rows to keep critical transitions atomic.

## Verification

```sh
pnpm run typecheck
pnpm --filter @workspace/api-server test
```

The backend test suite exercises real PostgreSQL transactions with disposable fixtures: content, character persistence/editing, duplicate-name and request prevention, friend request actions, invitation authorization/decline/expiry, concurrent joins and four-player capacity, readiness, host permissions and migration, story progression, reconnect state, acceptance, terminal transition and career history.

Anonymous HTTP checks verify that public content is accessible and protected profile endpoints return 401. This is not a substitute for a live Google OAuth browser round trip.

**Not certified by these tests:** an interactive Google sign-in/logout round trip, signed-in page rendering, simultaneous real users in separate browsers, production OAuth/domain configuration, load testing and a published deployment. These require their corresponding real environments and are not represented as completed automated checks.

## Publishing

1. Keep the managed frontend static build and API production commands in their artifact configuration.
2. Use an **always-running VM / Reserved VM** for this version's Socket.IO server. It requires a single API instance. Do not horizontally scale it without a shared Socket.IO adapter and shared presence storage.
3. Confirm Google sign-in configuration in the **Auth** pane for Production. Custom Google consent-screen branding may require production credentials there.
4. Click **Publish**. Replit applies the development-to-production schema diff through its publishing flow. Do not run development schema push commands against production or add startup/build-time DDL.
5. Verify the public health endpoint, Google sign-in, persistence after reload, logout, and a two-browser invitation/lobby/prologue flow using production accounts.

Production data is separate from development. Mission and preset content is upserted on API startup, so a fresh published database receives the catalog automatically.

The project is prepared for publication; publishing itself is a separate user action.

## Educational notice

Earth Observer's **$150,000,000** budget, **24-month** development deadline, **3-year** lifetime and low Earth orbit destination are fictional game parameters. Asterion Aerospace and Aurora Institute of Aerospace Engineering are fictional. The game is not an official NASA mission specification or an assertion of NASA endorsement.

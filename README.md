# Mission: Infinity

A cinematic, cooperative browser game about becoming a mission leader at the fictional **Asterion Aerospace**. Phase 1 covers sign-in, character creation, friends, invitations, a 1–4-player lobby, six introductory scenes, a mission briefing and synchronized acceptance. It ends at **MISSION INITIATED — TO BE CONTINUED**.

## Mission crew

The story uses a picture-first layout between the mission header and bottom crew bar. Each client puts its own player first without changing the saved crew order. The message icon toggles a compact non-modal chat panel without dimming the screen or trapping focus. Closing and reopening the panel preserves its unsent draft; changing player or session resets it. Enter sends a message and Shift+Enter adds a new line. Player messages appear as temporary right-side notifications, with at most three visible and no pointer interception over the game. The AI icon is a private, player-scoped draft notepad with no AI request or response. AI drafts are kept only in memory and disappear on reload.

The three introductory illustrations are optimized WebP objects in App Storage, served through the authenticated story-image endpoint rather than bundled into the frontend. Conversion outputs are excluded from Git and deployment. The remaining screens are **Get a Message**, **Meet Your Crew**, and **Start Mission**. Crew press Start Mission to signal readiness; the Leader's click accepts their own readiness and launches atomically once the connected crew are ready.

The mission creator is the initial **Leader**. Crew members signal readiness and accept the mission individually; only the Leader advances scenes and initiates the mission. Existing leadership succession still applies when the Leader leaves.

Every session stage has mission details, budget and timeline, live Uplink status, the current player's badge, and a confirmed exit action in its top bar. Crew avatars show their nicknames and open the corresponding employee badge.

The crew channel stores each message in PostgreSQL for its mission session. The non-modal chat panel shows saved history after refresh, including multiple messages per sender, names and timestamps. Older messages can be loaded in 50-message pages. The latest page travels with realtime session updates and fallback polling; new transmissions also appear as non-interactive notifications on the right for 12 seconds. Notification expiry never deletes history. Messages are limited to 180 characters, rate-limited per sender and readable only by active members of that mission. Remaining legacy per-member transmissions are imported idempotently, including expired ones; already-overwritten legacy messages cannot be recovered.

Publishing this feature adds `game_session_messages` through the normal managed schema comparison; existing characters and memberships are preserved. The old per-member snapshot remains for compatibility and rate limiting, not as the history source.

## Custom characters

### In-game character creation

Onboarding and Settings use the built-in appearance editor only. Players customize their face, skin tone, hairstyle and hair color inside the game, with the shared Asterion uniform and their country flag. There is no external editor, provider sign-in or scan required.

The Avaturn pilot was withdrawn because its separate login did not meet the requirement to create characters entirely inside the game. Existing models and profiles are not deleted. An existing model remains active until the player explicitly saves a replacement in-game look.

### Archived 3D compatibility

The model export and its supported metadata (avatar/body identifiers, gender and face-animation capability) are stored with the profile. The GLB itself is the appearance snapshot; no unsupported face/skin/hair parameter API is invented. GLBs and optional PNG posters are uploaded directly to App Storage, then validated and copied to immutable server-owned object keys. PostgreSQL contains upload ownership, asset references and configuration, never GLB/base64 bytes or signed export links.

Limits: 20 MiB per GLB, 1 MiB per poster, bounded model metadata/geometry, self-contained resources only, and 40 asset upload authorizations per player per day. Draft assets are owner-only; saved character assets are visible to signed-in players. Replacing an upload through its temporary PUT URL cannot change an already verified model. The additive schema retains all legacy data; only an explicit successful 3D save activates the new model, and older clients omitting `avatar3d` preserve it.

The server's App Storage client uses pinned, sidecar-compatible Google libraries. Test real direct upload, finalization and model download before upgrading their major versions.

### Appearance persistence and older portraits

Onboarding uses Identity, Age, Country and Character Customization, followed by a saved-badge confirmation. Ages are 14–60 (default 20); the initial country is Poland. A searchable ISO 3166-1 country selector controls both the personnel file and the flag sewn into the shared Asterion uniform.

Appearance configuration is stored in PostgreSQL, including its version, identity base, expression, skin tone, hairstyle, hair color, country and stable seed. SVGs are generated locally using **DiceBear Core 10.7.0** and the **Avataaars definition from DiceBear Styles 10.6.0**; these versions are pinned deliberately so an ordinary reinstall does not change saved characters. The modern DiceBear v10 `Style`/`Avatar` API differs from older `createAvatar` tutorials.

The schema extension is additive: existing portraits and profile IDs are retained. Existing profiles have no custom appearance until their owners explicitly save one. Omitting appearance from an older client's save preserves the saved custom configuration; explicitly setting it to `null` restores the legacy portrait. No bulk replacement or random backfill is performed.

The same saved configuration is returned with players in friends, invitations and sessions. Uniform flags are served locally, not from an external avatar service. DiceBear/Avataaars credits are retained in the style definition; distributed core and flag licenses are under `public/licenses` and `public/flags/LICENSE`.

For managed PostgreSQL, apply development schema changes through the normal Publish flow. Do not run the historical Drizzle SQL files against production or add startup/build migration commands. The updated age check, nullable country and nullable appearance must be included when publishing.

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

The custom-character update additionally passed 17 server/domain checks and five local avatar checks. A development browser run with two separate programmatically authenticated Clerk contexts verified onboarding, appearance saving and reloading, settings edits, friend requests, invitations, lobby and story portraits, plus the mobile creator layout. The initial-base hairstyle issue found by that run was corrected and covered by local tests.

**Not certified by these checks:** an interactive Google sign-in/logout round trip, production OAuth/domain configuration, load testing and a published deployment. Browser authentication used overridden test claims rather than the external provider. The final small tab-layout correction was checked in code, not with another browser run.

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

---
name: Build/test resource contention
description: Avoid exhausting workspace memory when browser testing and building the Three.js frontend.
---

Run production builds and workspace-wide TypeScript checks after the browser test and its recording finish, rather than in parallel.

**Why:** Browser recording processes consumed several gigabytes of this workspace's memory. Both the Three.js-heavy frontend build and a workspace-wide TypeScript check disconnected the shell and stopped managed workflows when run alongside recording. Serial builds succeeded with a bounded Node heap.

**How to apply:** Complete compiler checks before starting the browser, or wait until recording has finished. Do not assume that a workspace TypeScript check is cheap enough to overlap. If resource contention stops the services, restart the existing managed API/web workflows; do not create replacement servers or treat the resulting temporary preview failure as an application regression.

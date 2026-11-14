---
name: Build/test resource contention
description: Avoid exhausting workspace memory when browser testing and building the Three.js frontend.
---

Run the full production Vite build after the browser test and its recording finish, rather than in parallel.

**Why:** Browser recording processes consumed several gigabytes of this workspace's memory. Building the Three.js-heavy frontend concurrently disconnected the shell and stopped managed workflows. The same build succeeded after the browser test completed, with a bounded Node heap.

**How to apply:** Parallelize cheap type checks or unit tests, not full frontend builds with browser recordings. If resource contention stops the services, restart the existing managed API/web workflows; do not create replacement servers or treat the resulting temporary preview failure as an application regression.

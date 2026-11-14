---
name: Live control request budgets
description: Keep legitimate continuous piloting traffic within a bounded request allowance.
---

Treat continuous piloting updates as a separate bounded workload from profile, chat and social writes. Budget the combined cadence of background ticks and player input, not either cadence alone.

**Why:** Server-time flight and descent continue while the client is disconnected or throttled. Exhausting a legitimate input allowance can leave stale controls while the spacecraft continues moving; slowing only the background ticks does not account for simultaneous player input.

**How to apply:** When adding or changing live controls, verify a full minute of their expected combined traffic. Keep the limit per authenticated user, preserve lower limits for unrelated writes, and retain explicit interruption/retry feedback rather than silently dropping control commands.

---
name: Live control request budgets
description: Keep legitimate continuous piloting traffic within a bounded request allowance.
---

Treat continuous piloting updates as a separate bounded workload from profile, chat and social writes. Budget the combined cadence of background ticks and player input, not either cadence alone.

**Why:** Server-time flight and descent continue while the client is disconnected or throttled. Exhausting a legitimate input allowance can leave stale controls while the spacecraft continues moving; slowing only the background ticks does not account for simultaneous player input.

**How to apply:** When adding or changing live controls, verify a full minute of their expected combined traffic. Keep the limit per authenticated user, preserve lower limits for unrelated writes, and retain explicit interruption/retry feedback rather than silently dropping control commands.

Include the read requests caused by each control update in that budget, not only the control writes themselves. Keep the last successful mission visible during temporary throttling, with explicit delayed-update feedback; authentication and membership rejection must still close access.

**Why:** A sufficient control-write allowance did not prevent flight interruptions: every tick also triggered room and account refreshes, exhausting the shared read allowance and unmounting the flight screen.

**How to apply:** Coalesce realtime refreshes, avoid refreshing identity for every telemetry update, and ensure socket invalidations do not cancel a pending retry or bypass the server's retry delay.

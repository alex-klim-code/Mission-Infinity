---
name: Floating panel focus safety
description: Diagnose overlapping body portals when a floating panel stops accepting input.
---

Give sibling feature panels distinct key namespaces, even when both need the same session and player identity.

**Why:** A shared key between the chat and advisor caused repeated body portals during ordinary game polling. The overlapping copies intercepted clicks despite the source rendering only one chat panel. A fresh browser navigation was needed to discard the already-orphaned DOM.

**How to apply:** When a floating panel rejects typing, inspect its actual DOM instance count, pointer hit target, active element, and duplicate-key warnings before changing authentication or message APIs. Verify typing across polling and close/reopen, not only initial render. Keep deliberate opening focus synchronous for mobile keyboard activation.

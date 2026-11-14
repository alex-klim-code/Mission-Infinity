---
name: Viewport pagination checks
description: Non-obvious verification cases for no-scroll mission screens and animated dialogs.
---

Verify paginated content immediately after opening a dialog, without first resizing the browser. Also exercise inner pagination by pointer on the final page, where fewer items remain.

**Why:** Layouts appeared correct after a manual resize while the initial animated modal still split controls. Keyboard-only checks also missed pointer-focus jumps in nested pagination; shorter final lists changed outer page counts.

**How to apply:** For future viewport or dialog changes, verify full control visibility on at least one page, the first-open page, and stable inner/outer navigation on a phone. Absence of document scroll alone does not prove that content is usable.

Include a long-named, DEMO-recommended option in card-layout checks, not only ordinary cards. Match the available gameplay area after both header and footer are accounted for.

**Why:** The recommendation badge makes the final card taller. Testing only ordinary cards missed a last row pushed onto an unnecessary second page, leaving a large blank area.

**How to apply:** Verify every option's name and Purchase button, including the badged last option, at the reported window size. Check both a full row and an incomplete final row.

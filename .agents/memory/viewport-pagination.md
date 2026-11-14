---
name: Viewport pagination checks
description: Non-obvious verification cases for no-scroll mission screens and animated dialogs.
---

Verify paginated content immediately after opening a dialog, without first resizing the browser. Also exercise inner pagination by pointer on the final page, where fewer items remain.

**Why:** Layouts appeared correct after a manual resize while the initial animated modal still split controls. Keyboard-only checks also missed pointer-focus jumps in nested pagination; shorter final lists changed outer page counts.

**How to apply:** For future viewport or dialog changes, verify full control visibility on at least one page, the first-open page, and stable inner/outer navigation on a phone. Absence of document scroll alone does not prove that content is usable.

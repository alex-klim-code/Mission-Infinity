---
name: Viewport and dialog checks
description: Non-obvious verification cases for no-scroll mission screens and animated dialogs.
---

Verify content immediately after opening a dialog, without first resizing the browser. Also scroll internal regions to their ends on a phone.

**Why:** Layouts appeared correct after a manual resize while the initial animated modal still split controls. Absence of document scrolling did not prove that the final content or purchase controls were accessible.

**How to apply:** Check first-open layout and the bottom of each internal scroll region. Verify that dialog controls and the surrounding game header/footer stay accessible, including when nested lists overflow.

Include a long-named, DEMO-recommended option in card-layout checks, not only ordinary cards. Match the available gameplay area after both header and footer are accounted for.

**Why:** The recommendation badge makes the final card taller. Testing only ordinary cards missed inaccessible content at the end of the list.

**How to apply:** Verify every option's name and Purchase button, including the badged last option, at the reported window size. Check both a full row and an incomplete final row.

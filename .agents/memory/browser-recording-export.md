---
name: Browser recording export
description: Preflight actual recording export availability before promising a gameplay MP4.
---

Check whether the documented browser-recording export callback is exposed in the current runtime before a lengthy video capture. A browser run and screenshot markers alone are not a downloadable video.

**Why:** In a gameplay-video session, `exportBrowserRecordingClip` raised `ReferenceError` in both the durable and impure execution scopes despite being documented in the testing skill. FFmpeg was installed, but no source-video file could be retrieved through the documented export workflow.

**How to apply:** Recheck availability rather than assuming this limitation is permanent. If export remains unavailable, report the exact session limitation; do not replace requested gameplay footage with still images, simulate results, or claim an MP4 was produced.

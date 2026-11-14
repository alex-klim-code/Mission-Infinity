---
name: App Storage client compatibility
description: Google library major-version incompatibility with the canonical Replit sidecar credentials.
---

Preserve the canonical Replit sidecar credential setup and verify real storage operations when upgrading Google client libraries.

**Why:** Google Cloud Storage 9 with Google Auth 11 could issue a direct-upload URL, but reading that uploaded object failed with “Unable to detect a Project Id.” The same canonical credential setup worked with Storage 8.2 and Google Auth 9.15.1. A successful presigned upload alone therefore does not verify the integration.

**How to apply:** Exercise upload, metadata lookup, generation-pinned download and immutable copy before accepting a client major upgrade. Do not request Google service-account secrets or invent a project ID to bypass the managed sidecar.

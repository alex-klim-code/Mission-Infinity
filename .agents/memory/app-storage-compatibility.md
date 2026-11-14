---
name: App Storage client compatibility
description: Google library major-version incompatibility with the canonical Replit sidecar credentials.
---

Preserve the canonical Replit sidecar credential setup and verify real storage operations when upgrading Google client libraries.

**Why:** Google Cloud Storage 9 with Google Auth 11 could issue a direct-upload URL, but reading that uploaded object failed with “Unable to detect a Project Id.” The same canonical credential setup worked with Storage 8.2 and Google Auth 9.15.1. A successful presigned upload alone therefore does not verify the integration.

**How to apply:** Exercise upload, metadata lookup, generation-pinned download and immutable copy before accepting a client major upgrade. Do not request Google service-account secrets or invent a project ID to bypass the managed sidecar.

For small, allowlisted illustrations, buffer the storage download before sending the HTTP response rather than wiring the GCS stream directly to a browser connection.

**Why:** With Storage 8.2, cancelling a browser image request during the GCS response handshake could throw `ERR_STREAM_UNABLE_TO_PIPE` outside the route handler and terminate the API process. Adding a normal stream error listener would not catch that synchronous internal throw.

**How to apply:** Keep the small download independent of client cancellation, then send the buffer only if the response is still open. Do not apply unrestricted buffering to arbitrary user uploads or large models.

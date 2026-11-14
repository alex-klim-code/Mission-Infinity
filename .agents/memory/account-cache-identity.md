---
name: Account cache identity
description: Preserve user isolation when directly updating cached account state.
---

Direct account-cache writes must target the current user's scoped query key, not the SDK's generated base key.

**Why:** Account reads deliberately isolate signed-in identities. Writing the base entry does not update the visible account and can leave obsolete membership references active until a refetch. Updating every matching account would instead change other identities' cached state.

**How to apply:** Obtain the actual key from the shared active-account query. Use the base key for prefix invalidation or cancellation, not identity-specific writes.

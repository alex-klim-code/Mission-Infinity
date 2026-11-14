---
name: Avatar identity defaults
description: How to interpret Female/Male bases when testing or changing custom appearance.
---

Female/Male bases define starting defaults, not separate lists of permitted custom hairstyles.

**Why:** A browser check correctly found that the first Male selection inherited a provisional Female default, but also assumed that a deliberately selected bun must be invalid for Male. The user requested custom appearance without a gender-specific hairstyle restriction; that extra restriction must not be introduced by a test.

**How to apply:** Check that the first identity selection generates defaults for the selected base. Keep all offered hairstyles available afterward, and preserve deliberate custom choices when changing identity unless the player resets the appearance.

---
name: Publish check constraints
description: Safely make managed Publish recognize changed PostgreSQL CHECK rules.
---

When changing a CHECK rule, give the constraint a semantic name that reflects the new rule, and update the development constraint as well as the schema source.

**Why:** Production retained an age minimum of 21 while development and the API accepted 14. The publish diff reported no changes despite the different CHECK expressions. Renaming the development constraint to reflect the 14–60 range made Publish correctly propose dropping the old constraint and adding the widened rule, with no data-bearing structures removed.

**How to apply:** Read the real production definition through a read-only `pg_constraint` query and inspect `explainSchemaDiff`. Update only development and the schema source; verify the resulting Publish statements. The user must publish to apply the production fix. Do not add startup DDL or deploy-time schema mutation scripts, and do not narrow the game's allowed ages to conceal stale production rules.

---
name: Validation scope
description: Avoid claiming clean types when runtime-tested files are excluded from TypeScript.
---

Include newly added TypeScript tests in a compiler check, either in the application project or in a dedicated test project.

**Why:** Avatar tests passed when executed through a TypeScript runtime, but their excluded files still contained real editor errors. A green build and green runtime tests did not establish that the whole changed code was type-safe.

**How to apply:** Before reporting clean types, confirm the compiler includes changed test and configuration files. Do not hide their diagnostics by excluding them without a separate checked project.

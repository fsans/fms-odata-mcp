# AGENTS.md

When starting always read first the CLAUDE.md file

## Never forget — known unresolved bugs

- **$filter with spaces in string values**: A filter like `company eq 'Digital Dreams'`
  fails with OData error -1002. The `odataEncode()` function in `src/odata-client.ts`
  encodes spaces inside string literals as `%20`, which FileMaker rejects. See the
  "KNOWN BUG" section in CLAUDE.md for full details. This affects all filter-using
  tools and needs a dedicated fix plan.
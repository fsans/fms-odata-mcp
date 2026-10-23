# AGENTS.md

When starting always read first the CLAUDE.md file

## Never commit customer-specific names or credentials

- **Customer-specific connection names, hostnames, usernames, or deployment
  details from handoff documents must NEVER appear anywhere in this repo** —
  not in source, tests, fixtures, docs, or commit messages. They are private
  customer cases. Use fully generic fixture names in tests (e.g. `conn-a`,
  `conn-b`, `fms-a.example.com`, `user_a`) and generic wording in commit
  messages. Handoff/notes files describing customer setups stay untracked
  and are never staged or committed.

## Never forget — known FileMaker OData limitations

- **Cannot filter on the internal `id` field**: FileMaker's OData parser rejects any
  comparison operator on the reserved `id` field (`id eq`, `id gt`, `id lt`, `id ge`,
  `id le`, `id ne`) with error -1002 "syntax error in URL at: ' eq '". This is a
  FileMaker Server limitation, not a bug in this codebase. Use other fields (e.g.
  `row_id`, `uuid`) or functions like `contains()`/`startswith()` on text fields
  instead. See the "Known FileMaker OData limitations" section in CLAUDE.md.
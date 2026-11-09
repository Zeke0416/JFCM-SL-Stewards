# Ponytail — JFCM SL Stewards

Default level: full.

- Read affected routes, pages, components, Supabase calls, types, imports, and exports before editing.
- Reuse existing React components, contexts, Tailwind patterns, Supabase client, and installed libraries.
- Complete requested behavior with the least new code; avoid speculative abstractions, state libraries, and dependencies.
- Preserve authentication, church scoping, permissions, validation, accessibility, and error handling. Client route protection does not establish backend authorization.
- For money or reconciliation changes, verify rounding, exact cents, duplicates, dates, period boundaries, unmatched rows, and one-to-one allocation using representative anonymized fixtures.
- Preserve transaction history and audit behavior. Investigate consistency across related writes rather than assuming separate client requests are atomic.
- Add one focused regression test or assert-based check for nontrivial logic. No test script is currently declared; choose a minimal check suited to the change.
- Run `npm run lint` and `npm run build` for application changes, plus relevant behavior checks. Report existing failures separately from new ones.
- Mark intentional limits with `shortcut: <limit>, <when to upgrade>`.
- Update project notes when architecture or a development decision changes. Finish reports with what was checked, what was skipped, and material remaining risk.

See `PROJECT_NOTES.md` for the inspected baseline and graph refresh commands.
